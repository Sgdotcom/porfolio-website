# 🚀 Simon Grey Portfolio - Deployment Checklist

## 📋 Pre-Deployment Checklist

### ✅ SEO & Optimization
- [ ] Update domain URLs in `seo.html` (localhost → yourdomain.com)
- [ ] Test all pages locally
- [ ] Validate HTML with W3C validator
- [ ] Check mobile responsiveness
- [ ] Test contact forms
- [ ] Verify all links work correctly

### ✅ Performance
- [ ] Test with Google PageSpeed Insights
- [ ] Check Core Web Vitals
- [ ] Verify lazy loading works
- [ ] Test image optimization

### ✅ Content Review
- [ ] Replace all placeholder text
- [ ] Add alt text to all images
- [ ] Check spelling and grammar
- [ ] Verify project descriptions are accurate

### ✅ Technical
- [ ] Set up Google Analytics
- [ ] Configure SSL certificate
- [ ] Test on different browsers
- [ ] Check console for errors

## 🚀 Deployment Steps

### 1. Choose Hosting Platform
- [ ] **Netlify**: Drag & drop deployment
- [ ] **Vercel**: Git-based deployment
- [ ] **GitHub Pages**: Free static hosting
- [ ] **Traditional**: FTP/SFTP to web server

### 2. Deploy Files
```bash
# From the project root (e.g. worktree or repo root)
./deploy.sh
```

### 3. Moodboard (WDIGFH) on GitHub Pages

The moodboard uses **GitHub API** for edit-mode publish (no PHP, no server uploads). Deploy as static files.

**Key files to include:**
- `wdigfh.html`
- `JS/main.js`, `JS/wdigfh.js`
- `JS/modules/stateManager.js`, `gridEngine.js`, `uiController.js`, `authManager.js`, `githubApiManager.js`
- `css/wdigfh-standalone.css`
- `assets/pictures-of/gallery.json` (and any images/videos referenced there)

**GitHub Pages setup:** Settings → Pages → Source: Deploy from branch → branch `main` (or your default) → / (root). Site URL: `https://<owner>.github.io/<repo>/wdigfh.html`

**Edit mode:** `wdigfh.html?edit=1` — auth required (daily password; see browser console when needed). Publish writes `gallery.json` and uploads to the repo via GitHub API.

**Visitor guide:** See `PUBLIC_GALLERY_GUIDE.md` for the public moodboard experience.

### 4. Post-Deployment Verification
- [ ] **SEO Testing**: Use Google Search Console
- [ ] **Performance**: Google PageSpeed Insights test
- [ ] **Mobile**: Test on actual devices
- [ ] **Accessibility**: WAVE or axe DevTools
- [ ] **Analytics**: Check Google Analytics data

### 5. Submit to Search Engines
- [ ] **Google**: Submit sitemap via Search Console
- [ ] **Bing**: Submit to Bing Webmaster Tools
- [ ] **Local**: Google My Business listing

## 📊 Success Metrics to Track

### SEO Performance
- [ ] Google PageSpeed score: 90+
- [ ] Core Web Vitals: All green
- [ ] Mobile speed: 3G compatible
- [ ] Search ranking: Top 10 for "Stockholm designer"

### User Experience
- [ ] Bounce rate: < 40%
- [ ] Page load time: < 2 seconds
- [ ] Mobile usability: 95+ score
- [ ] Contact form conversion: > 5%

## 🔄 Ongoing Maintenance

### Monthly
- [ ] Update sitemap with new content
- [ ] Check for broken links
- [ ] Monitor analytics performance
- [ ] Update SEO keywords based on performance

### Quarterly
- [ ] Review and update SEO strategy
- [ ] Add new portfolio projects
- [ ] Backup website files
- [ ] Test new browser features

## 📞 Emergency Rollback Plan

If deployment causes issues:
1. **Restore backup**: `cp index_backup.html index.html`
2. **Revert changes**: Use Git history
3. **Contact hosting**: Support ticket with hosting provider
4. **Monitor**: Check analytics for errors

## 🎯 Next Steps After Deployment

1. **Content Strategy**: Plan blog posts or case studies
2. **Networking**: Share portfolio on design communities
3. **Client Acquisition**: Set up professional contact forms
4. **Analytics Review**: Monthly performance analysis
5. **SEO Expansion**: Target new keywords based on performance

---

**Last Updated**: 2026-02-19
**Version**: 1.0
