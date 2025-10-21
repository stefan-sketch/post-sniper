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

  // Set image when initialImage is provided
  useEffect(() => {
    if (initialImage) {
      setImage(initialImage);
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
  const [useWatermark, setUseWatermark] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const uploadMediaMutation = trpc.publer.uploadMedia.useMutation();
  const createPostMutation = trpc.publer.createPost.useMutation();
  const regenerateCaptionMutation = trpc.publer.regenerateCaption.useMutation();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
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
    async (imageData: string, watermarkPath: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        const img = new Image();
        img.onload = () => {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // Load and apply watermark
          const watermark = new Image();
          watermark.onload = () => {
            // Calculate watermark size (20% of image width, maintain aspect ratio)
            const watermarkWidth = img.width * 0.2;
            const watermarkHeight = (watermark.height / watermark.width) * watermarkWidth;

            // Position in top-right corner with 2% padding
            const x = img.width - watermarkWidth - img.width * 0.02;
            const y = img.height * 0.02;

            ctx.drawImage(watermark, x, y, watermarkWidth, watermarkHeight);
            resolve(canvas.toDataURL("image/png"));
          };
          watermark.onerror = () => reject(new Error("Failed to load watermark"));
          watermark.src = watermarkPath;
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imageData;
      });
    },
    []
  );

  const getCroppedImage = useCallback(async (): Promise<string | null> => {
    if (!completedCrop || !imgRef.current) {
      return image; // Return original if no crop
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height
    );

    return canvas.toDataURL("image/png");
  }, [completedCrop, image]);

  const handlePost = async () => {
    if (!image) {
      toast.error("Please upload an image");
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
      // Get cropped image
      let processedImage = await getCroppedImage();
      if (!processedImage) {
        throw new Error("Failed to process image");
      }

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

      // Reset form
      setImage(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setCaption("");
      setSelectedPages([]);
      setUseWatermark(true);
      onOpenChange(false);
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
            ) : (
              <div className="space-y-2">
                <div className="relative flex justify-center">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    className="max-h-96"
                    style={{
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <img 
                      ref={imgRef} 
                      src={image} 
                      alt="Upload" 
                      className="max-w-full"
                      style={{
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </ReactCrop>

                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImage(null);
                    setCrop(undefined);
                    setCompletedCrop(undefined);
                  }}
                  className="w-full transition-all duration-200 hover:scale-[1.02]"
                >
                  Remove Image
                </Button>
              </div>
            )}
          </div>

          {/* Watermark Toggle */}
          {image && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="watermark"
                checked={useWatermark}
                onCheckedChange={(checked) => setUseWatermark(checked as boolean)}
              />
              <label htmlFor="watermark" className="text-sm text-gray-300 cursor-pointer">
                Add watermark {selectedPages.length > 1 && "(only works with one page)"}
              </label>
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
    </Dialog>
  );
}

