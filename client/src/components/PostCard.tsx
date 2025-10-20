import { Heart, MessageCircle, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
}

export default function PostCard({ post }: PostCardProps) {
  const comments = post.kpi?.page_posts_comments_count?.value || 0;
  const shares = post.kpi?.page_posts_shares_count?.value || 0;
  const timeAgo = formatDistanceToNow(post.postDate, { addSuffix: true });

  return (
    <div 
      className="glass-card rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
      style={{ borderLeft: `4px solid ${post.borderColor}` }}
    >
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
        <div className="relative w-full aspect-video overflow-hidden">
          <img 
            src={post.image} 
            alt="Post content"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Post Message */}
      {post.message && (
        <div className="px-4 py-3">
          <p className="text-sm line-clamp-3">{post.message}</p>
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 pb-4 flex items-center gap-4 text-sm">
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
    </div>
  );
}

