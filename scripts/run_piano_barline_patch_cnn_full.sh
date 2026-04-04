#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DATA_DIR="synpdf_182/editmode/training-folder"
PDF_DIR="pdfs"
PATCH_DIR="synpdf_182/editmode/training-folder/patches_piano"
MODEL_OUT="synpdf_182/models/piano-barline-patch-cnn.keras"
SUMMARY_OUT="synpdf_182/models/piano-barline-patch-cnn-summary.json"
BROWSER_OUT="synpdf_182/models/piano-barline-patch-cnn-browser.js"
SUMMARY_HISTORY_DIR="synpdf_182/models/history"
PATCH_WIDTH=48
PATCH_HEIGHT=192
X_SPATIUMS=1.5
Y_SPATIUMS=0.75
RENDER_WIDTH=2000
DPI=130
JOBS=4
RENDER_THREADS=2
EPOCHS=12
BATCH_SIZE=64
ONNX_SITE_PACKAGES="${ROOT_DIR}/.venv-onnx/lib/python3.11/site-packages"
ONNX_OUT=""

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --patch-dir PATH      Output directory for piano patch shards
  --model-out PATH      Output .keras model path
  --summary-out PATH    Output JSON summary path
  --browser-out PATH    Output browser JS model path
  --onnx-out PATH       Output ONNX model path (default: derived from --model-out)
  --summary-history-dir PATH  Directory for timestamped summary snapshots
  --epochs N            Training epochs (default: ${EPOCHS})
  --batch-size N        Training batch size (default: ${BATCH_SIZE})
  --jobs N              Parallel extraction jobs (default: ${JOBS})
  --render-threads N    PDF render threads per extraction job (default: ${RENDER_THREADS})
  --dpi N               PDF render DPI (default: ${DPI})
  --render-width N      Width for rendered page images (default: ${RENDER_WIDTH})
  --patch-width N       Patch tensor width (default: ${PATCH_WIDTH})
  --patch-height N      Patch tensor height (default: ${PATCH_HEIGHT})
  --x-spatiums N        Horizontal crop margin in spatiums each side (default: ${X_SPATIUMS})
  --y-spatiums N        Vertical crop margin in spatiums above/below (default: ${Y_SPATIUMS})
  --help                Show this message
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --patch-dir) PATCH_DIR="$2"; shift 2 ;;
    --model-out) MODEL_OUT="$2"; shift 2 ;;
    --summary-out) SUMMARY_OUT="$2"; shift 2 ;;
    --browser-out) BROWSER_OUT="$2"; shift 2 ;;
    --onnx-out) ONNX_OUT="$2"; shift 2 ;;
    --summary-history-dir) SUMMARY_HISTORY_DIR="$2"; shift 2 ;;
    --epochs) EPOCHS="$2"; shift 2 ;;
    --batch-size) BATCH_SIZE="$2"; shift 2 ;;
    --jobs) JOBS="$2"; shift 2 ;;
    --render-threads) RENDER_THREADS="$2"; shift 2 ;;
    --dpi) DPI="$2"; shift 2 ;;
    --render-width) RENDER_WIDTH="$2"; shift 2 ;;
    --patch-width) PATCH_WIDTH="$2"; shift 2 ;;
    --patch-height) PATCH_HEIGHT="$2"; shift 2 ;;
    --x-spatiums) X_SPATIUMS="$2"; shift 2 ;;
    --y-spatiums) Y_SPATIUMS="$2"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$ONNX_OUT" ]]; then
  ONNX_OUT="${MODEL_OUT%.keras}.onnx"
fi

mkdir -p "$PATCH_DIR" "$(dirname "$MODEL_OUT")" "$(dirname "$SUMMARY_OUT")" "$(dirname "$BROWSER_OUT")" "$(dirname "$ONNX_OUT")" "$SUMMARY_HISTORY_DIR"

echo "==> Piano Barline CNN Pipeline"
echo "Root:           $ROOT_DIR"
echo "Data dir:       $DATA_DIR"
echo "PDF dir:        $PDF_DIR"
echo "Patch dir:      $PATCH_DIR"
echo "Model out:      $MODEL_OUT"
echo "Summary out:    $SUMMARY_OUT"
echo "Browser out:    $BROWSER_OUT"
echo "ONNX out:       $ONNX_OUT"
echo "Patch geometry: ${X_SPATIUMS} x-spatiums each side, ${Y_SPATIUMS} y-spatiums above/below"
echo "Patch tensor:   ${PATCH_WIDTH}x${PATCH_HEIGHT}"
echo "Render width:   $RENDER_WIDTH"
echo "Jobs:           $JOBS"
echo "Render threads: $RENDER_THREADS"
echo "DPI:            $DPI"
echo "Epochs:         $EPOCHS"
echo "Batch size:     $BATCH_SIZE"
echo

echo "==> Step 1: Extract piano CNN patch shards"
find "${DATA_DIR}/processed" -maxdepth 1 -name '*-50-td.json' -print0 | \
  xargs -0 -P "$JOBS" -I{} bash -lc '
    json="$1"
    pdf_dir="$2"
    patch_dir="$3"
    patch_width="$4"
    patch_height="$5"
    x_spatiums="$6"
    y_spatiums="$7"
    dpi="$8"
    render_width="$9"
    render_threads="${10}"
    base=$(basename "$json" -td.json)
    pdf="${pdf_dir}/${base}.pdf"
    out="${patch_dir}/${base}_patches.npz"
    if [[ ! -f "$pdf" ]]; then
      echo "SKIP ${base}: missing PDF ${pdf}"
      exit 0
    fi
    if [[ -f "$out" && "$out" -nt "$json" && "$out" -nt "$pdf" ]]; then
      echo "SKIP ${base}: piano patch shard is up to date"
      exit 0
    fi
    echo "EXTRACT ${base}"
    python3 -u scripts/extract_piano_barline_patch_dataset.py \
      --pdf "$pdf" \
      --json "$json" \
      --out "$out" \
      --patch-width "$patch_width" \
      --patch-height "$patch_height" \
      --x-spatiums "$x_spatiums" \
      --y-spatiums "$y_spatiums" \
      --dpi "$dpi" \
      --render-width "$render_width" \
      --include-gt-rescue \
      --render-threads "$render_threads"
  ' _ {} "$PDF_DIR" "$PATCH_DIR" "$PATCH_WIDTH" "$PATCH_HEIGHT" "$X_SPATIUMS" "$Y_SPATIUMS" "$DPI" "$RENDER_WIDTH" "$RENDER_THREADS"

echo
echo "==> Step 2: Train piano CNN"
python3 -u scripts/train_barline_patch_cnn.py \
  --data-dir "$PATCH_DIR" \
  --model-out "$MODEL_OUT" \
  --summary-out "$SUMMARY_OUT" \
  --epochs "$EPOCHS" \
  --batch-size "$BATCH_SIZE"

echo
echo "==> Step 3: Export piano browser CNN"
python3 -u scripts/export_barline_patch_cnn_to_js.py \
  --model "$MODEL_OUT" \
  --out "$BROWSER_OUT" \
  --var-name "PianoBarlinePatchCnnModelData" \
  --x-spatiums "$X_SPATIUMS" \
  --y-spatiums "$Y_SPATIUMS"

if [[ -d "$ONNX_SITE_PACKAGES" ]]; then
  echo
  echo "==> Step 4: Export piano ONNX CNN"
  PYTHONPATH="${ONNX_SITE_PACKAGES}${PYTHONPATH:+:${PYTHONPATH}}" python3 scripts/export_barline_patch_cnn_to_onnx.py \
    --model "$MODEL_OUT" \
    --out "$ONNX_OUT" \
    --x-spatiums "$X_SPATIUMS" \
    --y-spatiums "$Y_SPATIUMS"
else
  echo
  echo "==> Step 4: Skip ONNX export (missing $ONNX_SITE_PACKAGES)"
fi

echo
echo "==> Step 5: Archive timestamped training summary"
SUMMARY_STAMP="$(date +%Y%m%d-%H%M%S)"
SUMMARY_ARCHIVE_OUT="${SUMMARY_HISTORY_DIR}/piano-barline-patch-cnn-summary-${SUMMARY_STAMP}.json"
cp "$SUMMARY_OUT" "$SUMMARY_ARCHIVE_OUT"
echo "Summary snapshot: $SUMMARY_ARCHIVE_OUT"

echo
echo "==> Done"
echo "Model:   $MODEL_OUT"
echo "Browser: $BROWSER_OUT"
echo "ONNX:    $ONNX_OUT"
echo "Summary: $SUMMARY_OUT"
