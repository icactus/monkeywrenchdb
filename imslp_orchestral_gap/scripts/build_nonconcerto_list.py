#!/usr/bin/env python3

import argparse
import csv
import json
import re
import unicodedata
from pathlib import Path

from bs4 import BeautifulSoup

from imslp_api_request import load_config


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE_DIR = Path("/tmp/imslp_popular")
TITLE_RE = re.compile(r"^(?P<work>.*) \((?P<composer_last>[^,()]+), (?P<composer_rest>[^()]*)\)$")
CATALOG_TOKEN_RE = re.compile(
    r"(?:^|,\s+)(?:Op|BWV|K|KV|RV|HWV|Hob|D|Sz|M|TH|WWV|JB|S|Wq|WoO|TrV|MWV|FP|Kr|QV|GMW|SC|L|B|P|BB|Anh|KA|KAnh|CD|H|Z|FS|JS)\.?\s*[\w:/.-]+(?:\*+)?$",
    re.IGNORECASE,
)
KEY_RE = re.compile(r"\bin\s+[A-G](?:-flat|-sharp| flat| sharp)?\s+(?:major|minor)\b", re.IGNORECASE)
QUOTED_SUBTITLE_RE = re.compile(r"\s*,?\s*[\"“][^\"”]+[\"”]\s*")
BAD_PREFIXES = ("Category:", "IMSLP:", "List of works by", "List of ", "Template:", "Special:")
SOLO_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bconcerto\b",
        r"\bconcertino\b",
        r"\bsinfonia concertante\b",
        r"\bfor .*?\band orchestra\b",
        r"\brhapsody in blue\b",
        r"passacaglia for violin and viola",
        r"\bsymphonie espagnole\b",
    )
]
INCLUDE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in (
        r"\bsymphon",
        r"\boverture",
        r"\bballet\b",
        r"\(suite\)",
        r"\bsuite no\.?",
        r"\borchestral suite\b",
        r"\bserenade for string",
        r"\bserenade for strings\b",
        r"\bmarch no\.?",
        r"\bpomp and circumstance\b",
        r"\bslavonic dances\b",
        r"\bromanian folk dances\b",
        r"\bhungarian dances \(orchestra\)",
        r"\bvariations on an original theme .enigma",
        r"\bsymphonic metamorphosis\b",
        r"\bsymphonic dances\b",
        r"\btritsch tratsch polka\b",
        r"\bpizzicato polka\b",
    )
]
MANUAL_INCLUDE_SUBSTRINGS = (
    "pictures at an exhibition",
    "finlandia",
    "vltava",
    "la mer",
    "the planets",
    "pavane pour une infante defunte",
    "rapsodie espagnole",
    "don quixote",
    "lieutenant kije",
    "capriol",
    "egmont",
    "romeo and juliet",
    "the firebird",
    "swan lake",
    "the nutcracker",
    "sleeping beauty",
    "ma mere loye",
    "ma mere l oye",
    "petite suite",
    "peer gynt suite",
    "l arlesienne suite",
    "carmen suite",
    "karelia suite",
    "blue danube",
    "an der schonen blauen donau",
    "hungarian dances orchestra",
)
EXCLUDE_WORDS = (
    "piano",
    "violin",
    "cello",
    "flute",
    "clarinet",
    "oboe",
    "bassoon",
    "horn",
    "trumpet",
    "guitar",
    "lute",
    "organ",
    "harpsichord",
    "keyboard",
    "quartet",
    "quintet",
    "sextet",
    "septet",
    "octet",
    "trio",
    "duo",
    "sonata",
    "partita",
    "caprice",
    "etude",
    "étude",
    "prelude",
    "fugue",
    "mazurka",
    "nocturne",
    "impromptu",
    "romance",
    "song",
    "lieder",
    "method",
    "fantaisie",
    "fantasy",
    "toccata",
    "inventions",
    "mass",
    "missa",
    "requiem",
    "gloria",
    "passion",
    "oratorio",
)
EXACT_EXCLUDES = {
    "French Suite No.1 in D minor, BWV 812 (Bach, Johann Sebastian)",
    "French Suite No.2 in C minor, BWV 813 (Bach, Johann Sebastian)",
    "French Suite No.3 in B minor, BWV 814 (Bach, Johann Sebastian)",
    "French Suite No.4 in E-flat major, BWV 815 (Bach, Johann Sebastian)",
    "French Suite No.5 in G major, BWV 816 (Bach, Johann Sebastian)",
    "French Suite No.6 in E major, BWV 817 (Bach, Johann Sebastian)",
    "English Suite No.2 in A minor, BWV 807 (Bach, Johann Sebastian)",
    "English Suite No.3 in G minor, BWV 808 (Bach, Johann Sebastian)",
    "Beethoven Symphonies, S.464 (Liszt, Franz)",
    "Morceau symphonique, Op.88 (Guilmant, Alexandre)",
    "Scène de ballet, Op.100 (Bériot, Charles-Auguste de)",
    "Petite symphonie, CG 560 (Gounod, Charles)",
    "Suite No.2, Op.17 (Rachmaninoff, Sergei)",
    "10 Pieces from Romeo and Juliet, Op.75 (Prokofiev, Sergey)",
    "Overture to Offenbach's Opera 'Orphée aux Enfers' (Binder, Carl)",
    "The Firebird (suite), K010 (Stravinsky, Igor)",
    "Ma mère l'Oye (suite), M.60 (Ravel, Maurice)",
    "Symphony No.1, Op.25 (Prokofiev, Sergey)",
    "Symphony No.7 in E major, WAB 107 (Bruckner, Anton)",
    "Symphony No.8 in C minor, WAB 108 (Bruckner, Anton)",
    "Symphony No.9 in D minor, WAB 109/143 (Bruckner, Anton)",
    "Symphony No.4 in E-flat major, WAB 104 (Bruckner, Anton)",
    "Symphony No.8, D.759 (Schubert, Franz)",
    "Symphony No.9, D.944 (Schubert, Franz)",
}


def ascii_fold(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def simplify_text(value: str) -> str:
    value = ascii_fold(value).lower().replace("&", " and ")
    value = value.replace("'", "").replace("’", "")
    value = QUOTED_SUBTITLE_RE.sub(" ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def normalize_work(work: str) -> str:
    value = ascii_fold(work).lower().replace("&", " and ")
    value = value.replace("'", "").replace("’", "")
    value = QUOTED_SUBTITLE_RE.sub(" ", value)

    changed = True
    while changed:
        changed = False
        match = CATALOG_TOKEN_RE.search(value)
        if match:
            value = value[: match.start()].rstrip(", ").strip()
            changed = True

    value = KEY_RE.sub("", value)
    value = re.sub(r"[()]", " ", value)
    value = re.sub(r"[^a-z0-9]+", " ", value)
    value = re.sub(r"\bthe\b", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def canonical_key(title: str) -> str | None:
    match = TITLE_RE.match(title)
    if not match:
        return None
    composer_last = simplify_text(match.group("composer_last"))
    work = normalize_work(match.group("work"))
    return f"{composer_last}|{work}"


def looks_orchestral(title: str) -> bool:
    match = TITLE_RE.match(title)
    if not match:
        return False
    work = simplify_text(match.group("work"))
    if any(pattern.search(work) for pattern in INCLUDE_PATTERNS):
        return True
    return any(fragment in work for fragment in MANUAL_INCLUDE_SUBSTRINGS)


def obviously_not_orchestral(title: str) -> bool:
    match = TITLE_RE.match(title)
    if not match:
        return True
    work = simplify_text(match.group("work"))
    return any(word in work for word in EXCLUDE_WORDS)


def resolve_path(value: str | None, fallback: Path) -> Path:
    if not value:
        return fallback
    path = Path(value)
    if not path.is_absolute():
        path = ROOT.parent / path
    return path


def load_existing_keys(cache_dir: Path) -> set[str]:
    payload = json.loads((cache_dir / "mw_orchestra.json").read_text(encoding="utf-8"))
    keys = set()
    for piece in payload["pieces"]:
        key = canonical_key(f"{piece['piece_name']} ({piece['composer_last']}, x)")
        if key:
            keys.add(key)
    return keys


def load_popularity_rows(cache_dir: Path) -> list[dict[str, int | str]]:
    rows: list[dict[str, int | str]] = []
    for html_path in sorted(cache_dir.glob("*.html")):
        soup = BeautifulSoup(html_path.read_text(encoding="utf-8"), "html.parser")
        table = soup.find("table")
        if table is None:
            continue
        for tr in table.find_all("tr")[1:]:
            tds = tr.find_all("td")
            if len(tds) != 4:
                continue
            try:
                rank = int(tds[0].get_text(" ", strip=True).rstrip("."))
                views = int(tds[3].get_text(" ", strip=True).replace(",", ""))
            except ValueError:
                continue
            rows.append(
                {
                    "rank": rank,
                    "views": views,
                    "title": tds[2].get_text(" ", strip=True),
                }
            )
    return rows


def build_rows(cache_dir: Path, limit: int) -> list[dict[str, int | str]]:
    existing_keys = load_existing_keys(cache_dir)
    seen_titles: set[str] = set()
    results: list[dict[str, int | str]] = []

    for row in load_popularity_rows(cache_dir):
        title = str(row["title"])
        if title in seen_titles:
            continue
        seen_titles.add(title)

        if title in EXACT_EXCLUDES:
            continue
        if title.startswith(BAD_PREFIXES):
            continue
        if not TITLE_RE.match(title):
            continue
        if any(pattern.search(title) for pattern in SOLO_PATTERNS):
            continue
        if obviously_not_orchestral(title):
            continue
        if not looks_orchestral(title):
            continue

        key = canonical_key(title)
        if key in existing_keys:
            continue

        results.append(row)
        if len(results) >= limit:
            break

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the non-concerto orchestral gap list from cached IMSLP pages")
    parser.add_argument("--cache-dir", default=str(DEFAULT_CACHE_DIR), help="Directory containing cached IMSLP popularity pages and mw_orchestra.json")
    parser.add_argument("--output-tsv", help="Override the output TSV path")
    parser.add_argument("--limit", type=int, default=100, help="Number of rows to write")
    args = parser.parse_args()

    config = load_config()
    cache_dir = Path(args.cache_dir)
    output_tsv = resolve_path(args.output_tsv or config.get("input_tsv"), ROOT / "missing_nonconcerto.tsv")

    rows = build_rows(cache_dir=cache_dir, limit=args.limit)
    output_tsv.parent.mkdir(parents=True, exist_ok=True)
    with output_tsv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["rank", "views", "title"], delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_tsv}")


if __name__ == "__main__":
    main()
