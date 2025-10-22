import { trpc } from "@/lib/trpc";
import { Trash2, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

interface FacebookPageColumnProps {
  pageId: string;
  pageName: string;
  borderColor: string;
}

export default function FacebookPageColumn({ pageId, pageName, borderColor }: FacebookPageColumnProps) {
  const utils = trpc.useUtils();
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  
  const postsQuery = trpc.cachedPosts.getByPage.useQuery({ pageId, limit: 20 });
  const deletePostMutation = trpc.publer.deletePost.useMutation({
    onSuccess: () => {
      utils.cachedPosts.getByPage.invalidate({ pageId });
      toast.success("Post deleted successfully");
      setDeletingPostId(null);
    },
    onError: (error) => {
      toast.error(`Failed to delete post: ${error.message}`);
      setDeletingPostId(null);
    },
  });

  const handleDelete = async (postId: string) => {
    if (!confirm("Are you sure you want to delete this post? This cannot be undone.")) {
      return;
    }
    
    setDeletingPostId(postId);
    await deletePostMutation.mutateAsync({ postId });
  };

  if (postsQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading posts...</p>
      </div>
    );
  }

  if (postsQuery.isError) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-red-400 text-sm">Error loading posts</p>
      </div>
    );
  }

  const posts = postsQuery.data?.posts || [];

  if (posts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">No posts found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
      {posts.map((post: any) => (
        <div
          key={post.id}
          className="glass-card p-3 rounded-lg"
          style={{ borderLeft: `4px solid ${borderColor}` }}
        >
          {/* Post Image */}
          {post.image && (
            <img
              src={post.image}
              alt="Post"
              className="w-full rounded-lg mb-2"
            />
          )}

          {/* Post Message */}
          {post.message && (
            <p className="text-sm text-white mb-2 line-clamp-3">{post.message}</p>
          )}

          {/* Post Stats */}
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              <span>{post.reactions || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              <span>{post.comments || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Repeat2 className="h-3 w-3" />
              <span>{post.shares || 0}</span>
            </div>
          </div>

          {/* Delete Button */}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDelete(post.id)}
            disabled={deletingPostId === post.id}
            className="w-full"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            {deletingPostId === post.id ? "Deleting..." : "Delete Post"}
          </Button>
        </div>
      ))}
    </div>
  );
}

