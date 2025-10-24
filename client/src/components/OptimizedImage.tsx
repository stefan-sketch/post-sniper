import { useState, useEffect, useRef } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  quality?: number;
  eager?: boolean; // Skip lazy loading
}

export function OptimizedImage({ 
  src, 
  alt, 
  className = '', 
  width,
  quality = 80,
  eager = false 
}: OptimizedImageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(eager);
  const [imageSrc, setImageSrc] = useState<string>('');
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (eager) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '100px' } // Start loading 100px before entering viewport
    );
    
    if (imgRef.current) {
      observer.observe(imgRef.current);
    }
    
    return () => observer.disconnect();
  }, [eager]);

  // Set image source
  useEffect(() => {
    if (!shouldLoad) return;
    
    // For external images, use as-is (already optimized by platforms)
    // For local images or if optimization is needed, could use proxy
    setImageSrc(src);
  }, [shouldLoad, src, width, quality]);

  return (
    <div ref={imgRef} className={`relative ${className}`}>
      {/* Blur placeholder while loading */}
      {!imageLoaded && shouldLoad && (
        <div className="absolute inset-0 bg-gray-800 animate-pulse rounded" />
      )}
      
      {/* Actual image */}
      {shouldLoad && (
        <picture>
          {/* WebP source for modern browsers */}
          <source
            srcSet={imageSrc}
            type="image/webp"
          />
          {/* Fallback to original */}
          <img
            src={imageSrc}
            alt={alt}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            onLoad={() => setImageLoaded(true)}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
          />
        </picture>
      )}
    </div>
  );
}

