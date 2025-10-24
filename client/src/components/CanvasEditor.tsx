import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Upload, Check } from "lucide-react";
import { toast } from "sonner";

interface CanvasEditorProps {
  onClose: () => void;
  onSave: (imageDataUrl: string) => void;
}

export function CanvasEditor({ onClose, onSave }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);
  const [overlayScale, setOverlayScale] = useState(50); // 50% default scale
  const [overlayPosition, setOverlayPosition] = useState({ x: 540, y: 675 }); // Center of canvas
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;

  // Draw canvas whenever images or overlay properties change
  useEffect(() => {
    drawCanvas();
  }, [backgroundImage, overlayImage, overlayScale, overlayPosition]);

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

    // Draw overlay image (centered, scalable)
    if (overlayImage) {
      const scale = overlayScale / 100;
      const scaledWidth = overlayImage.width * scale;
      const scaledHeight = overlayImage.height * scale;
      
      ctx.drawImage(
        overlayImage,
        overlayPosition.x - scaledWidth / 2,
        overlayPosition.y - scaledHeight / 2,
        scaledWidth,
        scaledHeight
      );

      // Draw selection border around overlay when it exists
      ctx.strokeStyle = '#06b6d4'; // cyan-500
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 5]);
      ctx.strokeRect(
        overlayPosition.x - scaledWidth / 2,
        overlayPosition.y - scaledHeight / 2,
        scaledWidth,
        scaledHeight
      );
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
        toast.success("Background image loaded");
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
        toast.success("Overlay image loaded");
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

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Export canvas as data URL
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
    toast.success("Canvas saved!");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold text-white">Canvas Editor (1080x1350)</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Upload Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  id="background-upload"
                />
                <label
                  htmlFor="background-upload"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg cursor-pointer transition-colors border-2 border-dashed border-gray-600 hover:border-cyan-500"
                >
                  <Upload className="h-5 w-5" />
                  {backgroundImage ? "Change Background" : "Upload Background"}
                </label>
              </div>
              {backgroundImage && (
                <p className="text-xs text-green-400">
                  ✓ Background loaded ({backgroundImage.width}x{backgroundImage.height})
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
                  id="overlay-upload"
                />
                <label
                  htmlFor="overlay-upload"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg cursor-pointer transition-colors border-2 border-dashed border-gray-600 hover:border-cyan-500"
                >
                  <Upload className="h-5 w-5" />
                  {overlayImage ? "Change Overlay" : "Upload Overlay"}
                </label>
              </div>
              {overlayImage && (
                <p className="text-xs text-green-400">
                  ✓ Overlay loaded ({overlayImage.width}x{overlayImage.height})
                </p>
              )}
            </div>
          </div>

          {/* Overlay Scale Slider */}
          {overlayImage && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">
                Overlay Size: {overlayScale}%
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="5"
                value={overlayScale}
                onChange={(e) => setOverlayScale(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <p className="text-xs text-gray-400">
                Drag the overlay on the canvas to reposition it
              </p>
            </div>
          )}

          {/* Canvas */}
          <div className="flex justify-center bg-gray-800 rounded-lg p-4">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="max-w-full h-auto border-2 border-gray-700 rounded cursor-move"
              style={{ maxHeight: '500px' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-gray-700 text-gray-300 hover:text-white hover:border-gray-600"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!backgroundImage && !overlayImage}
              className="bg-cyan-500 hover:bg-cyan-600 text-white"
            >
              <Check className="h-4 w-4 mr-2" />
              Use Canvas
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

