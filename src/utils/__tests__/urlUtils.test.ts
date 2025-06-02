import { describe, test, expect } from '@jest/globals';
import {
  isSupportedUrl,
  isValidImageUrl,
  shouldDownloadImage,
  getHostnameFromUrl,
  isValidHttpUrl
} from '@utils/urlUtils';

describe('urlUtils', () => {
  describe('isSupportedUrl', () => {
    test('should return true for supported recipe sites', () => {
      expect(isSupportedUrl('https://allrecipes.com/recipe/123/cookies')).toBe(true);
      expect(isSupportedUrl('https://www.foodnetwork.com/recipes/recipe-123')).toBe(true);
      expect(isSupportedUrl('https://bbcgoodfood.com/recipes/recipe-123')).toBe(true);
      expect(isSupportedUrl('https://seriouseats.com/recipe-123')).toBe(true);
      expect(isSupportedUrl('https://epicurious.com/recipes/food/views/recipe-123')).toBe(true);
      expect(isSupportedUrl('https://food.com/recipe/recipe-123')).toBe(true);
      expect(isSupportedUrl('https://tasteofhome.com/recipes/recipe-123')).toBe(true);
      expect(isSupportedUrl('https://delish.com/cooking/recipe-ideas/recipe-123')).toBe(true);
      expect(isSupportedUrl('https://bonappetit.com/recipe/recipe-123')).toBe(true);
      expect(isSupportedUrl('https://simplyrecipes.com/recipes/recipe-123')).toBe(true);
    });

    test('should return false for unsupported sites', () => {
      expect(isSupportedUrl('https://example.com/recipe')).toBe(false);
      expect(isSupportedUrl('https://google.com')).toBe(false);
      expect(isSupportedUrl('https://unsupported-recipe-site.com')).toBe(false);
    });

    test('should handle invalid URLs', () => {
      expect(isSupportedUrl('not-a-url')).toBe(false);
      expect(isSupportedUrl('')).toBe(false);
      expect(isSupportedUrl('ftp://allrecipes.com')).toBe(true); // FTP URLs with supported hostnames are still considered supported
    });

    test('should be case insensitive', () => {
      expect(isSupportedUrl('https://ALLRECIPES.COM/recipe/123')).toBe(true);
      expect(isSupportedUrl('https://FoodNetwork.com/recipe/123')).toBe(true);
    });
  });

  describe('isValidImageUrl', () => {
    test('should return true for URLs with image extensions', () => {
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.jpeg')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.png')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.webp')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.gif')).toBe(true);
    });

    test('should return true for known image hosting domains', () => {
      expect(isValidImageUrl('https://images.unsplash.com/photo-123')).toBe(true);
      expect(isValidImageUrl('https://cdn.pixabay.com/photo/123')).toBe(true);
      expect(isValidImageUrl('https://images.pexels.com/photos/123')).toBe(true);
      expect(isValidImageUrl('https://i.imgur.com/abc123')).toBe(true);
      expect(isValidImageUrl('https://res.cloudinary.com/demo/image/upload/sample.jpg')).toBe(true);
      expect(isValidImageUrl('https://s3.amazonaws.com/bucket/image')).toBe(true);
      expect(isValidImageUrl('https://lh3.googleusercontent.com/image')).toBe(true);
    });

    test('should return true for URLs containing image keywords', () => {
      expect(isValidImageUrl('https://example.com/api/image/123')).toBe(true);
      expect(isValidImageUrl('https://example.com/photo/123')).toBe(true);
    });

    test('should return false for non-image URLs', () => {
      expect(isValidImageUrl('https://example.com/page.html')).toBe(false);
      expect(isValidImageUrl('https://example.com/document.pdf')).toBe(false);
      expect(isValidImageUrl('https://example.com/video.mp4')).toBe(false);
    });

    test('should handle invalid URLs', () => {
      expect(isValidImageUrl('not-a-url')).toBe(false);
      expect(isValidImageUrl('')).toBe(false);
    });

    test('should be case insensitive for extensions', () => {
      expect(isValidImageUrl('https://example.com/image.JPG')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.PNG')).toBe(true);
    });
  });

  describe('shouldDownloadImage', () => {
    test('should return true for valid remote image URLs', () => {
      expect(shouldDownloadImage('https://example.com/image.jpg')).toBe(true);
      expect(shouldDownloadImage('https://images.unsplash.com/photo-123')).toBe(true);
    });

    test('should return false for local file URLs', () => {
      expect(shouldDownloadImage('file:///path/to/image.jpg')).toBe(false);
      expect(shouldDownloadImage('/local/path/image.jpg')).toBe(false);
    });

    test('should return false for placeholder images', () => {
      expect(shouldDownloadImage('https://via.placeholder.com/400x300')).toBe(false);
      expect(shouldDownloadImage('https://example.com/placeholder.jpg')).toBe(false);
    });

    test('should return false for invalid URLs', () => {
      expect(shouldDownloadImage('')).toBe(false);
      expect(shouldDownloadImage('not-a-url')).toBe(false);
      expect(shouldDownloadImage('https://example.com/document.pdf')).toBe(false);
    });
  });

  describe('getHostnameFromUrl', () => {
    test('should extract hostname from valid URLs', () => {
      expect(getHostnameFromUrl('https://example.com/path')).toBe('example.com');
      expect(getHostnameFromUrl('https://www.google.com/search?q=test')).toBe('www.google.com');
      expect(getHostnameFromUrl('http://localhost:3000/app')).toBe('localhost');
    });

    test('should return original string for invalid URLs', () => {
      expect(getHostnameFromUrl('not-a-url')).toBe('not-a-url');
      expect(getHostnameFromUrl('')).toBe('');
      expect(getHostnameFromUrl('just-text')).toBe('just-text');
    });

    test('should handle URLs with different protocols', () => {
      expect(getHostnameFromUrl('ftp://files.example.com/file.txt')).toBe('files.example.com');
      expect(getHostnameFromUrl('mailto:test@example.com')).toBe('');
    });
  });

  describe('isValidHttpUrl', () => {
    test('should return true for HTTP and HTTPS URLs', () => {
      expect(isValidHttpUrl('https://example.com')).toBe(true);
      expect(isValidHttpUrl('http://example.com')).toBe(true);
      expect(isValidHttpUrl('https://www.example.com/path?query=value')).toBe(true);
    });

    test('should return false for non-HTTP protocols', () => {
      expect(isValidHttpUrl('ftp://example.com')).toBe(false);
      expect(isValidHttpUrl('file:///path/to/file')).toBe(false);
      expect(isValidHttpUrl('mailto:test@example.com')).toBe(false);
    });

    test('should return false for invalid URLs', () => {
      expect(isValidHttpUrl('not-a-url')).toBe(false);
      expect(isValidHttpUrl('')).toBe(false);
      expect(isValidHttpUrl('just-text')).toBe(false);
    });

    test('should handle URLs with ports', () => {
      expect(isValidHttpUrl('http://localhost:3000')).toBe(true);
      expect(isValidHttpUrl('https://example.com:8080/app')).toBe(true);
    });
  });
});
