#!/usr/bin/env bash
set -euo pipefail

# Install Ambient profile (ztunnel and waypoint infra)
istioctl install -y --set profile=ambient

# Move default namespace to ambient dataplane
kubectl label namespace default istio.io/dataplane-mode=ambient --overwrite

# Optional: install addons for observability/Kiali
base=https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons
kubectl apply -f ${base}/prometheus.yaml
kubectl apply -f ${base}/kiali.yaml
kubectl apply -f ${base}/jaeger.yaml
kubectl apply -f ${base}/grafana.yaml

kubectl -n istio-system wait deploy --all --for=condition=Available=True --timeout=180s || true
