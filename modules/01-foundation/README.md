# Module 1: Customer Context & Networking Fundamentals

**Duration**: 2-3 hours  
**Prerequisites**: Basic familiarity with Kubernetes concepts  
**Customer Focus**: Understanding why service mesh is necessary

## The Customer Problem

Meet **Sarah Martinez**, Principal Security Architect at MegaBank Corp. She's facing a critical challenge that millions of enterprise customers share.

### Sarah's Situation
- **Company**: Fortune 100 financial services (50,000+ employees)
- **Challenge**: Implementing zero-trust security across 2,000+ microservices
- **Pressure**: Board mandate to complete zero-trust by year-end
- **Current state**: Services communicate over plaintext, no authorization policies
- **Audit finding**: "Lack of encryption and access controls between services"
- **Platform team pushback**: "We can do this with Cilium + cert-manager + OPA"

### The Business Impact
- **Compliance risk**: SOX and PCI-DSS violations
- **Security exposure**: Any compromised service can access all others
- **Audit costs**: Manual documentation and spot-checking
- **Competitive risk**: Customers demand security certifications

### What Sarah Needs
1. **Automatic encryption** between all services
2. **Identity-based access control** instead of network-based
3. **Audit trail** of all service-to-service communications
4. **Zero operational overhead** for development teams
5. **Platform team buy-in** - they have valid alternatives in mind

**Your challenge as PM**: Understand both Sarah's business problem AND the platform team's technical objections well enough to navigate the solution space credibly.

## Technical Foundation: Why Kubernetes Isn't Enough

Let's start with what Kubernetes gives us and where it falls short for customers like Sarah.

### Lab Setup
```bash
# Start with clean environment
make kind-up
kubectl cluster-info
```

### Exercise 1: Basic Kubernetes Networking

```bash
# Create two services to simulate Sarah's microservices
kubectl create deployment frontend --image=nginx
kubectl create deployment backend --image=httpd

# Scale to multiple replicas to observe load balancing
kubectl scale deployment backend --replicas=3

# Expose services
kubectl expose deployment frontend --port=80
kubectl expose deployment backend --port=80

# Verify multiple endpoints are registered for the backend
kubectl get endpoints backend -o wide
kubectl get endpointslices | grep backend

# Test basic connectivity from a toolbox pod
kubectl run debug --image=nicolaka/netshoot -it --rm -- bash

# Inside the debug pod:
# 1) Basic HTTP reachability
curl -sS http://frontend | head -n 1
curl -sS http://backend | head -n 1

# 2) DNS lookup (nslookup may show "norecurse" in some images)
# Prefer dig:
dig +short backend.default.svc.cluster.local
# If needed:
#   dig +norecurse backend.default.svc.cluster.local
#   getent hosts backend.default.svc.cluster.local

# 3) Observe client-side distribution across backend pods
# (prints the remote pod IP each request)
for i in $(seq 1 10); do \
  curl -s -o /dev/null -w '%{remote_ip}\n' http://backend; \
  sleep 0.2; \
done | sort | uniq -c
```

**What you just saw:**
- **DNS-based service discovery**: Services find each other by name
- **Automatic load balancing**: Requests distributed across multiple backend pod IPs
- **Flat networking**: Any pod can reach any service

### Exercise 2: The Security Problem

```bash
# Create a "malicious" pod to show the security issue
kubectl run attacker --image=curlimages/curl -it --rm -- sh

# Inside the attacker pod, you can access everything:
curl http://frontend
curl http://backend
curl http://kube-dns.kube-system:53

# This simulates what happens if any service gets compromised
```

**Platform team response**: *"We can fix this with default-deny NetworkPolicies and namespace isolation."*

**The credible counter**: Absolutely - NetworkPolicies are essential baseline security. However:
- They work at L3/4 (IP/port), not service identity
- Labels and IPs can drift during auto-scaling or pod restarts
- No L7 context (HTTP verbs, JWT claims, request headers)
- Cross-namespace/multi-cluster scenarios require complex RBAC + VPN wiring

**Sarah's perspective**: "Any compromised service can access our entire infrastructure. NetworkPolicies help, but I need identity-based L7 policies that survive infrastructure changes."

### Exercise 3: The Observability Gap

```bash
# Generate some traffic between services
for i in {1..10}; do
  kubectl exec deployment/frontend -- curl http://backend
  sleep 1
done

# Try to understand what's happening in your "network"
kubectl get pods -o wide
kubectl logs deployment/frontend
kubectl logs deployment/backend

# Questions you can't answer from standard Kubernetes:
# 1) Which services are talking to each other?
kubectl get pods -o wide
# You see pod IPs, but no service-to-service communication map

# 2) How much traffic is flowing between services?
kubectl top pods
# Shows CPU/memory, but no network traffic metrics per service

# 3) What's the latency between frontend and backend?
kubectl exec deployment/frontend -- time curl http://backend
# You can time individual requests, but no aggregated latency metrics

# 4) Are there any failed requests or retry patterns?
kubectl logs deployment/frontend | grep -i error
kubectl logs deployment/backend | grep -i error
# Application logs may not show network-level failures

# 5) What's the dependency graph of my applications?
kubectl get services
# Shows services exist, but not WHO calls WHOM

# 6) Security: Who accessed what, when?
# No audit trail of service-to-service access
```

**Platform team response**: *"We have Prometheus + OpenTelemetry + Jaeger for observability, plus our CNI exports flow logs."*

**The credible counter**: True, but during an incident, you need to correlate:
- CNI flow logs (IP-based, no workload identity)
- Application metrics (different metric names per team)
- Distributed traces (if developers instrumented their code)
- Kubernetes audit logs (for policy changes)

**Sarah's perspective**: "When there's a security incident, correlating 4-5 data sources increases our MTTR. We need cryptographically verifiable 'service A talked to service B' audit trails."

### Exercise 4: The Policy Enforcement Problem

```bash
# Try to implement "only frontend can talk to backend"
# With Kubernetes alone, you need NetworkPolicies:

kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    ports:
    - protocol: TCP
      port: 80
EOF

# Test basic connectivity
kubectl run attacker --image=curlimages/curl -it --rm -- curl http://backend --timeout=5
# Should fail

kubectl exec deployment/frontend -- curl http://backend --timeout=5
# Should work
```

**What worked**: Basic IP/port-based access control

Now let's try to implement more sophisticated policies:

```bash
# Try to implement "only GET requests to /status path allowed"
# NetworkPolicies can't see HTTP verbs or paths - they only see TCP/80

# Even though frontend is allowed, both of these work:
kubectl exec deployment/frontend -- curl http://backend/admin/delete
kubectl exec deployment/frontend -- curl -X POST http://backend/sensitive-data

# Try to implement "only requests with valid JWT token"
# NetworkPolicies can't see HTTP headers

kubectl exec deployment/frontend -- curl -H "Authorization: Bearer fake-token" http://backend
# Still works - NetworkPolicy doesn't validate the token

# Try to see what traffic is being blocked
kubectl logs deployment/backend
# No audit trail - you can't see WHO was denied or WHY
```

**Limitations you discovered:**
- NetworkPolicies work at **Layer 3/4** (IP addresses and ports) - can't see HTTP methods, paths, or headers
- No **Layer 7** controls - both GET /status and POST /admin/delete are treated the same
- No **identity-based** access - relies on pod labels (can drift during auto-scaling)
- No **encryption** of traffic - all communication is plaintext
- No **audit trail** - can't see who was denied access or why

```bash
# Let's prove the plaintext issue
kubectl exec deployment/frontend -- curl -v http://backend 2>&1 | grep "TCP_NODELAY"
# You can see the actual HTTP headers in plaintext

# And show the identity drift problem
kubectl scale deployment frontend --replicas=0
kubectl scale deployment frontend --replicas=1
# New frontend pod gets same label but different IP - policy still works, but no cryptographic identity
```

**Platform team response**: *"Actually, Cilium NetworkPolicy supports L7 - HTTP methods, paths, even Kafka topics. And we can use cert-manager + SPIRE for automatic mTLS certificates."*

**The credible counter**: While true, this requires:
- Learning and maintaining separate control planes (Cilium, cert-manager, SPIRE, OPA)
- Correlating policy violations across multiple systems during incidents
- Managing certificate rotation in multiple places
- Stitching together telemetry from CNI flow logs, app metrics, and tracing backends

**Sarah's perspective**: "NetworkPolicies are a start, but at our scale (2,000+ services), the operational complexity of managing multiple systems becomes the bottleneck to zero-trust adoption."

## The Service Mesh Solution Preview

Now let's see what changes when we add Istio to solve Sarah's problems.

### Exercise 5: Adding Service Mesh

```bash
# Install Istio
make istio-sidecar

# Redeploy applications with sidecar injection
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment frontend backend

# Check what changed
kubectl get pods -o wide
kubectl describe pod $(kubectl get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}')
```

**What you're seeing:**
- Each pod now has **two containers**: your app + istio-proxy (Envoy)
- The proxy handles **all network traffic** for your application
- Your application code **didn't change**

### Exercise 6: Automatic Security

```bash
# Enable strict mTLS (mutual TLS)
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
spec:
  mtls:
    mode: STRICT
EOF

# Test connectivity - still works!
kubectl exec deployment/frontend -- curl http://backend

# But now it's encrypted with automatic certificates
istioctl authn tls-check backend.default.svc.cluster.local
```

**Platform team response**: *"We could achieve this with cert-manager + SPIRE injecting mTLS certs into workloads."*

**The credible counter**: Yes, and many sophisticated teams do exactly this. The operational overhead emerges when you consider:
- Certificate rotation across thousands of services (different lifetimes, CAs, trust bundles)
- Application-level TLS library integration and updates
- Cross-cluster/multi-cloud trust boundary management
- Correlating cert validation failures with application errors

**Sarah's perspective**: "All my service traffic is now encrypted without any code changes AND my ops team manages it from one control plane!"

### Exercise 7: Rich Authorization Policies

```bash
# Implement "only GET requests to /status allowed"
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: backend-authz
spec:
  selector:
    matchLabels:
      app: backend
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/default"]
    to:
    - operation:
        methods: ["GET"]
        paths: ["/status"]
EOF

# Test different requests
kubectl exec deployment/frontend -- curl http://backend/status  # Should work
kubectl exec deployment/frontend -- curl -X POST http://backend/data  # Should fail
```

**Platform team response**: *"OPA Gatekeeper can validate admission policies, and Cilium NetworkPolicy supports HTTP methods and paths."*

**The credible counter**: True, but:
- OPA operates at admission time (deploy-time), not runtime request-time
- Cilium L7 policies still rely on pod labels (can drift) rather than cryptographic workload identity
- Policy violations scattered across CNI logs, OPA audit logs, and application logs
- Each system has different policy syntax and debugging approaches

**Sarah's perspective**: "Now I have fine-grained, identity-based access control with unified policy language and audit trails!"

### Exercise 8: Instant Observability

```bash
# Open Kiali to see service topology
make kiali

# Generate some traffic
for i in {1..20}; do
  kubectl exec deployment/frontend -- curl http://backend/status
  sleep 1
done

# In Kiali, you can now see:
# - Service dependency graph
# - Real-time traffic flow
# - Success/error rates
# - Response times
```

**Platform team response**: *"We can build service topology with Prometheus service discovery and Jaeger traces."*

**The credible counter**: Absolutely, and this works well when:
- Developers consistently instrument their applications
- Metric naming is standardized across teams
- Trace sampling doesn't miss critical security events
- Multiple observability backends are correlated during incidents

**Sarah's perspective**: "I can see exactly which services are communicating with cryptographic identity verification, and prove it to auditors with single-pane observability!"

## Customer Application: Explaining the Value

Now practice explaining what you just learned to Sarah.

### The Business Problem
*"Sarah, you mentioned that auditors found a lack of encryption and access controls. Let me show you how service mesh solves this..."*

### The Technical Solution
*"Istio adds a proxy to each service that handles security transparently. Your developers don't change any code, but you get enterprise-grade security."*

### The Demo
```bash
# Show the before/after
# Before: Plaintext communication, no policies
# After: Encrypted communication, fine-grained policies

# Show the audit trail
kubectl logs $(kubectl get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}') -c istio-proxy | grep backend
```

### Handling Objections

**"This looks complex"**
- *"The complexity is in the infrastructure, not your applications. Your developers see no difference, but you get enterprise security."*

**"We can do this with CNI + PKI + OPA"**
- *"Absolutely - many sophisticated teams take that approach. Service mesh consolidates those control planes. The question is: at 2,000+ services, do you want to manage certificate rotation, policy syntax, and incident correlation across 4-5 systems, or from one?"*

**"What about performance?"**
- *"Typical overhead is less than 1ms. Let me show you the metrics..."*

**"What if the mesh breaks?"**
- *"The proxies fail open - your applications continue working, you just lose the security and observability features temporarily."*

**"Lock-in concerns"**
- *"Fair point. Service mesh gives you portable policies and gradual adoption - you can start with a few namespaces and keep your existing CNI/PKI for baseline security."*

## Key Takeaways

### Technical Understanding
- **Kubernetes + CNI + PKI + OPA**: Can achieve encryption, L7 policies, and observability through multiple specialized tools
- **Service mesh value**: Consolidates these capabilities into a single control plane with cryptographic workload identity
- **Adoption strategy**: Keep baseline NetworkPolicies; add mesh for unified policy/observability/audit at scale

### Customer Insights
- **Enterprise security**: Requires L7 policies, identity-based access, and audit trails
- **Operational complexity**: At 1000+ services, managing multiple control planes becomes the bottleneck
- **Compliance**: Single source of truth for audit trails accelerates regulatory validation

### PM Skills
- **Steel man arguments**: Acknowledge sophisticated alternatives before positioning your solution
- **Scale-based value**: Frame mesh as consolidation layer, not replacement for all networking tools
- **Credible objection handling**: Show deep understanding of alternatives and their operational trade-offs

## Troubleshooting Guide

### Pods not starting after Istio installation
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name> -c istio-init
```

### mTLS connectivity issues
```bash
istioctl authn tls-check <service>.<namespace>.svc.cluster.local
kubectl logs <pod-name> -c istio-proxy | grep TLS
```

### Authorization policies not working
```bash
istioctl analyze
kubectl logs <pod-name> -c istio-proxy | grep RBAC
```

## Next Steps

You now understand:
- Why customers need service mesh (operational complexity at scale, not Kubernetes limitations)
- How sophisticated platform teams can achieve similar outcomes with multiple tools
- When service mesh makes sense (consolidation value at 100s-1000s of services)
- How to credibly discuss alternatives while positioning mesh value

**Next module**: [Service Mesh Value Proposition](../02-service-mesh-value/) - Learn the architecture that enables these capabilities and how to articulate ROI to different stakeholder types, including sophisticated platform teams.

```bash
cd ../02-service-mesh-value
cat README.md
```

**Estimated time to next module**: You should feel confident explaining why service mesh is necessary AND addressing sophisticated platform team objections before moving on. If you need more practice with technical alternatives or customer conversations, review this module before proceeding.
