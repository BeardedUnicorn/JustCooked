import { vi, describe, test, expect, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  downloadAndStoreImage,
  getLocalImageUrl,
  deleteRecipeImage,
  shouldDownloadImage,
  processRecipeImage,
} from '@services/imageService';
import { mockStoredImage } from '@/__tests__/fixtures/recipes';

// Mock the dependencies
vi.mock('@tauri-apps/api/core');

const mockInvoke = invoke as vi.MockedFunction<typeof invoke>;

describe('imageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('downloadAndStoreImage', () => {
    test('should download and store image successfully', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      mockInvoke.mockResolvedValue(mockStoredImage);

      const result = await downloadAndStoreImage(imageUrl);

      expect(mockInvoke).toHaveBeenCalledWith('download_recipe_image', { imageUrl });
      expect(result).toEqual(mockStoredImage);
    });

    test('should handle download errors', async () => {
      const imageUrl = 'https://example.com/invalid-image.jpg';
      mockInvoke.mockRejectedValue(new Error('Network error'));

      await expect(downloadAndStoreImage(imageUrl)).rejects.toThrow(
        'Failed to download image: Error: Network error'
      );
    });

    test('should handle Tauri backend errors', async () => {
      const imageUrl = 'https://example.com/image.jpg';
      mockInvoke.mockRejectedValue('Backend error message');

      await expect(downloadAndStoreImage(imageUrl)).rejects.toThrow(
        'Failed to download image: Backend error message'
      );
    });
  });

  describe('getLocalImageUrl', () => {
    test('should get local image URL successfully', async () => {
      const localPath = '/path/to/image.jpg';
      const expectedBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';

      mockInvoke.mockResolvedValue(expectedBase64);

      const result = await getLocalImageUrl(localPath);

      expect(mockInvoke).toHaveBeenCalledWith('get_local_image', { localPath });
      expect(result).toBe(expectedBase64);
    });

    test('should return placeholder for file not found errors', async () => {
      const localPath = '/path/to/nonexistent.jpg';
      mockInvoke.mockRejectedValue(new Error('File not found'));

      const result = await getLocalImageUrl(localPath);

      expect(result).toBe('https://via.placeholder.com/400x300?text=Image+Not+Found');
    });

    test('should return placeholder for invalid file format errors', async () => {
      const localPath = '/path/to/invalid.txt';
      mockInvoke.mockRejectedValue('Invalid image format');

      const result = await getLocalImageUrl(localPath);

      expect(result).toBe('https://via.placeholder.com/400x300?text=Image+Not+Found');
    });
  });

  describe('deleteRecipeImage', () => {
    test('should delete local image successfully', async () => {
      const localImagePath = '/path/to/stored/image.jpg';
      mockInvoke.mockResolvedValue(undefined);

      await deleteRecipeImage(localImagePath);

      expect(mockInvoke).toHaveBeenCalledWith('delete_recipe_image', { localPath: localImagePath });
    });

    test('should skip deletion for web URLs', async () => {
      const webImageUrl = 'https://example.com/image.jpg';

      await deleteRecipeImage(webImageUrl);

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('should skip deletion for data URLs', async () => {
      const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';

      await deleteRecipeImage(dataUrl);

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('should skip deletion for placeholder URLs', async () => {
      const placeholderUrl = 'https://via.placeholder.com/400x300?text=No+Image';

      await deleteRecipeImage(placeholderUrl);

      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('should handle deletion errors gracefully', async () => {
      const localImagePath = '/path/to/stored/image.jpg';
      mockInvoke.mockRejectedValue(new Error('File system error'));

      // Should not throw, just log the error
      await expect(deleteRecipeImage(localImagePath)).resolves.not.toThrow();
    });

    test('should handle empty or invalid paths', async () => {
      await deleteRecipeImage('');
      await deleteRecipeImage('   ');

      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  describe('shouldDownloadImage', () => {
    test('should return true for valid HTTP/HTTPS URLs with image extensions', () => {
      expect(shouldDownloadImage('https://example.com/image.jpg')).toBe(true);
      expect(shouldDownloadImage('http://example.com/image.png')).toBe(true);
      expect(shouldDownloadImage('https://cdn.example.com/images/recipe.webp')).toBe(true);
    });

    test('should return false for placeholder URLs', () => {
      expect(shouldDownloadImage('https://via.placeholder.com/400x300')).toBe(false);
      expect(shouldDownloadImage('https://via.placeholder.com/400x300?text=No+Image')).toBe(false);
      expect(shouldDownloadImage('https://placehold.it/400x300')).toBe(false);
    });

    test('should return false for local file paths', () => {
      expect(shouldDownloadImage('/path/to/local/image.jpg')).toBe(false);
      expect(shouldDownloadImage('./relative/path/image.png')).toBe(false);
      expect(shouldDownloadImage('file:///absolute/path/image.gif')).toBe(false);
    });

    test('should return false for invalid URLs', () => {
      expect(shouldDownloadImage('')).toBe(false);
      expect(shouldDownloadImage('   ')).toBe(false);
      expect(shouldDownloadImage('not-a-url')).toBe(false);
    });

    test('should return true for URLs with image keywords', () => {
      expect(shouldDownloadImage('https://example.com/image')).toBe(true); // Contains 'image'
      expect(shouldDownloadImage('https://example.com/photo')).toBe(true); // Contains 'photo'
    });

    test('should return true for known image hosting domains', () => {
      expect(shouldDownloadImage('https://images.unsplash.com/photo-123')).toBe(true);
      expect(shouldDownloadImage('https://i.imgur.com/abc123')).toBe(true);
    });
  });

  describe('processRecipeImage', () => {
    test('should download and process valid image URL', async () => {
      const imageUrl = 'https://example.com/recipe-image.jpg';
      const localUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';
      
      mockInvoke.mockResolvedValueOnce(mockStoredImage); // downloadAndStoreImage
      mockInvoke.mockResolvedValueOnce(localUrl); // getLocalImageUrl

      const result = await processRecipeImage(imageUrl);

      expect(result).toBe(localUrl);
      expect(mockInvoke).toHaveBeenCalledWith('download_recipe_image', { imageUrl });
      expect(mockInvoke).toHaveBeenCalledWith('get_local_image', {
        localPath: mockStoredImage.local_path
      });
    });

    test('should return original URL for placeholder images', async () => {
      const placeholderUrl = 'https://via.placeholder.com/400x300?text=No+Image';

      const result = await processRecipeImage(placeholderUrl);

      expect(result).toBe(placeholderUrl);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('should return original URL for invalid URLs', async () => {
      const invalidUrl = 'not-a-valid-url';

      const result = await processRecipeImage(invalidUrl);

      expect(result).toBe(invalidUrl);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    test('should fallback to original URL on download failure', async () => {
      const imageUrl = 'https://example.com/recipe-image.jpg';
      
      mockInvoke.mockRejectedValue(new Error('Download failed'));

      const result = await processRecipeImage(imageUrl);

      expect(result).toBe(imageUrl);
      expect(mockInvoke).toHaveBeenCalledWith('download_recipe_image', { imageUrl });
    });

    test('should return placeholder when getLocalImageUrl fails', async () => {
      const imageUrl = 'https://example.com/recipe-image.jpg';
      const placeholderUrl = 'https://via.placeholder.com/400x300?text=Image+Not+Found';

      mockInvoke.mockResolvedValueOnce(mockStoredImage); // downloadAndStoreImage succeeds
      // getLocalImageUrl doesn't throw, it returns placeholder on error
      mockInvoke.mockResolvedValueOnce(placeholderUrl); // getLocalImageUrl returns placeholder

      const result = await processRecipeImage(imageUrl);

      expect(result).toBe(placeholderUrl); // getLocalImageUrl returns placeholder on error
    });

    test('should handle empty or invalid URLs', async () => {
      expect(await processRecipeImage('')).toBe('');
      expect(await processRecipeImage('   ')).toBe('   ');
      expect(await processRecipeImage('invalid-url')).toBe('invalid-url');
      
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });
});
