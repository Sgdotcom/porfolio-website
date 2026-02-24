#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Python syntax check"
export PYTHONPYCACHEPREFIX="$ROOT_DIR/.pycache"
python3 -m py_compile scripts/generate-gallery.py scripts/quick_check.py

echo "==> Structural quick checks"
python3 scripts/quick_check.py

echo "==> Git whitespace check"
git diff --check -- .

echo "==> Done"
