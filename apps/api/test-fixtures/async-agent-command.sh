#!/bin/sh
mode="$1"

case "$mode" in
  success)
    cat
    printf '%s\n' 'CODEX_TOKEN=fixture-secret-token' >&2
    ;;
  fail)
    printf '%s\n' 'provider failed with Bearer fixture-secret-token' >&2
    exit 7
    ;;
  timeout)
    sleep 5
    ;;
  *)
    printf '%s\n' "unknown fixture mode: $mode" >&2
    exit 2
    ;;
esac
