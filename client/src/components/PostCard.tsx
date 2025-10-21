import { ThumbsUp, MessageCircle, Share2, Copy, Download, Upload } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
}

export default function PostCard({ post, showDismiss, onDismiss }: PostCardProps) {
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

  const handleDownloadImage = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.image) {
      try {
        const response = await fetch(post.image);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `post-${post.id}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("Image downloaded!");
      } catch (error) {
        toast.error("Failed to download image");
      }
    }
  };

  const MANUS_CHATS = [
    { name: "FootballFunnys", sessionId: "EUlhxwbdboxq5GamuZOfw4" },
    { name: "FootyFeed", sessionId: "kcSypE0vgCTPKqXqLQWr7j" },
    { name: "FAD", sessionId: "gwbHdSMCBnio6ozpKdD5tJ" },
  ];

  const uploadMutation = trpc.manus.uploadImage.useMutation();

  const handleUploadToManus = async (e: React.MouseEvent, chatName: string, sessionId: string) => {
    e.stopPropagation();
    if (!post.image) {
      toast.error("No image to upload");
      return;
    }

    try {
      const toastId = toast.loading(`Uploading to ${chatName}...`);
      
      const result = await uploadMutation.mutateAsync({
        imageUrl: post.image,
        sessionId,
        chatName,
      });
      
      toast.dismiss(toastId);
      toast.success(`Uploaded to ${chatName}!`);
    } catch (error) {
      toast.error(`Failed to upload to ${chatName}`);
      console.error('Manus upload error:', error);
    }
  };

  const handleOpenPost = () => {
    if (post.link) {
      window.open(post.link, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div 
      className="glass-card rounded-xl overflow-hidden transition-all hover:scale-[1.02] cursor-pointer"
      onClick={handleOpenPost}
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

      {/* Post Message */}
      {post.message && (
        <div className="px-4 pb-3">
          <p className="text-sm line-clamp-3">{post.message}</p>
        </div>
      )}

      {/* Engagement Stats */}
      <div className="px-4 pb-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-gray-400" strokeWidth={2} />
            <span className="text-gray-300 font-medium">{post.reactions.toLocaleString()}</span>
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
          {post.image && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                  onClick={(e) => e.stopPropagation()}
                  title="Upload to Manus"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {MANUS_CHATS.map((chat) => (
                  <DropdownMenuItem
                    key={chat.sessionId}
                    onClick={(e) => handleUploadToManus(e, chat.name, chat.sessionId)}
                  >
                    {chat.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {post.message && (
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
        <div className="relative w-full overflow-hidden">
          <img 
            src={post.image} 
            alt="Post content"
            className="w-full h-auto object-contain"
          />
        </div>
      )}
    </div>
  );
}

