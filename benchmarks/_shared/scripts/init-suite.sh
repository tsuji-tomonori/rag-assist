#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUITE_DIR=""
OUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --suite-dir)
      SUITE_DIR="$2"
      shift 2
      ;;
    --out)
      OUT_DIR="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [[ -z "$SUITE_DIR" ]]; then
  echo "init-suite failed: --suite-dir is required" >&2
  exit 10
fi

node "$SCRIPT_DIR/validate-suite.mjs" --suite-dir "$SUITE_DIR" >/dev/null

if [[ -n "$OUT_DIR" ]]; then
  mkdir -p "$OUT_DIR"
  cat >"$OUT_DIR/init_result.json" <<'JSON'
{
  "schemaVersion": "benchmark.init_result.v1",
  "status": "validation_only",
  "message": "Suite input validation passed. API upload, ingest polling, and index verification are implemented by the environment-specific runner."
}
JSON
fi
