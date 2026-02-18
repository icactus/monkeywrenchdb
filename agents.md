# AI Agent Notes

This file contains instructions and notes for AI agents working on this codebase.

## Deployment Notes

### cPanel Deployment
This project uses `.cpanel.yml` for automated deployment. When adding new PHP, JS, or CSS files that need to be served in production, they MUST be added to the appropriate task in `.cpanel.yml`.

- **Web Root Files**: Add to `$DEPLOYPATH` (`/home/monkcdmb/public_html/`)
- **PHP Logic Files**: Add to `$DEPLOYPATH2` (`/home/monkcdmb/phpfiles/`)
- **Edit Mode Files**: Add to `$DEPLOYPATH3` (`/home/monkcdmb/public_html/editmode/`)

### Recent Additions (Feb 2026)
- `preview-editor.php`: Main page for editing previews.
- `synpdf-editor-extension.js`: Client-side logic for the preview editor and save functionality.
- `phpfiles/submit_recording.php`: Backend logic for saving edited recordings to the database (requires `piece_id`).

## DTW Pipeline
The Python pipeline (located in `scripts/`) is designed for local use to generate preview data. The resulting JSON files in `assets/previews/` are what the production `preview-editor.php` consumes.

## Database Compatibility
The database connection should use `utf8mb4` to support international characters.
The `fetch_pieces.php` script handles cases where the `piece_solo_instruments` table might be missing (useful for local development clones).

## Cache Busting
When modifying CSS or JS files, you MUST increment the version number (`?v=XXX`) in `index.php` (and any other files that include them) to ensure users receive the latest changes immediately. Do not wait for the user to ask for this. Refer to the `update-version-numbers` workflow.
