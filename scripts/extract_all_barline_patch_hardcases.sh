#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRAIN_DIR="${ROOT_DIR}/synpdf_182/editmode/training-folder"
HARDCASE_DIR="${TRAIN_DIR}/hardcases"
ARCHIVE_DIR="${TRAIN_DIR}/processed/corrections"
PDF_DIR="${ROOT_DIR}/pdfs"

mkdir -p "${HARDCASE_DIR}" "${ARCHIVE_DIR}"

found_any=0
declare -A seen_bases=()
for f in "${TRAIN_DIR}"/*-corrections.json "${ARCHIVE_DIR}"/*-corrections.json; do
  if [[ ! -e "${f}" ]]; then
    continue
  fi
  base="$(basename "${f}" -corrections.json)"
  if [[ "${base}" == *-50 ]]; then
    echo "SKIP ${base}: piano corrections belong to the piano CNN pipeline"
    continue
  fi
  if [[ -n "${seen_bases[${base}]:-}" ]]; then
    continue
  fi
  seen_bases["${base}"]=1
  found_any=1
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

  if [[ -f "${out}" && "${out}" -nt "${f}" && "${out}" -nt "${pdf}" ]]; then
    echo "SKIP ${base}: hardcase shard is up to date"
  else
  echo "EXTRACT ${base}"
  python3 "${ROOT_DIR}/scripts/extract_barline_patch_hardcases.py" \
    --corrections "${f}" \
    --pdf "${pdf}" \
    --out "${out}"
  fi

  if [[ "$(dirname "${f}")" == "${TRAIN_DIR}" ]]; then
    archived="${ARCHIVE_DIR}/$(basename "${f}")"
    mv "${f}" "${archived}"
    echo "ARCHIVE ${base}: moved corrections JSON to ${archived}"
  fi
done

if [[ "${found_any}" -eq 0 ]]; then
  echo "No *-corrections.json files found in ${TRAIN_DIR} or ${ARCHIVE_DIR}"
fi
