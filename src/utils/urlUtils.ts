/**
 * Utility functions for URL validation and processing
 */

// Check if URL is from a supported recipe site
export function isSupportedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return hostname.includes('allrecipes.com') ||
           hostname.includes('foodnetwork.com') ||
           hostname.includes('bbcgoodfood.com') ||
           hostname.includes('seriouseats.com') ||
           hostname.includes('epicurious.com') ||
           hostname.includes('food.com') ||
           hostname.includes('tasteofhome.com') ||
           hostname.includes('delish.com') ||
           hostname.includes('bonappetit.com') ||
           hostname.includes('simplyrecipes.com') ||
           hostname.includes('americastestkitchen.com');
  } catch {
    return false;
  }
}

// Check if URL is a valid image URL
export function isValidImageUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    // Check for common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
    
    // Also accept URLs that might be dynamic image URLs (no extension)
    // as long as they're from known image hosting domains
    const imageHostingDomains = [
      'images.unsplash.com',
      'cdn.pixabay.com',
      'images.pexels.com',
      'i.imgur.com',
      'cloudinary.com',
      'amazonaws.com',
      'googleusercontent.com',
    ];
    
    const isFromImageHost = imageHostingDomains.some(domain => 
      urlObj.hostname.includes(domain)
    );
    
    return hasImageExtension || isFromImageHost || url.includes('image') || url.includes('photo');
  } catch {
    return false;
  }
}

// Check if an image should be downloaded and stored locally
export function shouldDownloadImage(imageUrl: string): boolean {
  // Don't download if it's already a local file
  if (imageUrl.startsWith('file://') || imageUrl.startsWith('/')) {
    return false;
  }
  
  // Don't download placeholder images
  if (imageUrl.includes('placeholder') || imageUrl.includes('via.placeholder')) {
    return false;
  }
  
  // Don't download if URL is empty or invalid
  if (!imageUrl || !isValidImageUrl(imageUrl)) {
    return false;
  }
  
  return true;
}

// Extract hostname from URL for display purposes
export function getHostnameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch {
    return url;
  }
}

// Check if URL is a valid HTTP/HTTPS URL
export function isValidHttpUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}
