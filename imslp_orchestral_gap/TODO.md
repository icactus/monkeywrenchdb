# TODO

## Phase 1: tighten the queue

- Remove or replace borderline entries that are poor fits for the Kalmus-first orchestra-parts workflow.
- Add manual slug overrides for any ugly or ambiguous stems.
- Mark pieces likely to need LLM disambiguation before downloading.
- Keep `missing_nonconcerto.tsv` as the active queue input.

## Phase 2: scrape candidate pages

- Use the custom IMSLP API first, not repeated HTML scraping.
- For each queue item, find the target IMSLP work page or pages.
- Store candidate pages with URLs and popularity/download metadata.
- Filter out obvious bad targets: reductions, excerpts, arrangements, study scores.
- Cache all responses locally.
- Current scaffold:
  - `scripts/fetch_work_candidates.py`

## Phase 3: choose editions

- Deterministically prefer Kalmus when present.
- Otherwise choose the most-downloaded full orchestral materials.
- Only send ambiguous cases to the LLM.
- Save the choice to a manifest record.
- Keep the request rate conservative, even when using the API.
- Current scaffold:
  - `scripts/select_edition.py`

## Phase 4: download parts

- Download string parts.
- Save as:
  - `ComposerLastName-PieceName-1.pdf`
  - `ComposerLastName-PieceName-2.pdf`
  - `ComposerLastName-PieceName-3.pdf`
  - `ComposerLastName-PieceName-4.pdf`
  - `ComposerLastName-PieceName-5.pdf`
- If cello and bass share one source, duplicate it into both outputs.

## Phase 5: final audit

- Confirm each piece has five output files.
- Confirm manifest entries match downloaded files.
- Record ambiguous or failed pieces for manual follow-up.
