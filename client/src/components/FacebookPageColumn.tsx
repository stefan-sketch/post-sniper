import { trpc } from "@/lib/trpc";
import PostCard from "@/components/PostCard";
import { useState, useEffect } from "react";

interface FacebookPageColumnProps {
  pageId: string;
  pageName: string;
  borderColor: string;
  hidePageHeader?: boolean;
}

export default function FacebookPageColumn({ pageId, pageName, borderColor, hidePageHeader = false }: FacebookPageColumnProps) {
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [previousPostIds, setPreviousPostIds] = useState<Set<string>>(new Set());
  const postsQuery = trpc.cachedPosts.getByPage.useQuery(
    { pageId, limit: 20 },
    {
      refetchInterval: 10000, // Poll every 10 seconds to sync with background job
      staleTime: 5000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
    }
  );

  const posts = postsQuery.data?.posts || [];
  const pageConfig = postsQuery.data?.pageConfig;

  // Detect new posts for animation - only animate genuinely new posts (within last 30 seconds)
  useEffect(() => {
    if (posts.length > 0) {
      const currentPostIds = new Set(posts.map((p: any) => p.id));
      const now = Date.now();
      
      // Find posts that are both: 1) not in previous set, AND 2) posted within last 30 seconds
      const newIds = new Set<string>();
      posts.forEach((post: any) => {
        const postAge = now - new Date(post.postDate).getTime();
        const isRecentPost = postAge < 30000; // 30 seconds
        
        if (!previousPostIds.has(post.id) && isRecentPost) {
          newIds.add(post.id);
        }
      });
      
      if (newIds.size > 0) {
        setNewPostIds(newIds);
        // Remove animation after 2 seconds
        setTimeout(() => {
          setNewPostIds(new Set());
        }, 2000);
      }
      
      setPreviousPostIds(currentPostIds);
    }
  }, [posts]);

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

  if (posts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">No posts found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 scrollbar-hide max-w-full" style={{ touchAction: 'pan-y' }}>
      {posts.map((post: any) => {
        const isNew = newPostIds.has(post.id);
        
        return (
        <div
          key={post.id}
          className={isNew ? 'animate-slideIn' : ''}
          style={{
            animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
          }}
        >
          <PostCard
          post={{
            id: post.id,
            pageId: post.pageId,
            pageName: pageConfig?.name || pageName,
            borderColor: pageConfig?.borderColor || borderColor,
            profilePicture: pageConfig?.profilePicture || undefined,
            message: post.message,
            image: post.image,
            link: post.link,
            postDate: new Date(post.postDate),
            reactions: post.reactions || 0,
            kpi: {
              page_posts_comments_count: { value: post.comments || 0 },
              page_posts_shares_count: { value: post.shares || 0 },
            },
          }}
          showDismiss={false}
          hideActions={true}
          hidePageHeader={hidePageHeader}
        />
        </div>
        );
      })}
    </div>
  );
}

