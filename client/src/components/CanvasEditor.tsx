import { useRef, useEffect, useState } from "react";
import { Upload, ArrowLeft } from "lucide-react";

const PAGE_OUTLINES = [
  { 
    name: "Football Funnys", 
    color: "#FFD700", // Yellow/Gold
    icon: "/page-icons/football-funnys.jpg"
  },
  { 
    name: "Footy Feed", 
    color: "#000000", // Black
    icon: "/page-icons/footy-feed.jpg"
  },
  { 
    name: "Football Away Days", 
    color: "#8B0000", // Burgundy
    icon: "/page-icons/football-away-days.jpg"
  },
  { 
    name: "None", 
    color: null,
    icon: null
  },
];

interface CanvasEditorProps {
  onComplete: (imageDataUrl: string) => void;
}

export function CanvasEditor({ onComplete }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"background" | "tweet" | "outline">("background");
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [tweetImage, setTweetImage] = useState<HTMLImageElement | null>(null);
  const [outlineColor, setOutlineColor] = useState<string | null>(null);
  const [tweetPosition, setTweetPosition] = useState({ x: 0.5, y: 0.5 }); // Percentage position (0-1)
  const [tweetScale, setTweetScale] = useState(1.0); // Scale factor (0.1 to 2.0)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;
  const OUTLINE_WIDTH = 8;

  // Draw canvas whenever images, outline, position, or scale changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear with black background
    ctx.fillStyle = "black";
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
      // Use original dimensions scaled by tweetScale
      const scaledWidth = tweetImage.width * tweetScale;
      const scaledHeight = tweetImage.height * tweetScale;
      
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
    }
  }, [backgroundImage, tweetImage, outlineColor, tweetPosition, tweetScale]);

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
        // Auto-scale to fit within canvas if too large
        const maxDimension = Math.max(img.width, img.height);
        if (maxDimension > CANVAS_WIDTH * 0.8) {
          setTweetScale((CANVAS_WIDTH * 0.8) / maxDimension);
        }
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
    const scaledWidth = tweetImage.width * tweetScale;
    const scaledHeight = tweetImage.height * tweetScale;
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
      x: Math.max(0.1, Math.min(0.9, newX)),
      y: Math.max(0.1, Math.min(0.9, newY)),
    });
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleOutlineSelect = (color: string | null) => {
    setOutlineColor(color);
  };

  const handleComplete = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL("image/png");
      onComplete(dataUrl);
    }
  };

  const handleBackToOutline = () => {
    setOutlineColor(null);
  };

  return (
    <div className="space-y-4">
      {/* Canvas with Overlay Prompts */}
      <div ref={containerRef} className="relative flex justify-center bg-gray-800 rounded-lg p-4">
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
        
        {/* Step 1: Upload Background - Centered in Canvas */}
        {step === "background" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto">
              <input
                type="file"
                accept="image/*"
                onChange={handleBackgroundUpload}
                className="hidden"
                id="canvas-bg-upload"
              />
              <button
                onClick={() => document.getElementById("canvas-bg-upload")?.click()}
                className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold text-lg shadow-xl transition-all hover:scale-105 flex items-center gap-3"
              >
                <Upload className="h-6 w-6" />
                Upload Background
              </button>
            </div>
          </div>
        )}

        {/* Back to Outline Button - Top Left */}
        {step === "outline" && outlineColor !== null && (
          <button
            onClick={handleBackToOutline}
            className="absolute top-6 left-6 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium shadow-lg transition-all hover:scale-105 flex items-center gap-2 z-10"
          >
            <ArrowLeft className="h-4 w-4" />
            Change Outline
          </button>
        )}

        {/* Step 2: Upload Tweet - Centered in Canvas */}
        {step === "tweet" && !tweetImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto">
              <input
                type="file"
                accept="image/*"
                onChange={handleTweetUpload}
                className="hidden"
                id="canvas-tweet-upload"
              />
              <button
                onClick={() => document.getElementById("canvas-tweet-upload")?.click()}
                className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold text-lg shadow-xl transition-all hover:scale-105 flex items-center gap-3"
              >
                <Upload className="h-6 w-6" />
                Upload Tweet
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Scale Slider - Only show when tweet is uploaded */}
      {(step === "tweet" || step === "outline") && tweetImage && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white">Tweet Size</span>
            <span className="text-cyan-400">{Math.round(tweetScale * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="2.0"
            step="0.05"
            value={tweetScale}
            onChange={(e) => setTweetScale(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <div className="text-center text-xs text-cyan-400">
            💡 Drag the tweet to reposition • Use slider to resize
          </div>
        </div>
      )}

      {/* Step 3: Select Outline with Page Icons */}
      {step === "outline" && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white text-center">Select Outline Color</h3>
          <div className="grid grid-cols-4 gap-3">
            {PAGE_OUTLINES.map((page) => (
              <button
                key={page.name}
                onClick={() => handleOutlineSelect(page.color)}
                className="flex flex-col items-center gap-2 p-3 rounded-lg bg-gray-800 hover:bg-gray-700 transition-all hover:scale-105 border-2 border-transparent hover:border-cyan-500"
                title={page.name}
              >
                {page.icon ? (
                  <div className="relative">
                    <img 
                      src={page.icon} 
                      alt={page.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    {page.color && (
                      <div 
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-gray-800"
                        style={{ backgroundColor: page.color }}
                      />
                    )}
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center">
                    <span className="text-2xl">✕</span>
                  </div>
                )}
                <span className="text-xs text-white text-center leading-tight">
                  {page.name === "Football Funnys" ? "Funnys" : 
                   page.name === "Footy Feed" ? "Feed" :
                   page.name === "Football Away Days" ? "Away Days" : "None"}
                </span>
              </button>
            ))}
          </div>
          
          {/* Complete Button - Only show when outline is selected */}
          {outlineColor !== null && (
            <button
              onClick={handleComplete}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold text-lg shadow-xl transition-all hover:scale-105"
            >
              ✓ Complete
            </button>
          )}
        </div>
      )}
    </div>
  );
}

