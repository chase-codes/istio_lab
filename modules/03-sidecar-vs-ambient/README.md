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

### Lab Setup
```bash
# Start with clean environment for comparison
make kind-down
make kind-up

# Deploy diverse workload types to simulate Jennifer's environment
kubectl create deployment latency-sensitive --image=nginx --replicas=3
kubectl create deployment high-throughput --image=httpd --replicas=5  
kubectl create deployment legacy-app --image=tomcat:9 --replicas=2
kubectl create deployment cloud-native --image=nginx:alpine --replicas=4

kubectl expose deployment latency-sensitive --port=80
kubectl expose deployment high-throughput --port=80
kubectl expose deployment legacy-app --port=8080
kubectl expose deployment cloud-native --port=80
```

### Exercise 1: Sidecar Architecture Deep Dive

```bash
# Install sidecar-based Istio
make istio-sidecar

# Enable injection for our workloads
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment latency-sensitive high-throughput legacy-app cloud-native

# Wait for rollout
kubectl rollout status deployment latency-sensitive high-throughput legacy-app cloud-native

# Examine sidecar architecture
kubectl get pods -o wide
kubectl describe pod $(kubectl get pod -l app=latency-sensitive -o jsonpath='{.items[0].metadata.name}')
```

**What Jennifer sees with sidecars:**
- **Per-pod proxy**: Each workload gets its own Envoy instance
- **Resource overhead**: Memory and CPU per sidecar
- **Full feature set**: L7 capabilities available immediately
- **Familiar pattern**: Similar to traditional proxy deployments

### Exercise 2: Measuring Sidecar Overhead

```bash
# Measure resource usage with sidecars
kubectl top pods | grep -E "(latency-sensitive|high-throughput|legacy-app|cloud-native)"

# Get detailed resource consumption
kubectl get pods -o json | jq -r '.items[] | select(.metadata.labels.app) | "\(.metadata.labels.app): \(.status.containerStatuses[] | select(.name=="istio-proxy") | .restartCount) \(.spec.containers[] | select(.name=="istio-proxy") | .resources)"'

# Test latency impact
kubectl run latency-test --image=curlimages/curl --rm -it -- sh
# Inside container:
time curl http://latency-sensitive/
time curl http://high-throughput/
```

**Performance measurements Jennifer needs:**
- **Memory overhead**: ~50MB per sidecar (baseline)
- **CPU overhead**: ~0.1 CPU cores per sidecar under load
- **Latency impact**: Typically 0.5-2ms additional latency
- **Network overhead**: Minimal for most workloads

### Exercise 3: Ambient Architecture Deep Dive

```bash
# Clean up sidecar installation
make cleanup
kubectl delete namespace istio-system --ignore-not-found
kubectl label namespace default istio-injection-

# Install ambient mode
make istio-ambient

# Move workloads to ambient data plane  
kubectl label namespace default istio.io/dataplane-mode=ambient

# Redeploy applications (no sidecars this time)
kubectl rollout restart deployment latency-sensitive high-throughput legacy-app cloud-native

# Examine ambient architecture
kubectl get pods -o wide
kubectl -n istio-system get daemonset ztunnel
kubectl -n istio-system get pods -l app=ztunnel
```

**What Jennifer sees with ambient:**
- **No sidecars**: Applications run with original container count
- **Shared infrastructure**: ztunnel DaemonSet handles L4 + mTLS
- **Optional L7**: Waypoint proxies deployed per-service as needed
- **Resource efficiency**: Shared proxy infrastructure

### Exercise 4: Measuring Ambient Efficiency

```bash
# Compare resource usage (no per-pod sidecars)
kubectl top pods | grep -E "(latency-sensitive|high-throughput|legacy-app|cloud-native)"

# Check ztunnel resource usage across nodes
kubectl -n istio-system top pods -l app=ztunnel

# Test basic connectivity and mTLS
kubectl run ambient-test --image=curlimages/curl --rm -it -- sh
# Inside container:
curl http://latency-sensitive/
curl http://high-throughput/

# Verify mTLS is working
istioctl authn tls-check latency-sensitive.default.svc.cluster.local
```

**Resource efficiency Jennifer observes:**
- **No per-pod overhead**: Applications use original resource requirements
- **Shared ztunnel**: One DaemonSet per node vs per-pod sidecars
- **Selective L7**: Add waypoints only where needed

### Exercise 5: Adding L7 Capabilities in Ambient

```bash
# Deploy waypoint for services that need L7 features
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

# Apply L7 policy to cloud-native service
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

# Test L7 functionality
curl -H "version: v2" http://cloud-native/ -v
```

**Jennifer's L7 decision framework:**
- **L4 + mTLS**: Use ambient mode (ztunnel only)
- **L7 policies needed**: Add waypoint for specific services
- **Gradual adoption**: Start L4, add L7 capabilities incrementally

## Architecture Decision Framework

### Exercise 6: Workload Analysis

```bash
# Create Jennifer's decision matrix
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

cat workload-analysis.md
```

### Exercise 7: Cost-Benefit Analysis

```bash
# Calculate Jennifer's platform costs
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

cat platform-costs.md
```

### Exercise 8: Migration Strategy Planning

```bash
# Show Jennifer's phased adoption approach
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

cat migration-strategy.md
```

## Customer Application: Guiding Jennifer's Decision

Practice being Jennifer's trusted advisor for this critical architectural choice.

### The Platform Engineering Perspective
*"Jennifer, choosing the right data plane architecture affects your platform for years. Let me show you how to make this decision based on your actual workload characteristics..."*

### Decision Framework Presentation
```bash
# Show the decision tree
cat > decision-framework.md << EOF
## Service Mesh Data Plane Decision Framework

### Choose Sidecar When:
✅ Need immediate L7 features across all services
✅ Team familiar with proxy-per-service patterns  
✅ Resource overhead acceptable for business value
✅ Uniform workload characteristics

### Choose Ambient When:
✅ Resource efficiency is critical
✅ Diverse workload types (latency-sensitive + batch)
✅ Gradual feature adoption preferred
✅ Want to minimize operational complexity

### Jennifer's Specific Recommendation: **Ambient Mode**
**Rationale:**
- 60% of workloads are resource-sensitive (batch jobs)
- 25% are latency-critical (trading algorithms)  
- 15% need full L7 features (cloud-native apps)
- Platform team wants operational simplicity
EOF

cat decision-framework.md
```

### Demo Script for Platform Team
```bash
# 1. Show resource comparison (10 minutes)
kubectl top pods | head -20
kubectl -n istio-system top pods -l app=ztunnel

# 2. Show L7 flexibility (10 minutes)  
# "You can add waypoints selectively for services that need L7 features"
kubectl get gateway cloud-native-waypoint
curl -H "version: v2" http://cloud-native/ -v

# 3. Show migration path (10 minutes)
# "Start with L4 for all services, add L7 incrementally"
```

### Handling Platform Team Concerns

**"Is ambient production-ready?"**
- *"Ambient graduated to stable in Istio 1.22. Companies like Solo.io and Tetrate are running it in production. The L4 layer (ztunnel) is simpler and more stable than full L7 sidecars."*

**"What if we need to migrate from ambient to sidecar later?"**
- *"Both use the same control plane and APIs. Migration is changing a namespace label and restarting pods. You're not locked into either choice."*

**"How do we train teams on ambient concepts?"**
- *"Ambient is actually simpler for developers - they see fewer containers and less configuration. The complexity is hidden in the platform layer where your team manages it."*

### ROI Presentation for Leadership
```bash
# Show the business case
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

cat business-case.md
```

## Advanced Architecture Concepts

### Exercise 9: Hybrid Deployments

```bash
# Show how Jennifer can run both modes in different namespaces
kubectl create namespace sidecar-workloads
kubectl create namespace ambient-workloads

kubectl label namespace sidecar-workloads istio-injection=enabled
kubectl label namespace ambient-workloads istio.io/dataplane-mode=ambient

# Deploy same app in both modes
kubectl -n sidecar-workloads create deployment test-app --image=nginx
kubectl -n ambient-workloads create deployment test-app --image=nginx

# Compare resource usage
kubectl top pods -A | grep test-app
```

### Exercise 10: Performance Benchmarking

```bash
# Set up performance testing
kubectl run perf-test --image=fortio/fortio --rm -it -- load -qps 100 -t 30s -c 10 http://latency-sensitive/

# Measure latency distribution
kubectl logs perf-test | grep "Response time histogram"

# Compare ambient vs sidecar performance metrics
# (This would show Jennifer concrete performance data for her decision)
```

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

### Ambient mode not working
```bash
# Check ztunnel status
kubectl -n istio-system get pods -l app=ztunnel
kubectl -n istio-system logs daemonset/ztunnel

# Verify namespace labels
kubectl get namespace default -o yaml | grep labels
```

### Waypoint proxy issues
```bash
# Check waypoint deployment
kubectl get gateway cloud-native-waypoint
kubectl -n istio-system get pods -l gateway.networking.k8s.io/gateway-name=cloud-native-waypoint

# Verify L7 policies
istioctl analyze
```

### Performance debugging
```bash
# Check ztunnel resource usage
kubectl -n istio-system top pods -l app=ztunnel

# Monitor application latency
kubectl exec -it perf-test -- fortio load -qps 10 -t 10s http://latency-sensitive/
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
