<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Configuration
$uploadDir = 'assets/pictures-of/';
$galleryFile = 'assets/pictures-of/gallery.json';
$maxFileSize = 10 * 1024 * 1024; // 10MB
$allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'];

// Ensure upload directory exists
if (!file_exists($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

// Handle image upload
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['image'])) {
    try {
        $file = $_FILES['image'];
        
        // Validate file
        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedFormats)) {
            throw new Exception('Unsupported file format. Allowed: ' . implode(', ', $allowedFormats));
        }
        
        if ($file['size'] > $maxFileSize) {
            throw new Exception('File too large. Maximum size: 10MB');
        }
        
        if ($file['error'] !== UPLOAD_ERR_OK) {
            throw new Exception('Upload error: ' . $file['error']);
        }
        
        // Generate unique filename
        $timestamp = time();
        $random = bin2hex(random_bytes(3));
        $filename = $timestamp . '_' . $random . '.' . $extension;
        $filepath = $uploadDir . $filename;
        
        // Move uploaded file
        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            throw new Exception('Failed to save uploaded file');
        }
        
        // Update gallery.json
        updateGalleryJson($filepath, $file['name']);
        
        echo json_encode([
            'success' => true,
            'path' => $filepath,
            'originalName' => $file['name'],
            'size' => $file['size'],
            'type' => $file['type']
        ]);
        
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

// Handle gallery update
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['updateGallery'])) {
    try {
        $galleryData = json_decode($_POST['galleryData'], true);
        if (!$galleryData) {
            throw new Exception('Invalid gallery data');
        }
        
        // Add timestamp
        $galleryData['generatedAt'] = date('c');
        
        // Save to file
        if (file_put_contents($galleryFile, json_encode($galleryData, JSON_PRETTY_PRINT)) === false) {
            throw new Exception('Failed to save gallery data');
        }
        
        echo json_encode([
            'success' => true,
            'message' => 'Gallery updated successfully'
        ]);
        
    } catch (Exception $e) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
    exit;
}

// Invalid request
http_response_code(404);
echo json_encode([
    'success' => false,
    'error' => 'Invalid request'
]);

function updateGalleryJson($filepath, $originalName) {
    global $galleryFile;
    
    // Load existing gallery
    $gallery = ['items' []];
    if (file_exists($galleryFile)) {
        $json = file_get_contents($galleryFile);
        if ($json !== false) {
            $gallery = json_decode($json, true) ?: ['items' []];
        }
    }
    
    // Add new image
    $gallery['items'][] = [
        'path' => $filepath,
        'type' => 'image',
        'caption' => pathinfo($originalName, PATHINFO_FILENAME)
    ];
    
    // Update timestamp
    $gallery['generatedAt'] = date('c');
    
    // Save gallery
    file_put_contents($galleryFile, json_encode($gallery, JSON_PRETTY_PRINT));
}
?>
