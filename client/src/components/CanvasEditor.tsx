import { useState, useRef, useEffect } from "react";
import { Upload } from "lucide-react";

type PageId = "footy-feed" | "football-funnys" | "football-away-days";

const PAGE_COLORS: Record<PageId, string> = {
  "footy-feed": "#1877F2", // Facebook blue
  "football-funnys": "#FFD700", // Gold
  "football-away-days": "#FF4500", // Orange-red
};

interface CanvasEditorProps {
  selectedPage: PageId | null;
  onCanvasUpdate: (imageDataUrl: string) => void;
}

export function CanvasEditor({ selectedPage, onCanvasUpdate }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);
  const [overlayScale, setOverlayScale] = useState(50); // 50% default scale
  const [overlayPosition, setOverlayPosition] = useState({ x: 540, y: 675 }); // Center of canvas
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;
  const BORDER_WIDTH = 8; // Thin border width in pixels

  // Draw canvas whenever images, overlay properties, or selected page changes
  useEffect(() => {
    drawCanvas();
  }, [backgroundImage, overlayImage, overlayScale, overlayPosition, selectedPage]);

  // Update parent with canvas data URL whenever canvas changes
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

    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background image (fit to canvas, preserving aspect ratio)
    if (backgroundImage) {
      const imgAspect = backgroundImage.width / backgroundImage.height;
      const canvasAspect = CANVAS_WIDTH / CANVAS_HEIGHT;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imgAspect > canvasAspect) {
        // Image is wider - fit to height
        drawHeight = CANVAS_HEIGHT;
        drawWidth = drawHeight * imgAspect;
        offsetX = (CANVAS_WIDTH - drawWidth) / 2;
        offsetY = 0;
      } else {
        // Image is taller - fit to width
        drawWidth = CANVAS_WIDTH;
        drawHeight = drawWidth / imgAspect;
        offsetX = 0;
        offsetY = (CANVAS_HEIGHT - drawHeight) / 2;
      }

      ctx.drawImage(backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
    }

    // Draw overlay image with colored border based on selected page
    if (overlayImage) {
      const scale = overlayScale / 100;
      const scaledWidth = overlayImage.width * scale;
      const scaledHeight = overlayImage.height * scale;
      const x = overlayPosition.x - scaledWidth / 2;
      const y = overlayPosition.y - scaledHeight / 2;

      // Draw colored border if page is selected
      if (selectedPage) {
        const borderColor = PAGE_COLORS[selectedPage];
        if (borderColor) {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = BORDER_WIDTH;
          ctx.strokeRect(x, y, scaledWidth, scaledHeight);
        }
      }

      // Draw the overlay image
      ctx.drawImage(overlayImage, x, y, scaledWidth, scaledHeight);

      // Draw selection border (dashed cyan) for dragging feedback
      ctx.strokeStyle = '#06b6d4'; // cyan-500
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(x, y, scaledWidth, scaledHeight);
      ctx.setLineDash([]);
    }
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBackgroundImage(img);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOverlayUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setOverlayImage(img);
        // Reset position to center when new overlay is loaded
        setOverlayPosition({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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

    // Check if click is within overlay bounds
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
    <div className="flex gap-6">
      {/* Canvas on the left */}
      <div className="flex-shrink-0">
        <div className="bg-gray-800 rounded-lg p-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border-2 border-gray-700 rounded cursor-move"
            style={{ width: '450px', height: 'auto' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>
      </div>

      {/* Tools on the right - vertical layout */}
      <div className="flex flex-col gap-4 w-64">
        {/* Background Image Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Background Image
          </label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              className="hidden"
              id="canvas-background-upload"
            />
            <label
              htmlFor="canvas-background-upload"
              className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg cursor-pointer transition-colors border-2 border-dashed border-gray-600 hover:border-cyan-500 text-sm"
            >
              <Upload className="h-4 w-4" />
              {backgroundImage ? "Change" : "Upload"}
            </label>
          </div>
          {backgroundImage && (
            <p className="text-xs text-green-400">
              ✓ {backgroundImage.width}x{backgroundImage.height}
            </p>
          )}
        </div>

        {/* Overlay Image Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            Tweet Overlay
          </label>
          <div className="relative">
            <input
              type="file"
              accept="image/*"
              onChange={handleOverlayUpload}
              className="hidden"
              id="canvas-overlay-upload"
            />
            <label
              htmlFor="canvas-overlay-upload"
              className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg cursor-pointer transition-colors border-2 border-dashed border-gray-600 hover:border-cyan-500 text-sm"
            >
              <Upload className="h-4 w-4" />
              {overlayImage ? "Change" : "Upload"}
            </label>
          </div>
          {overlayImage && (
            <p className="text-xs text-green-400">
              ✓ {overlayImage.width}x{overlayImage.height}
            </p>
          )}
        </div>

        {/* Overlay Scale Slider */}
        {overlayImage && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-300">
              Overlay Size
            </label>
            <div className="space-y-1">
              <input
                type="range"
                min="10"
                max="200"
                step="5"
                value={overlayScale}
                onChange={(e) => setOverlayScale(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>10%</span>
                <span className="text-white font-medium">{overlayScale}%</span>
                <span>200%</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Drag overlay on canvas to reposition
            </p>
          </div>
        )}

        {/* Border color indicator */}
        {overlayImage && selectedPage && (
          <div className="space-y-2 pt-2 border-t border-gray-700">
            <label className="block text-xs font-medium text-gray-400">
              Border Color
            </label>
            <div className="flex items-center gap-2">
              <div 
                className="w-6 h-6 rounded border-2 border-gray-600"
                style={{ backgroundColor: PAGE_COLORS[selectedPage] }}
              />
              <span className="text-sm text-gray-300">
                {selectedPage === 'footy-feed' ? 'Facebook Blue' : 
                 selectedPage === 'football-funnys' ? 'Gold' : 
                 'Orange-Red'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

