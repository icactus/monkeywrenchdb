import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf


LAYER_NAMES = [
    "conv2d",
    "conv2d_1",
    "conv2d_2",
    "conv2d_3",
    "conv2d_4",
    "dense",
    "dense_1",
]


def to_payload(model):
    payload = {
        "input_shape": [64, 32, 1],
        "layers": {},
    }
    for layer_name in LAYER_NAMES:
        layer = model.get_layer(layer_name)
        weights = layer.get_weights()
        if len(weights) != 2:
            raise ValueError(f"Expected kernel+bias for {layer_name}, got {len(weights)} tensors")
        kernel, bias = weights
        payload["layers"][layer_name] = {
            "kernel_shape": list(kernel.shape),
            "kernel": np.asarray(kernel, dtype=np.float32).reshape(-1).tolist(),
            "bias_shape": list(bias.shape),
            "bias": np.asarray(bias, dtype=np.float32).reshape(-1).tolist(),
        }
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to .keras model")
    parser.add_argument("--out", required=True, help="Output JS file path")
    parser.add_argument("--var-name", default="BarlinePatchCnnModelData", help="Global JS variable name")
    args = parser.parse_args()

    model = tf.keras.models.load_model(args.model)
    payload = to_payload(model)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    json_blob = json.dumps(payload, separators=(",", ":"))
    out_path.write_text(f"window.{args.var_name}={json_blob};\n", encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
