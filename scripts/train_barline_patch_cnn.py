import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.model_selection import train_test_split
import tensorflow as tf


def load_shards(data_dir):
    shard_paths = sorted(Path(data_dir).glob("*_patches.npz"))
    if not shard_paths:
        raise FileNotFoundError(f"No *_patches.npz files found in {data_dir}")

    patches = []
    labels = []
    source_ids = []
    source_kind = []

    for shard_path in shard_paths:
        with np.load(shard_path, allow_pickle=False) as shard:
            if shard["patches"].shape[0] == 0:
                continue
            patches.append(shard["patches"])
            labels.append(shard["labels"])
            source_ids.append(shard["source_id"])
            source_kind.append(shard["source_kind"])

    if not patches:
        raise RuntimeError("All shards were empty.")

    x = np.concatenate(patches, axis=0).astype(np.float32)
    y = np.concatenate(labels, axis=0).astype(np.uint8)
    groups = np.concatenate(source_ids, axis=0)
    kinds = np.concatenate(source_kind, axis=0)

    x = np.expand_dims(x, axis=-1)
    return x, y, groups, kinds


def build_model(input_shape):
    model = tf.keras.Sequential([
        tf.keras.layers.Input(shape=input_shape),
        tf.keras.layers.Conv2D(16, (3, 3), padding="same", activation="relu"),
        tf.keras.layers.Conv2D(16, (3, 3), padding="same", activation="relu"),
        tf.keras.layers.MaxPooling2D((2, 2)),

        tf.keras.layers.Conv2D(32, (3, 3), padding="same", activation="relu"),
        tf.keras.layers.Conv2D(32, (3, 3), padding="same", activation="relu"),
        tf.keras.layers.MaxPooling2D((2, 2)),

        tf.keras.layers.Conv2D(64, (3, 3), padding="same", activation="relu"),
        tf.keras.layers.GlobalAveragePooling2D(),

        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=[
            tf.keras.metrics.BinaryAccuracy(name="accuracy"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )
    return model


def split_by_document(x, y, groups, val_size, test_size, seed):
    unique_groups = np.unique(groups)
    if len(unique_groups) < 3:
        indices = np.arange(len(x))
        train_val_idx, test_idx = train_test_split(
            indices,
            test_size=test_size,
            random_state=seed,
            stratify=y,
        )
        train_idx, val_idx = train_test_split(
            train_val_idx,
            test_size=val_size / (1.0 - test_size),
            random_state=seed + 1,
            stratify=y[train_val_idx],
        )
        return train_idx, val_idx, test_idx, "candidate_level_fallback"

    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_val_idx, test_idx = next(splitter.split(x, y, groups=groups))

    train_val_groups = groups[train_val_idx]
    val_fraction_of_train = val_size / (1.0 - test_size)
    splitter = GroupShuffleSplit(n_splits=1, test_size=val_fraction_of_train, random_state=seed + 1)
    train_idx_rel, val_idx_rel = next(splitter.split(x[train_val_idx], y[train_val_idx], groups=train_val_groups))

    train_idx = train_val_idx[train_idx_rel]
    val_idx = train_val_idx[val_idx_rel]
    return train_idx, val_idx, test_idx, "document_level"


def make_dataset(x, y, batch_size, training):
    ds = tf.data.Dataset.from_tensor_slices((x, y))
    if training:
        ds = ds.shuffle(min(len(x), 20000), reshuffle_each_iteration=True)
    ds = ds.batch(batch_size).prefetch(tf.data.AUTOTUNE)
    return ds


def class_weight_dict(y):
    pos = float(np.sum(y == 1))
    neg = float(np.sum(y == 0))
    total = pos + neg
    if pos == 0 or neg == 0:
        return None
    return {
        0: total / (2.0 * neg),
        1: total / (2.0 * pos),
    }


def evaluate_predictions(y_true, probs, threshold):
    preds = (probs >= threshold).astype(np.uint8)
    return {
        "threshold": threshold,
        "accuracy": float(accuracy_score(y_true, preds)),
        "f1": float(f1_score(y_true, preds)),
        "report": classification_report(y_true, preds, digits=4, zero_division=0),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", required=True, help="Directory containing *_patches.npz shards")
    parser.add_argument("--model-out", required=True, help="Path to save the trained .keras model")
    parser.add_argument("--summary-out", help="Optional JSON summary output path")
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--val-size", type=float, default=0.1)
    parser.add_argument("--test-size", type=float, default=0.2)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--threshold", type=float, default=0.5)
    args = parser.parse_args()

    tf.keras.utils.set_random_seed(args.seed)

    x, y, groups, kinds = load_shards(args.data_dir)
    train_idx, val_idx, test_idx, split_mode = split_by_document(x, y, groups, args.val_size, args.test_size, args.seed)

    x_train, y_train = x[train_idx], y[train_idx]
    x_val, y_val = x[val_idx], y[val_idx]
    x_test, y_test = x[test_idx], y[test_idx]

    model = build_model(input_shape=x_train.shape[1:])
    train_ds = make_dataset(x_train, y_train, args.batch_size, training=True)
    val_ds = make_dataset(x_val, y_val, args.batch_size, training=False)

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=3,
            restore_best_weights=True,
        )
    ]

    cw = class_weight_dict(y_train)
    history = model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=args.epochs,
        callbacks=callbacks,
        class_weight=cw,
        verbose=2,
    )

    test_probs = model.predict(make_dataset(x_test, y_test, args.batch_size, training=False), verbose=0).reshape(-1)
    metrics = evaluate_predictions(y_test, test_probs, args.threshold)

    print(f"Split mode: {split_mode}")
    print(f"Train docs: {len(np.unique(groups[train_idx]))}, Val docs: {len(np.unique(groups[val_idx]))}, Test docs: {len(np.unique(groups[test_idx]))}")
    print(f"Train examples: {len(train_idx)}, Val examples: {len(val_idx)}, Test examples: {len(test_idx)}")
    print(f"Threshold: {args.threshold:.2f}")
    print(f"Test accuracy: {metrics['accuracy']:.4f}")
    print(f"Test F1: {metrics['f1']:.4f}")
    print(metrics["report"])

    Path(args.model_out).parent.mkdir(parents=True, exist_ok=True)
    model.save(args.model_out)
    print(f"Saved model to {args.model_out}")

    if args.summary_out:
        summary = {
            "train_docs": sorted(np.unique(groups[train_idx]).tolist()),
            "val_docs": sorted(np.unique(groups[val_idx]).tolist()),
            "test_docs": sorted(np.unique(groups[test_idx]).tolist()),
            "split_mode": split_mode,
            "train_examples": int(len(train_idx)),
            "val_examples": int(len(val_idx)),
            "test_examples": int(len(test_idx)),
            "threshold": float(args.threshold),
            "test_accuracy": metrics["accuracy"],
            "test_f1": metrics["f1"],
            "class_weight": cw,
            "history": {k: [float(vv) for vv in vals] for k, vals in history.history.items()},
            "source_kind_breakdown": {
                "train": {
                    "candidate": int(np.sum(kinds[train_idx] == "candidate")),
                    "gt_rescue": int(np.sum(kinds[train_idx] == "gt_rescue")),
                },
                "val": {
                    "candidate": int(np.sum(kinds[val_idx] == "candidate")),
                    "gt_rescue": int(np.sum(kinds[val_idx] == "gt_rescue")),
                },
                "test": {
                    "candidate": int(np.sum(kinds[test_idx] == "candidate")),
                    "gt_rescue": int(np.sum(kinds[test_idx] == "gt_rescue")),
                },
            },
        }
        Path(args.summary_out).parent.mkdir(parents=True, exist_ok=True)
        with open(args.summary_out, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"Saved summary to {args.summary_out}")


if __name__ == "__main__":
    main()
