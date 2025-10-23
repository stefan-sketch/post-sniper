import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Upload, RefreshCw } from "lucide-react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { toast } from "sonner";

type PageId = "footy-feed" | "football-funnys" | "football-away-days";

const PAGES: { id: PageId; name: string; watermark: string; shortName: string; profilePicture: string }[] = [
  { id: "footy-feed", name: "The Footy Feed", watermark: "/watermarks/footy-feed.png", shortName: "Footy Feed", profilePicture: "/page-icons/footy-feed.jpg" },
  { id: "football-funnys", name: "Football Funnys", watermark: "/watermarks/football-funnys.png", shortName: "Funnys", profilePicture: "/page-icons/football-funnys.jpg" },
  { id: "football-away-days", name: "Football Away Days", watermark: "/watermarks/football-away-days.png", shortName: "Away Days", profilePicture: "/page-icons/football-away-days.jpg" },
];

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialImage?: string | null;
}

export function CreatePostDialog({ open, onOpenChange, initialImage }: CreatePostDialogProps) {
  const [image, setImage] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState(false); // Crop mode off by default
  const [croppedImage, setCroppedImage] = useState<string | null>(null); // Store the cropped result

  // Set image when initialImage is provided
  useEffect(() => {
    if (initialImage) {
      setImage(initialImage);
      setCropMode(false); // Keep crop mode off by default
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
  const [selectedPage, setSelectedPage] = useState<PageId | null>(null);
  const [useWatermark, setUseWatermark] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [overlayText, setOverlayText] = useState("");
  const [useGradient, setUseGradient] = useState(false);
  const [textBoxPosition, setTextBoxPosition] = useState({ x: 50, y: 50 }); // percentage from top-left
  const [textBoxWidth, setTextBoxWidth] = useState(60); // percentage of image width
  const [fontSize, setFontSize] = useState(48); // base font size in pixels
  const [watermarkPosition, setWatermarkPosition] = useState({ x: 85, y: 10 }); // percentage from top-left
  const [isDraggingTextBox, setIsDraggingTextBox] = useState(false);
  const [isResizingTextBox, setIsResizingTextBox] = useState(false);
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartState, setResizeStartState] = useState({ x: 0, y: 0, fontSize: 48, width: 60 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const uploadMediaMutation = trpc.publer.uploadMedia.useMutation();
  const createPostMutation = trpc.publer.createPost.useMutation();
  const regenerateCaptionMutation = trpc.publer.regenerateCaption.useMutation();

  const handlePasteFromClipboard = async () => {
    try {
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        for (const type of item.types) {
          if (type.startsWith('image/')) {
            const blob = await item.getType(type);
            const reader = new FileReader();
            reader.onload = () => {
              setImage(reader.result as string);
              setCropMode(false); // Don't start in crop mode
              setCroppedImage(null);
              toast.success("Image pasted from clipboard!");
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
      }
      toast.error("No image found in clipboard");
    } catch (error) {
      console.error('Paste failed:', error);
      toast.error("Failed to paste from clipboard");
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setCropMode(false); // Keep crop mode off by default
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
        setCropMode(false); // Keep crop mode off by default
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
          // Scale font size proportionally to canvas width
          const scaledFontSize = (fontSize / 800) * canvas.width;
          
          ctx.font = `${scaledFontSize}px Impact, 'Arial Black', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          const textX = (textBoxPosition.x / 100) * canvas.width;
          const textY = (textBoxPosition.y / 100) * canvas.height;
          const maxWidth = (textBoxWidth / 100) * canvas.width;
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
            // Add white fill (no outline)
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
  }, [useGradient, overlayText, textBoxPosition, textBoxWidth, fontSize]);

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

    if (!selectedPage) {
      toast.error("Please select a page");
      return;
    }

    setIsUploading(true);

    try {
      // Start with the cropped image
      let processedImage = croppedImage;
      
      // Apply overlays (gradient and text)
      processedImage = await applyOverlays(processedImage) || processedImage;

      // Apply watermark if enabled
      if (useWatermark && selectedPage) {
        const pageConfig = PAGES.find((p) => p.id === selectedPage);
        if (pageConfig) {
          processedImage = await applyWatermark(processedImage, pageConfig.watermark);
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
        pages: [selectedPage],
      });

      if (!postResult.success) {
        throw new Error(postResult.error || "Failed to create post");
      }

      const pageName = PAGES.find(p => p.id === selectedPage)?.shortName || 'page';
      toast.success(`Success! Posted to ${pageName}`);

      // Reset form completely
      setImage(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setCaption("");
      setSelectedPage(null);
      setUseWatermark(true);
      setOverlayText("");
      setUseGradient(false);
      setTextBoxPosition({ x: 50, y: 50 });
      setTextBoxWidth(60);
      setFontSize(48);
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

  const selectPage = (pageId: PageId) => {
    setSelectedPage(pageId);
  };

  // Get watermark preview for selected page
  const getWatermarkPreview = () => {
    if (!useWatermark || !selectedPage) return null;
    const pageConfig = PAGES.find((p) => p.id === selectedPage);
    return pageConfig?.watermark;
  };

  const handleClose = () => {
    // Reset all form state
    setImage(null);
    setCrop(undefined);
    setCompletedCrop(undefined);
    setCaption("");
    setSelectedPage(null);
    setUseWatermark(false);
    setOverlayText("");
    setUseGradient(false);
    setTextBoxPosition({ x: 50, y: 50 });
    setTextBoxWidth(60);
    setFontSize(48);
    setCropMode(true);
    setCroppedImage(null);
    // Close dialog
    onOpenChange(false);
  };

  // Handle mouse/touch events for dragging and resizing
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    if (isDraggingTextBox) {
      setTextBoxPosition({ 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    } else if (isResizingTextBox) {
      // Calculate new size based on drag distance
      const deltaX = x - resizeStartState.x;
      const deltaY = y - resizeStartState.y;
      // Use diagonal distance to scale both fontSize and width proportionally
      const delta = (deltaX + deltaY) / 2;
      const newFontSize = Math.max(24, Math.min(120, resizeStartState.fontSize + delta * 2));
      const newWidth = Math.max(30, Math.min(100, resizeStartState.width + deltaX));
      setFontSize(newFontSize);
      setTextBoxWidth(newWidth);
    } else if (isDraggingWatermark) {
      setWatermarkPosition({ 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current || !imgRef.current || e.touches.length === 0) return;
    const rect = imgRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = ((touch.clientX - rect.left) / rect.width) * 100;
    const y = ((touch.clientY - rect.top) / rect.height) * 100;
    
    if (isDraggingTextBox) {
      e.preventDefault();
      setTextBoxPosition({ 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    } else if (isResizingTextBox) {
      e.preventDefault();
      const deltaX = x - resizeStartState.x;
      const deltaY = y - resizeStartState.y;
      // Use diagonal distance to scale both fontSize and width proportionally
      const delta = (deltaX + deltaY) / 2;
      const newFontSize = Math.max(24, Math.min(120, resizeStartState.fontSize + delta * 2));
      const newWidth = Math.max(30, Math.min(100, resizeStartState.width + deltaX));
      setFontSize(newFontSize);
      setTextBoxWidth(newWidth);
    } else if (isDraggingWatermark) {
      e.preventDefault();
      setWatermarkPosition({ 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingTextBox(false);
    setIsResizingTextBox(false);
    setIsDraggingWatermark(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800 p-6" showCloseButton={false}>
        <div className="space-y-4">
          {/* Header with Page Pills and Post Button */}
          <div className="flex items-center justify-between gap-4 relative">
            <div className="flex items-center gap-3 flex-1">
              <h2 className="text-xl font-bold text-white whitespace-nowrap">Create Post</h2>
              <div className="flex gap-2 flex-wrap">
                {PAGES.map((page) => {
                  const isSelected = selectedPage === page.id;
                  
                  return (
                    <button
                      key={page.id}
                      onClick={() => selectPage(page.id)}
                      className={`
                        flex items-center justify-center p-1 rounded-full
                        transition-all duration-200 hover:scale-[1.1]
                        ${isSelected 
                          ? 'ring-2 ring-[#1877F2] ring-offset-2 ring-offset-gray-900' 
                          : 'opacity-60 hover:opacity-100'
                        }
                      `}
                      title={page.shortName}
                    >
                      <img 
                        src={page.profilePicture} 
                        alt={page.shortName}
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <Button
              onClick={handlePost}
              disabled={isUploading || !image || !caption.trim() || !selectedPage || cropMode}
              className="bg-[#1877F2] hover:bg-[#1664D8] text-white px-6 transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? "Posting..." : "Post"}
            </Button>
          </div>

          {/* Overlay Controls - Always visible, greyed out when no image */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Tools</label>
            <div className="flex gap-2">
              {/* Crop Button */}
              <Button
                type="button"
                variant={cropMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (image) {
                    if (!cropMode) {
                      // Enter crop mode
                      setCropMode(true);
                      setCrop({
                        unit: '%',
                        x: 0,
                        y: 0,
                        width: 100,
                        height: 100,
                      });
                    } else {
                      // Exit crop mode
                      setCropMode(false);
                    }
                  }
                }}
                disabled={!image}
                className={`flex-1 transition-all duration-200 ${
                  !image
                    ? "opacity-50 cursor-not-allowed"
                    : cropMode
                    ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                    : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                }`}
              >
                {cropMode ? "✓ Crop" : "Crop"}
              </Button>

              {/* Watermark Button */}
              <Button
                type="button"
                variant={useWatermark ? "default" : "outline"}
                size="sm"
                onClick={() => setUseWatermark(!useWatermark)}
                disabled={!image || !selectedPage || cropMode}
                className={`flex-1 transition-all duration-200 ${
                  !image || !selectedPage || cropMode
                    ? "opacity-50 cursor-not-allowed"
                    : useWatermark
                    ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                    : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                }`}
                title={!selectedPage ? "Select a page first" : ""}
              >
                {useWatermark ? "✓ Watermark" : "Watermark"}
              </Button>

              {/* Gradient Button */}
              <Button
                type="button"
                variant={useGradient ? "default" : "outline"}
                size="sm"
                onClick={() => setUseGradient(!useGradient)}
                disabled={!image || cropMode}
                className={`flex-1 transition-all duration-200 ${
                  !image || cropMode
                    ? "opacity-50 cursor-not-allowed"
                    : useGradient
                    ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                    : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                }`}
              >
                {useGradient ? "✓ Gradient" : "Gradient"}
              </Button>

              {/* Text Button */}
              <Button
                type="button"
                variant={overlayText ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!overlayText) {
                    setOverlayText("Your Text Here");
                  } else {
                    setOverlayText("");
                  }
                }}
                disabled={!image || cropMode}
                className={`flex-1 transition-all duration-200 ${
                  !image || cropMode
                    ? "opacity-50 cursor-not-allowed"
                    : overlayText
                    ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                    : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                }`}
              >
                {overlayText ? "✓ Text" : "Text"}
              </Button>
            </div>
          </div>

          {/* Image Upload/Preview */}
          <div className="space-y-2">
            {!image ? (
              <div className="relative">
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-cyan-500 transition-colors cursor-pointer"
                  onClick={() => document.getElementById("image-upload")?.click()}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-500 mb-4" />
                  <p className="text-gray-400 mb-2">Drop an image here or click to upload</p>
                  <input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                {/* Small Paste button in top-right - Hidden on iOS */}
                {!/iPhone|iPad|iPod/.test(navigator.userAgent) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePasteFromClipboard();
                    }}
                    className="absolute top-2 right-2 text-xs px-2 py-1 h-auto"
                  >
                    Paste
                  </Button>
                )}
              </div>
            ) : cropMode ? (
              <div className="space-y-2">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={(c) => setCompletedCrop(c)}
                  aspect={undefined}
                >
                  <img 
                    ref={imgRef} 
                    src={image} 
                    alt="Upload" 
                    className="max-w-full max-h-[600px]"
                  />
                </ReactCrop>
                <div className="flex justify-center">
                  <Button
                    size="sm"
                    onClick={handleConfirmCrop}
                    className="bg-cyan-500 hover:bg-cyan-600 transition-all duration-200 hover:scale-[1.02]"
                  >
                    ✓ Confirm Crop
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div 
                  ref={containerRef}
                  className="relative flex justify-center"
                  onMouseMove={handleMouseMove}
                  onTouchMove={handleTouchMove}
                  onMouseUp={handleMouseUp}
                  onTouchEnd={handleMouseUp}
                  onMouseLeave={handleMouseUp}
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

                  {/* X button to remove image - Hidden when watermark is active */}
                  {!useWatermark && (
                    <button
                      onClick={() => {
                        setImage(null);
                        setCrop(undefined);
                        setCompletedCrop(undefined);
                        setCropMode(false);
                        setCroppedImage(null);
                        setUseWatermark(false);
                        setUseGradient(false);
                        setOverlayText("");
                      }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-600 text-white flex items-center justify-center transition-all hover:scale-110 z-20"
                      title="Remove image"
                    >
                      ×
                    </button>
                  )}

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
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 60%, rgba(0,0,0,0.95) 100%)',
                      }}
                    />
                  )}

                  {/* Text Box Overlay - Draggable and Resizable */}
                  {overlayText && imgRef.current && (() => {
                    // Calculate preview font size
                    const previewFontSize = (fontSize / 800) * imgRef.current.clientWidth;
                    const boxWidth = (textBoxWidth / 100) * imgRef.current.clientWidth;
                    
                    // Create temporary canvas to measure text height
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.font = `${previewFontSize}px Impact, 'Arial Black', sans-serif`;
                      const lineHeight = previewFontSize * 1.2;
                      
                      // Calculate wrapped lines
                      const paragraphs = overlayText.split('\n');
                      let lineCount = 0;
                      paragraphs.forEach(paragraph => {
                        const words = paragraph.split(' ');
                        let currentLine = '';
                        words.forEach((word) => {
                          const testLine = currentLine + (currentLine ? ' ' : '') + word;
                          const metrics = ctx.measureText(testLine);
                          if (metrics.width > boxWidth && currentLine) {
                            lineCount++;
                            currentLine = word;
                          } else {
                            currentLine = testLine;
                          }
                        });
                        if (currentLine) lineCount++;
                      });
                      
                      const boxHeight = Math.max(lineHeight * 1.5, lineCount * lineHeight + previewFontSize * 0.4);
                      
                      return (
                        <div
                          className="absolute border-2 border-cyan-500 bg-cyan-500/10 cursor-move select-none"
                          style={{
                            pointerEvents: 'auto',
                            zIndex: 10,
                            left: `calc(50% + ${(textBoxPosition.x - 50) * (imgRef.current.clientWidth / 100)}px)`,
                            top: `calc(50% + ${(textBoxPosition.y - 50) * (imgRef.current.clientHeight / 100)}px)`,
                            transform: 'translate(-50%, -50%)',
                            width: `${boxWidth}px`,
                            height: `${boxHeight}px`,
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingTextBox(true);
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingTextBox(true);
                          }}
                        >
                          {/* Editable Text - Click to edit */}
                          <textarea
                            value={overlayText}
                            onChange={(e) => setOverlayText(e.target.value)}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Select all text when clicked
                              e.currentTarget.select();
                            }}
                            onMouseDown={(e) => {
                              // Prevent dragging when clicking inside text
                              e.stopPropagation();
                            }}
                            className="absolute inset-0 bg-transparent border-none outline-none resize-none text-center flex items-center justify-center"
                            style={{
                              fontSize: `${previewFontSize}px`,
                              fontFamily: 'Impact, "Arial Black", sans-serif',
                              fontWeight: 'bold',
                              color: 'white',
                              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                              padding: '8px',
                              cursor: 'text',
                              lineHeight: '1.2',
                            }}
                            maxLength={200}
                          />
                      
                      {/* Resize Handle - Bottom Right Corner */}
                      <div
                        className="absolute bottom-0 right-0 w-4 h-4 bg-cyan-500 cursor-nwse-resize"
                        style={{ transform: 'translate(50%, 50%)' }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = imgRef.current!.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          setResizeStartState({ 
                            x, 
                            y, 
                            fontSize: fontSize, 
                            width: textBoxWidth 
                          });
                          setIsResizingTextBox(true);
                        }}
                        onTouchStart={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const rect = imgRef.current!.getBoundingClientRect();
                          const touch = e.touches[0];
                          const x = ((touch.clientX - rect.left) / rect.width) * 100;
                          const y = ((touch.clientY - rect.top) / rect.height) * 100;
                          setResizeStartState({ 
                            x, 
                            y, 
                            fontSize: fontSize, 
                            width: textBoxWidth 
                          });
                          setIsResizingTextBox(true);
                        }}
                      />
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Watermark Preview */}
                  {useWatermark && selectedPage && imgRef.current && (
                    <img
                      src={PAGES.find(p => p.id === selectedPage)?.watermark}
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

              </div>
            )}
          </div>

          {/* Caption */}
          <div className="space-y-2">
            <div className="relative">
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption..."
                className="min-h-32 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 pt-8"
                maxLength={2000}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              />
              {/* Caption label inside textarea */}
              <div className="absolute top-2 left-3 text-xs font-medium text-gray-400 pointer-events-none">
                Caption
              </div>
              {/* Regenerate button inside textarea */}
              <Button
                type="button"
                variant="ghost"
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
                className="absolute top-1 right-1 text-xs gap-1 h-6 text-gray-400 hover:text-white"
              >
                <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                {isRegenerating ? "Regenerating..." : "Regenerate"}
              </Button>
            </div>
            <p className="text-xs text-gray-500 text-right">{caption.length} / 2000</p>
          </div>


        </div>
      </DialogContent>


    </Dialog>
  );
}
