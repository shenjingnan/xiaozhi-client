#!/bin/bash
# Biome lint wrapper that filters out nx-incompatible arguments
# This script removes --reporter arguments that Biome doesn't support

PROJECT_ROOT="${1:-.}"
shift

# Filter out --reporter arguments as Biome uses --log-kind instead
FILTERED_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --reporter*)
      # Skip --reporter arguments
      shift
      ;;
    *)
      # Keep other arguments
      FILTERED_ARGS+=("$1")
      shift
      ;;
  esac
done

# Run biome check with filtered arguments
biome check "$PROJECT_ROOT" "${FILTERED_ARGS[@]}"
