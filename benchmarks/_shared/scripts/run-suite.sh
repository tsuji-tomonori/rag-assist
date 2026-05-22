#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_PATH=""
OUT_DIR=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --spec)
      SPEC_PATH="$2"
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

if [[ -z "$SPEC_PATH" ]]; then
  echo "run-suite failed: --spec is required" >&2
  exit 10
fi

SUITE_DIR="$(cd "$(dirname "$SPEC_PATH")" && pwd)"
node "$SCRIPT_DIR/validate-suite.mjs" --suite-dir "$SUITE_DIR" >/dev/null

if [[ -n "$OUT_DIR" ]]; then
  mkdir -p "$OUT_DIR"
  cat >"$OUT_DIR/run_summary.json" <<'JSON'
{
  "schemaVersion": "benchmark.run_summary.v1",
  "status": "blocked",
  "promotionGate": {
    "status": "blocked",
    "reasons": ["Chat API execution is not wired in this contract-only runner."]
  }
}
JSON
fi
