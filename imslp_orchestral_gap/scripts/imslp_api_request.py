#!/usr/bin/env python3

import argparse
import base64
import hashlib
import json
import os
import sys
import time
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config.json"
DEFAULT_ACCOUNT_ENV = "IMSLP_API_ACCOUNT"
DEFAULT_PASSWORD_ENV = "IMSLP_API_PASSWORD"
API_BASE = "https://imslp.org/imslpscripts/API.ISCR.php"
USER_AGENT = "Mozilla/5.0"


def load_config() -> dict:
    if CONFIG_PATH.exists():
        with CONFIG_PATH.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    return {}


def encode_base64url(value: str) -> str:
    encoded = base64.urlsafe_b64encode(value.encode("utf-8")).decode("ascii")
    return encoded.rstrip("=")


def maybe_encode(value: str, rawinput: bool) -> str:
    if rawinput:
        return value
    return encode_base64url(value)


def build_segments(account: str, args: argparse.Namespace) -> list[str]:
    segments = [
        f"account={account}",
        "disclaimer=accepted",
    ]

    if args.type is not None:
        segments.append(f"type={args.type}")
    if args.id_value is not None:
        segments.append(f"id={maybe_encode(args.id_value, args.rawinput)}")
    if args.parent is not None:
        segments.append(f"parent={maybe_encode(args.parent, args.rawinput)}")
    if args.search is not None:
        segments.append(f"search={maybe_encode(args.search, args.rawinput)}")
    if args.start is not None:
        segments.append(f"start={args.start}")
    if args.limit is not None:
        segments.append(f"limit={args.limit}")
    if args.sort is not None:
        segments.append(f"sort={args.sort}")
    if args.metadata:
        segments.append("metadata=yes")
    if args.version is not None:
        segments.append(f"version={args.version}")
    if args.noticetest is not None:
        segments.append(f"noticetest={args.noticetest}")
    if args.rawinput:
        segments.append("rawinput=1")
    if args.retformat is not None:
        segments.append(f"retformat={args.retformat}")
    for extra in args.param:
        segments.append(extra)
    return segments


def build_url(account: str, args: argparse.Namespace, password: str | None) -> str:
    segments = build_segments(account, args)
    query_string = "/".join(segments)
    if password:
        signature = hashlib.sha1(f"{query_string}{password}".encode("utf-8")).hexdigest()
        query_string = f"{query_string}/signature={signature}"
    return f"{API_BASE}?{query_string}"


def resolve_account(config: dict, account_override: str | None = None) -> str | None:
    return (
        account_override
        or config.get("imslp_api_account")
        or os.environ.get(config.get("imslp_api_account_env", DEFAULT_ACCOUNT_ENV))
        or os.environ.get(DEFAULT_ACCOUNT_ENV)
    )


def resolve_password(config: dict) -> str | None:
    return (
        config.get("imslp_api_password")
        or os.environ.get(config.get("imslp_api_password_env", DEFAULT_PASSWORD_ENV))
        or os.environ.get(DEFAULT_PASSWORD_ENV)
    )


def resolve_sleep_seconds(config: dict, override: float | None = None) -> float:
    if override is not None:
        return float(override)
    return float(config.get("imslp_api_sleep_seconds", 3))


def request_payload(args: argparse.Namespace, account_override: str | None = None) -> bytes:
    config = load_config()
    account = resolve_account(config, account_override)
    if not account:
        raise RuntimeError("Missing IMSLP API account token. Set config.json or IMSLP_API_ACCOUNT.")

    password = resolve_password(config)
    sleep_seconds = resolve_sleep_seconds(config, args.sleep_seconds)
    if sleep_seconds > 0:
        time.sleep(sleep_seconds)

    url = build_url(account, args, password)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def request_json(args: argparse.Namespace, account_override: str | None = None) -> dict | list | str:
    payload = request_payload(args, account_override=account_override)
    return json.loads(payload.decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="Rate-limited IMSLP custom API requester")
    parser.add_argument("--account", help="IMSLP API account token. Prefer env/config instead.")
    parser.add_argument("--type", help="API type value")
    parser.add_argument("--id", dest="id_value", help="Record ID")
    parser.add_argument("--parent", help="Parent ID")
    parser.add_argument("--search", help="Search expression before base64url encoding, e.g. 'id:Romeo and Juliet'")
    parser.add_argument("--start", help="Row offset or modified-time condition")
    parser.add_argument("--limit", help="API limit value")
    parser.add_argument("--sort", help="API sort value")
    parser.add_argument("--retformat", default="pretty", help="API return format")
    parser.add_argument("--metadata", action="store_true", help="Request metadata=yes")
    parser.add_argument("--version", help="Explicit API version")
    parser.add_argument("--noticetest", choices=("blocking", "nonblocking"), help="Notice test value")
    parser.add_argument("--rawinput", action="store_true", help="Disable base64url encoding for id/parent/search")
    parser.add_argument("--param", action="append", default=[], help="Extra path-style API parameter, e.g. key=value")
    parser.add_argument("--sleep-seconds", type=float, default=None, help="Delay before the request")
    parser.add_argument("--out", help="Optional output file")
    args = parser.parse_args()
    try:
        payload = request_payload(args, account_override=args.account)
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    if args.out:
        out_path = Path(args.out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_bytes(payload)
    else:
        sys.stdout.buffer.write(payload)


if __name__ == "__main__":
    main()
