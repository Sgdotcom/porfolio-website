# Deployment Guide for Social Media Moodboard

## Server Setup

### 1. Upload Files
Upload these files to your website root directory:
- `wdigfh.html`
- `JS/wdigfh.js`
- `css/upload-styles.css`
- `api/upload.php`

### 2. Set Permissions
Make these directories writable:
```bash
chmod 755 assets/pictures-of/
chmod 644 assets/pictures-of/gallery.json
chmod 755 api/
```

### 3. PHP Requirements
Ensure your server has:
- PHP 7.4 or higher
- File upload support
- JSON functions

### 4. Test the Upload
Visit: `https://your-site.com/wdigfh.html?edit=1`

## How It Works Online

### Local Testing vs Production

**Local Testing (what you just used):**
- Uses blob URLs for images
- Simulates uploads without server
- Images disappear on page refresh

**Production (live website):**
- Uses PHP backend to save actual files
- Images are permanently stored on server
- `gallery.json` is automatically updated
- Images persist across sessions

### Upload Process on Live Site

1. **User uploads image** → JavaScript sends to `api/upload.php`
2. **PHP processes upload** → Saves file to `assets/pictures-of/`
3. **PHP updates gallery.json** → Adds new image to gallery data
4. **JavaScript reloads gallery** → Shows new image immediately
5. **Image is permanently stored** → Available for all visitors

### File Structure After Upload

```
assets/pictures-of/
├── gallery.json          # Gallery metadata
├── 1700000000_abc123.jpg  # Uploaded images
├── 1700000001_def456.png
└── original_filenames.jpg
```

### Security Notes

- PHP validates file types and sizes
- Unique filenames prevent conflicts
- Images stored in dedicated directory
- No executable files allowed

## Usage

### For Visitors
- View the moodboard at `your-site.com/wdigfh.html`
- See all uploaded images in beautiful grid layout

### For Admin (You)
- Enter edit mode: `your-site.com/wdigfh.html?edit=1`
- Upload images via drag & drop
- Edit text and rearrange layout
- Changes save automatically
- Exit edit mode with Escape key

## Troubleshooting

### Uploads Not Working
1. Check PHP error logs
2. Verify directory permissions
3. Test with small images first

### Images Not Appearing
1. Check browser console for errors
2. Verify `gallery.json` is being updated
3. Check file paths in gallery data

### Permissions Issues
```bash
# Fix permissions if needed
chown -R www-data:www-data assets/pictures-of/
chmod -R 755 assets/pictures-of/
```

## Features

✅ **Drag & Drop Upload** - Works like Instagram
✅ **Auto-Save** - Changes save automatically  
✅ **Mobile Friendly** - Works on all devices
✅ **Real-time Updates** - Images appear immediately
✅ **Persistent Storage** - Images saved permanently
✅ **Edit Mode** - Easy content management
✅ **Responsive Layout** - Adapts to screen size
