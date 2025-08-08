#!/usr/bin/env bash
set -euo pipefail

# Ensure Kiali is installed
if ! kubectl -n istio-system get deploy kiali >/dev/null 2>&1; then
  echo "Kiali not found in istio-system namespace. Installing sample addons..."
  base=https://raw.githubusercontent.com/istio/istio/release-1.22/samples/addons
  kubectl apply -f ${base}/kiali.yaml
fi

# Wait for Kiali to be ready
kubectl -n istio-system rollout status deploy/kiali --timeout=180s || true

# Start dashboard without auto-opening browser and keep it alive
PORT=${KIALI_PORT:-20001}
ADDR=127.0.0.1
URL="http://${ADDR}:${PORT}/kiali/"

if ! lsof -iTCP:${PORT} -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting Kiali dashboard on ${URL}"
  nohup istioctl dashboard kiali --address ${ADDR} --port ${PORT} --browser=false >/tmp/kiali_dashboard.log 2>&1 &
  # brief wait for port-forward to establish
  sleep 2
fi

echo "Opening ${URL}"
if command -v open >/dev/null 2>&1; then
  open "${URL}"
else
  echo "Please browse: ${URL}"
fi
