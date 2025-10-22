import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { X, Upload, RefreshCw } from "lucide-react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { toast } from "sonner";

type PageId = "footy-feed" | "football-funnys" | "football-away-days";

const PAGES: { id: PageId; name: string; watermark: string; shortName: string }[] = [
  { id: "footy-feed", name: "The Footy Feed", watermark: "/watermarks/footy-feed.png", shortName: "Footy Feed" },
  { id: "football-funnys", name: "Football Funnys", watermark: "/watermarks/football-funnys.png", shortName: "Funnys" },
  { id: "football-away-days", name: "Football Away Days", watermark: "/watermarks/football-away-days.png", shortName: "Away Days" },
];

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialImage?: string | null;
}

export function CreatePostDialog({ open, onOpenChange, initialImage }: CreatePostDialogProps) {
  const [image, setImage] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(true); // Start in crop mode
  const [croppedImage, setCroppedImage] = useState<string | null>(null); // Store the cropped result

  // Set image when initialImage is provided
  useEffect(() => {
    if (initialImage) {
      setImage(initialImage);
      setCropMode(true);
      setCroppedImage(null);
      // Start with full image selected
      setCrop({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      });
    }
  }, [initialImage]);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [caption, setCaption] = useState("");
  const [selectedPages, setSelectedPages] = useState<PageId[]>([]);
  const [useWatermark, setUseWatermark] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [overlayText, setOverlayText] = useState("");
  const [fontSize, setFontSize] = useState(48);
  const [useGradient, setUseGradient] = useState(false);
  const [textPosition, setTextPosition] = useState({ x: 50, y: 85 }); // percentage from top-left
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 85, y: 10 }); // percentage from top-left
  const [isDraggingText, setIsDraggingText] = useState(false);
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [tempText, setTempText] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const uploadMediaMutation = trpc.publer.uploadMedia.useMutation();
  const createPostMutation = trpc.publer.createPost.useMutation();
  const regenerateCaptionMutation = trpc.publer.regenerateCaption.useMutation();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setCropMode(true);
        setCroppedImage(null);
        // Start with full image selected
        setCrop({
          unit: '%',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        });
        setCompletedCrop(undefined);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setCropMode(true);
        setCroppedImage(null);
        // Start with full image selected
        setCrop({
          unit: '%',
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        });
        setCompletedCrop(undefined);
      };
      reader.readAsDataURL(file);
    }
  };

  const applyWatermark = useCallback(
    async (imageData: string, watermarkPath: string, position = watermarkPosition): Promise<string> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        const img = new Image();
        img.crossOrigin = 'anonymous'; // Enable CORS for external images
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Enable high-quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          
          ctx.drawImage(img, 0, 0);

          // Load and apply watermark
          const watermark = new Image();
          watermark.crossOrigin = 'anonymous';
          watermark.onload = () => {
            // Calculate watermark size (15% of image width, maintain aspect ratio)
            const watermarkWidth = img.width * 0.15;
            const watermarkHeight = (watermark.height / watermark.width) * watermarkWidth;

            // Use draggable position (percentage-based)
            const x = (watermarkPosition.x / 100) * img.width - watermarkWidth / 2;
            const y = (watermarkPosition.y / 100) * img.height - watermarkHeight / 2;

            // Draw watermark with high quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
            
            // Use JPEG with high quality for better file size and quality
            resolve(canvas.toDataURL("image/jpeg", 0.95));
          };
          watermark.onerror = () => reject(new Error("Failed to load watermark"));
          watermark.src = watermarkPath;
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageData;
      });
    },
    [watermarkPosition]
  );

  // Step 1: Just crop the image
  const cropImageOnly = useCallback(async (): Promise<string | null> => {
    if (!completedCrop || !imgRef.current) {
      return image; // Return original if no crop
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    // Use ORIGINAL image dimensions for canvas (not preview dimensions)
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;
    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // Draw cropped image at full resolution
    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    // Use JPEG with high quality
    return canvas.toDataURL("image/jpeg", 0.95);
  }, [completedCrop, image]);

  // Step 2: Apply overlays to the cropped image
  const applyOverlays = useCallback(async (baseImage: string): Promise<string | null> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0);

        // Add gradient overlay if enabled
        if (useGradient) {
          const gradient = ctx.createLinearGradient(0, canvas.height * 0.67, 0, canvas.height);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Add text overlay if provided
        if (overlayText.trim()) {
          // Scale font size proportionally to canvas width (fontSize is based on 800px reference width)
          const scaledFontSize = (fontSize / 800) * canvas.width;
          ctx.font = `bold ${scaledFontSize}px Impact, 'Arial Black', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const textX = (textPosition.x / 100) * canvas.width;
          const textY = (textPosition.y / 100) * canvas.height;
          const maxWidth = canvas.width * 0.9;
          const lineHeight = scaledFontSize * 1.2;
          
          // Split text by manual line breaks
          const paragraphs = overlayText.split('\n');
          const lines: string[] = [];
          
          // Word wrap each paragraph
          paragraphs.forEach(paragraph => {
            const words = paragraph.split(' ');
            let currentLine = '';
            
            words.forEach((word, i) => {
              const testLine = currentLine + (currentLine ? ' ' : '') + word;
              const metrics = ctx.measureText(testLine);
              
              if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
              } else {
                currentLine = testLine;
              }
              
              if (i === words.length - 1) {
                lines.push(currentLine);
              }
            });
          });
          
          // Calculate starting Y position to center all lines
          const totalHeight = lines.length * lineHeight;
          let currentY = textY - (totalHeight / 2) + (lineHeight / 2);
          
          // Render each line
          lines.forEach(line => {
            // Add black stroke for outline effect
            ctx.strokeStyle = 'black';
            ctx.lineWidth = scaledFontSize * 0.1;
            ctx.strokeText(line, textX, currentY);
            
            // Add white fill
            ctx.fillStyle = 'white';
            ctx.fillText(line, textX, currentY);
            
            currentY += lineHeight;
          });
        }

        // Use JPEG with high quality
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = baseImage;
    });
  }, [useGradient, overlayText, fontSize, textPosition]);

  // Handle confirming the crop
  const handleConfirmCrop = async () => {
    const cropped = await cropImageOnly();
    if (cropped) {
      setCroppedImage(cropped);
      setCropMode(false);
      toast.success("Crop confirmed! Now add overlays and watermark.");
    }
  };

  // Handle going back to crop mode
  const handleBackToCrop = () => {
    setCropMode(true);
    setCroppedImage(null);
  };

  const handlePost = async () => {
    if (!croppedImage) {
      toast.error("Please crop the image first");
      return;
    }

    if (!caption.trim()) {
      toast.error("Please enter a caption");
      return;
    }

    if (selectedPages.length === 0) {
      toast.error("Please select at least one page");
      return;
    }

    setIsUploading(true);

    try {
      // Start with the cropped image
      let processedImage = croppedImage;
      
      // Apply overlays (gradient and text)
      processedImage = await applyOverlays(processedImage) || processedImage;

      // Apply watermark if enabled and only one page selected
      if (useWatermark && selectedPages.length === 1) {
        const selectedPage = PAGES.find((p) => p.id === selectedPages[0]);
        if (selectedPage) {
          processedImage = await applyWatermark(processedImage, selectedPage.watermark);
        }
      }

      // Upload media to Publer
      const uploadResult = await uploadMediaMutation.mutateAsync({
        imageData: processedImage,
        fileName: `post-${Date.now()}.jpg`,
      });

      if (!uploadResult.success || !uploadResult.mediaId) {
        throw new Error(uploadResult.error || "Failed to upload media");
      }

      // Create post on selected pages
      const postResult = await createPostMutation.mutateAsync({
        mediaId: uploadResult.mediaId,
        caption,
        pages: selectedPages,
      });

      if (!postResult.success) {
        throw new Error(postResult.error || "Failed to create post");
      }

      toast.success(`Success! Posted to ${selectedPages.length} page${selectedPages.length > 1 ? "s" : ""}`);

      // Reset form completely
      setImage(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setCaption("");
      setSelectedPages([]);
      setUseWatermark(true);
      setOverlayText("");
      setFontSize(48);
      setUseGradient(false);
      setTextPosition({ x: 50, y: 85 });
      setWatermarkPosition({ x: 85, y: 10 });
      
      // Close dialog after short delay to show success message
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error: any) {
      toast.error(error.message || "Failed to create post");
    } finally {
      setIsUploading(false);
    }
  };

  const togglePage = (pageId: PageId) => {
    setSelectedPages((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId]
    );
  };

  // Get watermark preview for selected page
  const getWatermarkPreview = () => {
    if (!useWatermark || selectedPages.length !== 1) return null;
    const selectedPage = PAGES.find((p) => p.id === selectedPages[0]);
    return selectedPage?.watermark;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800 p-6" showCloseButton={false}>
        <div className="space-y-4">
          {/* Header with Page Pills */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <h2 className="text-xl font-bold text-white whitespace-nowrap">Create Post</h2>
              <div className="flex gap-2 flex-wrap">
                {PAGES.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => togglePage(page.id)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      selectedPages.includes(page.id)
                        ? "bg-cyan-500 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {page.shortName}
                  </button>
                ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Image Upload/Crop */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Image</label>
            {!image ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-cyan-500 rounded-lg p-8 text-center cursor-pointer"
                onClick={() => document.getElementById("image-upload")?.click()}
              >
                <Upload className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="text-gray-300 mb-1">Drag & drop an image here</p>
                <p className="text-sm text-gray-400">or click to browse</p>
                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            ) : cropMode ? (
              <div className="space-y-2">
                {/* Step 1: Crop Mode */}
                <div className="mb-2 p-2 bg-cyan-500/20 border border-cyan-500 rounded-lg">
                  <p className="text-sm text-cyan-300">📐 Step 1: Crop your image</p>
                </div>
                {/* Crop container with padding for visible handles */}
                <div 
                  ref={containerRef}
                  className="relative flex justify-center p-8 bg-gray-900/50 rounded-lg"
                  style={{
                    minHeight: '300px',
                  }}
                >
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    className="max-h-[600px]"
                    ruleOfThirds
                  >
                    <img 
                      ref={imgRef} 
                      src={image} 
                      alt="Upload" 
                      className="max-w-full select-none"
                      style={{
                        maxHeight: '500px',
                        objectFit: 'contain',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none',
                        pointerEvents: 'none',
                      }}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  </ReactCrop>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImage(null);
                      setCrop(undefined);
                      setCompletedCrop(undefined);
                      setCropMode(true);
                      setCroppedImage(null);
                    }}
                    className="flex-1 transition-all duration-200 hover:scale-[1.02]"
                  >
                    Remove Image
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmCrop}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-600 transition-all duration-200 hover:scale-[1.02]"
                  >
                    ✓ Confirm Crop
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Step 2: Overlay Mode */}
                <div className="mb-2 p-2 bg-green-500/20 border border-green-500 rounded-lg">
                  <p className="text-sm text-green-300">✨ Step 2: Add overlays and watermark</p>
                </div>
                <div 
                  ref={containerRef}
                  className="relative flex justify-center"
                  onMouseMove={(e) => {
                    if (!containerRef.current || !imgRef.current) return;
                    const rect = imgRef.current.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    
                    if (isDraggingText) {
                      setTextPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
                    }
                    if (isDraggingWatermark) {
                      setWatermarkPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
                    }
                  }}
                  onTouchMove={(e) => {
                    if (!containerRef.current || !imgRef.current || e.touches.length === 0) return;
                    const rect = imgRef.current.getBoundingClientRect();
                    const touch = e.touches[0];
                    const x = ((touch.clientX - rect.left) / rect.width) * 100;
                    const y = ((touch.clientY - rect.top) / rect.height) * 100;
                    
                    if (isDraggingText) {
                      e.preventDefault();
                      setTextPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
                    }
                    if (isDraggingWatermark) {
                      e.preventDefault();
                      setWatermarkPosition({ x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) });
                    }
                  }}
                  onMouseUp={() => {
                    setIsDraggingText(false);
                    setIsDraggingWatermark(false);
                  }}
                  onTouchEnd={() => {
                    setIsDraggingText(false);
                    setIsDraggingWatermark(false);
                  }}
                  onMouseLeave={() => {
                    setIsDraggingText(false);
                    setIsDraggingWatermark(false);
                  }}
                >
                  {/* Show the cropped image */}
                  <img 
                    ref={imgRef} 
                    src={croppedImage || image} 
                    alt="Cropped" 
                    className="max-w-full max-h-[600px] select-none"
                    style={{
                      WebkitUserSelect: 'none',
                      WebkitTouchCallout: 'none',
                    }}
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                  />

                  {/* Gradient Overlay Preview */}
                  {useGradient && imgRef.current && (
                    <div 
                      className="absolute pointer-events-none"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: imgRef.current.clientWidth,
                        height: imgRef.current.clientHeight,
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.85) 100%)',
                      }}
                    />
                  )}

                  {/* Text Overlay Preview */}
                  {overlayText && imgRef.current && (
                    <div
                      className="absolute cursor-move select-none text-center"
                      style={{
                        pointerEvents: 'auto',
                        zIndex: 10,
                        left: `calc(50% + ${(textPosition.x - 50) * (imgRef.current.clientWidth / 100)}px)`,
                        top: `calc(50% + ${(textPosition.y - 50) * (imgRef.current.clientHeight / 100)}px)`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: `${fontSize * (imgRef.current.clientWidth / imgRef.current.naturalWidth)}px`,
                        fontFamily: 'Impact, "Arial Black", sans-serif',
                        fontWeight: 'bold',
                        color: 'white',
                        textShadow: `
                          -${fontSize * 0.05}px -${fontSize * 0.05}px 0 black,
                          ${fontSize * 0.05}px -${fontSize * 0.05}px 0 black,
                          -${fontSize * 0.05}px ${fontSize * 0.05}px 0 black,
                          ${fontSize * 0.05}px ${fontSize * 0.05}px 0 black
                        `,
                        whiteSpace: 'pre-wrap',
                        maxWidth: `${imgRef.current.clientWidth * 0.9}px`,
                        lineHeight: 1.2,
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingText(true);
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingText(true);
                      }}
                      onClick={(e) => {
                        if (!isDraggingText) {
                          e.preventDefault();
                          e.stopPropagation();
                          setTempText(overlayText);
                          setIsEditingText(true);
                        }
                      }}
                    >
                      {overlayText}
                    </div>
                  )}

                  {/* Watermark Preview */}
                  {useWatermark && selectedPages.length === 1 && imgRef.current && (
                    <img
                      src={PAGES.find(p => p.id === selectedPages[0])?.watermark}
                      alt="Watermark"
                      className="absolute cursor-move select-none"
                      draggable={false}
                      style={{
                        pointerEvents: 'auto',
                        zIndex: 10,
                        left: `calc(50% + ${(watermarkPosition.x - 50) * (imgRef.current.clientWidth / 100)}px)`,
                        top: `calc(50% + ${(watermarkPosition.y - 50) * (imgRef.current.clientHeight / 100)}px)`,
                        transform: 'translate(-50%, -50%)',
                        width: imgRef.current.clientWidth * 0.15,
                        height: 'auto',
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingWatermark(true);
                      }}
                      onTouchStart={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsDraggingWatermark(true);
                      }}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBackToCrop}
                    className="flex-1 transition-all duration-200 hover:scale-[1.02]"
                  >
                    ← Back to Crop
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImage(null);
                      setCrop(undefined);
                      setCompletedCrop(undefined);
                      setCropMode(true);
                      setCroppedImage(null);
                    }}
                    className="flex-1 transition-all duration-200 hover:scale-[1.02]"
                  >
                    Remove Image
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Compact Overlay Controls - Only in overlay mode */}
          {image && !cropMode && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">Overlays</label>
              <div className="flex gap-2">
                {/* Text Button */}
                <Button
                  type="button"
                  variant={overlayText ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (!overlayText) {
                      setOverlayText("Text");
                    } else {
                      setOverlayText("");
                    }
                  }}
                  className={`flex-1 transition-all duration-200 ${
                    overlayText
                      ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                      : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                  }`}
                >
                  {overlayText ? "✓ Text" : "Text"}
                </Button>

                {/* Watermark Button */}
                <Button
                  type="button"
                  variant={useWatermark ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseWatermark(!useWatermark)}
                  disabled={selectedPages.length !== 1}
                  className={`flex-1 transition-all duration-200 ${
                    useWatermark
                      ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                      : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                  }`}
                  title={selectedPages.length > 1 ? "Only works with one page" : ""}
                >
                  {useWatermark ? "✓ Watermark" : "Watermark"}
                </Button>

                {/* Gradient Button */}
                <Button
                  type="button"
                  variant={useGradient ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseGradient(!useGradient)}
                  className={`flex-1 transition-all duration-200 ${
                    useGradient
                      ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                      : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                  }`}
                >
                  {useGradient ? "✓ Gradient" : "Gradient"}
                </Button>
              </div>
              
              {/* Font Size Slider - Only show when text is active */}
              {overlayText && (
                <div className="space-y-1">
                  <label className="text-xs text-gray-400">Font Size: {fontSize}px</label>
                  <input
                    type="range"
                    min="24"
                    max="120"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Caption */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Caption</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!caption.trim()) {
                    toast.error("Enter a caption first to regenerate");
                    return;
                  }
                  setIsRegenerating(true);
                  try {
                    const result = await regenerateCaptionMutation.mutateAsync({
                      originalCaption: caption,
                    });
                    if (result.success && result.caption) {
                      setCaption(result.caption);
                      toast.success("Caption regenerated!");
                    } else {
                      toast.error(result.error || "Failed to regenerate caption");
                    }
                  } catch (error: any) {
                    toast.error(error.message || "Failed to regenerate caption");
                  } finally {
                    setIsRegenerating(false);
                  }
                }}
                disabled={isRegenerating || !caption.trim()}
                className="text-xs gap-1 h-7 border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
              >
                <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              className="min-h-24 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              maxLength={2000}
            />
            <p className="text-xs text-gray-500 text-right">{caption.length} / 2000</p>
          </div>

          {/* Post Button */}
          <Button
            onClick={handlePost}
            disabled={isUploading || !image || !caption.trim() || selectedPages.length === 0}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white"
          >
            {isUploading ? "Posting..." : "Post"}
          </Button>
        </div>
      </DialogContent>

      {/* Text Editing Modal */}
      {isEditingText && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100]"
          onClick={() => {
            setIsEditingText(false);
            setTempText("");
          }}
        >
          <div 
            className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white mb-4">Edit Text Overlay</h3>
            <textarea
              value={tempText}
              onChange={(e) => setTempText(e.target.value)}
              placeholder="Enter your text..."
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
              maxLength={200}
              rows={4}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">{tempText.length} / 200</p>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditingText(false);
                  setTempText("");
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setOverlayText(tempText);
                  setIsEditingText(false);
                  setTempText("");
                }}
                className="flex-1 bg-cyan-500 hover:bg-cyan-600"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

