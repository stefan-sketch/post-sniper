/**
 * Image Optimization Utilities
 * Provides WebP support, responsive images, and lazy loading
 */

/**
 * Check if browser supports WebP format
 */
export const supportsWebP = (() => {
  if (typeof window === 'undefined') return false;
  
  const elem = document.createElement('canvas');
  if (elem.getContext && elem.getContext('2d')) {
    return elem.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  }
  return false;
})();

/**
 * Convert image URL to WebP if supported and available
 * For now, just returns original URL
 * TODO: Implement server-side WebP conversion or use CDN
 */
export function getOptimizedImageUrl(url: string, width?: number): string {
  if (!url) return '';
  
  // If it's a Facebook CDN image, we can add size parameters
  if (url.includes('fbcdn.net') || url.includes('facebook.com')) {
    // Facebook allows width parameter
    if (width) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}width=${width}`;
    }
  }
  
  // TODO: Implement WebP conversion on server or CDN
  // For now, return original URL
  return url;
}

/**
 * Generate srcset for responsive images
 */
export function generateSrcSet(url: string): string {
  if (!url) return '';
  
  // Generate multiple sizes for responsive loading
  const sizes = [320, 640, 960, 1280, 1920];
  
  return sizes
    .map(width => `${getOptimizedImageUrl(url, width)} ${width}w`)
    .join(', ');
}

/**
 * Get appropriate sizes attribute based on layout
 */
export function getImageSizes(layout: 'post' | 'thumbnail' | 'full'): string {
  switch (layout) {
    case 'thumbnail':
      return '(max-width: 768px) 100px, 150px';
    case 'post':
      return '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw';
    case 'full':
      return '100vw';
    default:
      return '100vw';
  }
}



