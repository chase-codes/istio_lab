#!/usr/bin/env bash
set -euo pipefail

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required. Install from https://brew.sh" >&2
  exit 1
fi

pkgs=(kind kubectl istioctl helm jq watch httpie)
for p in "${pkgs[@]}"; do
  if ! command -v "$p" >/dev/null 2>&1; then
    echo "Installing $p..."
    brew install "$p" || brew install --cask "$p" || true
  else
    echo "$p already installed"
  fi
done

echo "Tools ready."
