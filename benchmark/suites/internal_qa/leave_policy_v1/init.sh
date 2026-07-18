#!/usr/bin/env bash
set -euo pipefail

SUITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SUITE_DIR/../../../.." && pwd)"

exec "$REPO_ROOT/benchmark/_shared/scripts/init-suite.sh" \
  --suite-dir "$SUITE_DIR" \
  "$@"
