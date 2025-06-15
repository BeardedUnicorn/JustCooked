import { vi, describe, test, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useImageUrl } from '@hooks/useImageUrl';
import { getLocalImageUrl } from '@services/imageService';

// Mock the image service
vi.mock('@services/imageService');

const mockGetLocalImageUrl = getLocalImageUrl as vi.MockedFunction<typeof getLocalImageUrl>;

describe('useImageUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return web URL directly for HTTP/HTTPS URLs', async () => {
    const webUrl = 'https://example.com/image.jpg';
    
    const { result } = renderHook(() => useImageUrl(webUrl));

    expect(result.current.imageUrl).toBe(webUrl);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();
  });

  test('should return data URL directly for data URLs', async () => {
    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';
    
    const { result } = renderHook(() => useImageUrl(dataUrl));

    expect(result.current.imageUrl).toBe(dataUrl);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();
  });

  test('should fetch local image URL for local paths', async () => {
    const localPath = '/path/to/local/image.jpg';
    const expectedBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';
    
    mockGetLocalImageUrl.mockResolvedValue(expectedBase64);

    const { result } = renderHook(() => useImageUrl(localPath));

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.imageUrl).toBe('');
    expect(result.current.error).toBeNull();

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe(expectedBase64);
    expect(result.current.error).toBeNull();
    expect(mockGetLocalImageUrl).toHaveBeenCalledWith(localPath);
  });

  test('should handle errors when fetching local image URL', async () => {
    const localPath = '/path/to/nonexistent/image.jpg';
    const errorMessage = 'File not found';
    
    mockGetLocalImageUrl.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useImageUrl(localPath));

    // Initially should be loading
    expect(result.current.isLoading).toBe(true);

    // Wait for the async operation to complete
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe('');
    expect(result.current.error).toBe(errorMessage);
    expect(mockGetLocalImageUrl).toHaveBeenCalledWith(localPath);
  });

  test('should return placeholder URL for empty or null image paths', async () => {
    const { result: resultEmpty } = renderHook(() => useImageUrl(''));
    const { result: resultNull } = renderHook(() => useImageUrl(null as any));
    const { result: resultUndefined } = renderHook(() => useImageUrl(undefined as any));

    expect(resultEmpty.current.imageUrl).toBe('https://via.placeholder.com/400x300?text=No+Image');
    expect(resultEmpty.current.isLoading).toBe(false);
    expect(resultEmpty.current.error).toBeNull();

    expect(resultNull.current.imageUrl).toBe('https://via.placeholder.com/400x300?text=No+Image');
    expect(resultNull.current.isLoading).toBe(false);
    expect(resultNull.current.error).toBeNull();

    expect(resultUndefined.current.imageUrl).toBe('https://via.placeholder.com/400x300?text=No+Image');
    expect(resultUndefined.current.isLoading).toBe(false);
    expect(resultUndefined.current.error).toBeNull();

    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();
  });

  test('should handle whitespace-only image paths', async () => {
    const { result } = renderHook(() => useImageUrl('   \t\n   '));

    expect(result.current.imageUrl).toBe('https://via.placeholder.com/400x300?text=No+Image');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();
  });

  test('should update when image path changes', async () => {
    const webUrl = 'https://example.com/image.jpg';
    const localPath = '/path/to/local/image.jpg';
    const expectedBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';
    
    mockGetLocalImageUrl.mockResolvedValue(expectedBase64);

    const { result, rerender } = renderHook(
      ({ imagePath }) => useImageUrl(imagePath),
      { initialProps: { imagePath: webUrl } }
    );

    // Initially should show web URL
    expect(result.current.imageUrl).toBe(webUrl);
    expect(result.current.isLoading).toBe(false);

    // Change to local path
    rerender({ imagePath: localPath });

    // Should start loading
    expect(result.current.isLoading).toBe(true);

    // Wait for completion
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.imageUrl).toBe(expectedBase64);
    expect(mockGetLocalImageUrl).toHaveBeenCalledWith(localPath);
  });

  test('should handle rapid path changes correctly', async () => {
    const localPath1 = '/path/to/image1.jpg';
    const localPath2 = '/path/to/image2.jpg';
    const base64_1 = 'data:image/jpeg;base64,image1data';
    const base64_2 = 'data:image/jpeg;base64,image2data';
    
    mockGetLocalImageUrl
      .mockResolvedValueOnce(base64_1)
      .mockResolvedValueOnce(base64_2);

    const { result, rerender } = renderHook(
      ({ imagePath }) => useImageUrl(imagePath),
      { initialProps: { imagePath: localPath1 } }
    );

    // Quickly change to second path before first resolves
    rerender({ imagePath: localPath2 });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Should show the result for the latest path
    expect(result.current.imageUrl).toBe(base64_2);
  });

  test('should handle blob URLs correctly', async () => {
    const blobUrl = 'blob:http://localhost:3000/12345678-1234-1234-1234-123456789abc';
    
    const { result } = renderHook(() => useImageUrl(blobUrl));

    expect(result.current.imageUrl).toBe(blobUrl);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();
  });

  test('should handle file URLs correctly', async () => {
    const fileUrl = 'file:///path/to/local/image.jpg';
    
    const { result } = renderHook(() => useImageUrl(fileUrl));

    expect(result.current.imageUrl).toBe(fileUrl);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockGetLocalImageUrl).not.toHaveBeenCalled();
  });

  test('should clear error when path changes to valid URL', async () => {
    const localPath = '/path/to/nonexistent/image.jpg';
    const webUrl = 'https://example.com/image.jpg';
    
    mockGetLocalImageUrl.mockRejectedValue(new Error('File not found'));

    const { result, rerender } = renderHook(
      ({ imagePath }) => useImageUrl(imagePath),
      { initialProps: { imagePath: localPath } }
    );

    // Wait for error
    await waitFor(() => {
      expect(result.current.error).toBe('File not found');
    });

    // Change to web URL
    rerender({ imagePath: webUrl });

    expect(result.current.imageUrl).toBe(webUrl);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle concurrent requests for same path', async () => {
    const localPath = '/path/to/image.jpg';
    const expectedBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD...';
    
    mockGetLocalImageUrl.mockResolvedValue(expectedBase64);

    // Render multiple hooks with same path
    const { result: result1 } = renderHook(() => useImageUrl(localPath));
    const { result: result2 } = renderHook(() => useImageUrl(localPath));

    await waitFor(() => {
      expect(result1.current.isLoading).toBe(false);
      expect(result2.current.isLoading).toBe(false);
    });

    expect(result1.current.imageUrl).toBe(expectedBase64);
    expect(result2.current.imageUrl).toBe(expectedBase64);
    expect(result1.current.error).toBeNull();
    expect(result2.current.error).toBeNull();
  });
});
