---
description: How to update version numbers for cache busting
---

# Updating Version Numbers

When you modify JavaScript or CSS files, you must update the query string version in `index.php` to ensure users receive the latest changes immediately.

## File: `index.php`

1.  **Locate the Script/Style Tag**: Find the line including your modified file.
    ```html
    <script src="stripped-synpdf.js?v=293"></script>
    ```

2.  **Increment the Version**: Increase the number after `v=`.
    ```html
    <script src="stripped-synpdf.js?v=294"></script>
    <link href="assets/css/stripped-synpdf-styles.css?v=241" />
    ```

## Files to Check
- `stripped-synpdf.js`
- `stripped-synpdf-extras.js`
- `annotation-layer.js`
- `js/history-manager.js`
- `assets/css/stripped-synpdf-styles.css`

## Turbo Mode
// turbo-all
If you are running a command to update version numbers using `sed` or similar, verify the file content first.
