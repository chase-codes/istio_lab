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
# Create multiple clusters to simulate Sarah's global deployment
make kind-down

# Cluster 1: US East (Primary)
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

# Cluster 2: EU West (Secondary)  
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

# Set up contexts
kubectl config use-context kind-us-east
kubectl config rename-context kind-us-east us-east
kubectl config use-context kind-eu-west  
kubectl config rename-context kind-eu-west eu-west
```

### Exercise 1: Single-Cluster Foundation

```bash
# Start with US East cluster
kubectl config use-context us-east

# Install Istio in primary cluster
curl -L https://istio.io/downloadIstio | sh -
export PATH=$PWD/istio-*/bin:$PATH

istioctl install --set values.pilot.env.EXTERNAL_ISTIOD=true --set values.global.meshID=mesh1 --set values.global.clusterName=us-east --set values.global.network=us-east-network -y

# Label the cluster
kubectl label namespace istio-system topology.istio.io/network=us-east-network

# Deploy Sarah's banking services in US East
kubectl create deployment account-service --image=nginx --replicas=3
kubectl create deployment transaction-service --image=httpd --replicas=2
kubectl create deployment fraud-detection --image=nginx:alpine --replicas=2

kubectl expose deployment account-service --port=80
kubectl expose deployment transaction-service --port=80
kubectl expose deployment fraud-detection --port=80

# Enable sidecar injection
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment account-service transaction-service fraud-detection

kubectl rollout status deployment account-service transaction-service fraud-detection
```

### Exercise 2: Installing Secondary Cluster

```bash
# Switch to EU West cluster
kubectl config use-context eu-west

# Install Istio as remote cluster
export DISCOVERY_ADDRESS=$(kubectl --context=us-east -n istio-system get svc istio-pilot -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
# For kind clusters, use port-forward instead:
kubectl --context=us-east -n istio-system port-forward svc/istiod 15010:15010 &
export DISCOVERY_ADDRESS=127.0.0.1:15010

# Install remote cluster configuration
istioctl install --set istiodRemote.enabled=true --set pilot.env.EXTERNAL_ISTIOD=true --set global.remotePilotAddress=${DISCOVERY_ADDRESS} --set values.global.meshID=mesh1 --set values.global.clusterName=eu-west --set values.global.network=eu-west-network -y

# Label the cluster
kubectl label namespace istio-system topology.istio.io/network=eu-west-network

# Deploy Sarah's EU-specific services (GDPR compliant)
kubectl create deployment eu-user-data --image=nginx --replicas=2
kubectl create deployment eu-analytics --image=httpd --replicas=2

kubectl expose deployment eu-user-data --port=80
kubectl expose deployment eu-analytics --port=80

# Enable sidecar injection
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment eu-user-data eu-analytics

kubectl rollout status deployment eu-user-data eu-analytics
```

### Exercise 3: Cross-Cluster Service Discovery

```bash
# Enable cross-cluster service discovery
# Install cross-cluster secret in US East
kubectl --context=us-east apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: cacerts
  namespace: istio-system
  labels:
    istio/cluster: eu-west
type: Opaque
data:
  cert-chain.pem: $(kubectl --context=eu-west -n istio-system get secret cacerts -o jsonpath='{.data.cert-chain\.pem}')
  key.pem: $(kubectl --context=eu-west -n istio-system get secret cacerts -o jsonpath='{.data.key\.pem}')
  root-cert.pem: $(kubectl --context=eu-west -n istio-system get secret cacerts -o jsonpath='{.data.root-cert\.pem}')
EOF

# Create cross-cluster service endpoints
kubectl --context=us-east apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: eu-services
spec:
  hosts:
  - eu-user-data.default.global
  location: MESH_EXTERNAL  
  ports:
  - number: 80
    name: http
    protocol: HTTP
  resolution: DNS
  addresses:
  - 240.0.0.1  # Virtual IP for cross-cluster service
  endpoints:
  - address: eu-user-data.default.svc.cluster.local
    network: eu-west-network
    ports:
      http: 80
EOF

# Test cross-cluster connectivity
kubectl --context=us-east exec deployment/account-service -- curl http://eu-user-data.default.global/
```

**Sarah's global connectivity**: Services can securely communicate across cluster boundaries

### Exercise 4: Policy Federation

```bash
# Apply consistent security policies across clusters
# Policy 1: mTLS enforcement everywhere
kubectl --context=us-east apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: global-mtls
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
EOF

kubectl --context=eu-west apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: global-mtls
  namespace: istio-system
spec:
  mtls:
    mode: STRICT
EOF

# Policy 2: Data residency compliance
kubectl --context=eu-west apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: eu-data-residency
  namespace: default
spec:
  selector:
    matchLabels:
      app: eu-user-data
  action: DENY
  rules:
  - from:
    - source:
        notNamespaces: ["default", "istio-system"]
  - when:
    - key: source.cluster
      notValues: ["eu-west"]
EOF

# Verify policy enforcement
kubectl --context=us-east exec deployment/account-service -- curl http://eu-user-data.default.global/ --timeout=5
# Should be denied due to compliance policy
```

**Sarah's compliance enforcement**: Policies automatically enforced across global infrastructure

### Exercise 5: Intelligent Global Load Balancing

```bash
# Configure locality-aware routing
kubectl --context=us-east apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: global-load-balancing
spec:
  host: account-service.default.global
  trafficPolicy:
    outlierDetection:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
    localityLbSetting:
      enabled: true
      failover:
      - from: us-east/*
        to: eu-west/*
      - from: eu-west/*  
        to: us-east/*
  portLevelSettings:
  - port:
      number: 80
    loadBalancer:
      localityLbSetting:
        enabled: true
EOF

# Configure traffic distribution
kubectl --context=us-east apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: global-routing
spec:
  hosts:
  - account-service.default.global
  http:
  - match:
    - headers:
        region: {exact: "us"}
    route:
    - destination:
        host: account-service.default.svc.cluster.local
      weight: 100
  - match:
    - headers:
        region: {exact: "eu"}
    route:
    - destination:
        host: eu-user-data.default.global  
      weight: 100
  - route:  # Default: route to local region
    - destination:
        host: account-service.default.svc.cluster.local
      weight: 100
EOF

# Test regional routing
kubectl --context=us-east exec deployment/account-service -- curl -H "region: eu" http://account-service.default.global/
```

**Sarah's intelligent routing**: Traffic automatically routed to optimal regions

### Exercise 6: Disaster Recovery Setup

```bash
# Configure automatic failover
kubectl --context=us-east apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: disaster-recovery
spec:
  host: transaction-service.default.global
  trafficPolicy:
    outlierDetection:
      consecutiveErrors: 2
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 100  # Allow complete failover
    localityLbSetting:
      enabled: true
      failover:
      - from: us-east/*
        to: eu-west/*
EOF

# Simulate US East failure
kubectl --context=us-east scale deployment transaction-service --replicas=0

# Test automatic failover
kubectl --context=us-east exec deployment/account-service -- curl http://transaction-service.default.global/
# Traffic should automatically route to EU West backup
```

**Sarah's disaster recovery**: Automatic failover with minimal service disruption

### Exercise 7: Observability Across Clusters

```bash
# Set up federated monitoring
kubectl --context=us-east apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: federated-prometheus
  namespace: istio-system
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      external_labels:
        cluster: 'us-east'
        region: 'us'
    
    scrape_configs:
    - job_name: 'istio-mesh'
      kubernetes_sd_configs:
      - role: endpoints
        namespaces:
          names: [istio-system, default]
    
    # Federate from EU cluster
    - job_name: 'federate-eu'
      scrape_interval: 15s
      honor_labels: true
      metrics_path: '/federate'
      params:
        'match[]':
          - '{job=~"kubernetes-.*"}'
          - '{__name__=~"istio_.*"}'
      static_configs:
        - targets: ['prometheus-eu.example.com:9090']
EOF

# Install Kiali for global service map
kubectl --context=us-east apply -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons/kiali.yaml

# Configure Kiali for multi-cluster
kubectl --context=us-east patch configmap kiali -n istio-system --patch '{"data":{"config.yaml":"server:\n  web_root: /kiali\nistio:\n  config_map_name: istio\n  istio_namespace: istio-system\ndeployment:\n  accessible_namespaces: [\"**\"]\nexternal_services:\n  istio:\n    component_status:\n      enabled: true\n      components:\n      - app_label: istiod\n        is_core: true\n        is_proxy: false\n      - app_label: istio-proxy\n        is_core: true\n        is_proxy: true\n"}}'
```

**Sarah's global visibility**: Single pane of glass for multi-cluster operations

## Enterprise Deployment Patterns

### Exercise 8: Progressive Regional Rollout

```bash
# Implement canary deployment across regions
kubectl --context=us-east apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: regional-canary
spec:
  hosts:
  - account-service.default.global
  http:
  # EU users get new version first (lower risk region)
  - match:
    - headers:
        geo-region: {exact: "eu"}
    route:
    - destination:
        host: account-service.default.svc.cluster.local
        subset: v2
  # US users get stable version initially
  - match:
    - headers:
        geo-region: {exact: "us"}
    route:
    - destination:
        host: account-service.default.svc.cluster.local
        subset: v1
  # Default routing
  - route:
    - destination:
        host: account-service.default.svc.cluster.local
        subset: v1
      weight: 90
    - destination:
        host: account-service.default.svc.cluster.local
        subset: v2
      weight: 10
EOF

# Deploy new version to EU first
kubectl --context=eu-west set image deployment/eu-user-data nginx=nginx:1.20
```

**Sarah's risk management**: Deploy to lower-risk regions first, then expand globally

### Exercise 9: Network Segmentation and Security Zones

```bash
# Create security zones across clusters
kubectl --context=us-east create namespace dmz
kubectl --context=us-east create namespace secure-zone
kubectl --context=eu-west create namespace gdpr-zone

# Configure zone-specific policies
kubectl --context=us-east apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: dmz-isolation
  namespace: dmz
spec:
  action: DENY
  rules:
  - from:
    - source:
        namespaces: ["secure-zone"]
  - to:
    - operation:
        methods: ["POST", "PUT", "DELETE"]
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: secure-zone-access
  namespace: secure-zone
spec:
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/dmz/sa/gateway"]
  - to:
    - operation:
        methods: ["GET"]
EOF

# GDPR zone in EU
kubectl --context=eu-west apply -f - <<EOF
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: gdpr-compliance
  namespace: gdpr-zone
spec:
  action: DENY
  rules:
  - from:
    - source:
        notNamespaces: ["gdpr-zone", "istio-system"]
  - when:
    - key: source.cluster
      notValues: ["eu-west"]
EOF
```

**Sarah's security boundaries**: Network segmentation enforced across global infrastructure

### Exercise 10: Compliance Automation

```bash
# Automated compliance monitoring
kubectl --context=us-east apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: compliance-monitoring
  namespace: istio-system
data:
  compliance-rules.yml: |
    groups:
    - name: compliance-sre
      rules:
      # EU data residency violation
      - alert: EUDataResidencyViolation
        expr: |
          increase(istio_requests_total{
            source_cluster!="eu-west",
            destination_service_name=~".*eu.*",
            response_code!~"403"
          }[5m]) > 0
        labels:
          severity: critical
          compliance: gdpr
        annotations:
          summary: "EU data accessed from non-EU cluster"
      
      # Cross-zone unauthorized access
      - alert: SecurityZoneViolation
        expr: |
          increase(istio_requests_total{
            destination_service_namespace="secure-zone",
            source_workload!="gateway",
            response_code!~"403"
          }[5m]) > 0
        labels:
          severity: critical
          compliance: security-policy
        annotations:
          summary: "Unauthorized access to secure zone"
      
      # mTLS enforcement check
      - alert: mTLSViolation
        expr: |
          increase(istio_requests_total{
            connection_security_policy!="mutual_tls"
          }[5m]) > 0
        labels:
          severity: warning
          compliance: encryption
        annotations:
          summary: "Non-mTLS communication detected"
EOF
```

**Sarah's compliance automation**: Continuous monitoring of regulatory requirements

## Customer Application: Enterprise Scale Presentation

Practice presenting Sarah's global service mesh implementation to enterprise leadership.

### The Enterprise Scale Value
*"Sarah, let me show you how service mesh scales from single cluster to global enterprise deployment while maintaining security and compliance..."*

### Demo Script for Enterprise Leadership
```bash
# 1. Show global service connectivity (10 minutes)
kubectl config use-context us-east
kubectl exec deployment/account-service -- curl http://eu-user-data.default.global/
# "Services in US can securely communicate with EU services"

# 2. Demonstrate policy consistency (10 minutes)  
kubectl --context=us-east get peerauthentication -A
kubectl --context=eu-west get peerauthentication -A
# "Same security policies enforced across all regions"

# 3. Show compliance enforcement (10 minutes)
kubectl --context=us-east exec deployment/account-service -- curl http://eu-user-data.default.global/ --timeout=5
# "GDPR compliance automatically enforced - US services cannot access EU data"

# 4. Demonstrate disaster recovery (10 minutes)
kubectl --context=us-east scale deployment transaction-service --replicas=0
kubectl --context=us-east exec deployment/account-service -- curl http://transaction-service.default.global/
# "Automatic failover to EU region during US outage"

# 5. Show global observability (5 minutes)
# Open Kiali showing services across both clusters
# "Single view of global service health and traffic flow"
```

### Handling Enterprise Architecture Questions

**"How do we maintain consistency across multiple clusters?"**
- *"Service mesh provides policy federation and GitOps integration. You define policies once and apply them consistently across all clusters. Configuration drift is automatically detected and corrected."*

**"What about network latency between regions?"**
- *"Service mesh provides intelligent routing based on latency and locality. Traffic is automatically routed to the closest healthy region. Cross-region communication only happens when necessary for disaster recovery or specific business requirements."*

**"How do we handle regulatory compliance across different jurisdictions?"**
- *"Service mesh enforces compliance boundaries through automatic policy enforcement. EU data stays in EU clusters, PCI data stays in PCI-compliant zones. Violations are automatically blocked and audited."*

### Enterprise ROI Calculation
```bash
cat > enterprise-scale-roi.md << EOF
## Enterprise Multi-Cluster ROI: MegaBank Corp

### Current Global Operations Costs
- Manual policy deployment across 4 regions: 80 hours/month × $200 = $16,000
- Disaster recovery testing and coordination: 40 hours/month × $200 = $8,000
- Compliance monitoring and reporting: 60 hours/month × $150 = $9,000
- Cross-region networking and VPN management: $25,000/month
- Incident response coordination across regions: 30 hours/month × $200 = $6,000

**Current Monthly Cost: $64,000**

### With Multi-Cluster Service Mesh
- Automated policy federation: $3,200/month (80% reduction)
- Automated disaster recovery: $1,600/month (80% reduction)  
- Automated compliance monitoring: $1,800/month (80% reduction)
- Service mesh networking: $8,000/month (68% reduction)
- Coordinated incident response: $1,200/month (80% reduction)

**New Monthly Cost: $15,800**
**Monthly Savings: $48,200**
**Annual ROI: $578,400**

### Additional Business Value
- 99.99% uptime achievement: $2M/year in avoided downtime costs
- Faster global feature rollout: $5M/year in competitive advantage
- Automated compliance: $1M/year in reduced audit costs

**Total Annual Value: $8.578M**
EOF

cat enterprise-scale-roi.md
```

## Advanced Multi-Cluster Patterns

### Exercise 11: Cross-Cluster Canary Deployments

```bash
# Global canary deployment strategy
kubectl --context=us-east apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: global-canary
spec:
  hosts:
  - account-service.default.global
  http:
  # 5% global traffic to new version
  - route:
    - destination:
        host: account-service.default.svc.cluster.local
        subset: v1
      weight: 95
    - destination:
        host: account-service.default.svc.cluster.local
        subset: v2
      weight: 5
EOF
```

### Exercise 12: Service Mesh Federation

```bash
# Configure service mesh federation for acquired companies
kubectl --context=us-east apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: acquired-company-services
spec:
  hosts:
  - legacy-system.acquired.global
  location: MESH_EXTERNAL
  ports:
  - number: 443
    name: https
    protocol: HTTPS
  resolution: DNS
  endpoints:
  - address: legacy-gateway.acquired.com
EOF
```

## Key Takeaways

### Technical Understanding
- **Multi-cluster networking**: Secure service communication across cluster boundaries
- **Policy federation**: Consistent security and traffic policies across global infrastructure
- **Global load balancing**: Intelligent routing based on locality and health
- **Disaster recovery**: Automatic failover with minimal service disruption

### Enterprise Value Framework
- **Global scale**: Service mesh scales from single cluster to worldwide deployment
- **Compliance automation**: Regulatory requirements enforced automatically
- **Operational consistency**: Same tools and processes across all regions
- **Business continuity**: Disaster recovery built into the infrastructure

### PM Skills
- **Enterprise positioning**: Address global scale and compliance requirements
- **Architecture guidance**: Help customers design multi-region deployments
- **Compliance value**: Demonstrate automated regulatory compliance
- **Business continuity**: Show how technology enables business resilience

## Troubleshooting Guide

### Cross-cluster connectivity issues
```bash
istioctl proxy-config endpoints account-service-xxx | grep global
kubectl get serviceentry -A
```

### Policy federation problems
```bash
kubectl get peerauthentication -A --context=us-east
kubectl get peerauthentication -A --context=eu-west
```

### Multi-cluster observability gaps
```bash
kubectl -n istio-system get configmap kiali -o yaml
istioctl proxy-status --context=us-east
```

## Next Steps

You now understand:
- Multi-cluster service mesh deployment and management
- Enterprise-scale policy federation and compliance
- Global load balancing and disaster recovery
- Operational consistency across distributed infrastructure

**Next module**: [Integration & Customization](../08-integration/) - Learn how to integrate service mesh with existing enterprise systems and customize for specific requirements.

```bash
cd ../08-integration
cat README.md
```

**Progress check**: Can you design and present a multi-cluster service mesh architecture to enterprise leadership? Can you demonstrate compliance automation and disaster recovery? If yes, you're ready for the final integration module.
