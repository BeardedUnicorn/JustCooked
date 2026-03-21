import { useState, useEffect } from 'react';
import { getLocalImageUrl } from '@services/imageService';

export interface UseImageUrlResult {
  imageUrl: string;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook to handle loading local images asynchronously
 * Returns a data URL for local images or the original URL for remote images
 */
export function useImageUrl(imageUrl: string | undefined): UseImageUrlResult {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storybookOverride =
    typeof window !== 'undefined'
      ? (window as typeof window & {
          __STORYBOOK_HOOK_MOCKS__?: {
            useImageUrl?: (value: string | undefined) => UseImageUrlResult;
          };
        }).__STORYBOOK_HOOK_MOCKS__?.useImageUrl
      : undefined;

  useEffect(() => {
    if (storybookOverride) {
      return;
    }

    // Reset error state when imageUrl changes
    setError(null);

    if (!imageUrl || imageUrl.trim() === '') {
      setResolvedUrl('https://via.placeholder.com/400x300?text=No+Image');
      setIsLoading(false);
      return;
    }

    // If it's already a web URL, data URL, blob URL, or file URL, use it directly
    if (imageUrl.startsWith('http') || imageUrl.startsWith('data:') ||
        imageUrl.startsWith('blob:') || imageUrl.startsWith('file:')) {
      setResolvedUrl(imageUrl);
      setIsLoading(false);
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
        .catch(err => {
          console.error('Failed to load image:', err);
          setError(err.message || 'Failed to load image');
          setResolvedUrl('');
          setIsLoading(false);
        });
      return;
    }

    // Fallback for any other case
    setResolvedUrl(imageUrl);
    setIsLoading(false);
  }, [imageUrl, storybookOverride]);

  if (storybookOverride) {
    return storybookOverride(imageUrl);
  }

  return {
    imageUrl: resolvedUrl,
    isLoading,
    error,
  };
}
