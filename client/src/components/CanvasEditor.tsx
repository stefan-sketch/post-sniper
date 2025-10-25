import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Upload } from "lucide-react";

const PAGE_OUTLINES = [
  { 
    name: "Football Funnys", 
    color: "#FFD700", // Yellow/Gold
    icon: "/page-icons/football-funnys.jpg"
  },
  { 
    name: "Footy Feed", 
    color: "#FFFFFF", // White
    icon: "/page-icons/footy-feed.jpg"
  },
  { 
    name: "Football Away Days", 
    color: "#8B0000", // Burgundy
    icon: "/page-icons/football-away-days.jpg"
  },
];

interface CanvasEditorProps {
  onComplete: (imageDataUrl: string) => void;
  selectedPage: string | null;
  tweetOutlineColor?: 'white' | 'black';
  onTweetEditingChange?: (isEditing: boolean) => void;
  onCompleteClick?: (handler: () => void) => void;
  onOutlineColorChange?: (color: 'white' | 'black') => void;
}

export function CanvasEditor({ onComplete, selectedPage, tweetOutlineColor = 'white', onTweetEditingChange, onCompleteClick, onOutlineColorChange }: CanvasEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasRegisteredHandler = useRef(false);
  const [step, setStep] = useState<"background" | "gradient" | "tweet">("background");
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [tweetImage, setTweetImage] = useState<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [useGradient, setUseGradient] = useState(false);
  // Future: gradient color can be customized per page
  // const gradientColor = useMemo(() => {
  //   switch (selectedPage) {
  //     case 'football-funnys': return '#FFD700'; // Yellow
  //     case 'football-away-days': return '#8B0000'; // Burgundy
  //     default: return '#000000'; // Black
  //   }
  // }, [selectedPage]);
  const gradientColor = '#000000'; // Black for now
  
  // Notify parent when tweet editing state changes
  useEffect(() => {
    const isEditingTweet = step === "tweet" && tweetImage !== null;
    onTweetEditingChange?.(isEditingTweet);
  }, [step, tweetImage, onTweetEditingChange]);
  
  // Auto-apply outline color based on selected page
  const outlineColor = useMemo(() => {
    if (!selectedPage) return null;
    switch (selectedPage) {
      case 'football-funnys': return '#FFD700'; // Yellow/Gold
      case 'footy-feed': return tweetOutlineColor === 'black' ? '#000000' : '#FFFFFF'; // User-selected
      case 'football-away-days': return '#8B0000'; // Burgundy
      default: return null;
    }
  }, [selectedPage, tweetOutlineColor]);
  const [tweetPosition, setTweetPosition] = useState({ x: 0.5, y: 0.5 }); // Percentage position (0-1)
  const [tweetScale, setTweetScale] = useState(1.0); // Scale factor (0.1 to 2.0)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const CANVAS_WIDTH = 1080;
  const CANVAS_HEIGHT = 1350;
  const OUTLINE_WIDTH = 3;
  const OUTLINE_RADIUS = 3;

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

    // Draw gradient overlay (if enabled) - between background and tweet
    if (useGradient && backgroundImage) {
      const gradient = ctx.createLinearGradient(0, CANVAS_HEIGHT, 0, CANVAS_HEIGHT / 2);
      gradient.addColorStop(0, gradientColor); // Solid color at bottom
      gradient.addColorStop(1, 'transparent'); // Fade to transparent at middle
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw tweet image ON TOP (if exists)
    if (tweetImage) {
      // Use original dimensions scaled by tweetScale
      const scaledWidth = tweetImage.width * tweetScale;
      const scaledHeight = tweetImage.height * tweetScale;
      
      // Use position state (percentage-based)
      const x = tweetPosition.x * CANVAS_WIDTH - scaledWidth / 2;
      const y = tweetPosition.y * CANVAS_HEIGHT - scaledHeight / 2;

      // Draw tweet image with rounded corners
      ctx.save();
      
      // Create rounded rectangle clip path for the tweet image
      const radius = OUTLINE_RADIUS;
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + scaledWidth - radius, y);
      ctx.quadraticCurveTo(x + scaledWidth, y, x + scaledWidth, y + radius);
      ctx.lineTo(x + scaledWidth, y + scaledHeight - radius);
      ctx.quadraticCurveTo(x + scaledWidth, y + scaledHeight, x + scaledWidth - radius, y + scaledHeight);
      ctx.lineTo(x + radius, y + scaledHeight);
      ctx.quadraticCurveTo(x, y + scaledHeight, x, y + scaledHeight - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
      ctx.clip();
      
      // Draw the tweet image (will be clipped to rounded rectangle)
      ctx.drawImage(tweetImage, x, y, scaledWidth, scaledHeight);
      
      ctx.restore();

      // Draw outline AROUND the tweet (if color selected)
      if (outlineColor) {
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = OUTLINE_WIDTH;
        
        // Draw rounded rectangle outline
        const rectX = x + OUTLINE_WIDTH / 2;
        const rectY = y + OUTLINE_WIDTH / 2;
        const rectWidth = scaledWidth - OUTLINE_WIDTH;
        const rectHeight = scaledHeight - OUTLINE_WIDTH;
        const radius = OUTLINE_RADIUS;
        
        ctx.beginPath();
        ctx.moveTo(rectX + radius, rectY);
        ctx.lineTo(rectX + rectWidth - radius, rectY);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY, rectX + rectWidth, rectY + radius);
        ctx.lineTo(rectX + rectWidth, rectY + rectHeight - radius);
        ctx.quadraticCurveTo(rectX + rectWidth, rectY + rectHeight, rectX + rectWidth - radius, rectY + rectHeight);
        ctx.lineTo(rectX + radius, rectY + rectHeight);
        ctx.quadraticCurveTo(rectX, rectY + rectHeight, rectX, rectY + rectHeight - radius);
        ctx.lineTo(rectX, rectY + radius);
        ctx.quadraticCurveTo(rectX, rectY, rectX + radius, rectY);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }, [backgroundImage, tweetImage, outlineColor, tweetPosition, tweetScale, useGradient, gradientColor]);

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setBackgroundImage(img);
        setStep("gradient"); // Move to gradient prompt
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
        // Stay on tweet step, outline is auto-applied
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle file from drag-drop or paste
  const handleImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        if (step === 'background') {
          setBackgroundImage(img);
          setStep('gradient'); // Move to gradient prompt
        } else if (step === 'tweet' && !tweetImage) {
          setTweetImage(img);
          const maxDimension = Math.max(img.width, img.height);
          if (maxDimension > CANVAS_WIDTH * 0.8) {
            setTweetScale((CANVAS_WIDTH * 0.8) / maxDimension);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageFile(file);
    }
  };

  // Paste handler
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            handleImageFile(file);
          }
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [step, tweetImage]);

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (step !== "tweet") return;
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

  // Touch event handlers for iOS/mobile support
  const handleCanvasTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (step !== "tweet") return;
    if (!tweetImage) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const touch = e.touches[0];
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    // Check if touch is on the tweet
    const scaledWidth = tweetImage.width * tweetScale;
    const scaledHeight = tweetImage.height * tweetScale;
    const x = tweetPosition.x * CANVAS_WIDTH - scaledWidth / 2;
    const y = tweetPosition.y * CANVAS_HEIGHT - scaledHeight / 2;

    if (touchX >= x && touchX <= x + scaledWidth && touchY >= y && touchY <= y + scaledHeight) {
      setIsDragging(true);
      setDragStart({ x: touchX - tweetPosition.x * CANVAS_WIDTH, y: touchY - tweetPosition.y * CANVAS_HEIGHT });
    }
  };

  const handleCanvasTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const touch = e.touches[0];
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    // Update position (percentage-based)
    const newX = (touchX - dragStart.x) / CANVAS_WIDTH;
    const newY = (touchY - dragStart.y) / CANVAS_HEIGHT;

    // Clamp to canvas bounds
    setTweetPosition({
      x: Math.max(0.1, Math.min(0.9, newX)),
      y: Math.max(0.1, Math.min(0.9, newY)),
    });
  };

  const handleCanvasTouchEnd = () => {
    setIsDragging(false);
  };

  const handleComplete = useCallback(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Use maximum quality JPEG for Facebook posting (1.0 = 100% quality)
      // JPEG is better for photos and Facebook's compression
      const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
      onComplete(dataUrl);
    }
  }, [onComplete]);

  // Expose handleComplete to parent - only once to prevent infinite updates
  useEffect(() => {
    if (onCompleteClick && step === "tweet" && tweetImage && !hasRegisteredHandler.current) {
      onCompleteClick(handleComplete);
      hasRegisteredHandler.current = true;
    }
    
    // Reset when leaving tweet editing mode
    if (step !== "tweet" || !tweetImage) {
      hasRegisteredHandler.current = false;
    }
  }, [step, tweetImage, onCompleteClick, handleComplete]);

  return (
    <div className="space-y-4">
      {/* Canvas with Overlay Prompts */}
      <div 
        ref={containerRef} 
        className={`relative flex justify-center bg-gray-800 rounded-lg p-4 transition-all ${
          isDragging ? 'ring-4 ring-cyan-500 bg-gray-700' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border border-gray-700 rounded cursor-move"
          style={{ width: "380px", height: "auto", touchAction: "none" }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onTouchStart={handleCanvasTouchStart}
          onTouchMove={handleCanvasTouchMove}
          onTouchEnd={handleCanvasTouchEnd}
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
              <div className="text-center">
                <button
                  onClick={() => document.getElementById("canvas-bg-upload")?.click()}
                  className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold text-lg shadow-xl transition-all hover:scale-105 flex items-center gap-3"
                >
                  <Upload className="h-6 w-6" />
                  Upload Background
                </button>
                <p className="text-gray-400 text-sm mt-3">or drag & drop / paste image</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Gradient Prompt - Centered in Canvas */}
        {step === "gradient" && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-xl p-8 shadow-2xl max-w-md">
              <div className="text-center space-y-6">
                <h3 className="text-2xl font-bold text-white">Add Gradient Overlay?</h3>
                <p className="text-gray-300">A black gradient will fade from the bottom to the middle of your image</p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => {
                      setUseGradient(true);
                      setStep("tweet");
                    }}
                    className="px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold transition-all hover:scale-105 shadow-lg"
                  >
                    Yes, Add Gradient
                  </button>
                  <button
                    onClick={() => {
                      setUseGradient(false);
                      setStep("tweet");
                    }}
                    className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all hover:scale-105"
                  >
                    No, Skip
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Upload Tweet - Centered in Canvas */}
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
              <div className="text-center">
                <button
                  onClick={() => document.getElementById("canvas-tweet-upload")?.click()}
                  className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-semibold text-lg shadow-xl transition-all hover:scale-105 flex items-center gap-3"
                >
                  <Upload className="h-6 w-6" />
                  Upload Tweet
                </button>
                <p className="text-gray-400 text-sm mt-3">or drag & drop / paste image</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Outline Color Selector - Only show for Footy Feed after tweet upload */}
      {step === "tweet" && tweetImage && selectedPage === 'footy-feed' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white">Outline Color</span>
          </div>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => onOutlineColorChange?.('white')}
              className={`w-16 h-16 rounded border-2 transition-all ${
                tweetOutlineColor === 'white'
                  ? 'border-white bg-white/20 scale-110'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              title="White outline"
            >
              <div className="w-full h-full rounded bg-white" />
            </button>
            <button
              onClick={() => onOutlineColorChange?.('black')}
              className={`w-16 h-16 rounded border-2 transition-all ${
                tweetOutlineColor === 'black'
                  ? 'border-white bg-gray-800 scale-110'
                  : 'border-gray-600 hover:border-gray-400'
              }`}
              title="Black outline"
            >
              <div className="w-full h-full rounded bg-black" />
            </button>
          </div>
        </div>
      )}

      {/* Scale Slider - Only show when tweet is uploaded */}
      {step === "tweet" && tweetImage && (
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


    </div>
  );
}
