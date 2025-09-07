# Module 7: Multi-Cluster & Advanced Topologies

**Duration**: 2-3 hours  
**Prerequisites**: Modules 1-6 completion  
**Customer Focus**: Enterprise scale, global deployment, and high availability

## The Customer Problem

Welcome back to **Sarah Martinez**, Principal Security Architect at MegaBank Corp. After successfully implementing security (Module 4) and observability (Module 6), she faces her final challenge: enterprise-scale deployment.

### Sarah's Enterprise Requirements
- **Global presence**: Services in US East, US West, EU, and Asia regions
- **Regulatory compliance**: Data residency requirements (EU data stays in EU)
- **High availability**: 99.99% uptime with disaster recovery
- **Network isolation**: Different security zones, air-gapped environments
- **Progressive rollout**: Deploy changes region by region for risk management
- **Operational complexity**: Manage 4 clusters with consistent policies

### The Scale Challenge
- **Service communication**: Services need to communicate across regions
- **Policy consistency**: Security policies must be identical across clusters
- **Traffic management**: Intelligent routing based on latency and availability
- **Disaster recovery**: Automatic failover between regions
- **Compliance boundaries**: Some services cannot cross geographic boundaries

### What Sarah Needs
1. **Multi-cluster networking**: Secure communication across cluster boundaries
2. **Policy federation**: Consistent security policies across all clusters
3. **Global load balancing**: Route traffic to optimal regions
4. **Disaster recovery**: Automatic failover with minimal service disruption
5. **Compliance enforcement**: Ensure data residency requirements

**Your challenge as PM**: Show Sarah how service mesh scales from single cluster to global enterprise deployment while maintaining security and operational simplicity.

## Technical Foundation: Multi-Cluster Service Mesh

Understanding enterprise-scale deployment patterns is crucial for large customer success.

### Important Network Prerequisites
- **East-West Connectivity**: Clusters must route to each other (VPN, private link, or public internet)
- **DNS Resolution**: Cross-cluster service discovery requires network DNS or service entries
- **Trust Bundles**: Certificate authority coordination across cluster boundaries
- **Port Requirements**: Istio control plane ports (15010, 15011, 15012) open between clusters

**Note**: Kind-based multi-cluster is a simulation. Production requires real network connectivity.

### Lab Setup

```bash
make kind-down
```

## Exercise 1: Create Multi-Cluster Environment

### Step 1: Create US East Cluster (Primary)

```bash
kind create cluster --name us-east --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: us-east
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: ClusterConfiguration
    metadata:
      name: config
    networking:
      serviceSubnet: "10.96.0.0/16"
      podSubnet: "10.244.0.0/16"
- role: worker
EOF
```

### Step 2: Create EU West Cluster (Secondary)

```bash
kind create cluster --name eu-west --config - <<EOF
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: eu-west
nodes:
- role: control-plane
  kubeadmConfigPatches:
  - |
    kind: ClusterConfiguration
    metadata:
      name: config
    networking:
      serviceSubnet: "10.97.0.0/16"
      podSubnet: "10.245.0.0/16"
- role: worker
EOF
```

### Step 3: Set Up Cluster Contexts

```bash
kubectl config use-context kind-us-east
kubectl config rename-context kind-us-east us-east
kubectl config use-context kind-eu-west  
kubectl config rename-context kind-eu-west eu-west
```

#### Verify: Multi-Cluster Setup

```bash
kubectl config get-contexts
kubectl config use-context us-east && kubectl get nodes
kubectl config use-context eu-west && kubectl get nodes
```

You should see two separate Kubernetes clusters.

#### Reflection Questions
- How does multi-cluster deployment address regulatory requirements?
- What are the network connectivity challenges?
- How would you manage policies across multiple clusters?

## Exercise 2: Install Istio on Primary Cluster

### Step 1: Install Istio on US East

```bash
kubectl config use-context us-east
curl -L https://istio.io/downloadIstio | sh -
export PATH=$PWD/istio-*/bin:$PATH
istioctl install --set meshConfig.trustDomain=megabank.corp --set values.pilot.env.EXTERNAL_ISTIOD=true -y
```

### Step 2: Deploy Sample Application

```bash
kubectl label namespace default istio-injection=enabled
kubectl create deployment frontend --image=nginxdemos/hello --replicas=2
kubectl create deployment backend --image=nginxdemos/hello --replicas=2
kubectl expose deployment frontend --port=80
kubectl expose deployment backend --port=80
```

### Step 3: Enable Cross-Cluster Discovery

```bash
kubectl create secret generic cacerts -n istio-system \
  --from-file=root-cert.pem=istio-*/samples/certs/root-cert.pem \
  --from-file=cert-chain.pem=istio-*/samples/certs/cert-chain.pem \
  --from-file=ca-cert.pem=istio-*/samples/certs/ca-cert.pem \
  --from-file=ca-key.pem=istio-*/samples/certs/ca-key.pem
kubectl rollout restart deployment/istiod -n istio-system
```

#### Verify: Primary Cluster Setup

```bash
kubectl get pods -n istio-system
kubectl get pods -n default
```

#### Reflection Questions
- Why is external Istiod required for multi-cluster?
- How does trust domain configuration affect security?
- What's the role of certificate management across clusters?

## Exercise 3: Install Istio on Remote Cluster

### Step 1: Install Istio on EU West

```bash
kubectl config use-context eu-west
kubectl create namespace istio-system
kubectl create secret generic cacerts -n istio-system \
  --from-file=root-cert.pem=istio-*/samples/certs/root-cert.pem \
  --from-file=cert-chain.pem=istio-*/samples/certs/cert-chain.pem \
  --from-file=ca-cert.pem=istio-*/samples/certs/ca-cert.pem \
  --from-file=ca-key.pem=istio-*/samples/certs/ca-key.pem
```

### Step 2: Get Primary Cluster Info

```bash
kubectl config use-context us-east
export DISCOVERY_ADDRESS=$(kubectl get svc istio-eastwestgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "127.0.0.1")
echo "Discovery address: $DISCOVERY_ADDRESS"
```

### Step 3: Install Remote Istio

```bash
kubectl config use-context eu-west
istioctl install --set istiodRemote.enabled=true \
  --set pilot.env.EXTERNAL_ISTIOD=true \
  --set global.remotePilotAddress=$DISCOVERY_ADDRESS \
  --set meshConfig.trustDomain=megabank.corp -y
```

### Step 4: Deploy Services in EU

```bash
kubectl label namespace default istio-injection=enabled
kubectl create deployment eu-backend --image=nginxdemos/hello --replicas=2
kubectl expose deployment eu-backend --port=80 --name=backend
```

#### Verify: Remote Cluster Setup

```bash
kubectl get pods -n istio-system
kubectl get pods -n default
```

#### Reflection Questions
- How does remote Istio connect to primary control plane?
- What happens if the primary cluster becomes unavailable?
- How are certificates synchronized across clusters?

## Exercise 4: Cross-Cluster Service Discovery

### Step 1: Create Cross-Cluster Service Entry

```bash
kubectl config use-context us-east
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: eu-backend
spec:
  hosts: [eu-backend.default.global]
  location: MESH_EXTERNAL
  ports:
  - number: 80
    name: http
    protocol: HTTP
  resolution: DNS
  addresses: [240.0.0.1]
  endpoints:
  - address: eu-backend.default.svc.cluster.local
    network: eu-west
EOF
```

### Step 2: Test Cross-Cluster Communication

```bash
kubectl config use-context us-east
kubectl exec deployment/frontend -- curl -v http://eu-backend.default.global/
```

#### Verify: Cross-Cluster Connectivity

```bash
kubectl config use-context us-east
kubectl get serviceentry eu-backend
```

#### Reflection Questions
- How does service discovery work across cluster boundaries?
- What are the DNS resolution requirements?
- How would you handle service naming conflicts?

## Exercise 5: Global Load Balancing

### Step 1: Configure Destination Rules

```bash
kubectl config use-context us-east
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: backend-global
spec:
  host: backend
  subsets:
  - name: us-east
    labels:
      region: us-east
  - name: eu-west
    labels:
      region: eu-west
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: backend-global-routing
spec:
  hosts: [backend]
  http:
  - match:
    - headers:
        region: {exact: "eu"}
    route:
    - destination: {host: eu-backend.default.global}
  - route:
    - destination: {host: backend, subset: us-east}
      weight: 70
    - destination: {host: eu-backend.default.global}
      weight: 30
EOF
```

### Step 2: Test Regional Routing

```bash
kubectl exec deployment/frontend -- curl -H "region: eu" http://backend/
kubectl exec deployment/frontend -- curl http://backend/
```

#### Verify: Traffic Distribution

```bash
kubectl get virtualservice backend-global-routing -o yaml
```

#### Reflection Questions
- How does global load balancing improve user experience?
- What factors should influence traffic distribution?
- How would you implement disaster recovery routing?

## Exercise 6: Policy Federation

### Step 1: Apply Consistent Security Policies

```bash
kubectl config use-context us-east
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default-strict
spec:
  mtls:
    mode: STRICT
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: frontend-to-backend
spec:
  selector:
    matchLabels:
      app: backend
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/default"]
EOF
```

### Step 2: Apply Same Policies to EU

```bash
kubectl config use-context eu-west
kubectl apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default-strict
spec:
  mtls:
    mode: STRICT
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: frontend-to-backend
spec:
  selector:
    matchLabels:
      app: eu-backend
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/default/sa/default"]
EOF
```

#### Verify: Policy Consistency

```bash
kubectl config use-context us-east
kubectl get peerauthentication,authorizationpolicy
kubectl config use-context eu-west
kubectl get peerauthentication,authorizationpolicy
```

#### Reflection Questions
- How do you ensure policy consistency across clusters?
- What tools could automate policy federation?
- How would you handle policy drift detection?

## Exercise 7: Compliance and Data Residency

### Step 1: Implement Data Residency Controls

```bash
kubectl config use-context us-east
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: compliance-routing
spec:
  hosts: [backend]
  http:
  - match:
    - headers:
        data-classification: {exact: "eu-only"}
    route:
    - destination: {host: eu-backend.default.global}
  - match:
    - headers:
        data-classification: {exact: "us-only"}
    route:
    - destination: {host: backend}
  - route:
    - destination: {host: backend}
EOF
```

### Step 2: Test Compliance Routing

```bash
kubectl exec deployment/frontend -- curl -H "data-classification: eu-only" http://backend/
kubectl exec deployment/frontend -- curl -H "data-classification: us-only" http://backend/
```

#### Verify: Compliance Controls

```bash
kubectl get virtualservice compliance-routing -o yaml
```

#### Reflection Questions
- How does service mesh enforce data residency?
- What audit trails are available for compliance?
- How would you handle cross-border data flow restrictions?

## Exercise 8: Disaster Recovery Scenarios

### Step 1: Simulate Primary Cluster Failure

```bash
kubectl config use-context us-east
kubectl scale deployment backend --replicas=0
```

### Step 2: Configure Automatic Failover

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: backend-failover
spec:
  host: backend
  trafficPolicy:
    outlierDetection:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
---
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: backend-failover
spec:
  hosts: [backend]
  http:
  - route:
    - destination: {host: backend}
      weight: 100
    - destination: {host: eu-backend.default.global}
      weight: 0
    fault:
      abort:
        percentage:
          value: 0
        httpStatus: 503
EOF
```

### Step 3: Test Failover Behavior

```bash
for i in {1..10}; do
  kubectl exec deployment/frontend -- curl http://backend/ -m 5 || echo "Request failed"
  sleep 1
done
```

#### Verify: Disaster Recovery

```bash
kubectl get pods -l app=backend
kubectl get destinationrule backend-failover -o yaml
```

#### Reflection Questions
- How quickly can traffic fail over to healthy regions?
- What monitoring is needed for disaster recovery?
- How would you test disaster recovery procedures?

## Customer Application: Presenting to Sarah

Practice showing Sarah how multi-cluster service mesh meets enterprise requirements.

### The Enterprise Scale Problem Recap
*"Sarah, you mentioned needing global deployment with regulatory compliance. Let me show you how service mesh scales to meet enterprise requirements..."*

### Demo Script for Executive Team

Show multi-cluster topology:
1. "Here are your global regions with consistent security policies"
2. "Traffic routes intelligently based on compliance requirements"
3. "Disaster recovery happens automatically with zero configuration changes"

### Business Impact Calculation

```bash
cat > enterprise-roi.md << EOF
## Multi-Cluster Service Mesh ROI

### Before Multi-Cluster Mesh
- Manual policy synchronization: 40 hours/month
- Disaster recovery testing: 80 hours/quarter  
- Compliance audit preparation: 200 hours/year
- Cross-region debugging: 60 hours/month
- Regional deployment coordination: 120 hours/month

### After Multi-Cluster Mesh
- Automatic policy federation: 5 hours/month
- Disaster recovery validation: 20 hours/quarter
- Compliance automation: 40 hours/year
- Unified observability: 10 hours/month
- Coordinated deployments: 20 hours/month

### Annual Enterprise Value
- Operational efficiency: $1.2M
- Compliance cost reduction: $800K
- Disaster recovery confidence: $2M risk mitigation
- Global deployment velocity: $1.5M competitive advantage

**Total Annual Multi-Cluster ROI: $5.5M**
EOF
```

### Handling Enterprise Questions

**"How do we manage certificate rotation across clusters?"**
- *"Istio handles certificate distribution automatically. The shared root CA ensures trust across all clusters while maintaining security boundaries."*

**"What happens if network connectivity between clusters fails?"**
- *"Each cluster operates independently. Services continue working within their cluster, and traffic automatically routes to available regions."*

**"How do we ensure compliance with data residency laws?"**
- *"Service mesh routing rules enforce data residency at the infrastructure level. EU data never leaves EU clusters, with audit trails proving compliance."*

## Key Takeaways

### Technical Understanding
- **Multi-cluster networking**: Secure service communication across cluster boundaries
- **Policy federation**: Consistent security and traffic policies across global deployment
- **Global load balancing**: Intelligent traffic routing based on region, latency, and compliance
- **Disaster recovery**: Automatic failover with minimal service disruption

### Enterprise Value Framework
- **Global scale**: Deploy services across regions while maintaining consistency
- **Regulatory compliance**: Enforce data residency and compliance requirements
- **High availability**: 99.99% uptime through automatic disaster recovery
- **Operational efficiency**: Unified management across multiple clusters

### PM Skills
- **Enterprise positioning**: Address global deployment and compliance requirements
- **Risk mitigation**: Quantify disaster recovery and compliance value
- **Technical depth**: Understand multi-cluster networking and certificate management
- **Executive communication**: Translate complex technical capabilities to business outcomes

## Troubleshooting Guide

#### If cross-cluster communication fails:
```bash
kubectl get serviceentry
kubectl logs -n istio-system deployment/istiod | grep discovery
```

#### If certificate issues across clusters:
```bash
kubectl get secrets -n istio-system | grep cacerts
kubectl logs -n istio-system deployment/istiod | grep cert
```

#### If policy federation not working:
```bash
kubectl get peerauthentication,authorizationpolicy -A
istioctl analyze --all-namespaces
```

## Cleanup

```bash
kubectl config use-context us-east
kubectl delete virtualservice,destinationrule,serviceentry --all
kubectl config use-context eu-west  
kubectl delete virtualservice,destinationrule,serviceentry --all
kind delete cluster --name us-east
kind delete cluster --name eu-west
rm -f enterprise-roi.md
```

## Next Steps

You now understand:
- Multi-cluster service mesh deployment and management
- Enterprise-scale policy federation and compliance enforcement
- Global load balancing and disaster recovery patterns
- Business value of enterprise service mesh deployment

**Next module**: [Integration & Ecosystem](../08-integration/) - Learn how service mesh integrates with the broader cloud-native ecosystem.

```bash
cd ../08-integration
cat README.md
```

**Progress check**: Can you design multi-cluster service mesh architecture for enterprise requirements? Can you quantify the business value of global deployment and compliance? If yes, you're ready for ecosystem integration in Module 8.