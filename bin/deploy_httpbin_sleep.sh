#!/usr/bin/env bash
set -euo pipefail

REL=${ISTIO_REL:-release-1.22}
base=https://raw.githubusercontent.com/istio/istio/${REL}/samples

kubectl apply -f ${base}/httpbin/httpbin.yaml
kubectl apply -f ${base}/sleep/sleep.yaml
kubectl wait --for=condition=available deploy --all --timeout=180s
