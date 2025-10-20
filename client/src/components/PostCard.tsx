import { Heart, MessageCircle, Share2, Copy, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

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
  onDismiss?: (postId: string) => void;
  showDismiss?: boolean;
}

export default function PostCard({ post, onDismiss, showDismiss = false }: PostCardProps) {
  const comments = post.kpi?.page_posts_comments_count?.value || 0;
  const shares = post.kpi?.page_posts_shares_count?.value || 0;
  const timeAgo = formatDistanceToNow(post.postDate, { addSuffix: true });

  const handleCopyCaption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.message) {
      navigator.clipboard.writeText(post.message);
      toast.success("Caption copied to clipboard!");
    }
  };

  const handleCopyImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.image) {
      navigator.clipboard.writeText(post.image);
      toast.success("Image URL copied to clipboard!");
    }
  };

  const handleOpenPost = () => {
    if (post.link) {
      window.open(post.link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className="glass-card p-3 rounded-lg hover:scale-[1.02] transition-transform cursor-pointer relative"
      style={{ borderLeft: `3px solid ${post.borderColor}` }}
      onClick={() => window.open(post.link, '_blank')}
    >
      {showDismiss && onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss(post.id);
          }}
          className="absolute top-2 right-2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-red-500/80 hover:bg-red-600 text-white text-xs font-bold transition-colors"
          title="Dismiss from Popular Posts"
        >
          ✕
        </button>
      )}
      {/* Profile Header */}
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
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full bg-muted flex items-center justify-center text-lg font-bold">
              {post.pageName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{post.pageName}</p>
          <p className="text-xs text-muted-foreground">{timeAgo}</p>
        </div>
      </div>

      {/* Post Image */}
      {post.image && (
        <div className="relative w-full aspect-video overflow-hidden group/image">
          <img 
            src={post.image} 
            alt="Post content"
            className="w-full h-full object-cover"
          />
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
            onClick={handleCopyImage}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Post Message */}
      {post.message && (
        <div className="px-4 py-3 relative group">
          <p className="text-sm line-clamp-3">{post.message}</p>
          <Button
            size="sm"
            variant="ghost"
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopyCaption}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 pb-4 flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Heart className="h-4 w-4 text-accent" />
            <span>{post.reactions.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="h-4 w-4 text-primary" />
            <span>{comments.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Share2 className="h-4 w-4 text-secondary" />
            <span>{shares.toLocaleString()}</span>
          </div>
        </div>
        {post.link && (
          <ExternalLink className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

