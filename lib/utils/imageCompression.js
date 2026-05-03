/**
 * Image Compression Utility
 * 
 * Compresses images on the client side before upload
 * Uses browser Canvas API for compression
 */

/**
 * Compress image file
 * @param {File} file - Image file
 * @param {number} maxWidth - Maximum width (default: 1920)
 * @param {number} maxHeight - Maximum height (default: 1920)
 * @param {number} quality - JPEG quality 0-1 (default: 0.85)
 * @returns {Promise<string>} - Compressed base64 data URL
 */
export async function compressImage(file, maxWidth = 1920, maxHeight = 1920, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }
        
        // Create canvas and compress
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with compression
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to compress image'));
              return;
            }
            
            // Convert blob to base64
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          quality
        );
      };
      
      img.onerror = reject;
      img.src = e.target.result;
    };
    
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Compress multiple images in parallel
 * @param {File[]} files - Array of image files
 * @param {object} options - Compression options
 * @returns {Promise<string[]>} - Array of compressed base64 data URLs
 */
export async function compressImages(files, options = {}) {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    maxConcurrent = 3, // Process 3 at a time to avoid memory issues
  } = options;

  const results = [];
  
  // Process in batches to avoid memory issues
  for (let i = 0; i < files.length; i += maxConcurrent) {
    const batch = files.slice(i, i + maxConcurrent);
    const batchResults = await Promise.all(
      batch.map(file => compressImage(file, maxWidth, maxHeight, quality))
    );
    results.push(...batchResults);
  }
  
  return results;
}

/**
 * Get image file size in MB
 * @param {File} file - Image file
 * @returns {number} - Size in MB
 */
export function getImageSizeMB(file) {
  return file.size / (1024 * 1024);
}

/**
 * Check if image needs compression
 * @param {File} file - Image file
 * @param {number} maxSizeMB - Maximum size in MB (default: 2)
 * @returns {boolean} - True if compression needed
 */
export function needsCompression(file, maxSizeMB = 2) {
  return getImageSizeMB(file) > maxSizeMB;
}

