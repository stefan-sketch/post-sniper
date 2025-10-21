import { useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Upload, X, Crop, Loader2 } from "lucide-react";
import Cropper from "react-easy-crop";
import { trpc } from "@/lib/trpc";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGES = [
  { id: "footy-feed", name: "The Footy Feed" },
  { id: "football-funnys", name: "Football Funnys" },
  { id: "football-away-days", name: "Football Away Days" },
] as const;

type PageId = typeof PAGES[number]["id"];

export function CreatePostDialog({ open, onOpenChange }: CreatePostDialogProps) {
  const [image, setImage] = useState<string | null>(null);
  const [croppedImage, setCroppedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [selectedPages, setSelectedPages] = useState<PageId[]>([]);
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  const uploadMediaMutation = trpc.publer.uploadMedia.useMutation();
  const createPostMutation = trpc.publer.createPost.useMutation();

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        setShowCropper(true);
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
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const createCroppedImage = async () => {
    if (!image || !croppedAreaPixels) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageElement = new Image();
    imageElement.src = image;

    await new Promise((resolve) => {
      imageElement.onload = resolve;
    });

    canvas.width = croppedAreaPixels.width;
    canvas.height = croppedAreaPixels.height;

    ctx.drawImage(
      imageElement,
      croppedAreaPixels.x,
      croppedAreaPixels.y,
      croppedAreaPixels.width,
      croppedAreaPixels.height,
      0,
      0,
      croppedAreaPixels.width,
      croppedAreaPixels.height
    );

    return canvas.toDataURL("image/jpeg", 0.9);
  };

  const handleCropConfirm = async () => {
    const croppedImg = await createCroppedImage();
    if (croppedImg) {
      setCroppedImage(croppedImg);
      setShowCropper(false);
    }
  };

  const handlePost = async () => {
    if (!croppedImage) {
      alert("Please upload and crop an image");
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
      // Upload media to Publer
      const uploadResult = await uploadMediaMutation.mutateAsync({
        imageData: croppedImage,
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
      setCroppedImage(null);
      setCaption("");
      setSelectedPages([]);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Post</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Upload / Cropper */}
          {!image && !croppedImage && (
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-500 transition-colors"
            >
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-300">Drag & drop an image or click to upload</p>
              </label>
            </div>
          )}

          {showCropper && image && (
            <div className="space-y-4">
              <div className="relative h-96 bg-black rounded-lg overflow-hidden">
                <Cropper
                  image={image}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropComplete}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCropConfirm} className="flex-1">
                  <Crop className="w-4 h-4 mr-2" />
                  Confirm Crop
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImage(null);
                    setShowCropper(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {croppedImage && !showCropper && (
            <div className="relative">
              <img src={croppedImage} alt="Cropped" className="w-full rounded-lg" />
              <Button
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => {
                  setCroppedImage(null);
                  setImage(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Caption */}
          <div>
            <Label htmlFor="caption">Caption</Label>
            <Textarea
              id="caption"
              placeholder="Write your caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              className="mt-2"
            />
          </div>

          {/* Page Selection */}
          <div>
            <Label>Post to Pages</Label>
            <div className="space-y-2 mt-2">
              {PAGES.map((page) => (
                <div key={page.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={page.id}
                    checked={selectedPages.includes(page.id)}
                    onCheckedChange={() => togglePage(page.id)}
                  />
                  <Label htmlFor={page.id} className="cursor-pointer">
                    {page.name}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Post Button */}
          <Button
            onClick={handlePost}
            disabled={isUploading || !croppedImage || !caption || selectedPages.length === 0}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              "Post Now"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

