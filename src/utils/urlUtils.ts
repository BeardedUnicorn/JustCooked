/**
 * Utility functions for URL validation and processing
 */

function matchesDomain(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

// Check if URL is from a supported recipe site
export function isSupportedUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return matchesDomain(hostname, 'allrecipes.com') ||
           matchesDomain(hostname, 'foodnetwork.com') ||
           matchesDomain(hostname, 'bbcgoodfood.com') ||
           matchesDomain(hostname, 'seriouseats.com') ||
           matchesDomain(hostname, 'epicurious.com') ||
           matchesDomain(hostname, 'food.com') ||
           matchesDomain(hostname, 'tasteofhome.com') ||
           matchesDomain(hostname, 'delish.com') ||
           matchesDomain(hostname, 'bonappetit.com') ||
           matchesDomain(hostname, 'simplyrecipes.com') ||
           matchesDomain(hostname, 'americastestkitchen.com');
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
      matchesDomain(urlObj.hostname.toLowerCase(), domain)
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
