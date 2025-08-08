#!/usr/bin/env bash
set -euo pipefail

REL=${ISTIO_REL:-release-1.22}
base=https://raw.githubusercontent.com/istio/istio/${REL}/samples/bookinfo

kubectl apply -f ${base}/platform/kube/bookinfo.yaml
kubectl wait --for=condition=available deploy --all --timeout=180s

# Gateway and VS
kubectl apply -f ${base}/networking/bookinfo-gateway.yaml

# (Optional) DestinationRule defaults for mutual TLS
kubectl apply -f ${base}/networking/destination-rule-all.yaml || true

# Helpful port-forward for local access
set +e
kubectl -n default port-forward svc/productpage 9080:9080 >/dev/null 2>&1 &
echo "Productpage forwarded to http://localhost:9080"
