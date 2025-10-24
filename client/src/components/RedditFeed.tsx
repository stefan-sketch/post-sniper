import { MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
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

interface RedditComment {
  id: string;
  author: string;
  body: string;
  score: number;
  created: number;
  replies?: RedditComment[];
}

export function RedditFeed() {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, RedditComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<string | null>(null);

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

  async function fetchComments(post: RedditPost) {
    if (expandedPost === post.id) {
      // Collapse if already expanded
      setExpandedPost(null);
      return;
    }

    // If comments already loaded, just expand
    if (comments[post.id]) {
      setExpandedPost(post.id);
      return;
    }

    // Fetch comments
    try {
      setLoadingComments(post.id);
      const response = await fetch(
        `https://www.reddit.com${post.permalink}.json?limit=10`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      
      // Reddit returns [post, comments] array
      const commentsData = data[1]?.data?.children || [];
      
      const parsedComments: RedditComment[] = commentsData
        .filter((child: any) => child.kind === 't1') // Filter out "more" objects
        .map((child: any) => {
          const comment = child.data;
          return {
            id: comment.id,
            author: comment.author,
            body: comment.body,
            score: comment.score,
            created: comment.created_utc * 1000,
          };
        });

      setComments(prev => ({ ...prev, [post.id]: parsedComments }));
      setExpandedPost(post.id);
    } catch (err) {
      console.error('Error fetching comments:', err);
    } finally {
      setLoadingComments(null);
    }
  }

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

        const isExpanded = expandedPost === post.id;
        const postComments = comments[post.id] || [];

        return (
          <div
            key={post.id}
            className="bg-gray-800/50 rounded-lg border border-gray-700 hover:border-[#FF4500] transition-all"
          >
            <div className="p-4">
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
                  <a 
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
                  >
                    <h3 className="text-white font-semibold mb-2 line-clamp-3 hover:text-[#FF4500] transition-colors">{post.title}</h3>
                  </a>
                  
                  {/* Image if available */}
                  {post.thumbnail && (
                    <img 
                      src={post.thumbnail} 
                      alt=""
                      className="w-full max-h-96 object-contain rounded mb-2 bg-gray-900"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fetchComments(post);
                      }}
                      className="comments-button flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments} comments</span>
                      {loadingComments === post.id ? (
                        <div className="w-3 h-3 border-2 border-gray-400 border-t-white rounded-full animate-spin ml-1" />
                      ) : isExpanded ? (
                        <ChevronUp className="w-3 h-3 ml-1" />
                      ) : (
                        <ChevronDown className="w-3 h-3 ml-1" />
                      )}
                    </button>
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
            </div>

            {/* Comments Section */}
            {isExpanded && (
              <div className="border-t border-gray-700 p-4 bg-gray-900/30">
                {postComments.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-2">No comments yet</p>
                ) : (
                  <div className="space-y-3">
                    {postComments.map((comment) => {
                      const commentTime = Math.floor((Date.now() - comment.created) / 3600000);
                      const commentTimeAgo = commentTime < 1 
                        ? `${Math.floor((Date.now() - comment.created) / 60000)}m ago`
                        : commentTime < 24
                        ? `${commentTime}h ago`
                        : `${Math.floor(commentTime / 24)}d ago`;

                      return (
                        <div key={comment.id} className="border-l-2 border-[#FF4500] pl-3">
                          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                            <span className="font-semibold text-white">u/{comment.author}</span>
                            <span>•</span>
                            <span>{comment.score} points</span>
                            <span>•</span>
                            <span>{commentTimeAgo}</span>
                          </div>
                          <p className="text-sm text-gray-200 whitespace-pre-wrap">{comment.body}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

