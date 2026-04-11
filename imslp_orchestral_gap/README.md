# IMSLP Orchestral Gap

This folder holds the current working state for the IMSLP orchestra-parts side project.

## Current status

- `missing_nonconcerto.tsv`: active non-concerto orchestral gap list for the string-parts workflow.
- `missing_top100.tsv`: older mixed shortlist retained for reference.
- `work_queue.jsonl`: generated queue with stable slugs and target output filenames.
- `selection_policy.md`: rules for choosing IMSLP pages and editions.
- `selection_manifest.schema.json`: schema for completed selection records.
- `selection_manifest_example.json`: example of the metadata to save for each completed download.
- `config.example.json`: local config template for running the pipeline.
- `TODO.md`: execution plan for building the downloader.
- `api_notes.md`: notes for using the IMSLP custom API safely.

## Inputs used

- IMSLP live popularity pages: `https://imslp.org/wiki/Special:IMSLPPopular/p/ly`
- Monkey Wrench live orchestra full scores:
  `https://monkeywrenchdb.org/fetch_pieces.php?instrumentIds=39&instrumentName=Orchestra%20Full%20Score`

## Notes

- `missing_nonconcerto.tsv` is the active list for this workflow.
- The active list is built from cached IMSLP popularity pages and current Monkey Wrench holdings, then filtered to remove concertos and other poor fits for the string-parts workflow.
- The older `missing_top100.tsv` is still available as a mixed reference list.

## Working layout

- `scripts/build_nonconcerto_list.py`: rebuilds the active non-concerto list from cached IMSLP popularity pages
- `scripts/prepare_queue.py`: converts the active shortlist TSV into `work_queue.jsonl`
- `scripts/prepare_priority_gap_queue.py`: converts the live website orchestra-gap TSV into an isolated priority queue
- `scripts/imslp_api_request.py`: rate-limited IMSLP API requester
- `scripts/fetch_work_candidates.py`: caches `type=2` and `type=3` API responses for queue items
- `scripts/select_edition.py`: chooses a work candidate and file candidate, then writes a manifest draft
- `scripts/download_parts.py`: downloads full-resolution PDFs from selected manifest drafts
- `scripts/run_priority_gap_pipeline.py`: runs the isolated live-site priority workflow end to end
- `prompts/edition_selection_prompt.md`: compact LLM prompt template for ambiguous cases
- `fullres-pdfs/`: intended destination for final part PDFs
- `priority_gap/`: isolated queue/cache/drafts/PDFs for live-site “full score but no string parts” priority work
- `manifests/`: intended destination for completed manifest records

## Quick start

1. Copy `config.example.json` to `config.json` and edit if needed.
2. Rebuild the non-concerto shortlist from cached popularity pages:
   `python imslp_orchestral_gap/scripts/build_nonconcerto_list.py`
3. Regenerate the queue:
   `python imslp_orchestral_gap/scripts/prepare_queue.py`
4. Cache one test piece:
   `python imslp_orchestral_gap/scripts/fetch_work_candidates.py --piece-slug Tchaikovsky-Romeo_and_Juliet`
5. Draft a manifest selection:
   `python imslp_orchestral_gap/scripts/select_edition.py --piece-slug Tchaikovsky-Romeo_and_Juliet`
6. Download one full-resolution test set:
   `python imslp_orchestral_gap/scripts/download_parts.py --piece-slug Tchaikovsky-The_Nutcracker_suite`
7. Review `work_queue.jsonl`, `manifests/drafts/`, and `fullres-pdfs/`.

Example API search:

`python imslp_orchestral_gap/scripts/imslp_api_request.py --sleep-seconds 3 --type 2 --search 'id:Romeo and Juliet' --retformat pretty`

Example end-to-end test:

`python imslp_orchestral_gap/scripts/fetch_work_candidates.py --piece-slug Tchaikovsky-Romeo_and_Juliet`

`python imslp_orchestral_gap/scripts/select_edition.py --piece-slug Tchaikovsky-Romeo_and_Juliet`

Priority live-site gap workflow:

1. Refresh the live orchestra-only website gap TSV:
   `python imslp_orchestral_gap/scripts/find_live_full_scores_missing_string_parts.py`
2. Build the isolated priority queue:
   `python imslp_orchestral_gap/scripts/prepare_priority_gap_queue.py`
3. Run the isolated priority pipeline:
   `python -u imslp_orchestral_gap/scripts/run_priority_gap_pipeline.py --sleep-seconds 3 --continue-on-error`
4. Review outputs under `imslp_orchestral_gap/priority_gap/`.

## Queue shape

Each queue item includes:

- original IMSLP popularity rank and views
- canonical parsed work/composer fields
- a stable `piece_slug`
- a `file_stem`
- target output filenames `-1.pdf` through `-5.pdf`
- placeholders for selection status and review flags
