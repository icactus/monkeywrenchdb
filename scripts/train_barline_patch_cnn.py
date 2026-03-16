import argparse
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import GroupShuffleSplit
from sklearn.model_selection import train_test_split
import tensorflow as tf


def normalize_source_ids(values):
    normalized = []
    for value in values:
        if isinstance(value, bytes):
            value = value.decode("utf-8", errors="replace")
        text = str(value)
        if text.lower().endswith(".pdf"):
            text = text[:-4]
        normalized.append(text)
    return np.array(normalized, dtype="<U128")


def load_shards(data_dir):
    data_path = Path(data_dir)
    shard_paths = sorted(set(data_path.glob("*_patches.npz")) | set(data_path.glob("*_hardcases.npz")))
    if not shard_paths:
        raise FileNotFoundError(f"No *_patches.npz or *_hardcases.npz files found in {data_dir}")

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
            source_ids.append(normalize_source_ids(shard["source_id"]))
            source_kind.append(shard["source_kind"])

    if not patches:
        raise RuntimeError("All shards were empty.")

    x = np.concatenate(patches, axis=0).astype(np.float32)
    y = np.concatenate(labels, axis=0).astype(np.uint8)
    groups = np.concatenate(source_ids, axis=0)
    kinds = np.concatenate(source_kind, axis=0)

    x = np.expand_dims(x, axis=-1)
    return x, y, groups, kinds


def load_shards_from_dirs(data_dirs):
    xs = []
    ys = []
    groups_list = []
    kinds_list = []
    for data_dir in data_dirs:
        x, y, groups, kinds = load_shards(data_dir)
        xs.append(x)
        ys.append(y)
        groups_list.append(groups)
        kinds_list.append(kinds)

    x_all = np.concatenate(xs, axis=0)
    y_all = np.concatenate(ys, axis=0)
    groups_all = np.concatenate(groups_list, axis=0)
    kinds_all = np.concatenate(kinds_list, axis=0)
    return x_all, y_all, groups_all, kinds_all


def load_matching_shards(data_dir, patterns):
    data_path = Path(data_dir)
    shard_paths = []
    for pattern in patterns:
        shard_paths.extend(data_path.glob(pattern))
    shard_paths = sorted(set(shard_paths))
    if not shard_paths:
        raise FileNotFoundError(f"No matching shards found in {data_dir} for patterns {patterns}")

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
            source_ids.append(normalize_source_ids(shard["source_id"]))
            source_kind.append(shard["source_kind"])

    if not patches:
        raise RuntimeError("All matching shards were empty.")

    x = np.concatenate(patches, axis=0).astype(np.float32)
    y = np.concatenate(labels, axis=0).astype(np.uint8)
    groups = np.concatenate(source_ids, axis=0)
    kinds = np.concatenate(source_kind, axis=0)

    x = np.expand_dims(x, axis=-1)
    return x, y, groups, kinds


def compile_model(model, learning_rate):
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="binary_crossentropy",
        metrics=[
            tf.keras.metrics.BinaryAccuracy(name="accuracy"),
            tf.keras.metrics.Precision(name="precision"),
            tf.keras.metrics.Recall(name="recall"),
        ],
    )
    model.optimizer.learning_rate.assign(learning_rate)
    return model


def build_model(input_shape, learning_rate):
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
    return compile_model(model, learning_rate)


def load_or_build_model(input_shape, resume_from, learning_rate):
    if resume_from:
        model = tf.keras.models.load_model(resume_from)
        return compile_model(model, learning_rate), "resumed"
    return build_model(input_shape=input_shape, learning_rate=learning_rate), "fresh"
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


def class_weight_dict(y, class_weight_scale=None):
    pos = float(np.sum(y == 1))
    neg = float(np.sum(y == 0))
    total = pos + neg
    if pos == 0 or neg == 0:
        return None
    weights = {
        0: total / (2.0 * neg),
        1: total / (2.0 * pos),
    }
    if class_weight_scale:
        weights[0] *= float(class_weight_scale.get(0, 1.0))
        weights[1] *= float(class_weight_scale.get(1, 1.0))
    return weights


def evaluate_predictions(y_true, probs, threshold):
    preds = (probs >= threshold).astype(np.uint8)
    return {
        "threshold": threshold,
        "accuracy": float(accuracy_score(y_true, preds)),
        "f1": float(f1_score(y_true, preds)),
        "report": classification_report(y_true, preds, digits=4, zero_division=0),
    }


def sample_replay_indices(y, target_count, seed):
    if target_count >= len(y):
        return np.arange(len(y))

    rng = np.random.default_rng(seed)
    pos_idx = np.flatnonzero(y == 1)
    neg_idx = np.flatnonzero(y == 0)
    target_pos = int(round(target_count * (len(pos_idx) / len(y)))) if len(y) else 0
    target_pos = min(len(pos_idx), max(1 if len(pos_idx) else 0, target_pos))
    target_neg = max(0, target_count - target_pos)
    target_neg = min(len(neg_idx), target_neg)

    chosen = []
    if target_pos:
        chosen.append(rng.choice(pos_idx, size=target_pos, replace=False))
    if target_neg:
        chosen.append(rng.choice(neg_idx, size=target_neg, replace=False))
    picked = np.concatenate(chosen) if chosen else np.array([], dtype=np.int64)

    if len(picked) < target_count:
        remaining = np.setdiff1d(np.arange(len(y)), picked, assume_unique=False)
        extra = rng.choice(remaining, size=(target_count - len(picked)), replace=False)
        picked = np.concatenate([picked, extra])

    rng.shuffle(picked)
    return picked


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
    parser.add_argument("--resume-from", help="Optional existing .keras model to fine-tune from")
    parser.add_argument("--learning-rate", type=float, help="Learning rate; default 1e-3 for fresh training, 1e-4 for fine-tuning")
    parser.add_argument("--eval-only", action="store_true", help="Skip training and only evaluate a loaded model on the computed split")
    parser.add_argument("--replay-data-dir", help="Optional directory of base *_patches.npz shards to mix into fine-tuning and to use for benchmark splits")
    parser.add_argument("--extra-data-dir", action="append", default=[], help="Additional shard directory to merge into the main training/eval dataset")
    parser.add_argument("--replay-multiplier", type=float, default=3.0, help="When using --replay-data-dir, sample this many replay examples per hardcase example into the training set")
    parser.add_argument("--neg-weight-scale", type=float, default=1.0, help="Multiplier applied to class-0 weight during training")
    parser.add_argument("--pos-weight-scale", type=float, default=1.0, help="Multiplier applied to class-1 weight during training")
    args = parser.parse_args()

    tf.keras.utils.set_random_seed(args.seed)
    learning_rate = args.learning_rate if args.learning_rate is not None else (1e-4 if args.resume_from else 1e-3)

    replay_mode = bool(args.replay_data_dir)
    if replay_mode:
        x_hard, y_hard, groups_hard, kinds_hard = load_matching_shards(args.data_dir, ["*_hardcases.npz"])
        x_base, y_base, groups_base, kinds_base = load_matching_shards(args.replay_data_dir, ["*_patches.npz"])

        train_idx_base, val_idx_base, test_idx_base, split_mode = split_by_document(
            x_base, y_base, groups_base, args.val_size, args.test_size, args.seed
        )
        x_val, y_val = x_base[val_idx_base], y_base[val_idx_base]
        x_test, y_test = x_base[test_idx_base], y_base[test_idx_base]

        replay_target = int(round(len(x_hard) * args.replay_multiplier))
        replay_train_rel = sample_replay_indices(y_base[train_idx_base], replay_target, args.seed)
        replay_train_idx = train_idx_base[replay_train_rel]

        x_train = np.concatenate([x_hard, x_base[replay_train_idx]], axis=0)
        y_train = np.concatenate([y_hard, y_base[replay_train_idx]], axis=0)
        groups_train = np.concatenate([groups_hard, groups_base[replay_train_idx]], axis=0)
        kinds_train = np.concatenate([kinds_hard, kinds_base[replay_train_idx]], axis=0)
        groups_val = groups_base[val_idx_base]
        groups_test = groups_base[test_idx_base]
        kinds_val = kinds_base[val_idx_base]
        kinds_test = kinds_base[test_idx_base]
        train_docs = sorted(np.unique(groups_train).tolist())
        val_docs = sorted(np.unique(groups_val).tolist())
        test_docs = sorted(np.unique(groups_test).tolist())
    else:
        all_data_dirs = [args.data_dir] + list(args.extra_data_dir)
        x, y, groups, kinds = load_shards_from_dirs(all_data_dirs)
        train_idx, val_idx, test_idx, split_mode = split_by_document(x, y, groups, args.val_size, args.test_size, args.seed)

        x_train, y_train = x[train_idx], y[train_idx]
        x_val, y_val = x[val_idx], y[val_idx]
        x_test, y_test = x[test_idx], y[test_idx]
        groups_train = groups[train_idx]
        groups_val = groups[val_idx]
        groups_test = groups[test_idx]
        kinds_train = kinds[train_idx]
        kinds_val = kinds[val_idx]
        kinds_test = kinds[test_idx]
        train_docs = sorted(np.unique(groups_train).tolist())
        val_docs = sorted(np.unique(groups_val).tolist())
        test_docs = sorted(np.unique(groups_test).tolist())

    if args.eval_only and not args.resume_from:
        parser.error("--eval-only requires --resume-from")

    model, model_mode = load_or_build_model(
        input_shape=x_train.shape[1:],
        resume_from=args.resume_from,
        learning_rate=learning_rate,
    )
    train_ds = make_dataset(x_train, y_train, args.batch_size, training=True)
    val_ds = make_dataset(x_val, y_val, args.batch_size, training=False)

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=3,
            restore_best_weights=True,
        )
    ]

    class_weight_scale = {
        0: args.neg_weight_scale,
        1: args.pos_weight_scale,
    }
    cw = class_weight_dict(y_train, class_weight_scale=class_weight_scale)
    if args.eval_only:
        history = None
    else:
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
    print(f"Model mode: {model_mode}")
    if args.resume_from:
        print(f"Resume source: {args.resume_from}")
    print(f"Learning rate: {learning_rate:.6f}")
    print(f"Train docs: {len(train_docs)}, Val docs: {len(val_docs)}, Test docs: {len(test_docs)}")
    print(f"Train examples: {len(x_train)}, Val examples: {len(x_val)}, Test examples: {len(x_test)}")
    print(f"Threshold: {args.threshold:.2f}")
    print(f"Test accuracy: {metrics['accuracy']:.4f}")
    print(f"Test F1: {metrics['f1']:.4f}")
    print(metrics["report"])

    if args.eval_only:
        print("Eval-only mode: model weights were not modified.")
    else:
        Path(args.model_out).parent.mkdir(parents=True, exist_ok=True)
        model.save(args.model_out)
        print(f"Saved model to {args.model_out}")

    if args.summary_out:
        summary = {
            "train_docs": train_docs,
            "val_docs": val_docs,
            "test_docs": test_docs,
            "split_mode": split_mode,
            "train_examples": int(len(x_train)),
            "val_examples": int(len(x_val)),
            "test_examples": int(len(x_test)),
            "model_mode": model_mode,
            "resume_from": args.resume_from,
            "learning_rate": float(learning_rate),
            "data_dirs": [args.data_dir] + list(args.extra_data_dir),
            "replay_data_dir": args.replay_data_dir,
            "replay_multiplier": float(args.replay_multiplier),
            "threshold": float(args.threshold),
            "test_accuracy": metrics["accuracy"],
            "test_f1": metrics["f1"],
            "class_weight": cw,
            "class_weight_scale": {
                "neg": float(args.neg_weight_scale),
                "pos": float(args.pos_weight_scale),
            },
            "history": {} if history is None else {k: [float(vv) for vv in vals] for k, vals in history.history.items()},
            "source_kind_breakdown": {
                "train": {
                    "candidate": int(np.sum(kinds_train == "candidate")),
                    "gt_rescue": int(np.sum(kinds_train == "gt_rescue")),
                    "hardcase": int(np.sum(kinds_train == "hardcase")),
                },
                "val": {
                    "candidate": int(np.sum(kinds_val == "candidate")),
                    "gt_rescue": int(np.sum(kinds_val == "gt_rescue")),
                    "hardcase": int(np.sum(kinds_val == "hardcase")),
                },
                "test": {
                    "candidate": int(np.sum(kinds_test == "candidate")),
                    "gt_rescue": int(np.sum(kinds_test == "gt_rescue")),
                    "hardcase": int(np.sum(kinds_test == "hardcase")),
                },
            },
        }
        Path(args.summary_out).parent.mkdir(parents=True, exist_ok=True)
        with open(args.summary_out, "w") as f:
            json.dump(summary, f, indent=2)
        print(f"Saved summary to {args.summary_out}")


if __name__ == "__main__":
    main()
