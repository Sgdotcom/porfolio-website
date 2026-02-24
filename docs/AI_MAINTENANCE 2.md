# AI Maintenance Guide

This project is intentionally simple: static HTML, CSS, and vanilla JS.

## Goals
- Keep behavior predictable.
- Prefer explicit flow over abstraction.
- Make regressions obvious within seconds.

## Runtime Map
- `index.html`: structure, templates, and mount points.
- `css/style.css`: layout and visual state.
- `JS/main.js`: controllers and event wiring.
- `wdigfh.html`: moodboard page shell.
- `JS/wdigfh.js`: moodboard-specific behavior and persistence.
- `scripts/quick_check.py`: fast structural checks.
- `scripts/quick_feedback.sh`: one command for quick verification.

## JS Structure (main.js)
The file is organized in this order:
1. Global public helpers (`window.toggleDescription`).
2. Core helpers (`CONFIG`, `storage`, `math`, `mediaUtils`, `motion`, `dom`).
3. Feature controllers:
   - Lazy media loading
   - Freeform photo layout (edit mode)
   - Header/top UI
   - Project navigation + homepage feed
   - Lightbox
   - Text editing/export (edit mode)
4. Bootstrap (`initHeaderUi`, `initProjectSystem`, `initLightbox`).

Keep new code in the closest section. Do not create cross-section implicit dependencies.

## Hard Invariants
If these change, update code and checks in the same commit.

- `index.html` must include:
  - `#right-side`
  - `#lightbox`
  - `#lightbox-img`
  - `.wip-repeat`
  - `.name`
- `index.html` must load:
  - `css/style.css`
  - `JS/main.js`
- `JS/main.js` must expose:
  - `window.toggleDescription`
  - `window.activateLazyLoad`
  - `window.enablePhotoReorder`
  - `window.enableTextEditing`
- `wdigfh.html` must include:
  - `#moodboard-grid`
  - `JS/wdigfh.js`

## Safe Edit Protocol
For AI agents and humans:
1. Read the section you are editing plus adjacent helper section.
2. Keep function responsibilities narrow:
   - compute (pure) -> apply (DOM) -> wire events.
3. Avoid hidden side effects:
   - pass required inputs explicitly.
   - keep localStorage access inside `storage` helpers.
4. Prefer event delegation over attaching many listeners when behavior is uniform.
5. If you add timers/animation delays, place values in `CONFIG.motion`.

## Fast Feedback Loop
Run:

```bash
./scripts/quick_feedback.sh
```

This performs:
- Python syntax check for scripts.
- Structural checks for critical IDs/hooks/exports.
- Git whitespace error check.

## Common Low-Risk Changes
- Add new project template:
  - add template in `index.html`
  - add nav link with `data-template`
  - no JS changes if it follows existing template pattern
- Adjust animation timing:
  - edit `CONFIG.motion` only
- Add edit-mode UI behavior:
  - place under the `Text Editing (Edit Mode)` section

## What Not To Do
- Do not scatter `window.addEventListener` calls across unrelated sections.
- Do not add globals unless backward compatibility requires it.
- Do not mix DOM querying, state math, and mutation in one long function.
