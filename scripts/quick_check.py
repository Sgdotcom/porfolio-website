#!/usr/bin/env python3
"""Fast structural checks for the portfolio frontend.

This script is intentionally strict about a small set of high-signal invariants.
It is designed for fast feedback and safe AI-assisted edits.
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
MOODBOARD = ROOT / "wdigfh.html"
MAIN_JS = ROOT / "JS" / "main.js"
MOODBOARD_JS = ROOT / "JS" / "wdigfh.js"
STYLE = ROOT / "css" / "style.css"

REQUIRED_FILES = [INDEX, MOODBOARD, MAIN_JS, MOODBOARD_JS, STYLE]
REQUIRED_IDS = [
    "right-side",
    "lightbox",
    "lightbox-img",
]
REQUIRED_CLASSES = [
    "wip-repeat",
    "name",
]
REQUIRED_HTML_SNIPPETS = [
    'href="css/style.css"',
    'src="JS/main.js"',
]
REQUIRED_JS_SNIPPETS = [
    "window.toggleDescription",
    "window.activateLazyLoad",
    "window.enablePhotoReorder",
    "window.enableTextEditing",
]
REQUIRED_MOODBOARD_HTML_SNIPPETS = [
    'href="css/wdigfh-standalone.css"',
    'src="JS/wdigfh.js"',
    'id="moodboard-grid"',
]
REQUIRED_MOODBOARD_JS_SNIPPETS = [
    "import { StateManager } from './modules/stateManager.js'",
    "import { GridEngine, buildLayoutFromDom } from './modules/gridEngine.js'",
    "import { AuthManager } from './modules/authManager.js'",
    "import { GitHubApiManager } from './modules/githubApiManager.js'",
    "import { UIController } from './modules/uiController.js'"
]


def fail(message: str) -> None:
    print(f"[FAIL] {message}")
    raise SystemExit(1)


def ok(message: str) -> None:
    print(f"[OK]   {message}")


for file_path in REQUIRED_FILES:
    if not file_path.exists():
        fail(f"Missing required file: {file_path}")
ok("Required files exist")

html = INDEX.read_text(encoding="utf-8")
wdigfh_html = MOODBOARD.read_text(encoding="utf-8")
js = MAIN_JS.read_text(encoding="utf-8")
moodboard_js = MOODBOARD_JS.read_text(encoding="utf-8")

for required in REQUIRED_HTML_SNIPPETS:
    if required not in html:
        fail(f"index.html missing required snippet: {required}")
ok("Required CSS/JS includes found in index.html")

for element_id in REQUIRED_IDS:
    if f'id="{element_id}"' not in html:
        fail(f"index.html missing required id: #{element_id}")
ok("Required ids found in index.html")

for class_name in REQUIRED_CLASSES:
    if f'class="{class_name}"' not in html and f" {class_name}" not in html:
        fail(f"index.html appears to be missing required class usage: .{class_name}")
ok("Required class hooks found in index.html")

for required in REQUIRED_JS_SNIPPETS:
    if required not in js:
        fail(f"JS/main.js missing required export/hook: {required}")
ok("Required JS globals/hooks found")

for required in REQUIRED_MOODBOARD_HTML_SNIPPETS:
    if required not in wdigfh_html:
        fail(f"wdigfh.html missing required snippet: {required}")
ok("Required moodboard page hooks found")

for required in REQUIRED_MOODBOARD_JS_SNIPPETS:
    if required not in moodboard_js:
        fail(f"JS/wdigfh.js missing required behavior hook: {required}")
ok("Required moodboard JS hooks found")

all_ids = re.findall(r'id\s*=\s*"([^"]+)"', html)
seen = set()
duplicates = set()
for value in all_ids:
    if value in seen:
        duplicates.add(value)
    seen.add(value)

if duplicates:
    fail("Duplicate id attributes found: " + ", ".join(sorted(duplicates)))
ok("No duplicate id attributes found")

# Lightweight guard against accidental huge inline script insertion.
inline_script_blocks = len(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>", html, flags=re.IGNORECASE))
if inline_script_blocks > 1:
    fail("Too many inline <script> blocks detected in index.html")
ok("Inline script block count is within expected range")

wdigfh_inline_script_blocks = len(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>", wdigfh_html, flags=re.IGNORECASE))
if wdigfh_inline_script_blocks > 1:
    fail("Too many inline <script> blocks detected in wdigfh.html")
ok("Inline script block count is within expected range for moodboard page")

print("\nAll quick checks passed.")
