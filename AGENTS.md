# AGENTS.md

## Cursor Cloud specific instructions

This is a **static portfolio website** (HTML/CSS/vanilla JS) with no build system and no package manager. There are no external dependencies to install — Python scripts use the standard library only.

### Services

| Service | Command | Notes |
|---|---|---|
| Local dev server | `python3 -m http.server 8000` | Serve from repo root; visit `http://localhost:8000` |

### Lint / Checks

Run `./scripts/quick_feedback.sh` from the repo root. This performs:
- Python syntax checks on helper scripts
- Structural integrity checks (`scripts/quick_check.py`) — validates required files, HTML ids/classes, JS hooks
- Git whitespace check

### Key pages

- **Portfolio**: `index.html` (main page)
- **Moodboard**: `wdigfh.html` (secondary page; admin mode via `?edit=1` query param)

### Gallery regeneration

If images under `assets/pictures-of/` change, run `python3 scripts/generate-gallery.py` to update `gallery.json`.

### Deployment

`./deploy.sh` injects SEO tags from `seo.html` into `index.html` and regenerates the gallery. This is for production deployment only — not needed for local dev.
