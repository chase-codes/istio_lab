#!/usr/bin/env bash
set -euo pipefail

CLUSTER_NAME=${CLUSTER_NAME:-istio-lab}

kind delete cluster --name "${CLUSTER_NAME}" || true
