#!/bin/sh
mode="$1"

case "$mode" in
  success)
    cat
    printf '%s\n' 'CODEX_TOKEN=fixture-secret-token' >&2
    ;;
  success-opencode)
    cat
    printf '%s\n' 'OPENCODE_TOKEN=fixture-secret-token' >&2
    ;;
  fail)
    printf '%s\n' 'provider failed with Bearer fixture-secret-token' >&2
    exit 7
    ;;
  fail-opencode)
    printf '%s\n' 'provider failed with OPENCODE_API_KEY=fixture-secret-token' >&2
    exit 7
    ;;
  timeout)
    trap 'exit 143' TERM
    while :; do :; done
    ;;
  *)
    printf '%s\n' "unknown fixture mode: $mode" >&2
    exit 2
    ;;
esac
