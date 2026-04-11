#!/usr/bin/env python3

import argparse
import html
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import Cookie, CookieJar
from pathlib import Path

from bs4 import BeautifulSoup

from imslp_api_request import USER_AGENT, load_config


ROOT = Path(__file__).resolve().parents[1]
IMSLP_BASE = "https://imslp.org"


def resolve_path(value: str | None, fallback: Path) -> Path:
    if not value:
        return fallback
    path = Path(value)
    if not path.is_absolute():
        path = ROOT.parent / path
    return path


def add_cookie(jar: CookieJar, name: str, value: str, domain: str = "imslp.org") -> None:
    cookie = Cookie(
        version=0,
        name=name,
        value=value,
        port=None,
        port_specified=False,
        domain=domain,
        domain_specified=True,
        domain_initial_dot=domain.startswith("."),
        path="/",
        path_specified=True,
        secure=False,
        expires=None,
        discard=True,
        comment=None,
        comment_url=None,
        rest={},
        rfc2109=False,
    )
    jar.set_cookie(cookie)


def build_opener() -> tuple[urllib.request.OpenerDirector, CookieJar]:
    cookie_jar = CookieJar()
    add_cookie(cookie_jar, "redirectPassed", "1")
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))
    opener.addheaders = [("User-Agent", USER_AGENT)]
    return opener, cookie_jar


def fetch_url(opener: urllib.request.OpenerDirector, url: str) -> tuple[str, bytes]:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with opener.open(request, timeout=60) as response:
        return response.geturl(), response.read()


def fetch_text(opener: urllib.request.OpenerDirector, url: str) -> tuple[str, str]:
    final_url, payload = fetch_url(opener, url)
    return final_url, payload.decode("utf-8", errors="ignore")


def is_pdf_response(final_url: str, payload: bytes) -> bool:
    return payload.startswith(b"%PDF-") or urllib.parse.urlparse(final_url).path.lower().endswith(".pdf")


def rewrite_petrucci_us_linkhandler(url: str) -> str | None:
    parsed = urllib.parse.urlparse(url)
    if parsed.netloc not in {"www.petruccilibrary.us", "petruccilibrary.us"}:
        return None
    if parsed.path != "/linkhandler.php":
        return None
    query = urllib.parse.parse_qs(parsed.query)
    path_values = query.get("path")
    if not path_values:
        return None
    path = path_values[0].lstrip("/")
    if not path.lower().endswith(".pdf"):
        return None
    return urllib.parse.urlunparse(("https", parsed.netloc, f"/{path}", "", "", ""))


def fetch_html_or_direct_pdf(opener: urllib.request.OpenerDirector, url: str) -> tuple[str, str | None, str | None]:
    try:
        final_url, payload = fetch_url(opener, url)
    except urllib.error.HTTPError as exc:
        rewritten = rewrite_petrucci_us_linkhandler(exc.url)
        if exc.code == 406 and rewritten:
            return rewritten, rewritten, None
        raise
    if is_pdf_response(final_url, payload):
        return final_url, final_url, None
    rewritten = rewrite_petrucci_us_linkhandler(final_url)
    if rewritten:
        return rewritten, rewritten, None
    return final_url, None, payload.decode("utf-8", errors="ignore")


def parse_disclaimer_url(page_html: str) -> str | None:
    soup = BeautifulSoup(page_html, "html.parser")
    link = soup.find("a", href=lambda href: isinstance(href, str) and "Special:IMSLPDisclaimerAccept/" in href)
    if not link:
        return None
    return urllib.parse.urljoin(IMSLP_BASE, link["href"])


def parse_wait_data_url(page_html: str) -> str | None:
    soup = BeautifulSoup(page_html, "html.parser")
    wait_node = soup.find(id="sm_dl_wait")
    if not wait_node:
        return None
    data_id = wait_node.get("data-id")
    if not data_id:
        return None
    return html.unescape(data_id)


def parse_direct_pdf_link(page_html: str, base_url: str) -> str | None:
    soup = BeautifulSoup(page_html, "html.parser")
    link = soup.find("a", href=lambda href: isinstance(href, str) and ".pdf" in href.lower())
    if not link:
        return None
    return urllib.parse.urljoin(base_url, html.unescape(link["href"]))


def resolve_direct_pdf_url(
    opener: urllib.request.OpenerDirector,
    source_index: str,
    sleep_seconds: float,
) -> str:
    image_url = f"{IMSLP_BASE}/wiki/Special:ImagefromIndex/{source_index}"

    for attempt in range(4):
        if sleep_seconds > 0:
            time.sleep(sleep_seconds)
        page_final_url, direct_pdf_url, page_html = fetch_html_or_direct_pdf(opener, image_url)
        if direct_pdf_url:
            return direct_pdf_url
        if page_html is None:
            raise RuntimeError(f"Unable to read IMSLP response for index {source_index}.")

        direct_url = parse_wait_data_url(page_html)
        if direct_url:
            return direct_url
        direct_url = parse_direct_pdf_link(page_html, page_final_url)
        if direct_url:
            return direct_url

        disclaimer_url = parse_disclaimer_url(page_html)
        if disclaimer_url:
            if sleep_seconds > 0:
                time.sleep(sleep_seconds)
            disclaimer_final_url, direct_pdf_url, disclaimer_html = fetch_html_or_direct_pdf(opener, disclaimer_url)
            if direct_pdf_url:
                return direct_pdf_url
            if disclaimer_html is None:
                raise RuntimeError(f"Unable to read IMSLP disclaimer response for index {source_index}.")
            direct_url = parse_wait_data_url(disclaimer_html)
            if direct_url:
                return direct_url
            direct_url = parse_direct_pdf_link(disclaimer_html, disclaimer_final_url)
            if direct_url:
                return direct_url
            continue

        raise RuntimeError(
            f"Unable to resolve direct PDF URL for IMSLP index {source_index}. "
            f"Expected disclaimer or wait-page marker."
        )

    raise RuntimeError(f"Exhausted attempts while resolving IMSLP index {source_index}.")


def validate_pdf_bytes(payload: bytes, source_url: str) -> None:
    if payload.startswith(b"%PDF-"):
        return
    preview = payload[:200].decode("utf-8", errors="ignore")
    raise RuntimeError(f"Expected PDF from {source_url}, got non-PDF payload: {preview!r}")


def load_manifest(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def iter_manifest_paths(draft_dir: Path, piece_slug: str | None) -> list[Path]:
    if piece_slug:
        path = draft_dir / f"{piece_slug}.json"
        if not path.exists():
            raise SystemExit(f"Draft manifest not found: {path}")
        return [path]
    return sorted(draft_dir.glob("*.json"))


def download_manifest(
    opener: urllib.request.OpenerDirector,
    manifest: dict,
    downloads_dir: Path,
    sleep_seconds: float,
    force: bool,
    dry_run: bool,
) -> None:
    downloads_dir.mkdir(parents=True, exist_ok=True)
    source_cache: dict[str, bytes] = {}

    for part_number, output_name in sorted(manifest["parts"].items()):
        target_path = downloads_dir / Path(output_name).name
        source = manifest["selected_string_sources"].get(part_number)
        if not source:
            raise RuntimeError(f"Manifest {manifest['piece_slug']} missing selected source for part {part_number}")

        source_index = str(source["index"])
        if target_path.exists() and not force:
            print(f"skip {target_path.name}: already exists")
            continue

        if dry_run:
            print(f"would save {target_path.name} from IMSLP index {source_index}")
            continue

        payload = source_cache.get(source_index)
        if payload is None:
            direct_url = resolve_direct_pdf_url(opener, source_index, sleep_seconds)
            if sleep_seconds > 0:
                time.sleep(sleep_seconds)
            _, payload = fetch_url(opener, direct_url)
            validate_pdf_bytes(payload, direct_url)
            source_cache[source_index] = payload

        target_path.write_bytes(payload)
        print(f"saved {target_path.name}")


def missing_part_numbers(manifest: dict) -> list[str]:
    sources = manifest.get("selected_string_sources", {})
    return [str(part_number) for part_number in range(1, 6) if str(part_number) not in sources]


def main() -> None:
    parser = argparse.ArgumentParser(description="Download full-resolution IMSLP part PDFs from draft manifests")
    parser.add_argument("--piece-slug", help="Only download one draft manifest by piece slug")
    parser.add_argument("--sleep-seconds", type=float, help="Delay between IMSLP requests")
    parser.add_argument("--force", action="store_true", help="Redownload files even if they already exist")
    parser.add_argument("--include-review", action="store_true", help="Also download manifests flagged as needing review")
    parser.add_argument("--allow-incomplete", action="store_true", help="Download manifests missing one or more string-part sources")
    parser.add_argument("--continue-on-error", action="store_true", help="Continue with later manifests if one download fails")
    parser.add_argument("--dry-run", action="store_true", help="Print intended downloads without contacting IMSLP")
    parser.add_argument("--draft-dir", help="Override the draft manifest directory")
    parser.add_argument("--downloads-dir", help="Override the output downloads directory")
    args = parser.parse_args()

    config = load_config()
    draft_dir = resolve_path(args.draft_dir or config.get("draft_manifest_dir"), ROOT / "manifests" / "drafts")
    downloads_dir = resolve_path(args.downloads_dir or config.get("downloads_dir"), ROOT / "fullres-pdfs")
    sleep_seconds = float(
        args.sleep_seconds
        if args.sleep_seconds is not None
        else config.get("imslp_download_sleep_seconds", config.get("imslp_api_sleep_seconds", 3))
    )

    opener, _ = build_opener()
    manifest_paths = iter_manifest_paths(draft_dir, args.piece_slug)
    if not manifest_paths:
        raise SystemExit("No draft manifests found.")

    downloaded = 0
    skipped = 0
    failed: list[tuple[str, str]] = []

    for manifest_path in manifest_paths:
        manifest = load_manifest(manifest_path)
        piece_slug = manifest.get("piece_slug", manifest_path.stem)
        if manifest.get("needs_review") and not args.include_review:
            print(f"skip {piece_slug}: needs review")
            skipped += 1
            continue

        missing_parts = missing_part_numbers(manifest)
        if missing_parts and not args.allow_incomplete:
            print(f"skip {piece_slug}: missing part sources {', '.join(missing_parts)}")
            skipped += 1
            continue

        try:
            download_manifest(opener, manifest, downloads_dir, sleep_seconds, args.force, args.dry_run)
            downloaded += 1
        except Exception as exc:
            failed.append((piece_slug, str(exc)))
            print(f"error {piece_slug}: {exc}")
            if not args.continue_on_error:
                raise

    print(f"summary: processed={downloaded} skipped={skipped} failed={len(failed)}")
    for piece_slug, message in failed:
        print(f"failed\t{piece_slug}\t{message}")

    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
