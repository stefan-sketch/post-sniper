import { MessageCircle, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";

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
}

interface RedditFeedProps {
  sort?: 'hot' | 'new' | 'top';
}

export function RedditFeed({ sort = 'hot' }: RedditFeedProps) {
  const [posts, setPosts] = useState<RedditPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [currentPermalink, setCurrentPermalink] = useState<string | null>(null);

  // Fetch comments using tRPC (server-side to avoid CORS)
  const commentsQuery = trpc.reddit.getComments.useQuery(
    { permalink: currentPermalink!, limit: 25 },
    { enabled: !!currentPermalink }
  );

  useEffect(() => {
    async function fetchRedditPosts() {
      try {
        setLoading(true);
        setError(null);

        // Fetch directly from Reddit's JSON API (client-side)
        const response = await fetch(
          `https://www.reddit.com/r/soccercirclejerk/${sort}.json?limit=25${sort === 'top' ? '&t=day' : ''}`,
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
          
          // Get the best quality image URL
          let imageUrl = null;
          
          // Try to get the highest resolution from resolutions array
          if (post.preview?.images?.[0]?.resolutions?.length > 0) {
            const resolutions = post.preview.images[0].resolutions;
            // Get the highest resolution (last in array)
            imageUrl = resolutions[resolutions.length - 1].url.replace(/&amp;/g, '&');
          } else if (post.preview?.images?.[0]?.source?.url) {
            // Use the source image from preview
            imageUrl = post.preview.images[0].source.url.replace(/&amp;/g, '&');
          } else if (post.url && (post.url.endsWith('.jpg') || post.url.endsWith('.png') || post.url.endsWith('.gif') || post.url.endsWith('.jpeg'))) {
            // Direct image link
            imageUrl = post.url;
          } else if (post.thumbnail && post.thumbnail !== 'self' && post.thumbnail !== 'default' && post.thumbnail.startsWith('http')) {
            // Fallback to thumbnail (last resort)
            imageUrl = post.thumbnail;
          }
          
          return {
            id: post.id,
            title: post.title,
            author: post.author,
            subreddit: post.subreddit,
            upvotes: post.ups,
            comments: post.num_comments,
            created: post.created_utc * 1000,
            url: post.url,
            permalink: post.permalink,
            thumbnail: imageUrl,
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
  }, [sort]);

  function toggleComments(post: RedditPost) {
    if (expandedPost === post.id) {
      // Collapse
      setExpandedPost(null);
      setCurrentPermalink(null);
    } else {
      // Expand and fetch comments
      setExpandedPost(post.id);
      setCurrentPermalink(post.permalink);
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

      <div className="space-y-3">
      {posts.map((post) => {
        const hoursAgo = Math.floor((Date.now() - post.created) / 3600000);
        const timeAgo = hoursAgo < 1 
          ? `${Math.floor((Date.now() - post.created) / 60000)}m ago`
          : hoursAgo < 24
          ? `${hoursAgo}h ago`
          : `${Math.floor(hoursAgo / 24)}d ago`;

        const isExpanded = expandedPost === post.id;
        const postComments = (isExpanded && commentsQuery.data) ? commentsQuery.data : [];
        const isLoadingComments = isExpanded && commentsQuery.isLoading;

        return (
          <div
            key={post.id}
            className="bg-gray-800/50 rounded-lg border border-gray-700 hover:border-[#FF4500] transition-all relative"
          >
            {/* Link button in top-right */}
            <a
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-gray-800/80 hover:bg-gray-700/80 text-gray-400 hover:text-white transition-all"
              title="Open on Reddit"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            
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
                  <h3 className="text-white font-semibold mb-2 line-clamp-3 pr-8">{post.title}</h3>
                  
                  {/* Image if available */}
                  {post.thumbnail && (
                    <img 
                      src={post.thumbnail} 
                      alt=""
                      className="w-full max-h-96 object-contain rounded mb-2 bg-gray-900 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setExpandedImage(post.thumbnail)}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <button
                      onClick={() => toggleComments(post)}
                      className="flex items-center gap-1 hover:text-white transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{post.comments} comments</span>
                      {isLoadingComments ? (
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
                {isLoadingComments ? (
                  <p className="text-gray-400 text-sm text-center py-2">Loading comments...</p>
                ) : commentsQuery.error ? (
                  <p className="text-red-400 text-sm text-center py-2">Failed to load comments</p>
                ) : postComments.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-2">No comments yet</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800">
                    {postComments.map((comment: RedditComment) => {
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
                          <div className="text-sm text-gray-200 whitespace-pre-wrap">
                            {/* Parse comment body for images and links */}
                            {comment.body.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
                              // Check if it's a URL
                              if (part.match(/^https?:\/\//)) {
                                // Check if it's an image URL
                                if (part.match(/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i)) {
                                  return (
                                    <img 
                                      key={i}
                                      src={part} 
                                      alt="Comment image"
                                      className="max-w-full max-h-64 rounded my-2 bg-gray-900"
                                      onError={(e) => {
                                        // If image fails to load, show link instead
                                        e.currentTarget.style.display = 'none';
                                      }}
                                    />
                                  );
                                }
                                // Regular link
                                return (
                                  <a 
                                    key={i}
                                    href={part} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-[#FF4500] hover:underline break-all"
                                  >
                                    {part}
                                  </a>
                                );
                              }
                              // Regular text
                              return <span key={i}>{part}</span>;
                            })}
                          </div>
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

