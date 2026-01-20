---
description: Always write a git commit after making changes
---

# Git Commit Workflow

**IMPORTANT**: After completing any code changes, you MUST create a git commit with a descriptive message.

## Steps

1.  **Stage the Changed Files**:
    ```bash
    git add -A
    ```
    Or stage specific files:
    ```bash
    git add path/to/file1 path/to/file2
    ```

2.  **Write a Descriptive Commit Message**:
    ```bash
    git commit -m "Brief description of what changed"
    ```
    
    Good commit message examples:
    - `"Add inline rename for markings menu"`
    - `"Fix PDF loading timeout with retry button"`
    - `"Refactor history manager into separate module"`
    
    Bad commit message examples:
    - `"fix"`
    - `"update"`
    - `"changes"`

3.  **Push (if applicable)**:
    ```bash
    git push
    ```

## Guidelines

- Commit messages should be concise but descriptive
- Use present tense ("Add feature" not "Added feature")
- Reference the feature or bug being addressed
- Group related changes into a single commit

## Turbo Mode
// turbo-all
Git commands for staging and committing can be auto-run.
