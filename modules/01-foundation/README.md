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
make kind-up
kubectl cluster-info
```

## Exercise 1: Basic Kubernetes Networking

### Step 1: Deploy Applications

Create two services to simulate Sarah's microservices and scale the backend to observe load balancing.

```bash
kubectl create deployment frontend --image=nginx
kubectl create deployment backend --image=nginxdemos/hello
kubectl scale deployment backend --replicas=3
**kubectl** expose deployment frontend --port=80
kubectl expose deployment backend --port=80
```

#### Verify: Check Deployment Status

```bash
kubectl get pods -l app=backend -o wide
kubectl get services backend
kubectl get endpointslices -l kubernetes.io/service-name=backend -o wide
```

You should see:
- 3 backend pods running on different Pod IPs (like 10.244.x.x)
- A backend Service with a stable ClusterIP (like 10.96.x.x) 
- All pod IPs registered as endpoints behind the Service

### Step 2: Test Service Discovery

Launch a debug pod to test connectivity and DNS resolution. This simulates how one service connects to another.

```bash
kubectl run debug --image=nicolaka/netshoot -it --rm -- bash
```

Inside the debug pod, test basic HTTP reachability:

```bash
curl -sS http://frontend | head -n 1
curl -sS http://backend | head -n 1
```

Test DNS lookup to see how Kubernetes resolves service names to IP addresses:

```bash
dig +short backend.default.svc.cluster.local
```

This should return the Service IP you saw earlier (like 10.96.x.x).

#### If dig fails:
```bash
getent hosts backend.default.svc.cluster.local
```

### Step 3: Observe Load Balancing

Still inside the debug pod, observe how Kubernetes routes requests to different backend pods. Each request to the same Service IP gets routed to different pods:

```bash
for i in $(seq 1 10); do
  echo "=== Request $i ==="
  curl -s http://backend | sed -n 's/.*Server&nbsp;name:<\/span> <span>\([^<]*\).*/Server name: \1/p'
  sleep 1
done
```

You should see different pod names (like backend-686576749d-abc12, backend-686576749d-def34, etc.) across requests, proving that Kubernetes is load balancing behind the scenes.

Exit the debug pod:

```bash
exit
```

#### Verify: Check Backend Infrastructure

```bash
kubectl get pods -l app=backend -o wide
kubectl get endpoints backend -o wide
kubectl get services backend
```

Compare:
- The Pod IPs from the endpoints (10.244.x.x addresses)
- The pod names you saw in the curl responses  
- The stable Service IP (10.96.x.x) that all requests went to

### Step 4: Demonstrate Session Affinity

Show how kube-proxy normally load balances, then make it sticky to prove the load balancing behavior.

```bash
kubectl patch service backend -p '{"spec": {"sessionAffinity": "ClientIP"}}'
kubectl run debug2 --image=nicolaka/netshoot -it --rm -- bash
```

Inside the debug2 pod:

```bash
for i in $(seq 1 5); do
  curl -s http://backend | sed -n 's/.*Server&nbsp;name:<\/span> <span>\([^<]*\).*/Server name: \1/p'
  sleep 1
done
exit
```

Reset to default load balancing:

```bash
kubectl patch service backend -p '{"spec": {"sessionAffinity": "None"}}'
```

#### Reflection Questions
- What Service IP did you connect to in all requests? (Hint: Check the output of `kubectl get services backend`)
- How did the "Server name" change across requests before and after session affinity?
- Where does the load balancing happen in the Kubernetes stack?

**What you discovered about Kubernetes networking:**
- **Service IP**: You always connect to the same Service IP (like 10.96.x.x) - this is Kubernetes' built-in load balancer
- **Hidden load balancing**: Kubernetes routes each request to different pod IPs behind the scenes (notice how the "Server name" changes across requests)
- **Abstraction layer**: Applications see a stable service endpoint, not individual pods
- **Why this matters**: The load balancing is invisible to applications, but happens at the kernel/iptables level
- **Flat networking**: Any pod can reach any service by default (which creates security concerns)

## Exercise 2: The Security Problem

### Step 1: Demonstrate Flat Network Access

Create a malicious pod to show how any compromised service can access everything.

```bash
kubectl run attacker --image=curlimages/curl -it --rm -- sh
```

Inside the attacker pod, access everything:

```bash
curl http://frontend
curl http://backend
curl -k https://kubernetes.default.svc.cluster.local
exit
```

#### Reflection Questions
- What prevents the attacker pod from accessing your services?
- What happens if any legitimate service gets compromised?

**Platform team response**: *"We can fix this with default-deny NetworkPolicies and namespace isolation."*

**The credible counter**: Absolutely—NetworkPolicies are essential baseline security. However, they have important limits PMs should understand:
- **Layer 3/4 scope**: Policies match IPs and ports, not who the workload is. If the pod IP changes or a malicious pod gets the right labels, the policy can still allow traffic.
- **Identity drift**: Auto-scaling and restarts change pod IPs. Labels are human-managed metadata, not cryptographic identity.
- **No Layer 7 awareness**: Cannot express "allow only GET /status" or "require Authorization header with valid JWT". All TCP/80 looks the same.
- **Cross-namespace/multi-cluster complexity**: Enforcing consistent rules across namespaces and clusters requires complex RBAC, networking, and often VPN wiring.

What service mesh adds on top:
- **Cryptographic workload identity**: Each workload gets a verifiable identity (SPIFFE), not just a label.
- **mTLS by default**: Encryption and identity are enforced per-request at runtime.
- **L7 policy**: Express business rules (methods, paths, headers, JWT claims) close to the traffic.
- **Consistent, centralized control**: Uniform policies across namespaces and clusters.

**Sarah's perspective**: "NetworkPolicies are our baseline. For zero-trust, we also need runtime, identity-based L7 controls that survive scaling and infra changes."

## Exercise 3: The Observability Gap

### Step 1: Generate Traffic

Create traffic between services to simulate normal operations.

```bash
for i in {1..10}; do
  kubectl exec deployment/frontend -- curl -s -o /dev/null -w "." http://backend
  sleep 1
done
echo
```

### Step 2: Try to Understand Network Activity

Attempt to answer basic questions about service communication using standard Kubernetes tools.

```bash
kubectl get pods -o wide
kubectl logs deployment/frontend
kubectl logs deployment/backend
```

What this shows:
- `kubectl get pods -o wide`: Pod IPs, nodes, and labels. You can see where workloads run.
- `kubectl logs`: Application logs from each Deployment. You might see request lines if apps log them.

Why this is insufficient:
- There is no service-to-service map. You see pods, not who called whom.
- No traffic volume or error rate between services. Logs are per service, not correlated across calls.
- No end-to-end latency. You can time a single curl, but not aggregate latencies between services.

### Step 3: Test Observability Limitations

Try to answer these questions with standard Kubernetes:

```bash
echo "1) Which services are talking to each other?"
kubectl get pods -o wide
echo

echo "2) How much traffic is flowing between services?"
kubectl get pods --show-labels
echo

echo "3) What's the latency between frontend and backend?"
kubectl exec deployment/frontend -- curl -w "Time: %{time_total}s\n" -s -o /dev/null http://backend
echo

echo "4) Are there any failed requests or retry patterns?"
kubectl logs deployment/frontend | grep -i error
kubectl logs deployment/backend | grep -i error
echo

echo "5) What's the dependency graph of my applications?"
kubectl get services
echo

echo "6) Security: Who accessed what, when?"
echo "No audit trail of service-to-service access available"
```

What you’ll find (outcomes):
- 1) Service-to-service map: Listing pods doesn’t show source→destination pairs. No dependency graph.
- 2) Traffic volume: Pod listings and labels don’t expose request rates between services.
- 3) Latency: A one-off curl shows a single request time, not P50/P90/P99 between services.
- 4) Failures/retries: Grepping logs is manual, incomplete, and varies by team logging formats.
- 5) Dependency graph: `kubectl get services` shows Service objects, not who calls whom.
- 6) Security/audit: There is no runtime, per-request audit trail of which workload accessed which service.

#### Reflection Questions
- What information can you get about service-to-service communication?
- What critical visibility is missing for security and troubleshooting?

**Platform team response**: *"We have Prometheus + OpenTelemetry + Jaeger for observability, plus our CNI exports flow logs."*

**The credible counter**: True, but during an incident, you need to correlate:
- CNI flow logs (IP-based, no workload identity)
- Application metrics (different metric names per team)
- Distributed traces (if developers instrumented their code)
- Kubernetes audit logs (for policy changes)

**Sarah's perspective**: "When there's a security incident, correlating 4-5 data sources increases our MTTR. We need cryptographically verifiable 'service A talked to service B' audit trails."

## Exercise 4: The Policy Enforcement Problem

### Step 1: Implement Basic Network Policy

Try to implement "only frontend can talk to backend" using Kubernetes NetworkPolicies.

```bash
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
```

#### Verify: Test Basic Connectivity

```bash
kubectl run attacker --image=curlimages/curl -it --rm -- curl -m 5 http://backend
```

This should fail with "Operation timed out" after 5 seconds.

```bash
kubectl exec deployment/frontend -- curl -m 5 http://backend
```

This should work and return HTML content.

### Step 2: Test Layer 7 Limitations

NetworkPolicies only control IP/port. Test what they cannot see at Layer 7.

```bash
echo "Testing dangerous HTTP operations that NetworkPolicy can't block:"
kubectl exec deployment/frontend -- curl -X DELETE http://backend/admin/users
kubectl exec deployment/frontend -- curl -X POST -d "malicious=data" http://backend/sensitive-api

echo "Testing requests with fake tokens that NetworkPolicy can't validate:"
kubectl exec deployment/frontend -- curl -H "Authorization: Bearer fake-token" http://backend
kubectl exec deployment/frontend -- curl -H "X-Admin-Secret: hacked" http://backend
```

### Step 3: Demonstrate Lack of Audit Trail

```bash
kubectl logs deployment/backend
```

#### Verify: Show Plaintext Communication

```bash
kubectl exec deployment/frontend -- curl -v http://backend 2>&1 | grep -E "(GET|Host|User-Agent)"
```

### Step 4: Show Identity Drift Problem

```bash
kubectl scale deployment frontend --replicas=0
kubectl scale deployment frontend --replicas=1
kubectl exec deployment/frontend -- curl http://backend
```

The new frontend pod gets the same label but a different IP. Policy still works, but there's no cryptographic identity.

#### Reflection Questions
- What types of policies can NetworkPolicies enforce?
- What security controls are impossible with NetworkPolicies alone?
- How would you audit what requests were allowed or denied?

**Limitations you discovered:**
- NetworkPolicies work at **Layer 3/4** (IP addresses and ports) - can't see HTTP methods, paths, or headers
- No **Layer 7** controls - both GET /status and POST /admin/delete are treated the same
- No **identity-based** access - relies on pod labels (can drift during auto-scaling)
- No **encryption** of traffic - all communication is plaintext
- No **audit trail** - can't see who was denied access or why

**Platform team response**: *"Actually, Cilium NetworkPolicy supports L7 - HTTP methods, paths, even Kafka topics. And we can use cert-manager + SPIRE for automatic mTLS certificates."*

**The credible counter**: While true, this requires:
- Learning and maintaining separate control planes (Cilium, cert-manager, SPIRE, OPA)
- Correlating policy violations across multiple systems during incidents
- Managing certificate rotation in multiple places
- Stitching together telemetry from CNI flow logs, app metrics, and tracing backends

**Sarah's perspective**: "NetworkPolicies are a start, but at our scale (2,000+ services), the operational complexity of managing multiple systems becomes the bottleneck to zero-trust adoption."

### Decision Framework: When CNI L7 vs Service Mesh?

**CNI L7 + PKI Approach Sufficient When:**
- Small to medium scale (< 100 services)
- Team has deep networking expertise
- Simple L7 policies (HTTP methods, basic paths)
- Acceptable to manage multiple control planes

**Service Mesh Adds Value When:**
- Large scale (100s-1000s of services)
- Need runtime identity verification (not just deploy-time)
- Complex L7 policies with JWT validation, custom headers
- Want unified control plane for policy, observability, and traffic management

### Operational Complexity Comparison (30/60/90 Day Tasks)

**CNI + PKI Approach:**
- **30 days**: Setup Cilium L7 policies, configure cert-manager, deploy SPIRE, integrate OPA
- **60 days**: Rotate root certificates, update OPA policies, tune Cilium performance, correlate 4 monitoring systems during incident
- **90 days**: Upgrade each component separately, retrain team on policy syntax variations, debug cross-component issues

**Service Mesh Approach:**
- **30 days**: Install Istio, enable mTLS, deploy initial AuthorizationPolicies
- **60 days**: Rotate happens automatically, tune policies in unified syntax, single-pane incident debugging
- **90 days**: Single control plane upgrade, consistent policy language, streamlined operations

## The Service Mesh Solution Preview

Now let's see what changes when we add Istio to solve Sarah's problems.

## Exercise 5: Adding Service Mesh

### Step 1: Install Istio

```bash
make istio-sidecar
```

### Step 2: Enable Sidecar Injection

```bash
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment frontend backend
```

#### Verify: Check Sidecar Injection

```bash
kubectl get pods -o wide
kubectl describe pod $(kubectl get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}')
```

#### Reflection Questions
- How many containers does each pod have now?
- What changed about your application code?

**What you're seeing:**
- Each pod now has **two containers**: your app + istio-proxy (Envoy)
- The proxy handles **all network traffic** for your application
- Your application code **didn't change**

## Exercise 6: Automatic Security

### Step 1: Enable Strict mTLS

```bash
make mtls-strict
```

#### Verify: Test Encrypted Connectivity

```bash
kubectl exec deployment/frontend -- curl http://backend
```

The request still works, but now it's encrypted with automatic certificates.

```bash
istioctl proxy-config clusters $(kubectl get pod -l app=frontend -o jsonpath='{.items[0].metadata.name}') --fqdn backend.default.svc.cluster.local --direction outbound
```

#### Reflection Questions
- Did your application code change to support mTLS?
- How are certificates managed and rotated?

**Platform team response**: *"We could achieve this with cert-manager + SPIRE injecting mTLS certs into workloads."*

**The credible counter**: Yes, and many sophisticated teams do exactly this. The operational overhead emerges when you consider:
- Certificate rotation across thousands of services (different lifetimes, CAs, trust bundles)
- Application-level TLS library integration and updates
- Cross-cluster/multi-cloud trust boundary management
- Correlating cert validation failures with application errors

**Sarah's perspective**: "All my service traffic is now encrypted without any code changes AND my ops team manages it from one control plane!"

## Exercise 7: Rich Authorization Policies

### Step 1: Implement Layer 7 Policies

Create fine-grained authorization policies that NetworkPolicies cannot enforce.

```bash
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
        paths: ["/"]
EOF
```

#### Verify: Test Different Request Types

```bash
kubectl exec deployment/frontend -- curl http://backend/
kubectl exec deployment/frontend -- curl -X POST http://backend/data
```

The GET request should work, the POST should fail with RBAC denied.

#### Reflection Questions
- What types of policies can you now enforce that NetworkPolicies cannot?
- How does identity-based authorization differ from IP-based authorization?

**Platform team response**: *"OPA Gatekeeper can validate admission policies, and Cilium NetworkPolicy supports HTTP methods and paths."*

**The credible counter**: True, but:
- OPA operates at admission time (deploy-time), not runtime request-time
- Cilium L7 policies still rely on pod labels (can drift) rather than cryptographic workload identity
- Policy violations scattered across CNI logs, OPA audit logs, and application logs
- Each system has different policy syntax and debugging approaches

**Sarah's perspective**: "Now I have fine-grained, identity-based access control with unified policy language and audit trails!"

## Exercise 8: Instant Observability

### Step 1: Open Service Mesh Dashboard

```bash
make kiali
```

### Step 2: Generate Traffic

```bash
for i in {1..20}; do
  kubectl exec deployment/frontend -- curl http://backend/
  sleep 1
done
```

#### Verify: Check Kiali Dashboard

In the Kiali UI, you can now see:
- Service dependency graph
- Real-time traffic flow
- Success/error rates
- Response times

#### Reflection Questions
- What visibility do you have now that was missing before?
- How does this help with troubleshooting and security auditing?

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
- **Baseline controls remain**: NetworkPolicies, perimeter firewalls, admission controls (OPA/Gatekeeper) complement mesh
- **Adoption strategy**: Layer mesh on existing controls for runtime identity and unified management at scale

### Customer Insights
- **Enterprise security**: Requires L7 policies, identity-based access, and audit trails
- **Operational complexity**: At 1000+ services, managing multiple control planes becomes the bottleneck
- **Compliance**: Single source of truth for audit trails accelerates regulatory validation

### PM Skills
- **Steel man arguments**: Acknowledge sophisticated alternatives before positioning your solution
- **Scale-based value**: Frame mesh as consolidation layer, not replacement for all networking tools
- **Credible objection handling**: Show deep understanding of alternatives and their operational trade-offs

## Troubleshooting Guide

#### If pods not starting after Istio installation:
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name> -c istio-init
```

#### If mTLS connectivity issues:
```bash
istioctl proxy-config clusters <pod-name> --fqdn <service>.<namespace>.svc.cluster.local --direction outbound
kubectl logs <pod-name> -c istio-proxy | grep TLS
```

#### If authorization policies not working:
```bash
istioctl analyze
kubectl logs <pod-name> -c istio-proxy | grep RBAC
```

## Cleanup

```bash
kubectl delete authorizationpolicy backend-authz
kubectl delete networkpolicy backend-policy
kubectl delete deployment frontend backend
kubectl delete service frontend backend
kubectl delete pod --all
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