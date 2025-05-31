import { invoke } from '@tauri-apps/api/core';

export interface StoredImage {
  local_path: string;
  original_url: string;
  file_size: number;
  format: string;
  width: number;
  height: number;
}

export async function downloadAndStoreImage(imageUrl: string): Promise<StoredImage> {
  try {
    const storedImage: StoredImage = await invoke('download_recipe_image', { imageUrl });
    return storedImage;
  } catch (error) {
    console.error('Failed to download and store image:', error);
    throw new Error(`Failed to download image: ${error}`);
  }
}

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

export async function getLocalImageUrl(localPath: string): Promise<string> {
  // Convert local file path to a URL that can be used in the frontend
  if (localPath.startsWith('http')) {
    return localPath; // Already a URL
  }

  if (localPath.startsWith('data:')) {
    return localPath; // Already a data URL
  }

  try {
    // Use Tauri command to get the image as base64 data URL
    const base64DataUrl: string = await invoke('get_local_image', { localPath });
    return base64DataUrl;
  } catch (error) {
    console.error('Failed to load local image:', error);
    // Return a placeholder image if we can't load the local image
    return 'https://via.placeholder.com/400x300?text=Image+Not+Found';
  }
}

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

export async function processRecipeImage(imageUrl: string): Promise<string> {
  // If we shouldn't download the image, return the original URL
  if (!shouldDownloadImage(imageUrl)) {
    return imageUrl;
  }

  try {
    console.log('Downloading and storing image:', imageUrl);
    const storedImage = await downloadAndStoreImage(imageUrl);
    const localUrl = await getLocalImageUrl(storedImage.local_path);
    console.log('Image stored locally:', localUrl);
    return localUrl;
  } catch (error) {
    console.warn('Failed to download image, using original URL:', error);
    return imageUrl; // Fallback to original URL
  }
}

export async function deleteRecipeImage(imagePath: string): Promise<void> {
  // Only delete if it's a local image file (not a URL)
  if (!imagePath || imagePath.startsWith('http') || imagePath.startsWith('data:')) {
    return; // Nothing to delete for URLs or data URLs
  }

  // Check if it's a local image file (contains .justcooked path or starts with /)
  if (imagePath.includes('.justcooked') || imagePath.startsWith('/')) {
    try {
      await invoke('delete_recipe_image', { localPath: imagePath });
      console.log('Deleted local image:', imagePath);
    } catch (error) {
      console.warn('Failed to delete local image:', error);
      // Don't throw error - recipe deletion should continue even if image deletion fails
    }
  }
}
