#!/usr/bin/env bash
set -euo pipefail

# Remove sample apps
set +e
kubectl delete -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/bookinfo/networking/bookinfo-gateway.yaml
kubectl delete -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/bookinfo/platform/kube/bookinfo.yaml
kubectl delete -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/bookinfo/networking/destination-rule-all.yaml
kubectl delete -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/httpbin/httpbin.yaml
kubectl delete -f https://raw.githubusercontent.com/istio/istio/release-1.22/samples/sleep/sleep.yaml

# Lab manifests
kubectl delete -f manifests/traffic/basic-vs-dr.yaml
kubectl delete -f manifests/mtls/peer-authentication-permissive.yaml
kubectl delete -f manifests/mtls/peer-authentication-strict.yaml
kubectl delete -f manifests/authz/deny-all.yaml

# Uninstall addons
base=https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons
kubectl delete -f ${base}/kiali.yaml
kubectl delete -f ${base}/prometheus.yaml
kubectl delete -f ${base}/jaeger.yaml
kubectl delete -f ${base}/grafana.yaml

# Uninstall Istio completely
istioctl uninstall -y --purge || true
kubectl delete ns istio-system --ignore-not-found

# Optional: delete cluster if asked
if [[ "${DELETE_CLUSTER:-false}" == "true" ]]; then
  bash bin/kind_down.sh || true
fi
