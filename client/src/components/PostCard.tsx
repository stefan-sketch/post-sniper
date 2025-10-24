import { ThumbsUp, MessageCircle, Share2, Copy, ImageIcon, ExternalLink, X } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";
// Removed date-fns import - using custom time formatting
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getOptimizedImageUrl, generateSrcSet, getImageSizes } from "@/lib/imageOptimization";

interface PostCardProps {
  post: {
    id: string;
    pageId: string;
    pageName: string;
    borderColor: string;
    profilePicture?: string;
    message?: string;
    image?: string;
    link?: string;
    postDate: Date;
    reactions: number;
    kpi?: {
      page_posts_comments_count?: { value: number };
      page_posts_shares_count?: { value: number };
    };
  };
  showDismiss?: boolean;
  onDismiss?: () => void;
  reactionIncrease?: number; // Number of reactions gained since last update
  hideActions?: boolean; // Hide download and copy buttons
  hidePageHeader?: boolean; // Hide page name and profile picture
}

function PostCard({ post, showDismiss, onDismiss, reactionIncrease, hideActions, hidePageHeader }: PostCardProps) {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const [expandedImage, setExpandedImage] = React.useState<string | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const comments = post.kpi?.page_posts_comments_count?.value || 0;
  const shares = post.kpi?.page_posts_shares_count?.value || 0;

  // Intersection Observer for lazy loading
  React.useEffect(() => {
    // Desktop: Load further ahead (200px), Mobile: Load closer (50px)
    const isDesktop = window.matchMedia('(min-width: 768px)').matches;
    const rootMargin = isDesktop ? '200px' : '50px';

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin,  // Load ahead based on device
        threshold: 0.01,
      }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);
  
  // Custom time formatting that switches at halfway points
  const getTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    
    const diffHours = diffMins / 60;
    
    // Round to nearest hour (switches at 30-minute mark)
    // 60-89 mins = "1 hour ago"
    // 90-149 mins = "2 hours ago"
    const roundedHours = Math.round(diffHours);
    
    if (roundedHours < 24) {
      return `${roundedHours} hour${roundedHours === 1 ? '' : 's'} ago`;
    }
    
    const diffDays = Math.round(diffHours / 24);
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  };
  
  const timeAgo = getTimeAgo(post.postDate);

  const handleCopyCaption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.message) {
      navigator.clipboard.writeText(post.message);
      toast.success("Caption copied to clipboard!");
    }
  };

  const handleCopyImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.image) {
      try {
        // Detect iOS devices specifically (iPhone, iPad, iPod)
        const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        // Check if clipboard API is available
        const isClipboardAvailable = navigator.clipboard && typeof ClipboardItem !== 'undefined';
        
        // Only use download fallback on iOS devices where clipboard might not work in PWA
        if (isIOS && !isClipboardAvailable) {
          // Fallback for iOS PWA: Download the image instead
          const response = await fetch(post.image);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `post-${post.id}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("Image downloaded! (Clipboard not available in PWA)");
          return;
        }
        
        // Safari PWA requires clipboard.write() to be called synchronously in the user gesture
        // We pass a Promise to ClipboardItem to maintain the gesture chain
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': fetch(post.image)
              .then(response => response.blob())
              .then(blob => {
                // Convert to PNG for better compatibility
                return new Promise<Blob>((resolve) => {
                  const img = new Image();
                  img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    canvas.toBlob((pngBlob) => resolve(pngBlob!), 'image/png');
                  };
                  img.src = URL.createObjectURL(blob);
                });
              })
          })
        ]);
        
        toast.success("Image copied to clipboard!");
      } catch (error) {
        console.error('Copy failed:', error);
        // Fallback: Try to download instead
        try {
          const response = await fetch(post.image);
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `post-${post.id}.jpg`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          toast.success("Image downloaded! (Copy to clipboard failed)");
        } catch (downloadError) {
          toast.error("Failed to copy or download image");
        }
      }
    }
  };



  const handleOpenPost = () => {
    if (post.link) {
      window.open(post.link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
    <div 
      ref={cardRef}
      className="group glass-card rounded-xl overflow-hidden transition-all mb-4 max-w-full relative"
      style={{
        contain: 'layout style paint',  // CSS containment for better performance
        contentVisibility: 'auto',  // Render only when visible
      }}
    >
      {/* Link button in top-right - hover only */}
      {post.link && (
        <a
          href={post.link}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 z-10 flex items-center justify-center p-0.5 rounded-md bg-gray-800/60 backdrop-blur-sm hover:bg-gray-700/80 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 border border-gray-700/50 hover:border-gray-600/50"
          title="Open on Facebook"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
      {/* Profile Header */}
      {!hidePageHeader && (
      <div className="p-4 flex items-center gap-3">
        <div 
          className="h-12 w-12 rounded-full overflow-hidden flex-shrink-0"
          style={{ 
            border: `2px solid ${post.borderColor}`,
            boxShadow: `0 0 10px ${post.borderColor}40`
          }}
        >
          {post.profilePicture ? (
            <img 
              src={post.profilePicture} 
              alt={post.pageName}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center text-lg font-bold">
              {post.pageName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold truncate">{post.pageName}</p>
          </div>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
        {showDismiss && onDismiss && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
              toast.success("Post dismissed");
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      )}

      {/* Timestamp when header is hidden */}
      {hidePageHeader && (
        <div className="px-4 pt-3">
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      )}

      {/* Post Message */}
      {post.message && (
        <div className={`px-4 pb-3 ${hidePageHeader ? 'pt-1' : 'pt-3'}`}>
          <p className="text-sm line-clamp-3">{post.message}</p>
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 pb-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-gray-400" strokeWidth={2} />
            <span className="text-gray-300 font-medium">{post.reactions.toLocaleString()}</span>
            {reactionIncrease !== undefined && reactionIncrease > 0 && (
              <span className="text-xs font-semibold text-green-400">
                +{reactionIncrease.toLocaleString()}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-gray-400" strokeWidth={2} />
            <span className="text-gray-300 font-medium">{comments.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-gray-400" strokeWidth={2} />
            <span className="text-gray-300 font-medium">{shares.toLocaleString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!hideActions && post.message && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
              onClick={handleCopyCaption}
              title="Copy caption"
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Post Image */}
      {post.image && isVisible && (
        <div 
          className="relative w-full overflow-hidden cursor-pointer hover:opacity-90 transition-opacity group"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedImage(post.image!);
          }}
        >
          {/* Blur placeholder while loading */}
          {!imageLoaded && (
            <div className="absolute inset-0 bg-gray-800 animate-pulse" />
          )}
          <img 
            src={getOptimizedImageUrl(post.image, 640)}
            srcSet={generateSrcSet(post.image)}
            sizes={getImageSizes('post')}
            alt="Post content"
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            className={`w-full h-auto object-cover transition-opacity duration-300 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            draggable="true"
            onDragStart={(e) => {
              e.dataTransfer.setData('text/uri-list', post.image!);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          />
          {/* Copy image button overlay */}
          {!hideActions && (
            <button
              className="absolute top-2 right-2 z-10 flex items-center justify-center p-0.5 rounded-md bg-gray-800/60 backdrop-blur-sm hover:bg-gray-700/80 text-gray-400 hover:text-white transition-all opacity-0 group-hover:opacity-100 border border-gray-700/50 hover:border-gray-600/50"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyImage(e);
              }}
              title="Copy image to clipboard"
            >
              <ImageIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
    
    {/* Image Modal */}
    {expandedImage && createPortal(
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4"
        onClick={() => setExpandedImage(null)}
      >
        <button
          onClick={() => setExpandedImage(null)}
          className="absolute top-4 right-4 p-2 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 text-white transition-all z-[10000]"
          title="Close"
        >
          <X className="w-6 h-6" />
        </button>
        <img 
          src={expandedImage} 
          alt="Expanded view"
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>,
      document.body
    )}
    </>
  );
}

// Memoize PostCard to prevent unnecessary re-renders
export default React.memo(PostCard, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.reactions === nextProps.post.reactions &&
    prevProps.post.kpi?.page_posts_comments_count?.value === nextProps.post.kpi?.page_posts_comments_count?.value &&
    prevProps.post.kpi?.page_posts_shares_count?.value === nextProps.post.kpi?.page_posts_shares_count?.value &&
    prevProps.reactionIncrease === nextProps.reactionIncrease &&
    prevProps.showDismiss === nextProps.showDismiss &&
    prevProps.hideActions === nextProps.hideActions &&
    prevProps.hidePageHeader === nextProps.hidePageHeader
  );
});

