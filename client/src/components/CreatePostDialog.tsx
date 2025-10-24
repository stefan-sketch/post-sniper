import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useRef, useCallback, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Upload, RefreshCw, Droplet, Layers, Type, Sparkles } from "lucide-react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { toast } from "sonner";
import { CanvasEditor } from "./CanvasEditor";


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
  const [isResizingFontSize, setIsResizingFontSize] = useState(false);
  const [isResizingWidth, setIsResizingWidth] = useState(false);
  const [isDraggingWatermark, setIsDraggingWatermark] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingEnabled, setDrawingEnabled] = useState(false);
  const [drawingColor, setDrawingColor] = useState<'yellow' | 'black' | 'burgundy'>('yellow');
  const [strokeWidth, setStrokeWidth] = useState(4); // Default stroke width
  const [borderRadius, setBorderRadius] = useState(0); // Default border radius for rectangles
  const [rectangles, setRectangles] = useState<Array<{color: string, x: number, y: number, width: number, height: number, strokeWidth: number, borderRadius: number}>>([]);
  const [currentRect, setCurrentRect] = useState<{startX: number, startY: number, endX: number, endY: number} | null>(null);
  const [canvasMode, setCanvasMode] = useState(false);



  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [resizeStartState, setResizeStartState] = useState({ x: 0, y: 0, fontSize: 48, width: 60 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
          // Start gradient higher up (50% of image) and extend to very bottom
          const gradient = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
          gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
          gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
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
          ctx.letterSpacing = '0.1em'; // Increase letter spacing
          
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

        // Add overlay image if present (will be drawn synchronously after it loads) - DISABLED
        /* if (overlayImage && imgRef.current && overlayImageOriginalSize.width > 0) {
          const overlayImg = new Image();
          overlayImg.crossOrigin = 'anonymous';
          overlayImg.src = overlayImage;
          
          // Draw overlay image synchronously if already loaded
          if (overlayImg.complete) {
            const imgWidth = imgRef.current.clientWidth;
            const displayWidth = (overlayImageSize / 100) * overlayImageOriginalSize.width;
            const displayHeight = (overlayImageSize / 100) * overlayImageOriginalSize.height;
            const scaleRatio = canvas.width / imgWidth;
            const overlayWidth = displayWidth * scaleRatio;
            const overlayHeight = displayHeight * scaleRatio;
            
            const x = (overlayImagePosition.x / 100) * canvas.width - overlayWidth / 2;
            const y = (overlayImagePosition.y / 100) * canvas.height - overlayHeight / 2;
            
            // Scale border radius proportionally
            const scaledRadius = (overlayImageBorderRadius / imgWidth) * canvas.width;
            
            // Draw rounded rectangle clipping path
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x + scaledRadius, y);
            ctx.lineTo(x + overlayWidth - scaledRadius, y);
            ctx.quadraticCurveTo(x + overlayWidth, y, x + overlayWidth, y + scaledRadius);
            ctx.lineTo(x + overlayWidth, y + overlayHeight - scaledRadius);
            ctx.quadraticCurveTo(x + overlayWidth, y + overlayHeight, x + overlayWidth - scaledRadius, y + overlayHeight);
            ctx.lineTo(x + scaledRadius, y + overlayHeight);
            ctx.quadraticCurveTo(x, y + overlayHeight, x, y + overlayHeight - scaledRadius);
            ctx.lineTo(x, y + scaledRadius);
            ctx.quadraticCurveTo(x, y, x + scaledRadius, y);
            ctx.closePath();
            ctx.clip();
            
            ctx.drawImage(overlayImg, x, y, overlayWidth, overlayHeight);
            ctx.restore();
            
            // Draw border if enabled
            if (overlayImageBorderWidth > 0) {
              const borderColorMap = {
                'yellow': '#FFD700',
                'black': '#000000',
                'burgundy': '#800020'
              };
              const scaledBorderWidth = (overlayImageBorderWidth / imgWidth) * canvas.width;
              
              ctx.strokeStyle = borderColorMap[overlayImageBorderColor];
              ctx.lineWidth = scaledBorderWidth;
              
              // Draw rounded border
              ctx.beginPath();
              ctx.moveTo(x + scaledRadius, y);
              ctx.lineTo(x + overlayWidth - scaledRadius, y);
              ctx.quadraticCurveTo(x + overlayWidth, y, x + overlayWidth, y + scaledRadius);
              ctx.lineTo(x + overlayWidth, y + overlayHeight - scaledRadius);
              ctx.quadraticCurveTo(x + overlayWidth, y + overlayHeight, x + overlayWidth - scaledRadius, y + overlayHeight);
              ctx.lineTo(x + scaledRadius, y + overlayHeight);
              ctx.quadraticCurveTo(x, y + overlayHeight, x, y + overlayHeight - scaledRadius);
              ctx.lineTo(x, y + scaledRadius);
              ctx.quadraticCurveTo(x, y, x + scaledRadius, y);
              ctx.closePath();
              ctx.stroke();
            }
          }
        } */

        // Add drawing rectangles if any
        if (rectangles.length > 0 && imgRef.current) {
          const imgWidth = imgRef.current.clientWidth;
          const imgHeight = imgRef.current.clientHeight;
          
          rectangles.forEach(rect => {
            const x = (rect.x / imgWidth) * canvas.width;
            const y = (rect.y / imgHeight) * canvas.height;
            const width = (rect.width / imgWidth) * canvas.width;
            const height = (rect.height / imgHeight) * canvas.height;
            const radius = (rect.borderRadius / imgWidth) * canvas.width;
            
            ctx.strokeStyle = rect.color;
            // Scale stroke width proportionally to canvas size
            ctx.lineWidth = (rect.strokeWidth / imgWidth) * canvas.width;
            
            // Draw rounded rectangle
            if (radius > 0) {
              ctx.beginPath();
              ctx.moveTo(x + radius, y);
              ctx.lineTo(x + width - radius, y);
              ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
              ctx.lineTo(x + width, y + height - radius);
              ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
              ctx.lineTo(x + radius, y + height);
              ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
              ctx.lineTo(x, y + radius);
              ctx.quadraticCurveTo(x, y, x + radius, y);
              ctx.closePath();
              ctx.stroke();
            } else {
              ctx.strokeRect(x, y, width, height);
            }
          });
        }

        // Use JPEG with high quality
        resolve(canvas.toDataURL("image/jpeg", 0.95));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = baseImage;
    });
  }, [useGradient, overlayText, textBoxPosition, textBoxWidth, fontSize, rectangles, borderRadius]);

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
    // Use cropped image if available, otherwise use original image
    const imageToPost = croppedImage || image;
    
    if (!imageToPost) {
      toast.error("Please select an image first");
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
      // Start with the cropped image (or original if not cropped)
      let processedImage = imageToPost;
      
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
    setCropMode(false);
    setCroppedImage(null);
    setCanvasMode(false);
    // Close dialog
    onOpenChange(false);
  };

  // Handle mouse/touch events for dragging and resizing
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    
    if (isDrawing && drawingEnabled && currentRect) {
      setCurrentRect({ ...currentRect, endX: x, endY: y });
    } else if (isDraggingTextBox) {
      setTextBoxPosition({ 
        x: Math.max(0, Math.min(100, xPercent)), 
        y: Math.max(0, Math.min(100, yPercent)) 
      });
    } else if (isResizingFontSize) {
      // Top-left circle handle: resize font size only
      const deltaX = xPercent - resizeStartState.x;
      const deltaY = yPercent - resizeStartState.y;
      const delta = (deltaX + deltaY) / 2;
      const newFontSize = Math.max(16, Math.min(120, resizeStartState.fontSize + delta * 2));
      setFontSize(newFontSize);
    } else if (isResizingWidth) {
      // Right-side handle: resize width only
      const deltaX = xPercent - resizeStartState.x;
      const newWidth = Math.max(20, Math.min(100, resizeStartState.width + deltaX));
      setTextBoxWidth(newWidth);
    } else if (isDraggingWatermark) {
      setWatermarkPosition({ 
        x: Math.max(0, Math.min(100, xPercent)), 
        y: Math.max(0, Math.min(100, yPercent)) 
      });
    } /* else if (isDraggingOverlayImage) {
      setOverlayImagePosition({ 
        x: Math.max(0, Math.min(100, xPercent)), 
        y: Math.max(0, Math.min(100, yPercent)) 
      });
    } else if (isResizingOverlayImage) {
      // Simple resize based on horizontal movement
      const deltaX = xPercent - resizeStartState.x;
      const newSize = Math.max(10, Math.min(200, resizeStartState.width + deltaX * 2));
      setOverlayImageSize(newSize);
    } */
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!containerRef.current || !imgRef.current || e.touches.length === 0) return;
    const rect = imgRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;
    
    if (isDrawing && drawingEnabled && currentRect) {
      e.preventDefault();
      setCurrentRect({ ...currentRect, endX: x, endY: y });
    } else if (isDraggingTextBox) {
      e.preventDefault();
      setTextBoxPosition({ 
        x: Math.max(0, Math.min(100, xPercent)), 
        y: Math.max(0, Math.min(100, yPercent)) 
      });
    } else if (isResizingFontSize) {
      e.preventDefault();
      const deltaX = xPercent - resizeStartState.x;
      const deltaY = yPercent - resizeStartState.y;
      const delta = (deltaX + deltaY) / 2;
      const newFontSize = Math.max(16, Math.min(120, resizeStartState.fontSize + delta * 2));
      setFontSize(newFontSize);
    } else if (isResizingWidth) {
      e.preventDefault();
      const deltaX = xPercent - resizeStartState.x;
      const newWidth = Math.max(20, Math.min(100, resizeStartState.width + deltaX));
      setTextBoxWidth(newWidth);
    } else if (isDraggingWatermark) {
      e.preventDefault();
      setWatermarkPosition({ 
        x: Math.max(0, Math.min(100, xPercent)), 
        y: Math.max(0, Math.min(100, yPercent)) 
      });
    } /* else if (isDraggingOverlayImage) {
      e.preventDefault();
      setOverlayImagePosition({ 
        x: Math.max(0, Math.min(100, xPercent)), 
        y: Math.max(0, Math.min(100, yPercent)) 
      });
    } else if (isResizingOverlayImage) {
      e.preventDefault();
      // Simple resize based on horizontal movement
      const deltaX = xPercent - resizeStartState.x;
      const newSize = Math.max(10, Math.min(200, resizeStartState.width + deltaX * 2));
      setOverlayImageSize(newSize);
    } */
  };

  const handleMouseUp = () => {
    if (isDrawing && currentRect) {
      // Save the completed rectangle
      const colorMap = {
        'yellow': '#FFD700',
        'black': '#000000',
        'burgundy': '#800020'
      };
      const { startX, startY, endX, endY } = currentRect;
      const x = Math.min(startX, endX);
      const y = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);
      
      // Only save if rectangle has meaningful size (at least 5px)
      if (width > 5 && height > 5) {
        setRectangles(prev => [...prev, { color: colorMap[drawingColor], x, y, width, height, strokeWidth, borderRadius }]);
      }
      setCurrentRect(null);
    }
    setIsDrawing(false);
    setIsDraggingTextBox(false);
    setIsResizingFontSize(false);
    setIsResizingWidth(false);
    setIsDraggingWatermark(false);
    // setIsDraggingOverlayImage(false);
    // setIsResizingOverlayImage(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800 p-6" showCloseButton={false}>
        <div className="space-y-4">
          {/* Header with Page Pills and Post Button */}
          <div className="flex items-center justify-between gap-4 relative">
            <div className="flex items-center gap-3 flex-1">
              <h2 className="text-xl font-bold text-white whitespace-nowrap">Create Post</h2>
              <div className="flex gap-2 flex-wrap relative">
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
            <div className="flex gap-2">
              {/* Crop Button */}
                <Button
                  type="button"
                  variant={cropMode ? "default" : "outline"}
                  size="sm"
                  onClick={async () => {
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
                        // Confirm crop
                        await handleConfirmCrop();
                      }
                    }
                  }}
                  disabled={!image}
                  className={`flex-1 transition-all duration-200 relative z-50 ${
                    !image
                      ? "opacity-50 cursor-not-allowed"
                      : cropMode
                      ? "bg-green-400 hover:bg-green-300 text-white shadow-2xl shadow-green-400/80 ring-4 ring-green-300/70 hover:shadow-green-300/90 hover:scale-110 animate-pulse"
                      : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                  }`}
                  title={cropMode ? "Confirm crop" : "Crop image"}
                >
                  {cropMode ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
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
                title={!selectedPage ? "Select a page first" : "Add watermark"}
              >
                <Droplet className="h-4 w-4" />
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
                title="Add gradient overlay"
              >
                <Layers className="h-4 w-4" />
              </Button>

              {/* Text Button */}
              <Button
                type="button"
                variant={overlayText ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (!overlayText) {
                    setOverlayText("Your Text Here");
                    // Focus and select text after state updates
                    setTimeout(() => {
                      if (textareaRef.current) {
                        textareaRef.current.focus();
                        textareaRef.current.select();
                      }
                    }, 50);
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
                title="Add text overlay"
              >
                <Type className="h-4 w-4" />
              </Button>

              {/* Overlay Image Button - DISABLED */}
              {/* <Button
                type="button"
                variant={overlayImage ? "default" : "outline"}
                size="sm"
                onClick={() => overlayImageInputRef.current?.click()}
                disabled={!image || cropMode}
                className={`flex-1 transition-all duration-200 ${
                  !image || cropMode
                    ? "opacity-50 cursor-not-allowed"
                    : overlayImage
                    ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                    : "border-gray-700 text-gray-300 hover:text-white hover:border-cyan-500"
                }`}
                title="Add overlay image"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </Button>
              <input
                ref={overlayImageInputRef}
                type="file"
                accept="image/*"
                onChange={handleOverlayImageUpload}
                className="hidden"
              /> */}
            </div>

            {/* Drawing Color Picker - Show when drawing is enabled */}
            {drawingEnabled && image && !cropMode && (
              <div className="space-y-2">
                <div className="flex gap-2 items-center justify-center">
                  <span className="text-sm text-gray-400">Color:</span>
                <button
                  type="button"
                  onClick={() => setDrawingColor('yellow')}
                  className={`w-8 h-8 rounded-full border-2 ${
                    drawingColor === 'yellow' ? 'border-white ring-2 ring-cyan-500' : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: '#FFD700' }}
                  title="Yellow"
                />
                <button
                  type="button"
                  onClick={() => setDrawingColor('black')}
                  className={`w-8 h-8 rounded-full border-2 ${
                    drawingColor === 'black' ? 'border-white ring-2 ring-cyan-500' : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: '#000000' }}
                  title="Black"
                />
                <button
                  type="button"
                  onClick={() => setDrawingColor('burgundy')}
                  className={`w-8 h-8 rounded-full border-2 ${
                    drawingColor === 'burgundy' ? 'border-white ring-2 ring-cyan-500' : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: '#800020' }}
                  title="Burgundy"
                />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRectangles([])}
                    disabled={rectangles.length === 0}
                    className="ml-2 text-xs"
                    title="Clear rectangles"
                  >
                    Clear
                  </Button>
                </div>
                
                {/* Stroke Width Slider */}
                <div className="flex gap-3 items-center justify-center px-4">
                  <span className="text-sm text-gray-400 whitespace-nowrap">Width:</span>
                  <input
                    type="range"
                    min="1"
                    max="12"
                    step="1"
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    style={{
                      maxWidth: '200px'
                    }}
                  />
                  <span className="text-sm text-white font-medium w-8 text-center">{strokeWidth}px</span>
                </div>
                
                {/* Border Radius Slider */}
                <div className="flex gap-3 items-center justify-center px-4">
                  <span className="text-sm text-gray-400 whitespace-nowrap">Curve:</span>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="2"
                    value={borderRadius}
                    onChange={(e) => setBorderRadius(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    style={{
                      maxWidth: '200px'
                    }}
                  />
                  <span className="text-sm text-white font-medium w-8 text-center">{borderRadius}px</span>
                </div>
              </div>
            )}

            {/* Overlay Image Controls - DISABLED */}
            {/* {overlayImage && image && !cropMode && (
              <div className="space-y-2">
                <div className="flex gap-3 items-center justify-center px-4">
                  <span className="text-sm text-gray-400 whitespace-nowrap">Scale:</span>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="5"
                    value={overlayImageSize}
                    onChange={(e) => setOverlayImageSize(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    style={{ maxWidth: '150px' }}
                  />
                  <span className="text-sm text-white font-medium w-12 text-center">{overlayImageSize}%</span>
                </div>

                <div className="flex gap-3 items-center justify-center px-4">
                  <span className="text-sm text-gray-400 whitespace-nowrap">Curve:</span>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="2"
                    value={overlayImageBorderRadius}
                    onChange={(e) => setOverlayImageBorderRadius(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    style={{ maxWidth: '150px' }}
                  />
                  <span className="text-sm text-white font-medium w-10 text-center">{overlayImageBorderRadius}px</span>
                </div>

                <div className="flex gap-3 items-center justify-center px-4">
                  <span className="text-sm text-gray-400 whitespace-nowrap">Border:</span>
                  <input
                    type="range"
                    min="0"
                    max="20"
                    step="2"
                    value={overlayImageBorderWidth}
                    onChange={(e) => setOverlayImageBorderWidth(Number(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    style={{ maxWidth: '150px' }}
                  />
                  <span className="text-sm text-white font-medium w-10 text-center">{overlayImageBorderWidth}px</span>
                </div>

                {overlayImageBorderWidth > 0 && (
                  <div className="flex gap-2 items-center justify-center">
                    <span className="text-sm text-gray-400">Color:</span>
                    <button
                      type="button"
                      onClick={() => setOverlayImageBorderColor('yellow')}
                      className={`w-6 h-6 rounded-full border-2 ${
                        overlayImageBorderColor === 'yellow' ? 'border-white ring-2 ring-cyan-500' : 'border-gray-600'
                      }`}
                      style={{ backgroundColor: '#FFD700' }}
                      title="Yellow"
                    />
                    <button
                      type="button"
                      onClick={() => setOverlayImageBorderColor('black')}
                      className={`w-6 h-6 rounded-full border-2 ${
                        overlayImageBorderColor === 'black' ? 'border-white ring-2 ring-cyan-500' : 'border-gray-600'
                      }`}
                      style={{ backgroundColor: '#000000' }}
                      title="Black"
                    />
                    <button
                      type="button"
                      onClick={() => setOverlayImageBorderColor('burgundy')}
                      className={`w-6 h-6 rounded-full border-2 ${
                        overlayImageBorderColor === 'burgundy' ? 'border-white ring-2 ring-cyan-500' : 'border-gray-600'
                      }`}
                      style={{ backgroundColor: '#800020' }}
                      title="Burgundy"
                    />
                  </div>
                )}

                <div className="flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOverlayImage(null)}
                    className="text-xs"
                    title="Remove overlay image"
                  >
                    Remove Overlay
                  </Button>
                </div>
              </div>
            )} */}
          </div>

          {/* Image Upload/Preview */}
          <div className="space-y-2">
            {canvasMode && !image ? (
              <CanvasEditor
                onComplete={(imageDataUrl) => {
                  setImage(imageDataUrl);
                  setCanvasMode(false);
                }}
              />
            ) : !image ? (
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
                {/* Canvas button in top-left */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCanvasMode(true);
                  }}
                  className="absolute top-2 left-2 text-xs px-2 py-1 h-auto bg-cyan-500/10 border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-300"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  Canvas
                </Button>
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
                  onMouseDown={(e) => {
                    if (drawingEnabled && imgRef.current) {
                      const rect = imgRef.current.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      setIsDrawing(true);
                      setCurrentRect({ startX: x, startY: y, endX: x, endY: y });
                    }
                  }}
                  onTouchStart={(e) => {
                    if (drawingEnabled && imgRef.current && e.touches.length > 0) {
                      const rect = imgRef.current.getBoundingClientRect();
                      const touch = e.touches[0];
                      const x = touch.clientX - rect.left;
                      const y = touch.clientY - rect.top;
                      setIsDrawing(true);
                      setCurrentRect({ startX: x, startY: y, endX: x, endY: y });
                    }
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
                        background: 'linear-gradient(to bottom, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 100%)',
                      }}
                    />
                  )}



                  {/* Text Box Overlay - Draggable and Resizable */}
                  {overlayText && imgRef.current && (() => {
                    // Calculate preview font size
                    const previewFontSize = (fontSize / 800) * imgRef.current.clientWidth;
                    const boxWidth = (textBoxWidth / 100) * imgRef.current.clientWidth;
                    const lineHeight = previewFontSize * 1.2;
                    
                    // Simple minimum height - will auto-expand with content
                    const minBoxHeight = lineHeight * 1.5;
                    
                    return (
                        <div
                          className={`absolute select-none ${isEditingText ? 'border-2 border-cyan-500 bg-cyan-500/10 cursor-move' : 'cursor-move'}`}
                          style={{
                            pointerEvents: 'auto',
                            zIndex: 10,
                            left: `calc(50% + ${(textBoxPosition.x - 50) * (imgRef.current.clientWidth / 100)}px)`,
                            top: `calc(50% + ${(textBoxPosition.y - 50) * (imgRef.current.clientHeight / 100)}px)`,
                            transform: 'translate(-50%, -50%)',
                            width: `${boxWidth}px`,
                            minHeight: `${minBoxHeight}px`,
                            display: 'flex',
                            flexDirection: 'column',
                          }}
                          onClick={(e) => {
                            // If clicking the box itself (not the textarea), enable editing
                            if (e.target === e.currentTarget) {
                              setIsEditingText(true);
                              setTimeout(() => textareaRef.current?.focus(), 0);
                            }
                          }}
                          onMouseDown={(e) => {
                            // Only allow dragging if not clicking on textarea
                            if (e.target === e.currentTarget && !isEditingText) {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingTextBox(true);
                            }
                          }}
                          onTouchStart={(e) => {
                            // Only allow dragging if not clicking on textarea
                            if (e.target === e.currentTarget && !isEditingText) {
                              e.preventDefault();
                              e.stopPropagation();
                              setIsDraggingTextBox(true);
                            }
                          }}
                        >
                          {/* Editable Text - Click to edit */}
                          <textarea
                            ref={textareaRef}
                            value={overlayText}
                            onChange={(e) => setOverlayText(e.target.value)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsEditingText(true);
                              // Select all text when clicked
                              e.currentTarget.select();
                            }}
                            onFocus={() => setIsEditingText(true)}
                            onBlur={() => setIsEditingText(false)}
                            onMouseDown={(e) => {
                              // Prevent dragging when clicking inside text
                              e.stopPropagation();
                            }}
                            className="bg-transparent border-none outline-none resize-none text-center"
                            style={{
                              width: '100%',
                              flex: '1 1 auto',
                              minHeight: '0',
                              fontSize: `${previewFontSize}px`,
                              fontFamily: 'Impact, "Arial Black", sans-serif',
                              fontWeight: 'bold',
                              color: 'white',
                              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                              padding: '8px',
                              cursor: isEditingText ? 'text' : 'move',
                              lineHeight: '1.2',
                              letterSpacing: '0.1em',
                              pointerEvents: isEditingText ? 'auto' : 'none',
                              whiteSpace: 'pre-wrap',
                              wordWrap: 'break-word',
                              overflow: 'hidden',
                            }}
                            maxLength={200}
                          />
                      
                      {/* Font Size Handle - Top Left Circle - Only show when editing */}
                      {isEditingText && (
                        <div
                          className="absolute top-0 left-0 w-6 h-6 bg-white border-2 border-cyan-500 rounded-full cursor-nwse-resize shadow-lg"
                          style={{ transform: 'translate(-50%, -50%)' }}
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
                            setIsResizingFontSize(true);
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
                            setIsResizingFontSize(true);
                          }}
                        />
                      )}

                      {/* Width Handle - Right Side - Only show when editing */}
                      {isEditingText && (
                        <div
                          className="absolute top-1/2 right-0 w-4 h-8 bg-cyan-500 cursor-ew-resize"
                          style={{ transform: 'translate(50%, -50%)' }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = imgRef.current!.getBoundingClientRect();
                            const x = ((e.clientX - rect.left) / rect.width) * 100;
                            setResizeStartState({ 
                              x, 
                              y: 0, 
                              fontSize: fontSize, 
                              width: textBoxWidth 
                            });
                            setIsResizingWidth(true);
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = imgRef.current!.getBoundingClientRect();
                            const touch = e.touches[0];
                            const x = ((touch.clientX - rect.left) / rect.width) * 100;
                            setResizeStartState({ 
                              x, 
                              y: 0, 
                              fontSize: fontSize, 
                              width: textBoxWidth 
                            });
                            setIsResizingWidth(true);
                          }}
                        />
                      )}
                        </div>
                      );
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

                  {/* Overlay Image Preview - DISABLED */}
                  {/* {overlayImage && imgRef.current && overlayImageOriginalSize.width > 0 && (() => {
                    const displayWidth = (overlayImageSize / 100) * overlayImageOriginalSize.width;
                    const displayHeight = (overlayImageSize / 100) * overlayImageOriginalSize.height;
                    const borderColorMap = {
                      'yellow': '#FFD700',
                      'black': '#000000',
                      'burgundy': '#800020'
                    };
                    
                    return (
                      <div
                        className="absolute cursor-move select-none"
                        style={{
                          pointerEvents: 'auto',
                          zIndex: 11,
                          left: `calc(50% + ${(overlayImagePosition.x - 50) * (imgRef.current.clientWidth / 100)}px)`,
                          top: `calc(50% + ${(overlayImagePosition.y - 50) * (imgRef.current.clientHeight / 100)}px)`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        onMouseDown={(e) => {
                          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingOverlayImage(true);
                          }
                        }}
                        onTouchStart={(e) => {
                          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'IMG') {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDraggingOverlayImage(true);
                          }
                        }}
                      >
                        <img
                          src={overlayImage}
                          alt="Overlay"
                          draggable={false}
                          style={{
                            width: `${displayWidth}px`,
                            height: `${displayHeight}px`,
                            borderRadius: `${overlayImageBorderRadius}px`,
                            border: overlayImageBorderWidth > 0 ? `${overlayImageBorderWidth}px solid ${borderColorMap[overlayImageBorderColor]}` : 'none',
                            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
                          }}
                        />

                      </div>
                    );
                  })()} */}

                  {/* Drawing Canvas Overlay - Top Layer */}
                  {imgRef.current && (
                    <svg
                      className="absolute pointer-events-none"
                      style={{
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: imgRef.current.clientWidth,
                        height: imgRef.current.clientHeight,
                        zIndex: 12,
                      }}
                    >
                      {/* Render completed rectangles */}
                      {rectangles.map((rect, i) => (
                        <rect
                          key={i}
                          x={rect.x}
                          y={rect.y}
                          width={rect.width}
                          height={rect.height}
                          fill="none"
                          stroke={rect.color}
                          strokeWidth={rect.strokeWidth}
                          rx={rect.borderRadius}
                          ry={rect.borderRadius}
                        />
                      ))}
                      {/* Render current rectangle being drawn */}
                      {currentRect && (() => {
                        const x = Math.min(currentRect.startX, currentRect.endX);
                        const y = Math.min(currentRect.startY, currentRect.endY);
                        const width = Math.abs(currentRect.endX - currentRect.startX);
                        const height = Math.abs(currentRect.endY - currentRect.startY);
                        const color = drawingColor === 'yellow' ? '#FFD700' : drawingColor === 'black' ? '#000000' : '#800020';
                        return (
                          <rect
                            x={x}
                            y={y}
                            width={width}
                            height={height}
                            fill="none"
                            stroke={color}
                            strokeWidth={strokeWidth}
                            rx={borderRadius}
                            ry={borderRadius}
                          />
                        );
                      })()}
                    </svg>
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
