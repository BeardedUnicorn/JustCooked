import { invoke } from '@tauri-apps/api/core';
import { shouldDownloadImage as shouldDownloadImageUtil } from '@utils/urlUtils';

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

export async function processRecipeImage(imageUrl: string): Promise<string> {
  // If we shouldn't download the image, return the original URL
  if (!shouldDownloadImageUtil(imageUrl)) {
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

// Re-export utility functions for convenience
export { isValidImageUrl, shouldDownloadImage } from '@utils/urlUtils';
