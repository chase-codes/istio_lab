## Troubleshooting

### Kiali shows a blank page
- Fix: ensure dashboard runs and open the correct base path.
  ```bash
  pkill -f "istioctl dashboard kiali" || true
  make kiali
  # opens http://127.0.0.1:20001/kiali/
  ```
- Check readiness and logs:
  ```bash
  kubectl -n istio-system rollout status deploy/kiali --timeout=180s
  kubectl -n istio-system logs deploy/kiali | tail -n 200
  ```

### Sidecars not injected
- Ensure namespace label:
  ```bash
  kubectl label ns default istio-injection=enabled --overwrite
  ```
- Restart pods (new pods only get injected):
  ```bash
  kubectl rollout restart deploy -n default
  ```

### Ambient + sidecar labels conflict
- For ambient, remove sidecar injection labels:
  ```bash
  kubectl label ns default istio-injection- --overwrite
  kubectl label ns default istio.io/dataplane-mode=ambient --overwrite
  ```

### STRICT mTLS breaks calls
- Add `ISTIO_MUTUAL` DR if missing:
  ```yaml
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
  ```
- Verify with:
  ```bash
  istioctl authn tls-check httpbin.default.svc.cluster.local
  ```

### Productpage not accessible
- Ensure port-forward is up:
  ```bash
  kubectl -n default port-forward svc/productpage 9080:9080
  ```
- Or expose via ingress gateway in LoadBalancer mode on AKS.

### DNS or endpoints seem stale
- Check EndpointSlices and kube-proxy:
  ```bash
  kubectl get endpointslices
  kubectl -n kube-system logs ds/kube-proxy | tail
  ```

### Resource constraints
- Reduce addons or add resources in Docker Desktop; ensure 4+ CPUs and 8+ GB RAM.
