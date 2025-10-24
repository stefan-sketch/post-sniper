import { useState, useRef, useEffect } from "react";
import { Upload } from "lucide-react";

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

export function CanvasEditor({ selectedPage, onCanvasUpdate, triggerOverlayUpload, onOverlayUploaded }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);
  const [overlayScale, setOverlayScale] = useState(50);
  const [overlayPosition, setOverlayPosition] = useState({ x: 540, y: 675 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);

  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;
  const BORDER_WIDTH = 8;

  // Handle overlay upload triggered from tools button
  useEffect(() => {
    if (triggerOverlayUpload) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          console.log('Overlay image loaded:', img.width, 'x', img.height);
          setOverlayImage(img);
          setOverlayPosition({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
          // Force redraw after state update
          setTimeout(() => {
            console.log('Forcing canvas redraw after overlay load');
            drawCanvas();
          }, 100);
          onOverlayUploaded?.();
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(triggerOverlayUpload);
    }
  }, [triggerOverlayUpload]);

  useEffect(() => {
    drawCanvas();
  }, [backgroundImage, overlayImage, overlayScale, overlayPosition, selectedPage]);

  useEffect(() => {
    if (backgroundImage || overlayImage) {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        onCanvasUpdate(dataUrl);
      }
    }
  }, [backgroundImage, overlayImage, overlayScale, overlayPosition, selectedPage]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with white background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background image first (bottom layer)
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

    // Draw overlay image on top (top layer)
    if (overlayImage) {
      const scale = overlayScale / 100;
      const scaledWidth = overlayImage.width * scale;
      const scaledHeight = overlayImage.height * scale;
      const x = overlayPosition.x - scaledWidth / 2;
      const y = overlayPosition.y - scaledHeight / 2;

      // Draw the overlay image
      ctx.drawImage(overlayImage, x, y, scaledWidth, scaledHeight);

      // Draw colored border on top if page is selected
      if (selectedPage) {
        const borderColor = PAGE_COLORS[selectedPage];
        if (borderColor) {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = BORDER_WIDTH;
          ctx.strokeRect(x, y, scaledWidth, scaledHeight);
        }
      }

      // Draw selection border (dashed cyan) on very top
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(x, y, scaledWidth, scaledHeight);
      ctx.setLineDash([]);
    }
  };

  const loadImageFromFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => setBackgroundImage(img);
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadImageFromFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      loadImageFromFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!overlayImage) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const scale = overlayScale / 100;
    const scaledWidth = overlayImage.width * scale;
    const scaledHeight = overlayImage.height * scale;
    
    const isWithinOverlay = 
      mouseX >= overlayPosition.x - scaledWidth / 2 &&
      mouseX <= overlayPosition.x + scaledWidth / 2 &&
      mouseY >= overlayPosition.y - scaledHeight / 2 &&
      mouseY <= overlayPosition.y + scaledHeight / 2;

    if (isWithinOverlay) {
      setIsDragging(true);
      setDragStart({ x: mouseX - overlayPosition.x, y: mouseY - overlayPosition.y });
    }
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
      x: Math.max(0, Math.min(CANVAS_WIDTH, mouseX - dragStart.x)),
      y: Math.max(0, Math.min(CANVAS_HEIGHT, mouseY - dragStart.y))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="flex gap-3 items-start">
      {/* Size slider on the LEFT (only when overlay exists) */}
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

      {/* Canvas with drag-drop and upload button overlay */}
      <div className="flex-shrink-0 bg-gray-800 rounded-lg p-2 relative">
        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          onChange={handleBackgroundUpload}
          className="hidden"
          id="canvas-bg-drop"
        />
        
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`border rounded transition-all ${
            isDragOver 
              ? 'border-cyan-500 border-4' 
              : 'border-gray-700'
          } ${overlayImage ? 'cursor-move' : 'cursor-default'} ${
            !backgroundImage ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ width: '380px', height: 'auto' }}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
        
        {/* Upload button overlay - only show when no background */}
        {!backgroundImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <label
              htmlFor="canvas-bg-drop"
              className="flex flex-col items-center gap-3 cursor-pointer pointer-events-auto bg-gray-900/80 backdrop-blur-sm px-8 py-6 rounded-lg border-2 border-dashed border-gray-600 hover:border-cyan-500 hover:bg-gray-900/90 transition-all"
            >
              <Upload className="w-12 h-12 text-gray-400" />
              <div className="text-center">
                <p className="text-white font-semibold mb-1">Upload Background</p>
                <p className="text-gray-400 text-sm">or drag and drop</p>
              </div>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

