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
  const [overlayScale, setOverlayScale] = useState(50);
  const [overlayPosition, setOverlayPosition] = useState({ x: 540, y: 675 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;
  const BORDER_WIDTH = 8;

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

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

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

    if (overlayImage) {
      const scale = overlayScale / 100;
      const scaledWidth = overlayImage.width * scale;
      const scaledHeight = overlayImage.height * scale;
      const x = overlayPosition.x - scaledWidth / 2;
      const y = overlayPosition.y - scaledHeight / 2;

      if (selectedPage) {
        const borderColor = PAGE_COLORS[selectedPage];
        if (borderColor) {
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = BORDER_WIDTH;
          ctx.strokeRect(x, y, scaledWidth, scaledHeight);
        }
      }

      ctx.drawImage(overlayImage, x, y, scaledWidth, scaledHeight);

      ctx.strokeStyle = '#06b6d4';
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
      img.onload = () => setBackgroundImage(img);
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
    <div className="flex gap-3">
      {/* Canvas */}
      <div className="flex-shrink-0 bg-gray-800 rounded-lg p-2">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border border-gray-700 rounded cursor-move"
          style={{ width: '320px', height: 'auto' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      </div>

      {/* Compact tools */}
      <div className="flex flex-col gap-2 w-48">
        {/* Background Upload */}
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handleBackgroundUpload}
            className="hidden"
            id="canvas-bg"
          />
          <label
            htmlFor="canvas-bg"
            className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded cursor-pointer transition-colors border border-gray-700 hover:border-cyan-500 text-xs"
          >
            <Upload className="h-3 w-3" />
            <span>Background{backgroundImage && ' ✓'}</span>
          </label>
        </div>

        {/* Overlay Upload */}
        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handleOverlayUpload}
            className="hidden"
            id="canvas-overlay"
          />
          <label
            htmlFor="canvas-overlay"
            className="flex items-center gap-2 px-2 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded cursor-pointer transition-colors border border-gray-700 hover:border-cyan-500 text-xs"
          >
            <Upload className="h-3 w-3" />
            <span>Tweet{overlayImage && ' ✓'}</span>
          </label>
        </div>

        {/* Size Slider */}
        {overlayImage && (
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span>Size</span>
              <span className="text-white">{overlayScale}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={overlayScale}
              onChange={(e) => setOverlayScale(Number(e.target.value))}
              className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}

