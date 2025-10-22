import { trpc } from "@/lib/trpc";
import PostCard from "@/components/PostCard";

interface FacebookPageColumnProps {
  pageId: string;
  pageName: string;
  borderColor: string;
}

export default function FacebookPageColumn({ pageId, pageName, borderColor }: FacebookPageColumnProps) {
  const postsQuery = trpc.cachedPosts.getByPage.useQuery({ pageId, limit: 20 });

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
  const pageConfig = postsQuery.data?.pageConfig;

  if (posts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-400 text-sm">No posts found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden space-y-3 pr-2 scrollbar-hide max-w-full">
      {posts.map((post: any) => (
        <PostCard
          key={post.id}
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
          hidePageHeader={true}
        />
      ))}
    </div>
  );
}

