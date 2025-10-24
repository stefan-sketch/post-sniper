import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";

interface RedditPost {
  id: string;
  title: string;
  author: string;
  subreddit: string;
  upvotes: number;
  comments: number;
  created: number;
  url: string;
  permalink: string;
  thumbnail: string | null;
  isVideo: boolean;
}

export function RedditFeed() {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRedditPosts() {
      try {
        setLoading(true);
        setError(null);

        // Fetch directly from Reddit's JSON API (client-side)
        const response = await fetch(
          'https://www.reddit.com/r/soccercirclejerk/hot.json?limit=25',
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Reddit API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Transform Reddit data
        const redditPosts: RedditPost[] = data.data.children.map((child: any) => {
          const post = child.data;
          return {
            id: post.id,
            title: post.title,
            author: post.author,
            subreddit: post.subreddit,
            upvotes: post.ups,
            comments: post.num_comments,
            created: post.created_utc * 1000,
            url: post.url,
            permalink: `https://www.reddit.com${post.permalink}`,
            thumbnail: post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default' 
              ? post.thumbnail 
              : null,
            isVideo: post.is_video || false,
          };
        });

        setPosts(redditPosts);
      } catch (err) {
        console.error('Error fetching Reddit posts:', err);
        setError('Failed to load Reddit posts');
      } finally {
        setLoading(false);
      }
    }

    fetchRedditPosts();
  }, []);

  if (loading) {
    return (
      <div className="glass-card p-6 rounded-xl text-center">
        <p className="text-muted-foreground">Loading r/soccercirclejerk...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-6 rounded-xl text-center">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="glass-card p-6 rounded-xl text-center">
        <p className="text-muted-foreground">No posts found</p>
      </div>
    );
  }

  return (
    <>
      {/* Reddit loading indicator */}
      <div className="sticky top-0 z-10 relative h-0.5 bg-[#FF4500]/30 mb-3 overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FF4500] to-transparent animate-pulse"></div>
      </div>

      {posts.map((post) => {
        const hoursAgo = Math.floor((Date.now() - post.created) / 3600000);
        const timeAgo = hoursAgo < 1 
          ? `${Math.floor((Date.now() - post.created) / 60000)}m ago`
          : hoursAgo < 24
          ? `${hoursAgo}h ago`
          : `${Math.floor(hoursAgo / 24)}d ago`;

        return (
          <a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-[#FF4500] transition-all"
          >
            <div className="flex gap-3">
              {/* Upvote section */}
              <div className="flex flex-col items-center gap-1 text-xs flex-shrink-0">
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 4l8 8h-6v8h-4v-8H4z"/>
                </svg>
                <span className="font-bold text-[#FF4500]">{post.upvotes.toLocaleString()}</span>
                <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 20l-8-8h6V4h4v8h6z"/>
                </svg>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 flex-wrap">
                  <span className="font-semibold text-[#FF4500]">r/{post.subreddit}</span>
                  <span>•</span>
                  <span className="truncate">u/{post.author}</span>
                  <span>•</span>
                  <span>{timeAgo}</span>
                </div>
                <h3 className="text-white font-semibold mb-2 line-clamp-3">{post.title}</h3>
                
                {/* Thumbnail if available */}
                {post.thumbnail && (
                  <img 
                    src={post.thumbnail} 
                    alt=""
                    className="w-full h-32 object-cover rounded mb-2"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    <span>{post.comments} comments</span>
                  </div>
                  {post.isVideo && (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      Video
                    </span>
                  )}
                </div>
              </div>
            </div>
          </a>
        );
      })}
    </>
  );
}

