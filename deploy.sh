#!/bin/bash
set -euo pipefail

# Deployment Script for Simon Grey Portfolio
echo "🚀 Deploying Simon Grey Portfolio..."
echo "📋 Refer to DEPLOYMENT.md for detailed checklist"

if command -v python3 >/dev/null 2>&1; then
  echo "🧠 Regenerating moodboard manifest..."
  python3 scripts/generate-gallery.py
else
  echo "⚠️  Python3 not found; run scripts/generate-gallery.py manually to refresh assets list."
fi

echo "📋 Injecting SEO optimization code..."
cp index.html index_backup.html

if ! grep -q '<!-- SEO_START -->' index_backup.html || ! grep -q '<!-- SEO_END -->' index_backup.html; then
  echo "❌ Missing SEO markers in index_backup.html"
  exit 1
fi

tmp_index="$(mktemp)"
sed -n '1,/<!-- SEO_START -->/p' index_backup.html > "$tmp_index"
cat seo.html >> "$tmp_index"
sed -n '/<!-- SEO_END -->/,$p' index_backup.html >> "$tmp_index"
mv "$tmp_index" index.html

echo "✅ SEO code injected into index.html"
echo "📁 All files ready for deployment!"
echo ""
echo "📦 Files to upload:"
echo "  ├── index.html (with SEO)"
echo "  ├── css/style.css (optimized)"
echo "  ├── css/wdigfh-standalone.css (moodboard)"
echo "  ├── JS/main.js (original)"
echo "  ├── assets/ (images, videos)"
echo "  ├── seo.html (backup)"
echo "  ├── sitemap.xml"
echo "  ├── robots.txt"
echo "  ├── manifest.json"
echo "  ├── browserconfig.xml"
echo "  ├── opensearch.xml"
echo "  ├── humans.txt"
echo "  ├── security.txt"
echo "  └── DEPLOYMENT.md (checklist)"
echo ""
echo "🌐 After deployment:"
echo "  1. Complete checklist in DEPLOYMENT.md"
echo "  2. Update domain URLs in seo.html"
echo "  3. Test locally: python -m http.server 8000"
echo "  4. Deploy to hosting platform"
echo "  5. Submit sitemap to Google Search Console"
echo "  6. Test with Google PageSpeed Insights"
echo ""
echo "✨ Ready to deploy."
