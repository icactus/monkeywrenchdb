# Selection Policy

## Overall flow

1. Start from the curated missing-work queue.
2. Find the correct IMSLP work page or version.
3. On that page, choose the edition/file set.
4. Download the string parts.
5. Save a manifest entry recording what was selected and why.

## Hard rules

- Prefer a Kalmus edition if one exists and contains the needed materials.
- If there is no Kalmus option, choose the full orchestral materials with the highest download count.
- Ignore reductions, excerpts, study scores, and arrangements when full orchestral materials are available.
- If cello and bass share one source PDF, save two output files anyway: `-4.pdf` and `-5.pdf`.

## LLM role

Use an LLM only when the deterministic rules do not settle the choice cleanly.

Typical ambiguity cases:

- multiple IMSLP work pages or versions for what looks like the same repertoire target
- multiple plausible edition/file sets on the same page
- deciding which version is the "standard" modern orchestra choice
- assigning a filename stem when two works would otherwise collide

## Output filenames

Use:

- `ComposerLastName-PieceName-1.pdf`
- `ComposerLastName-PieceName-2.pdf`
- `ComposerLastName-PieceName-3.pdf`
- `ComposerLastName-PieceName-4.pdf`
- `ComposerLastName-PieceName-5.pdf`

Part mapping:

- `1`: violin 1
- `2`: violin 2
- `3`: viola
- `4`: cello
- `5`: bass

## Filename stem rules

- Build filenames from canonical metadata, not the raw IMSLP page title.
- Use a short stable stem:
  `ComposerLastName-NormalizedPieceName`
- Normalize `PieceName` to ASCII.
- Remove quotes and most punctuation.
- Replace spaces with `_`.
- Keep the shortest name that remains unambiguous in practice.
- If two works collide, append a short discriminator such as `Ballet`, `Suite_1`, `Overture`, `Op_20`, etc.

Examples:

- `Beethoven-Symphony_No_5-1.pdf`
- `Tchaikovsky-Romeo_and_Juliet-4.pdf`
- `Prokofiev-Romeo_and_Juliet_Ballet-1.pdf`

## Recommended implementation split

Deterministic code should handle:

- scraping IMSLP candidate pages and file rows
- detecting Kalmus
- counting downloads
- filtering bad material types
- mapping part files to `-1` through `-5`
- duplicating shared cello/bass sources
- saving manifests

The LLM should handle only:

- ambiguous page/version selection
- ambiguous edition selection
- "standard modern choice" judgments
- filename stem disambiguation

## Token budget

For ambiguous pieces only, target a compact JSON payload:

- roughly `300-800` input tokens
- roughly `100-250` output tokens

Expected total:

- roughly `400-1050` tokens per ambiguous piece

This stays cheap if the code sends structured candidate summaries instead of raw HTML.
