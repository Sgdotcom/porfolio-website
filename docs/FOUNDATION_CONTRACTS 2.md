# Foundation Contracts (AI-Oriented)

This document captures stable abstractions and interfaces that other code depends on.

## Core Abstractions

1. Template routing contract (`index.html` + `JS/main.js`)
- Each left-nav link uses `a[data-template]`.
- Each template id must map to a `<template id="...">` in `index.html`.
- `#right-side` is the single mount target for hydrated project content.

2. UI state class contract (`css/style.css` + JS controllers)
- `body.project-open`: desktop project mode.
- `.project-wrapper.active`: selected project in sidebar.
- `.project-wrapper.homepage-active`: current section marker highlight.
- `.mobile-project-view.active`: visible mobile overlay.
- `.edit-freeform` / `.edit-mode`: freeform editor states.

3. Public JS hooks contract
- `window.toggleDescription(button)`
- `window.activateLazyLoad(container)`
- `window.enablePhotoReorder(container, force?)`
- `window.enableTextEditing(container)`

4. Moodboard data contract (`wdigfh.html` + `JS/wdigfh.js` + `assets/pictures-of/gallery.json`)
- Grid root: `#moodboard-grid[data-sort-key]`.
- Persisted key: `moodboard-items-ordered-v2`.
- Manifest payload shape:
  - `{ items: [{ path: string, type: 'image'|'video', caption?: string }] }`

## Strengthened Contracts Implemented

1. `wdigfh.html` script boundary
- Inline moodboard app removed.
- Moodboard logic now lives in `JS/wdigfh.js`.
- Page contracts are explicit and testable.

2. Script-side validation
- `scripts/quick_check.py` now verifies:
  - `wdigfh.html` includes `JS/wdigfh.js` and moodboard hooks.
  - `JS/wdigfh.js` contains required behavior entry points.

3. Deploy script safety
- `deploy.sh` now uses `set -euo pipefail`.
- SEO marker presence is validated before rewriting `index.html`.
- Rewrite is done via temp file + move for safer updates.

## Suggested Renames (non-breaking targets)

These are safe future cleanups that improve readability.

- `wdigfh` -> `moodboard`
- `grid` -> `moodboardGrid`
- `wUnits/hUnits` -> `gridWidthUnits/gridHeightUnits`
- `applyLayout` -> `applyPackedGridLayout`
- `saveLayout` -> `persistMoodboardLayout`
- `itemsV2` storage key constant -> `moodboardLayoutV2`

## Test Targets

1. Pure layout math
- `getGridColumns(width)`
  - `<=576 => 2`, `577..992 => 5`, `>992 => 10`.
- placement algorithm in `applyLayout`
  - no overlap invariant.
  - width unit clamping to available columns.

2. Persistence and restore
- unknown/invalid JSON in `moodboard-items-ordered-v2` does not crash.
- restored order preserves unmatched leftovers.

3. Integration behavior
- desktop project open/close toggles `body.project-open` correctly.
- mobile project open creates `.mobile-project-view`, back button removes it.
- lightbox keyboard navigation wraps at bounds.

4. Contract regression checks
- `scripts/quick_check.py` should fail if:
  - `#right-side` or `#moodboard-grid` removed.
  - required global hooks removed.
  - moodboard JS script reference removed.

## Coupling Reduction Opportunities (next incremental step)

1. Move hard-coded selectors in `JS/main.js` to a `SELECTORS` map (like `JS/wdigfh.js`).
2. Extract modal creation into a shared helper module to dedupe export modals.
3. Replace inline style edits with class toggles where practical.
