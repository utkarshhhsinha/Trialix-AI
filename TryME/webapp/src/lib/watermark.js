/**
 * watermark.js — Client-side watermark overlay
 * 
 * Adds "styled by 🔍 oraneo" watermark to generated images
 * This is a GUARANTEED watermark (AI models can't add text reliably)
 */

/**
 * Add watermark overlay to an image
 * @param {string} imageUrl - Image URL or data URI
 * @returns {Promise<string>} - Data URI with watermark
 */
export async function addWatermark(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      try {
        // Create canvas matching image size
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Calculate responsive font size (3% of image height)
        const fontSize = Math.max(14, Math.floor(img.height * 0.03));
        
        // Configure watermark text style
        ctx.font = `bold ${fontSize}px "Outfit", -apple-system, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        
        // Add semi-transparent background for better readability
        const padding = fontSize * 0.4;
        const textMetrics = ctx.measureText('styled by 🔍 oraneo');
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        const bgX = img.width - textWidth - padding * 3;
        const bgY = img.height - textHeight - padding * 2;
        const bgWidth = textWidth + padding * 2;
        const bgHeight = textHeight + padding;
        
        // Draw rounded rectangle background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.beginPath();
        ctx.roundRect(bgX, bgY, bgWidth, bgHeight, padding * 0.5);
        ctx.fill();
        
        // Draw watermark text with subtle shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText('styled by 🔍 oraneo', img.width - padding * 2, img.height - padding * 1.5);
        
        // Convert to data URI
        const watermarkedDataUri = canvas.toDataURL('image/jpeg', 0.92);
        resolve(watermarkedDataUri);
      } catch (error) {
        console.error('[Watermark] Failed to add watermark:', error);
        // Return original on error
        resolve(imageUrl);
      }
    };
    
    img.onerror = () => {
      console.error('[Watermark] Failed to load image');
      // Return original on error
      resolve(imageUrl);
    };
    
    img.src = imageUrl;
  });
}

/**
 * Add watermark and convert to downloadable blob
 * @param {string} imageUrl - Image URL or data URI
 * @param {string} filename - Download filename
 */
export async function downloadWithWatermark(imageUrl, filename = 'tryon_by_oraneo.jpg') {
  try {
    const watermarkedDataUri = await addWatermark(imageUrl);
    
    // Convert data URI to blob
    const response = await fetch(watermarkedDataUri);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    // Trigger download
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Cleanup
    URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('[Watermark] Download failed:', error);
    // Fallback to direct download without watermark
    window.open(imageUrl, '_blank');
  }
}
