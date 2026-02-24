# GitHub Pages Deployment Guide

## 🔐 Secure Admin Access for GitHub Pages

Your moodboard now has a secure authentication system that only allows you (the admin) to edit the page.

## 🚀 How It Works

### Authentication System
- **Daily Password**: Generates a unique password each day
- **Browser-Specific**: Password is unique to your browser/device
- **Session-Based**: Stay logged in for 24 hours
- **Auto-Logout**: Sessions expire automatically for security

### Access Levels
- **Public Visitors**: Can view the moodboard but cannot edit
- **Admin (You)**: Full access to upload, edit, and manage content

## 📋 Deployment Steps

### 1. Upload Files to GitHub
Push these files to your GitHub repository:

```
your-repo/
├── wdigfh.html
├── JS/
│   ├── main.js
│   ├── wdigfh.js
│   ├── auth.js
│   └── github-uploader.js
├── css/
│   ├── wdigfh-standalone.css
│   └── upload-styles.css
└── assets/
    └── pictures-of/
        └── gallery.json
```

### 2. Enable GitHub Pages
1. Go to your GitHub repository
2. Click **Settings** → **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** + **/(root)**
5. Click **Save**

### 3. Visit Your Site
Your moodboard will be available at:
`https://your-username.github.io/your-repo/wdigfh.html`

## 🔐 How to Access Edit Mode

### Step 1: Get Today's Password
1. Visit: `your-site.com/wdigfh.html?edit=1`
2. Open browser console (F12)
3. Look for the admin password (displayed in green)
4. Copy the password

### Step 2: Login
1. Enter the password in the login modal
2. Click "Access Editor"
3. You're now in admin mode!

### Step 3: Edit Your Moodboard
- **Upload Images**: Drag & drop or click "Choose Images"
- **Edit Text**: Click any text to edit
- **Rearrange**: Drag items to reposition
- **Resize**: Drag corners to resize
- **Auto-Save**: Changes save automatically

## 🛡️ Security Features

### Password Generation
The password is generated from:
- Your browser fingerprint (user agent, language, screen size)
- Today's date
- Unique to your device

### Session Management
- **24-hour sessions** - auto-logout for security
- **Browser-specific** - works only on your device
- **Daily rotation** - password changes every day

### Public Access
- **View-only mode** for regular visitors
- **No upload access** for non-admins
- **Secure authentication** required for editing

## 📱 Storage on GitHub Pages

### Image Storage
Since GitHub Pages doesn't support server uploads:
- **Base64 encoding**: Images converted to text
- **Browser storage**: Stored in localStorage
- **Persistent**: Images remain until you clear them
- **Private**: Only visible in your browser

### Limitations
- **Per-browser storage**: Images don't sync across devices
- **Storage limits**: Browser localStorage has size limits
- **Manual cleanup**: You may need to remove old images

## 🎯 Admin Features

### Upload Management
```javascript
// In browser console, you can:
// View stored images
const uploader = new GitHubPagesUploader();
console.log(uploader.getStoredImages());

// Delete old images
uploader.deleteImage('image-id');
```

### Session Control
```javascript
// Logout immediately
window.moodboardAuth.logout();

// Check session status
console.log('Is admin:', window.moodboardAuth.isAdmin);
```

## 🔧 Troubleshooting

### Can't Access Edit Mode
1. **Check console** for the daily password
2. **Copy password exactly** (case-sensitive)
3. **Try refreshing** the page
4. **Clear browser cache** if needed

### Password Not Working
- Password changes **daily at midnight**
- Different on **different browsers/devices**
- **Console shows current password**

### Images Not Saving
- **GitHub Pages limitation**: Images stored in browser only
- **Clear storage** if needed: `localStorage.clear()`
- **Check quota**: `console.log(localStorage.length)`

## 🌟 Benefits

✅ **Secure**: Only you can edit
✅ **Easy**: No server setup needed
✅ **Free**: Works with GitHub Pages
✅ **Modern**: Social media-style interface
✅ **Responsive**: Works on all devices
✅ **Auto-save**: No manual saving needed

## 📞 Support

If you need help:
1. **Check browser console** for error messages
2. **Verify files uploaded** correctly to GitHub
3. **Ensure GitHub Pages** is enabled
4. **Try different browser** if issues persist

Your secure moodboard is ready for GitHub Pages! 🎉
