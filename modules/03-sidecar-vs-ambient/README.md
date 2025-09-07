# Module 3: Sidecar vs Ambient Decision

**Duration**: 2-3 hours  
**Prerequisites**: Modules 1-2 completion  
**Customer Focus**: Choosing the right data plane architecture

## The Customer Problem

Meet **Jennifer Rodriguez**, Staff Engineer and Platform Engineering Lead at TechCorp. After seeing Sarah's security success (Module 1) and Marcus's ROI (Module 2), Jennifer faces a critical architectural decision.

### Jennifer's Situation
- **Company**: Mid-size B2B software (800 employees, 120+ microservices)
- **Role**: Building internal developer platform for 15 product teams
- **Challenge**: Need to choose data plane architecture that will scale
- **Constraints**: Limited platform team (6 people), diverse workload types
- **Pressure**: Decision affects 150+ developers and long-term platform strategy

### The Technical Dilemma
Jennifer's platform team serves diverse needs:
- **Latency-sensitive services**: Trading algorithms, real-time APIs
- **High-throughput batch jobs**: Data processing, ML training
- **Legacy applications**: Gradual modernization, minimal changes
- **New cloud-native apps**: Full service mesh feature adoption

### What Jennifer Needs
1. **Architecture guidance**: Sidecar vs ambient - when to use what?
2. **Performance data**: Concrete overhead measurements for different workloads
3. **Operational complexity**: Which approach scales better operationally?
4. **Migration strategy**: How to adopt gradually without disruption?

**Your challenge as PM**: Guide Jennifer to the right architectural choice for her diverse platform needs.

## Technical Foundation: Understanding Data Plane Architectures

Let's deeply understand both approaches so you can guide customers like Jennifer.

### Important Version and Compatibility Notes
- **Ambient Mode**: Stable as of Istio 1.22+ (March 2024)
- **AKS Compatibility**: Requires Azure CNI (not kubenet), Linux node pools
- **Node OS**: Ambient mode requires Linux nodes (Windows nodes use sidecar)
- **IPAM**: Works with Azure CNI, may need configuration with custom CNIs

### Lab Setup

```bash
make kind-down
make kind-up
```

## Exercise 1: Deploy Jennifer's Diverse Workloads

### Step 1: Create Workload Types

Deploy different application types to simulate Jennifer's diverse platform environment.

```bash
kubectl create deployment latency-sensitive --image=nginxdemos/hello --replicas=3
kubectl create deployment high-throughput --image=nginxdemos/hello --replicas=5  
kubectl create deployment legacy-app --image=tomcat:9 --replicas=2
kubectl create deployment cloud-native --image=nginx:alpine --replicas=4
```

### Step 2: Expose Services

```bash
kubectl expose deployment latency-sensitive --port=80
kubectl expose deployment high-throughput --port=80
kubectl expose deployment legacy-app --port=8080
kubectl expose deployment cloud-native --port=80
```

#### Verify: Check Workload Deployment

```bash
kubectl get pods -o wide
kubectl get services
```

You should see 14 pods total across 4 different workload types.

#### Reflection Questions
- How do these workloads differ in their requirements?
- What are the resource and performance implications of each type?

## Exercise 2: Sidecar Architecture Deep Dive

### Step 1: Install Sidecar-Based Istio

```bash
make istio-sidecar
```

### Step 2: Enable Sidecar Injection

```bash
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment latency-sensitive high-throughput legacy-app cloud-native
```

### Step 3: Wait for Rollout Completion

```bash
kubectl rollout status deployment latency-sensitive
kubectl rollout status deployment high-throughput
kubectl rollout status deployment legacy-app
kubectl rollout status deployment cloud-native
```

#### Verify: Examine Sidecar Architecture

```bash
kubectl get pods -o wide
kubectl describe pod $(kubectl get pod -l app=latency-sensitive -o jsonpath='{.items[0].metadata.name}')
```

Each pod should now have 2 containers: the application and istio-proxy.

#### Reflection Questions
- How many total containers are running now?
- What's the resource overhead per pod?
- How does this scale with Jennifer's 120+ microservices?

**What Jennifer sees with sidecars:**
- **Per-pod proxy**: Each workload gets its own Envoy instance
- **Resource overhead**: Memory and CPU per sidecar
- **Full feature set**: L7 capabilities available immediately
- **Familiar pattern**: Similar to traditional proxy deployments

## Exercise 3: Measure Sidecar Overhead

### Step 1: Check Resource Usage

```bash
kubectl top pods | grep -E "(latency-sensitive|high-throughput|legacy-app|cloud-native)"
```

### Step 2: Performance Baseline Testing

```bash
kubectl run perf-baseline --image=fortio/fortio --rm -it -- load -qps 100 -t 30s -c 10 http://latency-sensitive/
```

Record the P50, P90, P99 latency values from the output.

### Step 3: Test High-Throughput Workloads

```bash
kubectl run perf-burst --image=fortio/fortio --rm -it -- load -qps 1000 -t 10s -c 20 http://high-throughput/
```

#### Verify: Resource Consumption Analysis

```bash
kubectl get pods -o json | jq -r '.items[] | select(.metadata.labels.app) | "\(.metadata.labels.app): \(.spec.containers[] | select(.name=="istio-proxy") | .resources)"'
```

#### Reflection Questions
- What's the memory overhead per sidecar?
- How does CPU usage scale under load?
- What's the latency impact for latency-sensitive workloads?

**Performance measurements Jennifer needs:**
- **Memory overhead**: ~50MB per sidecar (baseline)
- **CPU overhead**: ~0.1 CPU cores per sidecar under load
- **Latency impact**: Typically 0.5-2ms additional latency
- **Network overhead**: Minimal for most workloads

## Exercise 4: Ambient Architecture Deep Dive

### Step 1: Clean Up Sidecar Installation

```bash
make cleanup
kubectl delete namespace istio-system --ignore-not-found
kubectl label namespace default istio-injection-
```

### Step 2: Install Ambient Mode

```bash
make istio-ambient
```

### Step 3: Enable Ambient Data Plane

```bash
kubectl label namespace default istio.io/dataplane-mode=ambient
kubectl rollout restart deployment latency-sensitive high-throughput legacy-app cloud-native
```

#### Verify: Examine Ambient Architecture

```bash
kubectl get pods -o wide
kubectl -n istio-system get daemonset ztunnel
kubectl -n istio-system get pods -l app=ztunnel
```

Notice that pods now have only 1 container (no sidecars).

#### Reflection Questions
- How many containers per pod now?
- Where is the networking functionality provided?
- What's the resource distribution across the cluster?

**What Jennifer sees with ambient:**
- **No sidecars**: Applications run with original container count
- **Shared infrastructure**: ztunnel DaemonSet handles L4 + mTLS
- **Optional L7**: Waypoint proxies deployed per-service as needed
- **Resource efficiency**: Shared proxy infrastructure

## Exercise 5: Measure Ambient Efficiency

### Step 1: Compare Resource Usage

```bash
kubectl top pods | grep -E "(latency-sensitive|high-throughput|legacy-app|cloud-native)"
```

Compare with the sidecar measurements from Exercise 3.

### Step 2: Check Ztunnel Resource Usage

```bash
kubectl -n istio-system top pods -l app=ztunnel
```

### Step 3: Test Basic Connectivity

```bash
kubectl run ambient-test --image=curlimages/curl --rm -it -- sh
```

Inside the container:

```bash
curl http://latency-sensitive/
curl http://high-throughput/
exit
```

#### Verify: mTLS Functionality

```bash
kubectl run debug --image=nicolaka/netshoot -it --rm -- bash
```

Inside debug pod:

```bash
istioctl proxy-config clusters $(hostname) --fqdn latency-sensitive.default.svc.cluster.local --direction outbound
exit
```

#### Reflection Questions
- How does resource usage compare to sidecar mode?
- What's the trade-off in terms of features available?
- How does this scale across Jennifer's node count?

**Resource efficiency Jennifer observes:**
- **No per-pod overhead**: Applications use original resource requirements
- **Shared ztunnel**: One DaemonSet per node vs per-pod sidecars
- **Selective L7**: Add waypoints only where needed

## Exercise 6: Add L7 Capabilities in Ambient

### Step 1: Deploy Waypoint for L7 Features

```bash
kubectl apply -f - <<EOF
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: cloud-native-waypoint
  labels:
    istio.io/waypoint-for: service
spec:
  gatewayClassName: istio-waypoint
  listeners:
  - name: mesh
    port: 15008
    protocol: HSTS
EOF
```

### Step 2: Apply L7 Policy

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: cloud-native-routing
spec:
  hosts: [cloud-native]
  http:
  - match:
    - headers:
        version: {exact: "v2"}
    route:
    - destination: {host: cloud-native}
      headers:
        response:
          add: {x-served-by: "waypoint-v2"}
  - route:
    - destination: {host: cloud-native}
EOF
```

### Step 3: Test L7 Functionality

```bash
kubectl run l7-test --image=curlimages/curl --rm -it -- sh
```

Inside the container:

```bash
curl -H "version: v2" http://cloud-native/ -v
curl http://cloud-native/ -v
exit
```

#### Verify: Waypoint Deployment

```bash
kubectl get gateway cloud-native-waypoint
kubectl -n istio-system get pods -l gateway.networking.k8s.io/gateway-name=cloud-native-waypoint
```

#### Reflection Questions
- Which services need L7 capabilities in Jennifer's environment?
- How does selective L7 deployment affect resource usage?
- What's the operational complexity difference?

**Jennifer's L7 decision framework:**
- **L4 + mTLS**: Use ambient mode (ztunnel only)
- **L7 policies needed**: Add waypoint for specific services
- **Gradual adoption**: Start L4, add L7 capabilities incrementally

## Exercise 7: Workload Analysis and Recommendations

### Step 1: Create Decision Matrix

```bash
cat > workload-analysis.md << EOF
## Workload Architecture Recommendations

### Latency-Sensitive Services (Trading, Real-time APIs)
**Characteristics:**
- Ultra-low latency requirements (<1ms acceptable overhead)
- High request rate (1000+ RPS)
- Simple routing needs

**Recommendation: Ambient Mode**
- Minimal latency overhead (L4 only)
- Shared ztunnel reduces per-service overhead
- Add waypoint only if L7 features required

### High-Throughput Batch Jobs (Data Processing)
**Characteristics:**  
- High CPU/memory usage
- Resource-sensitive workloads
- Basic networking needs

**Recommendation: Ambient Mode**
- No per-pod sidecar overhead
- Preserves full resources for application
- L4 security and observability sufficient

### Legacy Applications (Gradual Modernization)
**Characteristics:**
- Minimal changes acceptable
- Traditional deployment patterns
- Basic service mesh features

**Recommendation: Either (Start with Ambient)**
- Ambient: Least intrusive, gradual adoption
- Sidecar: If team prefers familiar proxy pattern

### Cloud-Native Applications (Full Feature Adoption)
**Characteristics:**
- Advanced traffic management needs
- Rich observability requirements  
- Frequent deployment updates

**Recommendation: Sidecar or Ambient + Waypoints**
- Sidecar: Immediate L7 features
- Ambient: Start L4, add waypoints as needed
EOF
```

### Step 2: Calculate Platform Costs

```bash
cat > platform-costs.md << EOF
## Jennifer's Platform: Cost Analysis

### Current Workload Profile
- 120 microservices across 15 teams
- Mix of latency-sensitive, batch, legacy, cloud-native
- 500 total pod replicas in production

### Sidecar Mode Costs
**Resource Overhead:**
- 500 sidecars × 50MB memory = 25GB additional memory
- 500 sidecars × 0.1 CPU = 50 CPU cores overhead
- Monthly cloud cost: ~$3,000 additional infrastructure

**Operational Complexity:**
- Sidecar injection debugging: 5 hours/month
- Resource planning complexity: 3 hours/month
- Performance troubleshooting: 8 hours/month

### Ambient Mode Costs  
**Resource Overhead:**
- 10 ztunnel instances (per node) × 100MB = 1GB memory
- Waypoints for 30% of services requiring L7 = 36 waypoints × 50MB = 1.8GB
- Monthly cloud cost: ~$400 additional infrastructure

**Operational Benefits:**
- Simpler resource planning: -5 hours/month saved
- Reduced troubleshooting: -6 hours/month saved
- Gradual feature adoption: -3 hours/month saved

**ROI: 87% cost reduction with ambient architecture**
EOF
```

#### Verify: Review Analysis

```bash
cat workload-analysis.md
echo "---"
cat platform-costs.md
```

#### Reflection Questions
- How do these recommendations apply to Jennifer's specific workloads?
- What are the long-term operational implications?
- How does this analysis change with different scale assumptions?

## Exercise 8: Migration Strategy Planning

### Step 1: Define Phased Approach

```bash
cat > migration-strategy.md << EOF
## Platform Migration Strategy

### Phase 1: Foundation (Month 1)
**Scope:** Infrastructure services and low-risk applications
- Install ambient mesh
- Migrate monitoring, logging services
- Validate L4 security and observability

### Phase 2: Batch Workloads (Month 2)  
**Scope:** High-throughput, resource-sensitive applications
- Migrate data processing services
- Measure resource efficiency gains
- Validate performance characteristics

### Phase 3: Legacy Applications (Month 3)
**Scope:** Traditional applications with minimal changes
- Gradual migration with extensive testing
- Focus on security and visibility gains
- Minimal operational disruption

### Phase 4: Cloud-Native with L7 (Month 4)
**Scope:** Applications requiring advanced features
- Add waypoints for services needing L7 capabilities
- Implement advanced traffic management
- Full observability and policy features

### Success Metrics:
- Zero service disruption during migration
- 80% resource overhead reduction
- Maintained or improved performance
- Increased platform team productivity
EOF
```

### Step 2: Create Decision Framework

```bash
cat > decision-framework.md << EOF
## Service Mesh Data Plane Decision Framework

### Choose Sidecar When:
✅ Need immediate L7 features across all services
✅ Team familiar with proxy-per-service patterns  
✅ Resource overhead acceptable for business value
✅ Uniform workload characteristics
✅ Advanced Envoy filters or custom extensions required

### Choose Ambient When:
✅ Resource efficiency is critical
✅ Diverse workload types (latency-sensitive + batch)
✅ Gradual feature adoption preferred
✅ Want to minimize operational complexity
✅ L4 security + selective L7 sufficient for most services

### When Either Works (Start Small):
- Small teams (< 50 services) can succeed with either approach
- Test with non-production namespaces first
- Consider hybrid: ambient for most services, sidecar for advanced use cases

### Jennifer's Specific Recommendation: **Ambient Mode**
**Rationale:**
- 60% of workloads are resource-sensitive (batch jobs)
- 25% are latency-critical (trading algorithms)  
- 15% need full L7 features (cloud-native apps)
- Platform team wants operational simplicity
EOF
```

#### Verify: Review Strategy

```bash
cat migration-strategy.md
echo "---"
cat decision-framework.md
```

#### Reflection Questions
- How does this migration approach minimize risk?
- What success metrics matter most for Jennifer's platform?
- How would you adapt this strategy for different organizational contexts?

## Exercise 9: Hybrid Deployments

### Step 1: Create Different Namespace Configurations

```bash
kubectl create namespace sidecar-workloads
kubectl create namespace ambient-workloads
kubectl label namespace sidecar-workloads istio-injection=enabled
kubectl label namespace ambient-workloads istio.io/dataplane-mode=ambient
```

### Step 2: Deploy Same Application in Both Modes

```bash
kubectl -n sidecar-workloads create deployment test-app --image=nginxdemos/hello
kubectl -n ambient-workloads create deployment test-app --image=nginxdemos/hello
kubectl -n sidecar-workloads expose deployment test-app --port=80
kubectl -n ambient-workloads expose deployment test-app --port=80
```

#### Verify: Compare Resource Usage

```bash
kubectl get pods -A -o wide | grep test-app
kubectl top pods -A | grep test-app
```

#### Reflection Questions
- How do resource patterns differ between the two modes?
- What operational considerations exist for hybrid deployments?
- When would you recommend this approach to customers?

## Customer Application: Guiding Jennifer's Decision

Practice being Jennifer's trusted advisor for this critical architectural choice.

### The Platform Engineering Perspective
*"Jennifer, choosing the right data plane architecture affects your platform for years. Let me show you how to make this decision based on your actual workload characteristics..."*

### Demo Script for Platform Team

```bash
kubectl top pods | head -20
kubectl -n istio-system top pods -l app=ztunnel
kubectl get gateway cloud-native-waypoint
kubectl run demo-test --image=curlimages/curl --rm -it -- curl -H "version: v2" http://cloud-native.default.svc.cluster.local/ -v
```

### ROI Presentation for Leadership

```bash
cat > business-case.md << EOF
## Business Case: Ambient Architecture Choice

### Financial Impact
- Infrastructure cost reduction: $2,600/month ($31,200/year)
- Platform team efficiency: 14 hours/month saved = $5,600/month
- Developer productivity: Simpler mental model, faster debugging

### Strategic Benefits
- Technology alignment with industry direction
- Operational simplicity at scale
- Flexibility for future requirements

### Risk Mitigation
- Gradual adoption minimizes deployment risk
- Shared infrastructure reduces operational complexity
- Industry-standard technology with enterprise support

**Total Annual Value: $318,000**
**Implementation Cost: $50,000 (training + migration)**
**ROI: 536% first year**
EOF
```

### Handling Platform Team Concerns

**"Is ambient production-ready?"**
- *"Ambient graduated to stable in Istio 1.22. Companies like Solo.io and Tetrate are running it in production. The L4 layer (ztunnel) is simpler and more stable than full L7 sidecars."*

**"What if we need to migrate from ambient to sidecar later?"**
- *"Both use the same control plane and APIs. Migration is changing a namespace label and restarting pods. You're not locked into either choice."*

**"How do we train teams on ambient concepts?"**
- *"Ambient is actually simpler for developers - they see fewer containers and less configuration. The complexity is hidden in the platform layer where your team manages it."*

## Key Takeaways

### Technical Understanding
- **Sidecar architecture**: Per-pod proxy, immediate L7 features, higher resource overhead
- **Ambient architecture**: Shared L4 proxy (ztunnel), optional L7 (waypoints), resource efficient
- **Hybrid deployments**: Can run both modes simultaneously during migration

### Customer Decision Framework
- **Workload characteristics**: Match architecture to application requirements
- **Resource constraints**: Ambient better for resource-sensitive environments
- **Feature requirements**: Sidecar for immediate L7, ambient for gradual adoption
- **Operational preferences**: Ambient reduces platform complexity

### PM Skills
- **Architecture guidance**: Help customers make informed technology choices
- **Business case development**: Quantify technical decisions in business terms
- **Risk assessment**: Address concerns with migration strategies and data
- **Strategic thinking**: Consider long-term platform implications

## Troubleshooting Guide

#### If ambient mode not working:
```bash
kubectl -n istio-system get pods -l app=ztunnel
kubectl -n istio-system logs daemonset/ztunnel
kubectl get namespace default -o yaml | grep labels
```

#### If waypoint proxy issues:
```bash
kubectl get gateway cloud-native-waypoint
kubectl -n istio-system get pods -l gateway.networking.k8s.io/gateway-name=cloud-native-waypoint
istioctl analyze
```

#### If performance debugging needed:
```bash
kubectl -n istio-system top pods -l app=ztunnel
kubectl run perf-debug --image=fortio/fortio --rm -it -- load -qps 10 -t 10s http://latency-sensitive/
```

## Cleanup

```bash
kubectl delete namespace sidecar-workloads ambient-workloads
kubectl delete gateway cloud-native-waypoint
kubectl delete virtualservice cloud-native-routing
kubectl delete deployment latency-sensitive high-throughput legacy-app cloud-native
kubectl delete service latency-sensitive high-throughput legacy-app cloud-native
rm -f workload-analysis.md platform-costs.md migration-strategy.md decision-framework.md business-case.md
```

## Next Steps

You now understand:
- Technical differences between sidecar and ambient architectures
- Decision framework for choosing the right approach
- Business case development for architecture decisions
- Migration strategies for platform teams

**Next module**: [Identity & Security Implementation](../04-identity-security/) - Learn how to implement enterprise-grade security policies using the architecture you've chosen.

```bash
cd ../04-identity-security
cat README.md
```

**Progress check**: Can you guide a platform engineering team through the sidecar vs ambient decision? Can you quantify the business impact of the architectural choice? If yes, you're ready to implement security in Module 4.