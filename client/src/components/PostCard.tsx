import { ThumbsUp, MessageCircle, Share2, Copy, Image as ImageIcon } from "lucide-react";
// Removed date-fns import - using custom time formatting
import { Button } from "@/components/ui/button";
import { toast } from "sonner";


import { X } from "lucide-react";

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

export default function PostCard({ post, showDismiss, onDismiss, reactionIncrease, hideActions, hidePageHeader }: PostCardProps) {
  const comments = post.kpi?.page_posts_comments_count?.value || 0;
  const shares = post.kpi?.page_posts_shares_count?.value || 0;
  
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
        
        // Fetch the image
        const response = await fetch(post.image);
        const blob = await response.blob();
        
        // Copy image blob directly to clipboard
        // Safari supports both image/png and image/jpeg
        await navigator.clipboard.write([
          new ClipboardItem({
            [blob.type]: blob
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
    <div 
      className="glass-card rounded-xl overflow-hidden transition-all mb-4 max-w-full"
    >
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
          {!hideActions && post.image && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
              onClick={handleCopyImage}
              title="Copy image to clipboard"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          )}
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
      {post.image && (
        <div 
          className="relative w-full overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
          onClick={handleOpenPost}
        >
          <img 
            src={post.image} 
            alt="Post content"
            loading="lazy"
            decoding="async"
            className="w-full h-auto object-contain"
            draggable="true"
            onDragStart={(e) => {
              e.dataTransfer.setData('text/uri-list', post.image!);
              e.dataTransfer.effectAllowed = 'copy';
            }}
          />
        </div>
      )}
    </div>
  );
}

