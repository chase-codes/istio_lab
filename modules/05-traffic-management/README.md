# Module 5: Traffic Management & Deployment Safety

**Duration**: 2-3 hours  
**Prerequisites**: Modules 1-4 completion  
**Customer Focus**: Safe deployments and business agility

## The Customer Problem

Return to **Marcus Chen**, CTO at RapidScale. You helped him understand service mesh ROI (Module 2). Now he faces the operational challenge of deploying features safely at startup speed.

### Marcus's Current Situation
- **Growth pressure**: 40% month-over-month growth demands daily deployments
- **Risk aversion**: Last bad deployment caused 2-hour outage, lost $50K revenue
- **Developer fear**: Teams afraid to deploy, velocity dropping despite mesh investment
- **Investor scrutiny**: Board wants proof that infrastructure enables, not hinders, growth
- **Competition**: Competitors shipping features faster, taking market share

### The Deployment Challenge
Marcus's teams face conflicting pressures:
- **Speed**: Deploy features daily to stay competitive
- **Safety**: Zero tolerance for customer-impacting failures
- **Scale**: 40+ microservices with complex dependencies  
- **Complexity**: Distributed systems make rollback difficult
- **Monitoring**: Need to detect issues before customers notice

### What Marcus Needs
1. **Deployment confidence**: Deploy without fear of breaking production
2. **Automatic safety**: Built-in rollback and traffic management
3. **Customer protection**: Route traffic away from problematic versions
4. **Performance insight**: Understand impact before full rollout
5. **Business agility**: Technology that enables faster, not slower, deployment

**Your challenge as PM**: Show Marcus how service mesh transforms deployment risk into competitive advantage.

## Technical Foundation: Traffic Management for Business Agility

Understanding advanced traffic management is key to positioning service mesh as an enabler of business velocity.

### Lab Setup

```bash
make kind-up
make istio-sidecar
```

## Exercise 1: Deploy Marcus's Microservices

### Step 1: Create Application Architecture

Deploy a realistic microservices setup to simulate Marcus's deployment challenges.

```bash
kubectl create deployment productpage --image=nginxdemos/hello --replicas=3
kubectl create deployment reviews-v1 --image=nginxdemos/hello --replicas=2
kubectl create deployment ratings --image=nginx:alpine --replicas=2
```

### Step 2: Expose Services

```bash
kubectl expose deployment productpage --port=80
kubectl expose deployment reviews-v1 --port=80 --name=reviews
kubectl expose deployment ratings --port=80
```

### Step 3: Enable Sidecar Injection

```bash
kubectl label namespace default istio-injection=enabled
kubectl rollout restart deployment productpage reviews-v1 ratings
kubectl rollout status deployment productpage
kubectl rollout status deployment reviews-v1
kubectl rollout status deployment ratings
```

### Step 4: Add Version Labels

```bash
kubectl patch deployment reviews-v1 -p '{"spec":{"template":{"metadata":{"labels":{"version":"v1"}}}}}'
kubectl patch deployment ratings -p '{"spec":{"template":{"metadata":{"labels":{"version":"v1"}}}}}'
```

#### Verify: Check Deployment Status

```bash
kubectl get pods -l app=reviews --show-labels
kubectl get pods -l app=productpage --show-labels
```

#### Reflection Questions
- How do version labels enable traffic management?
- What's the current deployment risk with this setup?
- How would a bad deployment affect all users?

## Exercise 2: Demonstrate Current Deployment Risk

### Step 1: Simulate Dangerous All-or-Nothing Deployment

```bash
kubectl create deployment reviews-v2 --image=httpd:2.4.48 --replicas=2
kubectl patch deployment reviews-v2 -p '{"spec":{"template":{"metadata":{"labels":{"version":"v2","app":"reviews"}}}}}'
```

### Step 2: Scale Down Old Version (Traditional Deployment)

```bash
kubectl scale deployment reviews-v1 --replicas=0
```

### Step 3: Test Impact on Users

```bash
kubectl run test --image=curlimages/curl --rm -it -- curl http://reviews/
```

#### Verify: All Traffic Goes to New Version

```bash
kubectl get pods -l app=reviews
```

Only v2 pods should be running.

#### Reflection Questions
- What happens if v2 has a critical bug?
- How long would it take to rollback?
- What's the customer impact during rollback?

**Marcus's current risk**: All traffic immediately goes to new version with no safety net

## Exercise 3: Implement Safe Canary Deployments

### Step 1: Create Traffic Management Rules

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews-destination
spec:
  host: reviews
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
EOF
```

### Step 2: Start with 100% Traffic to Stable Version

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews-canary
spec:
  hosts: [reviews]
  http:
  - route:
    - destination: {host: reviews, subset: v1}
      weight: 100
    - destination: {host: reviews, subset: v2}
      weight: 0
EOF
```

### Step 3: Scale Both Versions Up

```bash
kubectl scale deployment reviews-v1 --replicas=2
kubectl scale deployment reviews-v2 --replicas=2
```

#### Verify: Test Initial State

```bash
for i in {1..10}; do 
  kubectl exec deployment/productpage -- curl -s http://reviews/ | grep -o "hello\|httpd" || echo "v1"
done | sort | uniq -c
```

All traffic should go to v1.

#### Reflection Questions
- How does this differ from traditional deployment?
- What safety does this provide?
- How can you now test v2 without customer impact?

**Marcus's safety improvement**: New version is deployed but receives no traffic until explicitly enabled

## Exercise 4: Gradual Traffic Shifting

### Step 1: Shift 10% Traffic to v2

```bash
kubectl patch virtualservice reviews-canary --type='merge' -p='{"spec":{"http":[{"route":[{"destination":{"host":"reviews","subset":"v1"},"weight":90},{"destination":{"host":"reviews","subset":"v2"},"weight":10}]}]}}'
```

### Step 2: Test Traffic Distribution

```bash
echo "Testing 90/10 split (v1/v2):"
for i in {1..20}; do 
  kubectl exec deployment/productpage -- curl -s http://reviews/ | grep -o "hello\|httpd" || echo "v1"
done | sort | uniq -c
```

### Step 3: Increase to 50% if v2 Looks Good

```bash
kubectl patch virtualservice reviews-canary --type='merge' -p='{"spec":{"http":[{"route":[{"destination":{"host":"reviews","subset":"v1"},"weight":50},{"destination":{"host":"reviews","subset":"v2"},"weight":50}]}]}}'
```

### Step 4: Complete Rollout to 100% v2

```bash
kubectl patch virtualservice reviews-canary --type='merge' -p='{"spec":{"http":[{"route":[{"destination":{"host":"reviews","subset":"v2"},"weight":100}]}]}}'
```

#### Verify: Test Final State

```bash
for i in {1..10}; do 
  kubectl exec deployment/productpage -- curl -s http://reviews/ | grep -o "hello\|httpd" || echo "v1"
done | sort | uniq -c
```

All traffic should now go to v2.

#### Reflection Questions
- How does gradual rollout reduce risk?
- What monitoring would you want during each phase?
- How quickly can you rollback if issues are detected?

**Marcus's business value**: Deploy with confidence, monitor real user impact, rollback instantly if needed

## Exercise 5: Header-Based Routing for Testing

### Step 1: Implement Testing Strategy

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews-testing
spec:
  hosts: [reviews]
  http:
  - match:
    - headers:
        user-type: {exact: "internal"}
    route:
    - destination: {host: reviews, subset: v2}
  - match:
    - headers:
        beta-user: {exact: "true"}
    route:
    - destination: {host: reviews, subset: v2}
  - route:
    - destination: {host: reviews, subset: v1}
EOF
```

### Step 2: Test Internal Team Access

```bash
kubectl exec deployment/productpage -- curl -H "user-type: internal" http://reviews/
```

### Step 3: Test Beta User Access

```bash
kubectl exec deployment/productpage -- curl -H "beta-user: true" http://reviews/
```

### Step 4: Test Regular User Access

```bash
kubectl exec deployment/productpage -- curl http://reviews/
```

#### Verify: Different Routing Behavior

Internal and beta users should get v2, regular users get v1.

#### Reflection Questions
- How does this enable safe testing in production?
- What other routing criteria could be useful?
- How does this integrate with feature flag systems?

**Marcus's testing strategy**: Internal validation before customer exposure, beta user feedback

### Alternatives and Ecosystem Integration

**Deployment Tools (Complement Service Mesh):**

**Argo Rollouts / Flagger:**
- **What they provide**: Application-level canary deployments, blue-green rollouts, automated promotion
- **Synergy with mesh**: Rollouts handle app deployment, mesh handles network-level traffic control and policy
- **Combined value**: App-level + network-level deployment safety

**Feature Flags (LaunchDarkly, Split, etc.):**
- **What they provide**: Code-level feature toggles, user targeting
- **Synergy with mesh**: Feature flags control code paths, mesh controls traffic routing
- **When to use together**: Complex rollouts with both feature and infrastructure changes

**When Service Mesh Traffic Management Alone is Sufficient:**
- Simple microservices with clear service boundaries
- Need for L7 routing, circuit breaking, and observability
- Teams comfortable with infrastructure-level deployment controls

## Exercise 6: Automatic Failure Detection

### Step 1: Deploy Observability

```bash
make kiali
```

### Step 2: Create Failing Version for Testing

```bash
kubectl create deployment reviews-v3 --image=nginx:broken --replicas=2
kubectl patch deployment reviews-v3 -p '{"spec":{"template":{"metadata":{"labels":{"version":"v3","app":"reviews"}}}}}'
```

### Step 3: Configure Automatic Failure Detection

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews-destination
spec:
  host: reviews
  subsets:
  - name: v1
    labels: {version: v1}
  - name: v2  
    labels: {version: v2}
  - name: v3
    labels: {version: v3}
  trafficPolicy:
    outlierDetection:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
      maxEjectionPercent: 50
EOF
```

### Step 4: Route Traffic to Include Bad Version

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews-with-failure
spec:
  hosts: [reviews]
  http:
  - route:
    - destination: {host: reviews, subset: v2}
      weight: 80
    - destination: {host: reviews, subset: v3}  
      weight: 20
EOF
```

#### Verify: Watch Automatic Failure Handling

```bash
for i in {1..20}; do 
  kubectl exec deployment/productpage -- curl http://reviews/ -w "Status: %{http_code}\n" -m 5 || echo "Failed"
  sleep 1
done
```

Watch as failing instances are automatically removed from traffic.

#### Reflection Questions
- How quickly are failing instances detected?
- What's the customer impact during failure detection?
- How does this compare to manual monitoring and intervention?

**Marcus's automatic safety**: Circuit breakers automatically remove failing instances from traffic

## Exercise 7: Performance-Based Routing

### Step 1: Configure Performance Optimization

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews-performance
spec:
  host: reviews
  subsets:
  - name: v1
    labels: {version: v1}
  - name: v2
    labels: {version: v2}
  trafficPolicy:
    loadBalancer:
      simple: LEAST_CONN
    connectionPool:
      tcp:
        maxConnections: 10
      http:
        http1MaxPendingRequests: 10
        maxRequestsPerConnection: 2
    outlierDetection:
      consecutiveErrors: 3
      interval: 30s
      baseEjectionTime: 30s
EOF
```

### Step 2: Add Retry and Timeout Policies

```bash
kubectl apply -f - <<EOF
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews-performance-routing
spec:
  hosts: [reviews]
  http:
  - timeout: 5s
    retries:
      attempts: 3
      perTryTimeout: 2s
    route:
    - destination: {host: reviews, subset: v2}
      weight: 100
    fault:
      delay:
        percentage:
          value: 0.1
        fixedDelay: 5s
EOF
```

#### Verify: Test Performance Features

```bash
time kubectl exec deployment/productpage -- curl http://reviews/
```

#### Reflection Questions
- How do these policies improve user experience?
- What business impact does automatic retry have?
- How does connection pooling help with scale?

**Marcus's performance optimization**: Automatic routing to best-performing instances

## Exercise 8: SLO-Based Deployment Gates

### Step 1: Define SLO Framework

```bash
cat > slo-deployment-gate.md << EOF
## SLO-Based Canary Promotion

### Service Level Objectives
- **Availability**: 99.9% (8.76 hours downtime/month budget)
- **Latency**: P99 < 100ms (SLI: 95% of requests)  
- **Error Rate**: < 0.1% (SLI: error ratio)

### Canary Promotion Gates
1. **10% Traffic**: Monitor for 15 minutes
   - Error rate < 0.05%
   - P99 latency < 50ms
   - Zero 5xx errors

2. **50% Traffic**: Monitor for 30 minutes
   - Maintain SLO thresholds
   - Customer satisfaction metrics stable
   - No increase in support tickets

3. **100% Traffic**: Full rollout
   - All SLOs maintained
   - Business metrics positive
   - Ready for next deployment cycle

### Automated Rollback Triggers
- Error rate > 0.2% for 5 minutes
- P99 latency > 200ms for 3 minutes  
- Any 5xx error rate > 1%
EOF
```

### Step 2: Business Impact Calculation

```bash
cat > deployment-roi.md << EOF
## Deployment Safety ROI

### Before Service Mesh
- Deployment frequency: Weekly (fear-based)
- Average rollback time: 2 hours
- Customer impact per bad deployment: $50,000
- Bad deployments per month: 2
- Monthly impact: $100,000

### After Service Mesh  
- Deployment frequency: Daily (confidence-based)
- Average rollback time: 30 seconds
- Customer impact per bad deployment: $500 (limited blast radius)
- Bad deployments per month: 1 (better testing)
- Monthly impact: $500

### Business Value
- Risk reduction: $99,500/month
- Deployment velocity: 7x increase
- Time to market: 4x faster
- Developer productivity: +40% (less fear, more features)

**Annual Deployment ROI: $1.2M**
EOF
```

#### Verify: Review Business Case

```bash
cat slo-deployment-gate.md
echo "---"
cat deployment-roi.md
```

#### Reflection Questions
- How do SLOs translate technical metrics to business impact?
- What automation could be built on these foundations?
- How does this change the relationship between development and operations?

## Customer Application: Presenting to Marcus

Practice showing Marcus how traffic management transforms deployment risk into competitive advantage.

### The Business Problem Recap
*"Marcus, you mentioned that deployment fear is slowing down your competitive advantage. Let me show you how service mesh turns deployment into your secret weapon..."*

### Demo Script for Executive Team

```bash
make kiali
```

Show in Kiali:
1. "Here's your current traffic flow - 100% safe"
2. "Now watch as we deploy a new version with zero customer risk"
3. "We can shift traffic gradually and monitor real user impact"
4. "If anything goes wrong, we rollback in seconds, not hours"

### Deployment Confidence Demo

```bash
kubectl patch virtualservice reviews-canary --type='merge' -p='{"spec":{"http":[{"route":[{"destination":{"host":"reviews","subset":"v1"},"weight":90},{"destination":{"host":"reviews","subset":"v2"},"weight":10}]}]}}'
```

"10% of users are now testing the new version. If metrics look good, we increase. If not, we rollback instantly."

### Handling Board Questions

**"How do we know this won't slow down development?"**
- *"This actually accelerates development by removing deployment fear. Teams can deploy daily instead of weekly because the risk is controlled."*

**"What's the business impact of faster deployments?"**
- *"Every week faster to market is worth $X in competitive advantage. Safe daily deployments mean 7x faster feature delivery."*

**"What if the service mesh itself fails?"**
- *"The mesh fails open - your applications continue working normally. You temporarily lose the advanced traffic management but maintain basic functionality."*

## Key Takeaways

### Technical Understanding
- **Canary deployments**: Gradual traffic shifting reduces deployment risk
- **Header-based routing**: Enable testing in production safely
- **Circuit breakers**: Automatic failure detection and recovery
- **Performance policies**: Built-in retry, timeout, and load balancing

### Business Value Framework
- **Deployment velocity**: From weekly to daily deployments
- **Risk mitigation**: Controlled blast radius and instant rollback
- **Customer protection**: Issues caught before full user impact
- **Competitive advantage**: Faster time-to-market with lower risk

### PM Skills
- **Risk/reward positioning**: Show how infrastructure enables business agility
- **Quantified business impact**: Calculate deployment ROI and competitive advantage
- **Technical credibility**: Understand traffic management deeply enough to handle technical questions
- **Executive communication**: Translate technical capabilities to business outcomes

## Troubleshooting Guide

#### If traffic routing not working:
```bash
istioctl analyze
kubectl get virtualservice reviews-canary -o yaml
kubectl get destinationrule reviews-destination -o yaml
```

#### If canary deployment stuck:
```bash
kubectl get pods -l app=reviews --show-labels
kubectl logs deployment/reviews-v2
```

#### If circuit breaker not triggering:
```bash
kubectl logs deployment/productpage -c istio-proxy | grep outlier
istioctl proxy-config endpoints $(kubectl get pod -l app=productpage -o jsonpath='{.items[0].metadata.name}') --cluster "outbound|80||reviews.default.svc.cluster.local"
```

## Cleanup

```bash
kubectl delete virtualservice --all
kubectl delete destinationrule --all
kubectl delete deployment productpage reviews-v1 reviews-v2 reviews-v3 ratings
kubectl delete service productpage reviews ratings
rm -f slo-deployment-gate.md deployment-roi.md
```

## Next Steps

You now understand:
- Advanced traffic management for safe deployments
- Business value of deployment velocity and safety
- Integration with deployment tools and SLO frameworks
- Executive positioning of technical capabilities

**Next module**: [Observability & Troubleshooting](../06-observability/) - Learn how to provide operational excellence through comprehensive observability.

```bash
cd ../06-observability
cat README.md
```

**Progress check**: Can you demonstrate safe deployment practices to a startup CTO? Can you quantify the business value of deployment velocity and safety? If yes, you're ready for operational excellence in Module 6.