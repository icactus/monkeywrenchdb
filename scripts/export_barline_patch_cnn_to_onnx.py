import argparse
import json
from pathlib import Path

import tensorflow as tf
import tf2onnx


def build_metadata(model, x_spatiums, y_spatiums):
    input_shape = model.input_shape
    if not isinstance(input_shape, (list, tuple)) or len(input_shape) != 4:
        raise ValueError(f"Unexpected model input shape: {input_shape}")
    return {
        "input_shape": [int(input_shape[1]), int(input_shape[2]), int(input_shape[3])],
        "crop_config": {
            "x_spatiums": float(x_spatiums),
            "y_spatiums": float(y_spatiums),
        },
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to .keras model")
    parser.add_argument("--out", required=True, help="Output ONNX file path")
    parser.add_argument("--metadata-out", help="Optional metadata JSON path (defaults to <out>.json)")
    parser.add_argument("--x-spatiums", type=float, default=1.5, help="Horizontal crop margin in spatiums each side")
    parser.add_argument("--y-spatiums", type=float, default=1.0, help="Vertical crop margin in spatiums above/below")
    parser.add_argument("--opset", type=int, default=17, help="ONNX opset version")
    args = parser.parse_args()

    model = tf.keras.models.load_model(args.model)
    input_signature = (
        tf.TensorSpec((None,) + tuple(model.input_shape[1:]), tf.float32, name="input"),
    )
    onnx_model, _ = tf2onnx.convert.from_keras(
        model,
        input_signature=input_signature,
        opset=args.opset,
        output_path=None,
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(onnx_model.SerializeToString())

    metadata_out = Path(args.metadata_out) if args.metadata_out else Path(str(out_path) + ".json")
    metadata = build_metadata(model, args.x_spatiums, args.y_spatiums)
    metadata_out.write_text(json.dumps(metadata, separators=(",", ":")) + "\n", encoding="utf-8")

    print(f"Wrote {out_path}")
    print(f"Wrote {metadata_out}")


if __name__ == "__main__":
    main()
