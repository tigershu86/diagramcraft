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
OUTPUT_DIR="$(cd "${OUTPUT_DIR}" && pwd -P)"

for skill in arch-diagram flowchart; do
  SOURCE_SKILL="$(cd "${PROJECT_ROOT}/${skill}" && pwd -P)"
  case "${OUTPUT_DIR}/" in
    "${SOURCE_SKILL}/"*)
      echo "Refusing to package skills into source skill directory: ${OUTPUT_DIR}" >&2
      exit 1
      ;;
  esac
done

for skill in arch-diagram flowchart; do
  STAGING_ROOT="${PACKAGE_TMP}/staging-${skill}"
  STAGED_SKILL="${STAGING_ROOT}/${skill}"
  mkdir -p "${STAGED_SKILL}/references"
  cp -R "${PROJECT_ROOT}/${skill}/." "${STAGED_SKILL}/"
  cp "${PROJECT_ROOT}/schema/diagram.schema.json" \
    "${STAGED_SKILL}/references/diagram.schema.json"

  (
    cd "${STAGING_ROOT}"
    zip -qr "${PACKAGE_TMP}/${skill}.skill" "${skill}" -x "*/.DS_Store"
  )
  cp "${PACKAGE_TMP}/${skill}.skill" "${OUTPUT_DIR}/${skill}.skill"
  echo "Packaged ${OUTPUT_DIR}/${skill}.skill"
done
