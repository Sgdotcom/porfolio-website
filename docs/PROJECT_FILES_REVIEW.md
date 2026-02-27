# Project files review

## What the project needs (keep)

| Category | Files / folders | Why |
|----------|----------------|-----|
| **Entry points** | `index.html`, `wdigfh.html`, `seo.html` | Main site, moodboard, SEO fragment for deploy |
| **JS** | `JS/main.js`, `JS/wdigfh.js`, `JS/modules/*.js` | Used by index + wdigfh |
| **CSS** | `css/style.css`, `css/wdigfh-standalone.css` | index and wdigfh styles |
| **Assets** | `assets/**` | Content (images, videos, gallery.json). Do not delete unless you intentionally remove content. |
| **Config** | `package.json`, `package-lock.json`, `.gitignore`, `.htaccess`, `CNAME`, `manifest.json`, `browserconfig.xml`, `opensearch.xml`, `robots.txt`, `sitemap.xml`, `humans.txt` | Build, deploy, SEO |
| **Deploy** | `deploy.sh`, `scripts/generate-gallery.py`, `scripts/quick_check.py`, `scripts/quick_feedback.sh` | Used by deploy and docs |
| **Docs** | `docs/AI_MAINTENANCE.md`, `docs/FOUNDATION_CONTRACTS.md` | Current project contracts |
| **Deploy checklist** | `DEPLOYMENT.md` | Referenced by deploy.sh; generic checklist |
| **Tests** | `tests/e2e-grid.js`, `tests/fixtures/test-image.png`, `tests/README.md` | E2E and docs |

---

## Files suggested to delete

### 1. Obsolete one-off scripts (safe to delete)

| File | Reason |
|------|--------|
| `test-drag.js` | Hardcoded path to `/Users/simongrey/Desktop/my website/`. Debug script; replaced by `tests/e2e-grid.js`. |
| `test-html.js` | Minimal localhost check; superseded by E2E. |

### 2. Duplicate docs (safe to delete)

| File | Reason |
|------|--------|
| `docs/AI_MAINTENANCE 2.md` | Duplicate of `docs/AI_MAINTENANCE.md`. |
| `docs/FOUNDATION_CONTRACTS 2.md` | Duplicate of `docs/FOUNDATION_CONTRACTS.md`. |

### 3. Outdated deployment docs (merged and removed)

| File | Reason |
|------|--------|
| ~~`DEPLOYMENT_GUIDE.md`~~ | Described PHP upload; project uses GitHub API. Merged into DEPLOYMENT.md §3 and file deleted. |
| ~~`GITHUB_PAGES_DEPLOYMENT.md`~~ | Outdated file names and storage model. Merged into DEPLOYMENT.md §3 and file deleted. |

**DEPLOYMENT.md** now includes a "Moodboard (WDIGFH) on GitHub Pages" subsection with current files and steps. **PUBLIC_GALLERY_GUIDE.md** remains the user-facing moodboard guide.

---

## Optional cleanup (your call)

- **Assets:** Only remove files you no longer use. `assets/pictures-of/` is driven by `gallery.json`; removing images there can break layout until you republish. Other `assets/` folders (100bilder, cheiron, dialogue, field-day, home, photography) look like portfolio content; keep unless you are pruning the main site.
- **Deploy script:** It mentions `security.txt` in the “files to upload” list; that file is not in the repo. Add it if you want, or remove that line from the script.

---

## Summary

- **Deleted in this pass:** `test-drag.js`, `test-html.js`, `docs/AI_MAINTENANCE 2.md`, `docs/FOUNDATION_CONTRACTS 2.md`.
- **Done:** Merged useful deployment content into **DEPLOYMENT.md** (Moodboard on GitHub Pages §3) and deleted `DEPLOYMENT_GUIDE.md` and `GITHUB_PAGES_DEPLOYMENT.md`. Do not delete asset files unless you are intentionally removing content.
