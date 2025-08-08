# AKS Notes

- Use AKS clusters with sufficient node resources (2+ DSv3 nodes recommended for addons).
- Sidecar: standard Istio install works; ensure LoadBalancer for `istio-ingressgateway`.
- Ambient: check kernel/eBPF prerequisites and current Istio ambient support status.
- Integrations: Azure Monitor for Prometheus, AGIC or NGINX Ingress with Istio gateways.
