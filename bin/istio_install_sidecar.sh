#!/usr/bin/env bash
set -euo pipefail

NS=${NS:-istio-system}

istioctl install -y --set profile=demo

kubectl label namespace default istio-injection=enabled --overwrite

# Addons (Kiali, Prometheus, Jaeger, Grafana)
base=https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons
kubectl apply -f ${base}/prometheus.yaml
kubectl apply -f ${base}/kiali.yaml
kubectl apply -f ${base}/jaeger.yaml
kubectl apply -f ${base}/grafana.yaml

kubectl -n istio-system wait deploy --all --for=condition=Available=True --timeout=180s || true
