## Tools Quick Reference

### Cluster and mesh
- kubectl
  - Pods: `kubectl get pods -o wide`
  - Logs: `kubectl logs deploy/istiod -n istio-system`
  - Watch: `kubectl get pods -w`
- istioctl
  - Check install: `istioctl version`
  - Inspect proxy config:
    - Endpoints: `istioctl proxy-config endpoints <pod> -n <ns>`
    - Clusters: `istioctl proxy-config clusters <pod> -n <ns>`
    - Routes: `istioctl proxy-config routes <pod> -n <ns>`
  - TLS check: `istioctl proxy-config clusters <pod> --fqdn <svc> --direction outbound`

### Observability
- Kiali: `make kiali` then browse the Graph and Validations
- Prometheus: `istioctl dashboard prometheus`
- Jaeger: `istioctl dashboard jaeger`

### Traffic generation
- curl from sleep:
  ```bash
  kubectl exec deploy/sleep -c sleep -- curl -sS http://httpbin:8000/get | jq .headers.Host
  ```
- Local load:
  ```bash
  for i in {1..50}; do curl -sS http://localhost:9080/productpage >/dev/null; done
  ```

### Debugging
- Sidecar present?
  ```bash
  kubectl get pods -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].name}{"\n"}{end}'
  ```
- Kiali logs:
  ```bash
  kubectl -n istio-system logs deploy/kiali | tail -n 200
  ```
- Envoy admin (port-forward to sidecar):
  ```bash
  kubectl port-forward <pod> 15000:15000 &
  open http://127.0.0.1:15000
  ```
