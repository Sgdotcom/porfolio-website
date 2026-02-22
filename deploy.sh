#!/bin/bash

# Deployment Script for Simon Grey Portfolio
echo "🚀 Deploying Simon Grey Portfolio..."
echo "📋 Refer to DEPLOYMENT.md for detailed checklist"

if command -v python3 >/dev/null 2>&1; then
  echo "🧠 Regenerating moodboard manifest..."
  python3 scripts/generate-gallery.py
else
  echo "⚠️  Python3 not found; run scripts/generate-gallery.py manually to refresh assets list."
fi

# Inject SEO code into index.html
echo "📋 Injecting SEO optimization code..."
cp index.html index_backup.html

# Use sed to construct a new index.html with seo.html content between markers
sed -n '1,/<!-- SEO_START -->/p' index_backup.html > index.html
cat seo.html >> index.html
sed -n '/<!-- SEO_END -->/,$p' index_backup.html >> index.html

echo "✅ SEO code injected into index.html"
echo "📁 All files ready for deployment!"
echo ""
echo "� Files to upload:"
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
echo "✨ Ready to deploy! Run: ./deploy.sh"
