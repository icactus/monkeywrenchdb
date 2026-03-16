#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRAIN_DIR="${ROOT_DIR}/synpdf_182/editmode/training-folder"
HARDCASE_DIR="${TRAIN_DIR}/hardcases"
PDF_DIR="${ROOT_DIR}/pdfs"

mkdir -p "${HARDCASE_DIR}"

found_any=0
for f in "${TRAIN_DIR}"/*-corrections.json; do
  if [[ ! -e "${f}" ]]; then
    continue
  fi
  found_any=1
  base="$(basename "${f}" -corrections.json)"
  out="${HARDCASE_DIR}/${base}_hardcases.npz"
  pdf="${PDF_DIR}/${base}.pdf"

  if [[ ! -s "${f}" ]]; then
    echo "SKIP ${base}: empty corrections file"
    continue
  fi

  if [[ ! -f "${pdf}" ]]; then
    echo "SKIP ${base}: missing PDF ${pdf}"
    continue
  fi

  echo "EXTRACT ${base}"
  python3 "${ROOT_DIR}/scripts/extract_barline_patch_hardcases.py" \
    --corrections "${f}" \
    --pdf "${pdf}" \
    --out "${out}"
done

if [[ "${found_any}" -eq 0 ]]; then
  echo "No *-corrections.json files found in ${TRAIN_DIR}"
fi
