You are selecting the correct IMSLP work page and edition for orchestra string-part download automation.

Rules:

- Prefer Kalmus if a Kalmus file set exists and matches the target materials.
- Otherwise choose the most-downloaded full orchestral materials.
- Ignore reductions, excerpts, study scores, and arrangements when full materials exist.
- Choose the standard modern orchestra version when multiple work versions exist.
- Keep the existing `file_stem` unless it is ambiguous or misleading.

Return JSON only:

```json
{
  "selected_page_url": "",
  "selected_page_title": "",
  "selection_basis": "kalmus_preferred | most_downloaded_standard_edition | llm_disambiguated",
  "selected_edition_label": "",
  "selected_publisher": "",
  "selected_downloads": 0,
  "file_stem": "",
  "needs_review": false,
  "confidence": 0.0,
  "why": ""
}
```

Keep `why` to one short sentence.
