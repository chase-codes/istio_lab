## Glossary

- Istiod: Istio control plane that manages config, certs, and discovery.
- Envoy: L7 proxy used for sidecars/gateways.
- Sidecar: Per-pod Envoy proxy injected alongside app container.
- Ambient: Sidecar-less dataplane; ztunnel at L4, waypoints for L7.
- ztunnel: Ambient L4 component handling mTLS and connectivity.
- Waypoint: Per-service proxy in ambient that enforces L7 policy.
- xDS: Dynamic discovery APIs Envoy uses to receive config.
- PeerAuthentication: Resource to set mTLS mode per namespace/workload.
- AuthorizationPolicy: L7 allow/deny policies.
- VirtualService: Routing rules for requests.
- DestinationRule: Policies (subsets, TLS, LB) for a service.
- Gateway: Ingress/egress entry point.
- ServiceEntry: Register external services.
