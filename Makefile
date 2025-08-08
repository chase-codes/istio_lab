.PHONY: tools kind-up kind-down istio-sidecar istio-ambient bookinfo httpbin-sleep traffic kiali mtls-permissive mtls-strict authz-deny-all cleanup

SHELL := /bin/bash

TOOLS := kubectl kind istioctl helm jq

TOOLS_CHECK := $(foreach bin,$(TOOLS),$(if $(shell command -v $(bin) 2>/dev/null),,missing-$(bin)))

tools:
	@bash bin/install_tools.sh

kind-up:
	@bash bin/kind_up.sh

kind-down:
	@bash bin/kind_down.sh

istio-sidecar:
	@bash bin/istio_install_sidecar.sh

istio-ambient:
	@bash bin/istio_install_ambient.sh

bookinfo:
	@bash bin/deploy_bookinfo.sh

httpbin-sleep:
	@bash bin/deploy_httpbin_sleep.sh

traffic:
	@kubectl apply -f manifests/traffic/basic-vs-dr.yaml

mtls-permissive:
	@kubectl apply -f manifests/mtls/peer-authentication-permissive.yaml

mtls-strict:
	@kubectl apply -f manifests/mtls/peer-authentication-strict.yaml

authz-deny-all:
	@kubectl apply -f manifests/authz/deny-all.yaml

kiali:
	@bash bin/open_kiali.sh

cleanup:
	@bash bin/cleanup.sh
