import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { X, Upload } from "lucide-react";
import ReactCrop, { Crop, PixelCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

type PageId = "footy-feed" | "football-funnys" | "football-away-days";

const PAGES: { id: PageId; name: string; watermark: string }[] = [
  { id: "footy-feed", name: "The Footy Feed", watermark: "/watermarks/footy-feed.png" },
  { id: "football-funnys", name: "Football Funnys", watermark: "/watermarks/football-funnys.png" },
  { id: "football-away-days", name: "Football Away Days", watermark: "/watermarks/football-away-days.png" },
];

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostDialog({ open, onOpenChange }: CreatePostDialogProps) {
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [caption, setCaption] = useState("");
  const [selectedPages, setSelectedPages] = useState<PageId[]>([]);
  const [useWatermark, setUseWatermark] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const uploadMediaMutation = trpc.publer.uploadMedia.useMutation();
  const createPostMutation = trpc.publer.createPost.useMutation();

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setCrop(undefined);
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
        setCrop(undefined);
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
            resolve(canvas.toDataURL("image/jpeg", 0.9));
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

    return canvas.toDataURL("image/jpeg", 0.9);
  }, [completedCrop, image]);

  const handlePost = async () => {
    if (!image) {
      alert("Please upload an image");
      return;
    }

    if (!caption.trim()) {
      alert("Please enter a caption");
      return;
    }

    if (selectedPages.length === 0) {
      alert("Please select at least one page");
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

      alert(`Success! Posted to ${selectedPages.length} page${selectedPages.length > 1 ? "s" : ""}`);

      // Reset form
      setImage(null);
      setCrop(undefined);
      setCompletedCrop(undefined);
      setCaption("");
      setSelectedPages([]);
      setUseWatermark(true);
      onOpenChange(false);
    } catch (error: any) {
      alert(`Error: ${error.message || "Failed to create post"}`);
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-800">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Create Post</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="text-gray-400 hover:text-white"
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
                className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-gray-600 transition-colors"
                onClick={() => document.getElementById("image-upload")?.click()}
              >
                <Upload className="h-12 w-12 mx-auto mb-3 text-gray-500" />
                <p className="text-gray-400 mb-1">Drag & drop an image here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
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
                <div className="relative">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    className="max-h-96"
                  >
                    <img ref={imgRef} src={image} alt="Upload" className="max-w-full" />
                  </ReactCrop>
                  {/* Watermark Preview */}
                  {getWatermarkPreview() && (
                    <img
                      src={getWatermarkPreview()!}
                      alt="Watermark"
                      className="absolute top-2 right-2 w-16 opacity-90 pointer-events-none"
                    />
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImage(null);
                    setCrop(undefined);
                    setCompletedCrop(undefined);
                  }}
                  className="w-full"
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
                Add watermark (only when posting to one page)
              </label>
            </div>
          )}

          {/* Caption */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Caption</label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              className="min-h-24 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              maxLength={2000}
            />
            <p className="text-xs text-gray-500 text-right">{caption.length} / 2000</p>
          </div>

          {/* Page Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">Post to Pages</label>
            <div className="space-y-2">
              {PAGES.map((page) => (
                <div key={page.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={page.id}
                    checked={selectedPages.includes(page.id)}
                    onCheckedChange={() => togglePage(page.id)}
                  />
                  <label htmlFor={page.id} className="text-sm text-gray-300 cursor-pointer">
                    {page.name}
                  </label>
                </div>
              ))}
            </div>
            {useWatermark && selectedPages.length > 1 && (
              <p className="text-xs text-yellow-500">
                ⚠️ Watermark disabled when posting to multiple pages
              </p>
            )}
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

