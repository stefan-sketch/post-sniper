import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ImageModalProps {
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageModal({ imageUrl, onClose }: ImageModalProps) {
  const [scale, setScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastTouchDistance = useRef<number>(0);
  const lastTapTime = useRef<number>(0);

  // Reset state when image changes
  useEffect(() => {
    setScale(1);
    setDragOffsetY(0);
  }, [imageUrl]);

  // Calculate distance between two touch points
  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };



  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch gesture start
      e.preventDefault();
      lastTouchDistance.current = getTouchDistance(e.touches);
    } else if (e.touches.length === 1) {
      // Single touch - could be swipe down or double tap
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime.current;
      
      if (timeSinceLastTap < 300) {
        // Double tap detected
        e.preventDefault();
        if (scale > 1) {
          // Zoom out
          setScale(1);
        } else {
          // Zoom in to 2x
          setScale(2);
        }
      } else if (scale === 1) {
        // Only allow swipe down when not zoomed
        setIsDragging(true);
        setDragStartY(e.touches[0].clientY);
      }
      
      lastTapTime.current = now;
    }
  };

  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom - keep image centered
      e.preventDefault();
      const currentDistance = getTouchDistance(e.touches);
      
      if (lastTouchDistance.current > 0) {
        const scaleChange = currentDistance / lastTouchDistance.current;
        const newScale = Math.max(1, Math.min(5, scale * scaleChange));
        setScale(newScale);
      }
      
      lastTouchDistance.current = currentDistance;
    } else if (e.touches.length === 1 && isDragging && scale === 1) {
      // Swipe down to close (only when not zoomed)
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - dragStartY;
      setDragOffsetY(deltaY);
    }
  };

  // Handle touch end
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsDragging(false);
      
      // Check if swipe down threshold reached (only when not zoomed)
      if (scale === 1 && Math.abs(dragOffsetY) > 100) {
        onClose();
      } else {
        // Snap back
        setDragOffsetY(0);
      }
      
      lastTouchDistance.current = 0;
    }
  };

  if (!imageUrl) return null;

  return createPortal(
    <div 
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      style={{
        transform: `translateY(${dragOffsetY}px)`,
        opacity: scale === 1 ? Math.max(0.5, 1 - Math.abs(dragOffsetY) / 300) : 1,
        transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out',
      }}
      onClick={(e) => {
        if (e.target === containerRef.current) {
          onClose();
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 text-white transition-all z-[10000]"
        title="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Image with gestures - always centered */}
      <img 
        ref={imageRef}
        src={imageUrl} 
        alt="Expanded view"
        className="max-w-full max-h-full object-contain select-none"
        style={{
          transform: `scale(${scale})`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out',
          touchAction: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />

      {/* Hint text when zoomed */}
      {scale > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
          Pinch to zoom in/out
        </div>
      )}
      
      {/* Hint text when not zoomed */}
      {scale === 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
          Swipe down to close • Double tap to zoom
        </div>
      )}
    </div>,
    document.body
  );
}

