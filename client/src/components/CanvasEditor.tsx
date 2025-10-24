import { useRef, useEffect, useState } from "react";

type PageId = "footy-feed" | "football-funnys" | "football-away-days";

const PAGE_COLORS: Record<PageId, string> = {
  "footy-feed": "#1877F2",
  "football-funnys": "#FFD700",
  "football-away-days": "#FF4500",
};

interface CanvasEditorProps {
  selectedPage: PageId | null;
  onCanvasUpdate: (imageDataUrl: string) => void;
  triggerOverlayUpload?: File | null;
  onOverlayUploaded?: () => void;
}

export function CanvasEditor({ 
  selectedPage, 
  onCanvasUpdate, 
  triggerOverlayUpload,
  onOverlayUploaded 
}: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);
  const [overlayScale, setOverlayScale] = useState(50);
  const [overlayPosition, setOverlayPosition] = useState({ x: 540, y: 675 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;
  const BORDER_WIDTH = 8;

  // Handle overlay upload from tools button
  useEffect(() => {
    if (triggerOverlayUpload) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          setOverlayImage(img);
          setOverlayPosition({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
          onOverlayUploaded?.();
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(triggerOverlayUpload);
    }
  }, [triggerOverlayUpload, onOverlayUploaded]);

  // Draw canvas whenever anything changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 1. Draw background image (if exists)
    if (backgroundImage) {
      const imgAspect = backgroundImage.width / backgroundImage.height;
      const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imgAspect > canvasAspect) {
        drawHeight = CANVAS_HEIGHT;
        drawWidth = drawHeight * imgAspect;
        offsetX = (CANVAS_WIDTH - drawWidth) / 2;
        offsetY = 0;
      } else {
        drawWidth = CANVAS_WIDTH;
        drawHeight = drawWidth / imgAspect;
        offsetX = 0;
        offsetY = (CANVAS_HEIGHT - drawHeight) / 2;
      }

      ctx.drawImage(backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
    }

    // 2. Draw overlay image ON TOP (if exists)
    if (overlayImage) {
      const scale = overlayScale / 100;
      const scaledWidth = overlayImage.width * scale;
      const scaledHeight = overlayImage.height * scale;
      const x = overlayPosition.x - scaledWidth / 2;
      const y = overlayPosition.y - scaledHeight / 2;

      // Draw overlay image
      ctx.drawImage(overlayImage, x, y, scaledWidth, scaledHeight);

      // 3. Draw colored outline around overlay (if page selected)
      if (selectedPage) {
        const borderColor = PAGE_COLORS[selectedPage];
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = BORDER_WIDTH;
        ctx.strokeRect(x, y, scaledWidth, scaledHeight);
      }

      // 4. Draw selection border (dashed cyan)
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(x, y, scaledWidth, scaledHeight);
      ctx.setLineDash([]);
    }

    // Update parent with canvas image
    if (backgroundImage || overlayImage) {
      const dataUrl = canvas.toDataURL('image/png');
      onCanvasUpdate(dataUrl);
    }
  }, [backgroundImage, overlayImage, overlayScale, overlayPosition, selectedPage, onCanvasUpdate]);

  // Mouse handlers for dragging overlay
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayImage) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    setIsDragging(true);
    setDragStart({
      x: mouseX - overlayPosition.x,
      y: mouseY - overlayPosition.y
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !overlayImage) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    setOverlayPosition({
      x: mouseX - dragStart.x,
      y: mouseY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => setBackgroundImage(img);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex gap-3 items-start">
      {/* Size slider (only when overlay exists) */}
      {overlayImage && (
        <div className="flex flex-col items-center gap-1">
          <input
            type="range"
            min="10"
            max="200"
            step="5"
            value={overlayScale}
            onChange={(e) => setOverlayScale(Number(e.target.value))}
            className="h-32 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            style={{
              writingMode: 'bt-lr',
              WebkitAppearance: 'slider-vertical',
              width: '8px'
            }}
            title={`Size: ${overlayScale}%`}
          />
          <span className="text-xs text-gray-400">{overlayScale}%</span>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-shrink-0 bg-gray-800 rounded-lg p-2">
        <input
          type="file"
          accept="image/*"
          onChange={handleBackgroundUpload}
          className="hidden"
          id="canvas-bg-upload"
        />
        
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`border border-gray-700 rounded ${
            overlayImage ? 'cursor-move' : 'cursor-default'
          }`}
          style={{ width: '380px', height: 'auto' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>
    </div>
  );
}

