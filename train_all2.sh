#!/bin/bash
set -e
cd synpdf_182/editmode/training-folder

echo "Extracting features from processed data..."
rm -f combined_features.csv
rm -f processed/*_features.csv

for json_file in processed/*.json; do
    base_name=$(basename "$json_file" .json)
    
    # Try pdf extension first, then pdf-td, then exact match
    pdf_file="processed/${base_name}.pdf"
    if [ ! -f "$pdf_file" ]; then
        # Example: 1-3-td.json originally came from 1-3.pdf
        orig_name=${base_name%-td}
        pdf_file="processed/${orig_name}.pdf"
    fi
    
    if [ -f "$pdf_file" ]; then
        echo "Processing $pdf_file with $json_file"
        python3 ../../../scripts/extract_barline_features_temp.py \
            --pdf "$pdf_file" \
            --json "$json_file" \
            --out "processed/${base_name}_features.csv"
    else
        echo "WARNING: Could not find PDF for $json_file"
    fi
done

echo "Combining features..."
first=1
for csv_file in processed/*_features.csv; do
    if [ $first -eq 1 ]; then
        cat "$csv_file" > combined_features.csv
        first=0
    else
        tail -n +2 "$csv_file" >> combined_features.csv
    fi
done

echo "Training model..."
cd ../../../
python3 scripts/train_barline_model.py

echo "Done!"
