#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME=${CLUSTER_NAME:-istio-lab}

if kind get clusters | grep -q "^${CLUSTER_NAME}$"; then
  echo "Cluster ${CLUSTER_NAME} already exists"
  exit 0
fi

kind create cluster --name "${CLUSTER_NAME}" --config kind/cluster.yaml

echo "Waiting for CoreDNS to be ready..."
kubectl -n kube-system rollout status deploy/coredns --timeout=120s || true

echo "Cluster ${CLUSTER_NAME} is ready."
