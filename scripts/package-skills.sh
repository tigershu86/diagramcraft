#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUTPUT_DIR="${1:-${PROJECT_ROOT}/dist}"
PACKAGE_TMP="$(mktemp -d)"
trap 'rm -rf "${PACKAGE_TMP}"' EXIT

command -v zip >/dev/null 2>&1 || {
  echo "zip is required to package Claude skills" >&2
  exit 1
}

mkdir -p "${OUTPUT_DIR}"

for skill in arch-diagram flowchart; do
  (
    cd "${PROJECT_ROOT}"
    zip -qr "${PACKAGE_TMP}/${skill}.skill" "${skill}" -x "*/.DS_Store"
  )
  cp "${PACKAGE_TMP}/${skill}.skill" "${OUTPUT_DIR}/${skill}.skill"
  echo "Packaged ${OUTPUT_DIR}/${skill}.skill"
done
