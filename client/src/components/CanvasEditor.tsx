import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

const OUTLINE_COLORS = [
  { name: "Blue (Facebook)", color: "#1877F2" },
  { name: "Gold (Funnys)", color: "#FFD700" },
  { name: "Orange (Away Days)", color: "#FF4500" },
  { name: "None", color: null },
];

interface CanvasEditorProps {
  onComplete: (imageDataUrl: string) => void;
}

export function CanvasEditor({ onComplete }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [step, setStep] = useState<"background" | "tweet" | "outline">("background");
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [tweetImage, setTweetImage] = useState<HTMLImageElement | null>(null);
  const [outlineColor, setOutlineColor] = useState<string | null>(null);
  const [tweetPosition, setTweetPosition] = useState({ x: 0.5, y: 0.5 }); // Percentage position (0-1)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;
  const OUTLINE_WIDTH = 8;

  // Draw canvas whenever images, outline, or position changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear with white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background image (if exists)
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

    // Draw tweet image ON TOP (if exists)
    if (tweetImage) {
      // Scale to 50% of canvas width
      const scale = 0.5;
      const scaledWidth = CANVAS_WIDTH * scale;
      const scaledHeight = (tweetImage.height / tweetImage.width) * scaledWidth;
      
      // Use position state (percentage-based)
      const x = tweetPosition.x * CANVAS_WIDTH - scaledWidth / 2;
      const y = tweetPosition.y * CANVAS_HEIGHT - scaledHeight / 2;

      // Draw tweet image
      ctx.drawImage(tweetImage, x, y, scaledWidth, scaledHeight);

      // Draw outline AROUND the tweet (if color selected)
      if (outlineColor) {
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = OUTLINE_WIDTH;
        // Draw outline slightly inset so it's fully visible
        ctx.strokeRect(
          x + OUTLINE_WIDTH / 2, 
          y + OUTLINE_WIDTH / 2, 
          scaledWidth - OUTLINE_WIDTH, 
          scaledHeight - OUTLINE_WIDTH
        );
      }

      // Draw dashed selection border when in tweet or outline step
      if (step === "tweet" || step === "outline") {
        ctx.strokeStyle = "#00ffff";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, scaledWidth, scaledHeight);
        ctx.setLineDash([]); // Reset dash
      }
    }
  }, [backgroundImage, tweetImage, outlineColor, tweetPosition, step]);

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBackgroundImage(img);
        setStep("tweet");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleTweetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setTweetImage(img);
        setStep("outline");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (step !== "tweet" && step !== "outline") return;
    if (!tweetImage) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Check if click is on the tweet
    const scale = 0.5;
    const scaledWidth = CANVAS_WIDTH * scale;
    const scaledHeight = (tweetImage.height / tweetImage.width) * scaledWidth;
    const x = tweetPosition.x * CANVAS_WIDTH - scaledWidth / 2;
    const y = tweetPosition.y * CANVAS_HEIGHT - scaledHeight / 2;

    if (mouseX >= x && mouseX <= x + scaledWidth && mouseY >= y && mouseY <= y + scaledHeight) {
      setIsDragging(true);
      setDragStart({ x: mouseX - tweetPosition.x * CANVAS_WIDTH, y: mouseY - tweetPosition.y * CANVAS_HEIGHT });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // Update position (percentage-based)
    const newX = (mouseX - dragStart.x) / CANVAS_WIDTH;
    const newY = (mouseY - dragStart.y) / CANVAS_HEIGHT;

    // Clamp to canvas bounds
    setTweetPosition({
      x: Math.max(0.25, Math.min(0.75, newX)), // Keep tweet mostly on canvas
      y: Math.max(0.25, Math.min(0.75, newY)),
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleOutlineSelect = (color: string | null) => {
    setOutlineColor(color);
    
    // Wait a moment for the outline to render, then generate final image
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) {
        const dataUrl = canvas.toDataURL("image/png");
        onComplete(dataUrl);
      }
    }, 100);
  };

  return (
    <div className="space-y-4">
      {/* Canvas Preview */}
      <div className="flex justify-center bg-gray-800 rounded-lg p-4">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border border-gray-700 rounded cursor-move"
          style={{ width: "380px", height: "auto" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
      </div>

      {/* Instructions */}
      {(step === "tweet" || step === "outline") && tweetImage && (
        <div className="text-center text-sm text-cyan-400">
          💡 Drag the tweet to reposition it
        </div>
      )}

      {/* Step 1: Upload Background */}
      {step === "background" && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">Step 1: Upload Background Image</h3>
          <input
            type="file"
            accept="image/*"
            onChange={handleBackgroundUpload}
            className="hidden"
            id="canvas-bg-upload"
          />
          <Button
            onClick={() => document.getElementById("canvas-bg-upload")?.click()}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Background
          </Button>
        </div>
      )}

      {/* Step 2: Upload Tweet */}
      {step === "tweet" && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">Step 2: Upload Tweet Screenshot</h3>
          <input
            type="file"
            accept="image/*"
            onChange={handleTweetUpload}
            className="hidden"
            id="canvas-tweet-upload"
          />
          <Button
            onClick={() => document.getElementById("canvas-tweet-upload")?.click()}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Tweet
          </Button>
        </div>
      )}

      {/* Step 3: Select Outline Color */}
      {step === "outline" && (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white">Step 3: Select Outline Color</h3>
          <div className="grid grid-cols-2 gap-2">
            {OUTLINE_COLORS.map((option) => (
              <Button
                key={option.name}
                onClick={() => handleOutlineSelect(option.color)}
                className="w-full"
                variant="outline"
                style={{
                  borderColor: option.color || "#6b7280",
                  borderWidth: "2px",
                  color: option.color || "#9ca3af",
                }}
              >
                {option.name}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

