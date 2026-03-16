#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ $# -lt 1 ]]; then
  echo "Usage: $(basename "$0") <pdf-id> [--epochs N] [--batch-size N]" >&2
  echo "Example: $(basename "$0") 250-71" >&2
  exit 1
fi

PDF_ID="$1"
shift

DATA_DIR="synpdf_182/editmode/training-folder"
PATCH_DIR="${DATA_DIR}/patches_3x6"
HARDCASE_DIR="${DATA_DIR}/hardcases"
MODEL_OUT="synpdf_182/models/barline-patch-cnn-3x6.keras"
SUMMARY_OUT="synpdf_182/models/barline-patch-cnn-3x6-summary.json"
BROWSER_OUT="synpdf_182/models/barline-patch-cnn-3x6-browser.js"
EPOCHS=12
BATCH_SIZE=64

while [[ $# -gt 0 ]]; do
  case "$1" in
    --epochs) EPOCHS="$2"; shift 2 ;;
    --batch-size) BATCH_SIZE="$2"; shift 2 ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

PDF_PATH="pdfs/${PDF_ID}.pdf"
TD_JSON="${DATA_DIR}/${PDF_ID}-td.json"
TD_JSON_PROCESSED="${DATA_DIR}/processed/${PDF_ID}-td.json"
CORRECTIONS_JSON="${DATA_DIR}/${PDF_ID}-corrections.json"
PATCH_OUT="${PATCH_DIR}/${PDF_ID}_patches.npz"
HARDCASE_OUT="${HARDCASE_DIR}/${PDF_ID}_hardcases.npz"

mkdir -p "$PATCH_DIR" "$HARDCASE_DIR" "$(dirname "$MODEL_OUT")"

if [[ ! -f "$PDF_PATH" ]]; then
  echo "Missing PDF: $PDF_PATH" >&2
  exit 1
fi

if [[ -f "$TD_JSON_PROCESSED" ]]; then
  TD_JSON="$TD_JSON_PROCESSED"
fi

if [[ -f "$TD_JSON" ]]; then
  echo "==> Rebuild base patch shard for ${PDF_ID}"
  python3 scripts/extract_barline_patch_dataset.py \
    --pdf "$PDF_PATH" \
    --json "$TD_JSON" \
    --out "$PATCH_OUT"
else
  echo "SKIP base patch shard: missing td.json for ${PDF_ID}"
fi

if [[ -s "$CORRECTIONS_JSON" ]]; then
  echo
  echo "==> Rebuild hardcase shard for ${PDF_ID}"
  python3 scripts/extract_barline_patch_hardcases.py \
    --corrections "$CORRECTIONS_JSON" \
    --pdf "$PDF_PATH" \
    --out "$HARDCASE_OUT"
else
  echo
  echo "SKIP hardcase shard: missing or empty corrections file for ${PDF_ID}"
fi

echo
echo "==> Retrain full CNN on all shards"
python3 scripts/train_barline_patch_cnn.py \
  --data-dir "$PATCH_DIR" \
  --extra-data-dir "$HARDCASE_DIR" \
  --model-out "$MODEL_OUT" \
  --summary-out "$SUMMARY_OUT" \
  --epochs "$EPOCHS" \
  --batch-size "$BATCH_SIZE"

echo
echo "==> Export browser CNN"
python3 scripts/export_barline_patch_cnn_to_js.py \
  --model "$MODEL_OUT" \
  --out "$BROWSER_OUT"

echo
echo "==> Done"
echo "Model:   $MODEL_OUT"
echo "Browser: $BROWSER_OUT"
echo "Summary: $SUMMARY_OUT"
