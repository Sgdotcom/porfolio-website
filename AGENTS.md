## Cursor Cloud specific instructions

This is a **static HTML/CSS/vanilla-JS portfolio website** with no build step, no bundler, and no package manager dependencies.

### Running the dev server

```bash
python3 -m http.server 8000
```

Serve from the workspace root (`/workspace`). The ES-module moodboard page (`wdigfh.html`) requires HTTP — `file://` will not work.

### Pages

- `index.html` — main portfolio (navigation, lightbox, dark mode, lazy loading)
- `wdigfh.html` — moodboard / inspiration board; append `?edit=1` for CMS edit mode (requires an admin token printed to the browser console)

### Lint / structural checks

```bash
bash scripts/quick_feedback.sh
```

Runs Python syntax validation, structural invariant checks (`scripts/quick_check.py`), and a git whitespace check. See `docs/AI_MAINTENANCE.md` for the full list of hard invariants.

### Gallery manifest regeneration

```bash
python3 scripts/generate-gallery.py
```

Regenerates `assets/pictures-of/gallery.json` from the image/video files in that directory.

### Gotchas

- There is no `package.json`, `requirements.txt`, or any dependency file — Python standard library is sufficient.
- The JS directory is uppercase: `JS/` (not `js/`). File references are case-sensitive.
- `wdigfh.html` uses ES modules (`import`/`export`), so it must be served over HTTP.
