---
description: How to update version numbers for cache busting
---

# Version Number Updates

**IMPORTANT**: When modifying JavaScript or CSS files that are included in `index.php`, you MUST increment their version numbers to bust browser caches.

## Files with Version Numbers

Check `index.php` for these cache-busted includes:

| File | Example Location |
|------|-----------------|
| `stripped-synpdf.js` | Line ~655: `stripped-synpdf.js?v=XXX` |
| `stripped-synpdf-extras.js` | Line ~656: `stripped-synpdf-extras.js?v=XXX` |
| `stripped-synpdf-styles.css` | Line ~36: `stripped-synpdf-styles.css?v=XXX` |
| `annotation-layer.js` | Line ~44: `annotation-layer.js?v=XXX` |
| `fonts.css` | Line ~35: `fonts.css?v=XXX` |

## When to Update

- **After modifying any of the above files**, increment their `?v=XXX` parameter by 1
- **Before committing and pushing**, verify version numbers are updated
- This prevents users from seeing cached (old) versions of the code

## Example

If you edited `stripped-synpdf.js` and its current version is `v=290`, change it to `v=291`:

```php
// Before
<script src="stripped-synpdf.js?v=290"></script>

// After  
<script src="stripped-synpdf.js?v=291"></script>
```
