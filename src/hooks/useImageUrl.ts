import { useState, useEffect } from 'react';
import { getLocalImageUrl } from '@services/imageService';

/**
 * Hook to handle loading local images asynchronously
 * Returns a data URL for local images or the original URL for remote images
 */
export function useImageUrl(imageUrl: string | undefined): string {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
      setResolvedUrl('https://via.placeholder.com/400x300?text=No+Image');
      return;
    }

    // If it's already a web URL or data URL, use it directly
    if (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) {
      setResolvedUrl(imageUrl);
      return;
    }

    // If it's a local file path, load it asynchronously
    if (imageUrl.startsWith('/') || imageUrl.includes('.justcooked')) {
      setIsLoading(true);
      getLocalImageUrl(imageUrl)
        .then(url => {
          setResolvedUrl(url);
          setIsLoading(false);
        })
        .catch(error => {
          console.error('Failed to load image:', error);
          setResolvedUrl('https://via.placeholder.com/400x300?text=Image+Not+Found');
          setIsLoading(false);
        });
      return;
    }

    // Fallback for any other case
    setResolvedUrl(imageUrl);
  }, [imageUrl]);

  // Show placeholder while loading
  if (isLoading) {
    return 'https://via.placeholder.com/400x300?text=Loading...';
  }

  return resolvedUrl;
}
