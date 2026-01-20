---
description: How to ensure new files are deployed via cPanel
---

# Checking Deployment Configuration

When adding new files or directories to the project (e.g., new JS modules, PHP endpoints), you MUST ensure they are added to the deployment script.

## The `.cpanel.yml` File

The file `.cpanel.yml` controls the automatic deployment pipeline. It explicitly copies files from the repository to the `public_html` directory.

### Checklist

1.  **Open `.cpanel.yml`**: Check the `tasks` list.
2.  **Verify New Files**: If you created a new file (e.g., `js/history-manager.js`), ensure its parent directory is copied.
    *   Example: `- /bin/cp -R js $DEPLOYPATH` covers all files in `js/`.
    *   Example: `- /bin/cp new_file.php $DEPLOYPATH` covers a single file.
3.  **Add if Missing**: If the file/path is missing, add a new line to the copy command list.

## Turbo Mode
// turbo-all
If you are running a command to check this file, you can auto-run `cat .cpanel.yml`.
