#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DATA_DIR="synpdf_182/editmode/training-folder"
PDF_DIR="pdfs"
PATCH_DIR="synpdf_182/editmode/training-folder/patches_3x6"
HARDCASE_DIR="synpdf_182/editmode/training-folder/hardcases"
MODEL_OUT="synpdf_182/models/barline-patch-cnn-3x6.keras"
SUMMARY_OUT="synpdf_182/models/barline-patch-cnn-3x6-summary.json"
PATCH_WIDTH=32
PATCH_HEIGHT=64
X_SPATIUMS=1.5
Y_SPATIUMS=1.0
RENDER_WIDTH=2000
DPI=130
JOBS=4
RENDER_THREADS=2
EPOCHS=12
BATCH_SIZE=64

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --patch-dir PATH      Output directory for patch shards
  --model-out PATH      Output .keras model path
  --summary-out PATH    Output JSON summary path
  --hardcase-dir PATH   Additional hardcase shard directory to merge into full retraining
  --epochs N            Training epochs (default: ${EPOCHS})
  --batch-size N        Training batch size (default: ${BATCH_SIZE})
  --jobs N              Parallel extraction jobs for base patch shards (default: ${JOBS})
  --render-threads N    PDF render threads per extraction job (default: ${RENDER_THREADS})
  --dpi N               PDF render DPI for patch extraction (default: ${DPI})
  --render-width N      Width for patch-rendered page images (default: ${RENDER_WIDTH})
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
    --hardcase-dir) HARDCASE_DIR="$2"; shift 2 ;;
    --model-out) MODEL_OUT="$2"; shift 2 ;;
    --summary-out) SUMMARY_OUT="$2"; shift 2 ;;
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

mkdir -p "$PATCH_DIR" "$(dirname "$MODEL_OUT")" "$(dirname "$SUMMARY_OUT")"

echo "==> Barline Patch CNN Pipeline"
echo "Root:           $ROOT_DIR"
echo "Data dir:       $DATA_DIR"
echo "PDF dir:        $PDF_DIR"
echo "Patch dir:      $PATCH_DIR"
echo "Hardcase dir:   $HARDCASE_DIR"
echo "Model out:      $MODEL_OUT"
echo "Summary out:    $SUMMARY_OUT"
echo "Patch geometry: ${X_SPATIUMS} x-spatiums each side, ${Y_SPATIUMS} y-spatiums above/below"
echo "Patch tensor:   ${PATCH_WIDTH}x${PATCH_HEIGHT}"
echo "Render width:   $RENDER_WIDTH"
echo "Jobs:           $JOBS"
echo "Render threads: $RENDER_THREADS"
echo "DPI:            $DPI"
echo "Epochs:         $EPOCHS"
echo "Batch size:     $BATCH_SIZE"
echo

echo "==> Step 1: Extract CNN patch shards"
mkdir -p "$PATCH_DIR"
if [[ "$JOBS" -le 1 ]]; then
  python3 -u scripts/extract_barline_patch_dataset.py \
    --data-dir "$DATA_DIR" \
    --pdf-dir "$PDF_DIR" \
    --out-dir "$PATCH_DIR" \
    --patch-width "$PATCH_WIDTH" \
    --patch-height "$PATCH_HEIGHT" \
    --x-spatiums "$X_SPATIUMS" \
    --y-spatiums "$Y_SPATIUMS" \
    --dpi "$DPI" \
    --render-width "$RENDER_WIDTH" \
    --render-threads "$RENDER_THREADS"
else
  find "${DATA_DIR}/processed" -maxdepth 1 -name '*-td.json' -print0 | \
    xargs -0 -P "$JOBS" -I{} bash -lc '
      json="$1"
      data_dir="$2"
      pdf_dir="$3"
      patch_dir="$4"
      patch_width="$5"
      patch_height="$6"
      x_spatiums="$7"
      y_spatiums="$8"
      dpi="$9"
      render_width="${10}"
      render_threads="${11}"
      base=$(basename "$json" -td.json)
      pdf="${pdf_dir}/${base}.pdf"
      out="${patch_dir}/${base}_patches.npz"
      if [[ ! -f "$pdf" ]]; then
        echo "SKIP ${base}: missing PDF ${pdf}"
        exit 0
      fi
      if [[ -f "$out" && "$out" -nt "$json" && "$out" -nt "$pdf" ]]; then
        echo "SKIP ${base}: patch shard is up to date"
        exit 0
      fi
      echo "EXTRACT ${base}"
      python3 -u scripts/extract_barline_patch_dataset.py \
        --pdf "$pdf" \
        --json "$json" \
        --out "$out" \
        --patch-width "$patch_width" \
        --patch-height "$patch_height" \
        --x-spatiums "$x_spatiums" \
        --y-spatiums "$y_spatiums" \
        --dpi "$dpi" \
        --render-width "$render_width" \
        --render-threads "$render_threads"
    ' _ {} "$DATA_DIR" "$PDF_DIR" "$PATCH_DIR" "$PATCH_WIDTH" "$PATCH_HEIGHT" "$X_SPATIUMS" "$Y_SPATIUMS" "$DPI" "$RENDER_WIDTH" "$RENDER_THREADS"
fi

echo
echo "==> Step 2: Extract hardcase shards"
bash scripts/extract_all_barline_patch_hardcases.sh

echo
echo "==> Step 3: Train CNN from scratch on base patches + hardcases"
TRAIN_ARGS=(
  --data-dir "$PATCH_DIR"
  --model-out "$MODEL_OUT"
  --summary-out "$SUMMARY_OUT"
  --epochs "$EPOCHS"
  --batch-size "$BATCH_SIZE"
)
if compgen -G "${HARDCASE_DIR}/*_hardcases.npz" > /dev/null; then
  TRAIN_ARGS+=(--extra-data-dir "$HARDCASE_DIR")
fi
python3 -u scripts/train_barline_patch_cnn.py "${TRAIN_ARGS[@]}"

echo
echo "==> Done"
echo "Model:   $MODEL_OUT"
echo "Summary: $SUMMARY_OUT"
