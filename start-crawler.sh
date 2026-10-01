#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Prefer the installed Codex Node runtime; otherwise use Node 24+ on PATH.
foodi_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [[ ! -x "$foodi_node" ]]; then
  foodi_node="$(command -v node || true)"
fi
if [[ -z "$foodi_node" ]] || ! "$foodi_node" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 24 ? 0 : 1)'; then
  echo "Node.js 24 or newer is required to start the crawler." >&2
  exit 1
fi
if [[ ! -d node_modules/tsx ]]; then
  echo "Project dependencies are missing. Install them with pnpm install first." >&2
  exit 1
fi
exec "$foodi_node" scripts/local-worker.mjs
