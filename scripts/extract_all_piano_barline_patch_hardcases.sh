#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TRAIN_DIR="${ROOT_DIR}/synpdf_182/editmode/training-folder"
PATCH_DIR="${TRAIN_DIR}/patches_piano"
ARCHIVE_DIR="${TRAIN_DIR}/processed/corrections"
PDF_DIR="${ROOT_DIR}/pdfs"
PATCH_WIDTH=32
PATCH_HEIGHT=192
X_SPATIUMS=1.5
Y_SPATIUMS=0.75
DPI=130
RENDER_WIDTH=2000

while [[ $# -gt 0 ]]; do
  case "$1" in
    --patch-dir) PATCH_DIR="$2"; shift 2 ;;
    --patch-width) PATCH_WIDTH="$2"; shift 2 ;;
    --patch-height) PATCH_HEIGHT="$2"; shift 2 ;;
    --x-spatiums) X_SPATIUMS="$2"; shift 2 ;;
    --y-spatiums) Y_SPATIUMS="$2"; shift 2 ;;
    --dpi) DPI="$2"; shift 2 ;;
    --render-width) RENDER_WIDTH="$2"; shift 2 ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

mkdir -p "${PATCH_DIR}" "${ARCHIVE_DIR}"

found_any=0
declare -A seen_bases=()
for f in "${TRAIN_DIR}"/*-50-corrections.json "${ARCHIVE_DIR}"/*-50-corrections.json; do
  if [[ ! -e "${f}" ]]; then
    continue
  fi
  base="$(basename "${f}" -corrections.json)"
  if [[ -n "${seen_bases[${base}]:-}" ]]; then
    continue
  fi
  seen_bases["${base}"]=1
  found_any=1
  out="${PATCH_DIR}/${base}_hardcases.npz"
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
    echo "SKIP ${base}: piano hardcase shard is up to date"
  else
    echo "EXTRACT ${base}"
    python3 "${ROOT_DIR}/scripts/extract_piano_barline_patch_hardcases.py" \
      --corrections "${f}" \
      --pdf "${pdf}" \
      --out "${out}" \
      --patch-width "${PATCH_WIDTH}" \
      --patch-height "${PATCH_HEIGHT}" \
      --x-spatiums "${X_SPATIUMS}" \
      --y-spatiums "${Y_SPATIUMS}" \
      --dpi "${DPI}" \
      --render-width "${RENDER_WIDTH}"
  fi

  if [[ "$(dirname "${f}")" == "${TRAIN_DIR}" ]]; then
    archived="${ARCHIVE_DIR}/$(basename "${f}")"
    mv "${f}" "${archived}"
    echo "ARCHIVE ${base}: moved corrections JSON to ${archived}"
  fi
done

if [[ "${found_any}" -eq 0 ]]; then
  echo "No *-50-corrections.json files found in ${TRAIN_DIR} or ${ARCHIVE_DIR}"
fi
