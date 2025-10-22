import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Settings, Play, Pause, Bell, TrendingUp, Loader2, RefreshCw, ArrowUp, Plus, ImagePlus, Download } from "lucide-react";
import SettingsDialog from "@/components/SettingsDialog";
import AlertsDialog from "@/components/AlertsDialog";
import PostCard from "@/components/PostCard";
import { CreatePostDialog } from "@/components/CreatePostDialog";

export default function Home() {
  // No authentication required - public access
  const utils = trpc.useUtils();
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0); // seconds until next refresh
  const [showSettings, setShowSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [droppedImage, setDroppedImage] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'live' | 'popular' | 'twitter'>('live'); // For mobile dropdown
  const [minutesSinceUpdate, setMinutesSinceUpdate] = useState(0);
  const [popularTimeFilter, setPopularTimeFilter] = useState<'2hr' | '6hr' | 'today'>('2hr');
  const [feedType, setFeedType] = useState<'popular' | 'twitter'>('popular');
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [livePageFilter, setLivePageFilter] = useState<string>('all'); // 'all' or pageId
  const [showPageFilter, setShowPageFilter] = useState(false);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [previousPostIds, setPreviousPostIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [previousReactionCounts, setPreviousReactionCounts] = useState<Map<string, number>>(new Map());
  const [previousPopularRankings, setPreviousPopularRankings] = useState<Map<string, number>>(new Map());
  const [indicatorTimestamps, setIndicatorTimestamps] = useState<Map<string, number>>(new Map());
  const [showLiveScrollTop, setShowLiveScrollTop] = useState(false);
  const [showPopularScrollTop, setShowPopularScrollTop] = useState(false);
  const [twitterPlaying, setTwitterPlaying] = useState(true); // Control Twitter API polling
  const liveScrollRef = useRef<HTMLDivElement>(null);
  const popularScrollRef = useRef<HTMLDivElement>(null);
  
  const settingsQuery = trpc.settings.get.useQuery();
  const pagesQuery = trpc.pages.list.useQuery();
  const setPlayingMutation = trpc.settings.setPlaying.useMutation();
  const manualFetchMutation = trpc.manualFetch.triggerFetch.useMutation();


  const twitterQuery = trpc.twitter.getListTweets.useQuery(
    { cursor: undefined }, 
    { 
      enabled: feedType === 'twitter' && twitterPlaying,
      refetchInterval: (feedType === 'twitter' && twitterPlaying) ? 300000 : false, // Refresh every 5 minutes when playing
      staleTime: 0,
    }
  );
  
  const handleManualFetch = async () => {
    await manualFetchMutation.mutateAsync();
    postsQuery.refetch();
    settingsQuery.refetch();
  };

  // Sync isPlaying state from database on load
  useEffect(() => {
    if (settingsQuery.data?.isPlaying !== undefined && settingsQuery.data.isPlaying !== null) {
      setIsPlaying(settingsQuery.data.isPlaying);
    }
  }, [settingsQuery.data?.isPlaying]);

  // Update database when isPlaying changes
  useEffect(() => {
    if (settingsQuery.data) {
      setPlayingMutation.mutate({ isPlaying });
    }
  }, [isPlaying]);
  // Use cached posts from server (fetched by background job)
  const postsQuery = trpc.cachedPosts.getAll.useQuery(undefined, {
    refetchInterval: 5000, // Poll every 5 seconds to get latest cached data
    staleTime: 0, // Always consider data stale to ensure fresh updates
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
  const unreadCountQuery = trpc.alerts.unreadCount.useQuery(undefined, {
    refetchInterval: 30000, // Check every 30 seconds
  });

  // No need to update lastFetchedAt - background job handles this

  // Timer countdown based on lastFetchedAt
  useEffect(() => {
    if (!isPlaying) {
      setTimer(0);
      return;
    }

    const interval = settingsQuery.data?.refreshInterval || 180; // 3 minutes = 180 seconds
    const lastFetched = settingsQuery.data?.lastFetchedAt;

    const calculateRemainingTime = () => {
      if (!lastFetched) {
        return interval; // No previous fetch, start from full interval
      }
      
      const now = Date.now();
      const lastFetchTime = new Date(lastFetched).getTime();
      const elapsed = Math.floor((now - lastFetchTime) / 1000);
      const remaining = Math.max(0, interval - elapsed);
      
      return remaining;
    };

    // Set initial timer value
    setTimer(calculateRemainingTime());

    // Update timer every second
    const countdown = setInterval(() => {
      const remaining = calculateRemainingTime();
      setTimer(remaining);
      
      // Show "Fetching Data" when timer hits 0 and for 10 seconds after
      if (remaining === 0) {
        setIsFetching(true);
        setTimeout(() => setIsFetching(false), 10000); // Show for 10 seconds
      }
    }, 1000);

    return () => clearInterval(countdown);
  }, [isPlaying, settingsQuery.data?.refreshInterval, settingsQuery.data?.lastFetchedAt]);

  // Calculate minutes since last update
  useEffect(() => {
    const updateMinutes = () => {
      const lastFetched = postsQuery.data?.lastFetchedAt;
      if (!lastFetched) {
        setMinutesSinceUpdate(0);
        return;
      }
      
      const now = Date.now();
      const lastFetchTime = new Date(lastFetched).getTime();
      const elapsed = Math.floor((now - lastFetchTime) / 1000 / 60); // minutes
      setMinutesSinceUpdate(elapsed);
    };

    updateMinutes();
    const interval = setInterval(updateMinutes, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [postsQuery.data?.lastFetchedAt]);

  const alertsListQuery = trpc.alerts.list.useQuery();
  const dismissPostMutation = trpc.settings.dismissPost.useMutation({
    onSuccess: () => {
      settingsQuery.refetch();
    },
  });
  const createAlertMutation = trpc.alerts.create.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.unreadCount.invalidate();
    },
  });

  // Process and organize posts (now from cached server data)
  const { livePosts, popularPosts } = useMemo(() => {
    if (!postsQuery.data?.posts) return { livePosts: [], popularPosts: [] };

    const now = new Date();
    
    // Calculate time threshold based on selected filter
    let timeAgo: Date;
    if (popularTimeFilter === 'today') {
      // Today since 6am UK time
      const todayAt6am = new Date();
      todayAt6am.setHours(6, 0, 0, 0);
      timeAgo = todayAt6am;
    } else {
      const timeThresholds = {
        '2hr': 2 * 60 * 60 * 1000,
        '6hr': 6 * 60 * 60 * 1000,
      };
      timeAgo = new Date(now.getTime() - timeThresholds[popularTimeFilter]);
    }

    // Convert cached posts to display format
    const allPosts = postsQuery.data.posts.map((post: any) => ({
      id: post.id,
      pageId: post.pageId,
      pageName: post.pageName,
      borderColor: post.borderColor,
      profilePicture: post.profilePicture,
      message: post.message,
      image: post.image,
      link: post.link,
      postDate: new Date(post.postDate),
      reactions: post.reactions || 0,
      previousReactions: post.previousReactions || 0,
      kpi: {
        page_posts_comments_count: { value: post.comments || 0 },
        page_posts_shares_count: { value: post.shares || 0 },
      },
      alertThreshold: post.alertThreshold,
      alertEnabled: post.alertEnabled,
    }));

    // Sort all posts by date (newest first) for live posts
    let live = [...allPosts].sort((a, b) => b.postDate.getTime() - a.postDate.getTime());
    
    // Filter by page if a specific page is selected
    if (livePageFilter !== 'all') {
      live = live.filter(post => post.pageId === livePageFilter);
    }

    // Get dismissed post IDs
    const dismissedIds = settingsQuery.data?.dismissedPosts 
      ? JSON.parse(settingsQuery.data.dismissedPosts) 
      : [];

    // Popular posts: posts from selected time period sorted by reactions (highest first), excluding dismissed
    const popular = allPosts
      .filter(post => post.postDate >= timeAgo && !dismissedIds.includes(post.id))
      .sort((a, b) => b.reactions - a.reactions);

    return { livePosts: live, popularPosts: popular };
  }, [postsQuery.data, settingsQuery.data?.dismissedPosts, popularTimeFilter, livePageFilter]);

  // Get available pages from monitored pages instead of posts
  const availablePages = useMemo(() => {
    if (!pagesQuery.data) return [];
    return pagesQuery.data.map(page => ({
      id: page.id,
      name: page.profileName
    }));
  }, [pagesQuery.data]);

  // Detect new posts for animation
  useEffect(() => {
    if (livePosts.length > 0) {
      const currentPostIds = new Set(livePosts.map(p => p.id));
      
      // Find new posts that weren't in the previous set
      const newIds = new Set<string>();
      currentPostIds.forEach(id => {
        if (!previousPostIds.has(id)) {
          newIds.add(id);
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
  }, [livePosts]);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleLiveScroll = () => {
      if (liveScrollRef.current) {
        setShowLiveScrollTop(liveScrollRef.current.scrollTop > 300);
      }
    };

    const handlePopularScroll = () => {
      if (popularScrollRef.current) {
        setShowPopularScrollTop(popularScrollRef.current.scrollTop > 300);
      }
    };

    const liveEl = liveScrollRef.current;
    const popularEl = popularScrollRef.current;

    if (liveEl) liveEl.addEventListener('scroll', handleLiveScroll);
    if (popularEl) popularEl.addEventListener('scroll', handlePopularScroll);

    return () => {
      if (liveEl) liveEl.removeEventListener('scroll', handleLiveScroll);
      if (popularEl) popularEl.removeEventListener('scroll', handlePopularScroll);
    };
  }, []);

  const scrollToTop = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Track popular posts rankings for trending indicators
  useEffect(() => {
    if (popularPosts.length > 0) {
      const currentRankings = new Map<string, number>();
      popularPosts.forEach((post, index) => {
        currentRankings.set(post.id, index + 1); // 1-indexed ranking
      });
      
      // Only update if we have previous rankings to compare
      if (previousPopularRankings.size > 0) {
        // Check if rankings actually changed
        let hasChanges = false;
        currentRankings.forEach((rank, id) => {
          if (previousPopularRankings.get(id) !== rank) {
            hasChanges = true;
          }
        });
        // Don't update previous rankings - keep showing changes permanently
        // if (hasChanges) {
        //   setPreviousPopularRankings(currentRankings);
        // }
      } else {
        // First load, just store rankings without showing changes
        setPreviousPopularRankings(currentRankings);
      }
    }
  }, [popularPosts]);

  // Track reaction count changes for all posts
  useEffect(() => {
    if (postsQuery.data?.posts && postsQuery.data.posts.length > 0) {
      const currentReactions = new Map<string, number>();
      postsQuery.data.posts.forEach((post: any) => {
        currentReactions.set(post.id, post.reactions || 0);
      });
      
      // Only update previous counts if they're different (data actually changed)
      if (previousReactionCounts.size > 0) {
        // Check if any values actually changed
        let hasChanges = false;
        currentReactions.forEach((count, id) => {
          if (previousReactionCounts.get(id) !== count) {
            hasChanges = true;
          }
        });
        // Store timestamps for new changes
        if (hasChanges) {
          const newTimestamps = new Map(indicatorTimestamps);
          currentReactions.forEach((count, id) => {
            if (previousReactionCounts.get(id) !== count && !indicatorTimestamps.has(id)) {
              newTimestamps.set(id, Date.now());
            }
          });
          setIndicatorTimestamps(newTimestamps);
        }
      } else {
        // First load, just store counts without showing changes
        setPreviousReactionCounts(currentReactions);
      }
    }
  }, [postsQuery.data?.posts]);

  // No authentication required - removed loading and login screens

  // API status based on postsQuery success/error
  const apiStatus = postsQuery.isError ? "error" : postsQuery.isSuccess ? "success" : "unknown";

  return (
    <div className="h-screen w-full md:w-[770px] md:mx-auto px-4 md:px-6 py-4 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="mb-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left: API Status */}
          <div className="flex items-center gap-1.5 text-xs">
            {settingsQuery.data?.lastAPIStatus === "success" ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-green-400 font-medium">Online</span>
              </>
            ) : (
              <>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                <span className="text-red-400 font-medium">Offline</span>
              </>
            )}
          </div>

          {/* Center: Settings + SDL MEDIA + Create Post button */}
          <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="relative h-8 w-8 md:h-10 md:w-10 flex-shrink-0"
            >
              <Settings className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-wider" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              SDL MEDIA
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDroppedImage(null);
                setShowCreatePost(true);
              }}
              className="relative h-8 w-8 md:h-10 md:w-10 flex-shrink-0"
            >
              <Plus className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>

          {/* Right: Notifications + Drag-drop icon */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAlerts(true)}
              className="relative h-8 w-8 md:h-10 md:w-10 flex-shrink-0"
            >
              <Bell className="h-4 w-4 md:h-5 md:w-5" />
              {(unreadCountQuery.data || 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCountQuery.data}
                </span>
              )}
            </Button>
            <div
              onDrop={async (e) => {
                e.preventDefault();
                
                // Try to get file first (from desktop)
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                  const reader = new FileReader();
                  reader.onload = () => {
                    setDroppedImage(reader.result as string);
                    setShowCreatePost(true);
                  };
                  reader.readAsDataURL(file);
                  return;
                }
                
                // Try to get URL (from within app)
                const url = e.dataTransfer.getData('text/uri-list');
                if (url) {
                  try {
                    // Fetch the image and convert to base64
                    const response = await fetch(url);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    reader.onload = () => {
                      setDroppedImage(reader.result as string);
                      setShowCreatePost(true);
                    };
                    reader.readAsDataURL(blob);
                  } catch (error) {
                    console.error('Failed to load image:', error);
                  }
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              className="h-8 w-8 md:h-10 md:w-10 flex items-center justify-center border-2 border-dashed border-gray-600 rounded-lg hover:border-cyan-500 transition-colors cursor-pointer group"
              title="Drag & drop image here"
            >
              <ImagePlus className="h-4 w-4 md:h-5 md:w-5 text-gray-500 group-hover:text-cyan-500 transition-colors" />
            </div>
          </div>
        </div>
      </header>

      {/* Mobile View Selector - Only visible on mobile */}
      <div className="md:hidden mb-4 glass-card p-1 rounded-xl flex gap-1 flex-shrink-0">
        <button
          onClick={() => setMobileView('live')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
            mobileView === 'live' 
              ? 'bg-primary text-primary-foreground' 
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          🔴 Live
        </button>
        <button
          onClick={() => setMobileView('popular')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all relative ${
            mobileView === 'popular' 
              ? 'bg-green-500 text-white' 
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          📈 Popular
          {mobileView === 'popular' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400 animate-pulse"></span>
          )}
        </button>
        <button
          onClick={() => setMobileView('twitter')}
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all relative ${
            mobileView === 'twitter' 
              ? 'bg-blue-500 text-white' 
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          𝕏 Twitter
          {mobileView === 'twitter' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 animate-pulse"></span>
          )}
        </button>
      </div>

      {/* Desktop: Two Column Layout */}
      <div className="hidden md:grid grid-cols-2 gap-6 flex-1 overflow-hidden">
        {/* Live Posts Column */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-center gap-3 mb-3">
            <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Posts
            </h2>
            <div className="relative">
              <button
                onClick={() => setShowPageFilter(!showPageFilter)}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all bg-primary hover:bg-primary/80 text-black shadow-lg shadow-primary/50 flex items-center gap-1"
              >
                {livePageFilter === 'all' ? 'All' : availablePages.find(p => p.id === livePageFilter)?.name || 'All'}
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPageFilter && (
                <div className="absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[120px]">
                  <button
                    onClick={() => {
                      setLivePageFilter('all');
                      setShowPageFilter(false);
                    }}
                    className={`w-full px-3 py-2 text-xs font-medium text-left hover:bg-white/10 transition-colors first:rounded-t-lg ${livePageFilter === 'all' ? 'text-primary' : 'text-white/60'}`}
                  >
                    All
                  </button>
                  {availablePages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => {
                        setLivePageFilter(page.id);
                        setShowPageFilter(false);
                      }}
                      className={`w-full px-3 py-2 text-xs font-medium text-left hover:bg-white/10 transition-colors last:rounded-b-lg ${livePageFilter === page.id ? 'text-primary' : 'text-white/60'}`}
                    >
                      {page.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Printer line - thin red line where new posts emerge from */}
          <div className="relative h-0.5 bg-red-500/30 mb-3 overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
          </div>
          <div ref={liveScrollRef} className="space-y-3 relative overflow-y-auto flex-1 pr-2 hide-scrollbar">
            {postsQuery.isLoading && (
              <div className="glass-card p-6 rounded-xl text-center">
                <p className="text-muted-foreground">Loading posts...</p>
              </div>
            )}
            {!postsQuery.isLoading && livePosts.length === 0 && (
              <div className="glass-card p-6 rounded-xl text-center">
                <p className="text-muted-foreground">No posts yet. Configure pages in Settings.</p>
              </div>
            )}
            {livePosts.map((post) => {
              const isNew = newPostIds.has(post.id);
              const reactionIncrease = post.previousReactions && post.reactions > post.previousReactions 
                ? post.reactions - post.previousReactions 
                : undefined;
              const indicatorAge = indicatorTimestamps.get(post.id) ? Date.now() - indicatorTimestamps.get(post.id)! : 0;
              
              return (
                <div
                  key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}`}
                  className={isNew ? 'animate-slideIn' : ''}
                  style={{
                    animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                  }}
                >
                  <PostCard post={post} reactionIncrease={reactionIncrease} />
                </div>
              );
            })}
            {showLiveScrollTop && (
              <button
                onClick={() => scrollToTop(liveScrollRef)}
                className="fixed bottom-6 left-1/4 p-3 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/50 transition-all z-50"
                aria-label="Scroll to top"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>

        {/* Popular Posts Column */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-center gap-3 mb-3">
            <TrendingUp className="h-5 w-5 text-green-400 animate-pulse" />
            {/* Toggle Switch - Smaller */}
            <button
              onClick={() => setFeedType(feedType === 'popular' ? 'twitter' : 'popular')}
              className="relative inline-flex h-7 w-24 items-center rounded-full bg-gray-700 transition-all hover:bg-gray-600"
            >
              <span
                className={`inline-block h-6 w-12 transform rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg transition-transform ${
                  feedType === 'twitter' ? 'translate-x-[45px]' : 'translate-x-0.5'
                }`}
              />
              <span className="absolute left-2 flex items-center text-white pointer-events-none">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </span>
              <span className="absolute right-2 flex items-center text-white pointer-events-none">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </span>
            </button>
            
            {/* Conditional Button: Time Filter (Popular) or Play/Pause (Twitter) */}
            {feedType === 'twitter' ? (
              <button
                onClick={() => setTwitterPlaying(!twitterPlaying)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  twitterPlaying
                    ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                    : 'bg-gray-600 hover:bg-gray-500 text-white shadow-lg'
                }`}
                title={twitterPlaying ? 'Pause Twitter updates' : 'Resume Twitter updates'}
              >
                {twitterPlaying ? (
                  <>
                    <Pause className="h-3 w-3" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    <span>Play</span>
                  </>
                )}
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowTimeFilter(!showTimeFilter)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/50"
                >
                  {popularTimeFilter === 'today' ? 'Today' : popularTimeFilter}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTimeFilter && (
                  <div className="absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[80px]">
                    {(['2hr', '6hr', 'today'] as const).map((time) => (
                      <button
                        key={time}
                        onClick={() => {
                          setPopularTimeFilter(time);
                          setShowTimeFilter(false);
                        }}
                        className={`w-full px-3 py-2 text-xs font-medium text-left hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                          popularTimeFilter === time ? 'text-secondary' : 'text-white/60'
                        }`}
                      >
                        {time === 'today' ? 'Today' : time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Green separator line */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent mb-3 flex-shrink-0"></div>
          
          <div ref={popularScrollRef} className="space-y-3 overflow-y-auto flex-1 pr-2 hide-scrollbar relative">
            {feedType === 'popular' ? (
              <>
                {postsQuery.isLoading && (
                  <div className="glass-card p-6 rounded-xl text-center">
                    <p className="text-muted-foreground">Loading posts...</p>
                  </div>
                )}
                {!postsQuery.isLoading && popularPosts.length === 0 && (
                  <div className="glass-card p-6 rounded-xl text-center">
                    <p className="text-muted-foreground">No popular posts in the last {popularTimeFilter}.</p>
                  </div>
                )}
                {popularPosts.map((post, index) => {
                  const currentRank = index + 1;
                  const previousRank = previousPopularRankings.get(post.id);
                  const rankingChange = previousRank ? previousRank - currentRank : undefined;
                  const reactionIncrease = post.previousReactions && post.reactions > post.previousReactions 
                    ? post.reactions - post.previousReactions 
                    : undefined;
                  const indicatorAge = indicatorTimestamps.get(post.id) ? Date.now() - indicatorTimestamps.get(post.id)! : 0;
                  
                  return (
                    <PostCard 
                      key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}-popular`} 
                      post={post} 
                      reactionIncrease={reactionIncrease}
                    />
                  );
                })}
              </>
            ) : (
              <>
                {twitterQuery.isLoading && (
                  <div className="glass-card p-6 rounded-xl text-center">
                    <p className="text-muted-foreground">Loading tweets...</p>
                  </div>
                )}
                {!twitterQuery.isLoading && (!twitterQuery.data?.tweets || twitterQuery.data.tweets.length === 0) && (
                  <div className="glass-card p-6 rounded-xl text-center">
                    <p className="text-muted-foreground">{twitterPlaying ? 'No tweets found in your list.' : 'Twitter updates paused. Click play to resume.'}</p>
                  </div>
                )}
                {twitterQuery.data?.tweets?.filter((tweet: any) => tweet.image).map((tweet: any) => {
                  // Format timestamp using the same logic as PostCard
                  const getTimeAgo = (dateString: string): string => {
                    const date = new Date(dateString);
                    const now = new Date();
                    const diffMs = now.getTime() - date.getTime();
                    const diffMins = Math.floor(diffMs / 60000);
                    
                    if (diffMins < 1) return 'just now';
                    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
                    
                    const diffHours = diffMins / 60;
                    const roundedHours = Math.round(diffHours);
                    
                    if (roundedHours < 24) {
                      return `${roundedHours} hour${roundedHours === 1 ? '' : 's'} ago`;
                    }
                    
                    const diffDays = Math.round(diffHours / 24);
                    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
                  };
                  
                  const timeAgo = tweet.createdAt ? getTimeAgo(tweet.createdAt) : '';
                  // Remove t.co URLs from tweet text
                  const cleanText = tweet.text ? tweet.text.replace(/https:\/\/t\.co\/\S+/g, '').trim() : '';
                  
                  const handleDownload = async (imageUrl: string) => {
                    try {
                      const response = await fetch(imageUrl);
                      const blob = await response.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `tweet-${tweet.id}.jpg`;
                      document.body.appendChild(a);
                      a.click();
                      window.URL.revokeObjectURL(url);
                      document.body.removeChild(a);
                    } catch (error) {
                      console.error('Download failed:', error);
                    }
                  };
                  
                  return (
                  <div key={tweet.id} className="glass-card rounded-xl overflow-hidden hover:bg-white/5 transition-colors">
                    {/* Profile Header */}
                    <div className="p-4 flex items-center gap-3">
                      <img src={tweet.author.avatar} alt={tweet.author.name} className="w-10 h-10 rounded-full flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{tweet.author.name}</span>
                          <span className="text-gray-500 text-sm">@{tweet.author.username}</span>
                        </div>
                        {timeAgo && <p className="text-xs text-gray-500">{timeAgo}</p>}
                      </div>
                    </div>
                    
                    {/* Tweet Text */}
                    {cleanText && (
                      <div className="px-4 pb-3">
                        <p className="text-sm text-white/90">{cleanText}</p>
                      </div>
                    )}
                    
                    {/* Tweet Image */}
                    <div className="relative w-full overflow-hidden group">
                      <img 
                        src={tweet.image} 
                        alt="Tweet image" 
                        className="w-full h-auto object-contain"
                        draggable="true"
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/uri-list', tweet.image);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                      />
                      <button
                        onClick={() => handleDownload(tweet.image)}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Download image"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                    
                    {/* Engagement Stats */}
                    <div className="px-4 py-3 flex items-center gap-4 text-sm text-gray-500">
                      <span>❤️ {tweet.engagement.likes.toLocaleString()}</span>
                      <span>🔁 {tweet.engagement.retweets.toLocaleString()}</span>
                      <span>💬 {tweet.engagement.replies.toLocaleString()}</span>
                      {tweet.engagement.views > 0 && <span>👁️ {tweet.engagement.views.toLocaleString()}</span>}
                    </div>
                  </div>
                  );
                })}
              </>
            )}
            {showPopularScrollTop && (
              <button
                onClick={() => scrollToTop(popularScrollRef)}
                className="fixed bottom-6 right-6 p-3 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/50 transition-all z-50"
                aria-label="Scroll to top"
              >
                <ArrowUp className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Single Column with Switchable View */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden">
        {mobileView === 'live' ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-center gap-3 mb-3">
              <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                Live Posts
              </h2>
              <div className="relative">
                <button
                  onClick={() => setShowPageFilter(!showPageFilter)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all bg-primary hover:bg-primary/80 text-black shadow-lg shadow-primary/50 flex items-center gap-1"
                >
                  {livePageFilter === 'all' ? 'All' : availablePages.find(p => p.id === livePageFilter)?.name || 'All'}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPageFilter && (
                  <div className="absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[120px]">
                    <button
                      onClick={() => {
                        setLivePageFilter('all');
                        setShowPageFilter(false);
                      }}
                      className={`w-full px-3 py-2 text-xs font-medium text-left hover:bg-white/10 transition-colors first:rounded-t-lg ${livePageFilter === 'all' ? 'text-primary' : 'text-white/60'}`}
                    >
                      All
                    </button>
                    {availablePages.map((page) => (
                      <button
                        key={page.id}
                        onClick={() => {
                          setLivePageFilter(page.id);
                          setShowPageFilter(false);
                        }}
                        className={`w-full px-3 py-2 text-xs font-medium text-left hover:bg-white/10 transition-colors last:rounded-b-lg ${livePageFilter === page.id ? 'text-primary' : 'text-white/60'}`}
                      >
                        {page.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Printer line - thin red line where new posts emerge from */}
            <div className="relative h-0.5 bg-red-500/30 mb-3 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
            </div>
            <div className="space-y-3 relative overflow-y-auto flex-1 hide-scrollbar">
              {postsQuery.isLoading && (
                <div className="glass-card p-6 rounded-xl text-center">
                  <p className="text-muted-foreground">Loading posts...</p>
                </div>
              )}
              {!postsQuery.isLoading && livePosts.length === 0 && (
                <div className="glass-card p-6 rounded-xl text-center">
                  <p className="text-muted-foreground">No posts yet. Configure pages in Settings.</p>
                </div>
              )}
              {livePosts.map((post) => {
                const isNew = newPostIds.has(post.id);
                const reactionIncrease = post.previousReactions && post.reactions > post.previousReactions 
                  ? post.reactions - post.previousReactions 
                  : undefined;
                
                return (
                  <div
                    key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}-mobile`}
                    className={isNew ? 'animate-slideIn' : ''}
                    style={{
                      animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                    }}
                  >
                    <PostCard post={post} reactionIncrease={reactionIncrease} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : mobileView === 'popular' ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex flex-col items-center mb-3 flex-shrink-0">
              <div className="flex items-center justify-center gap-3 mb-2">
                <TrendingUp className="h-5 w-5 text-green-400 animate-pulse" />
                <h2 className="text-lg font-semibold text-green-400">
                  Popular Posts
                </h2>
                <div className="relative">
                <button
                  onClick={() => setShowTimeFilter(!showTimeFilter)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all bg-green-500 hover:bg-green-600 text-white shadow-lg shadow-green-500/50 flex items-center gap-1"
                >
                  {popularTimeFilter === 'today' ? 'Today' : popularTimeFilter}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTimeFilter && (
                  <div className="absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[80px]">
                    {(['2hr', '6hr', 'today'] as const).map((time) => (
                      <button
                        key={time}
                        onClick={() => {
                          setPopularTimeFilter(time);
                          setShowTimeFilter(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                          popularTimeFilter === time ? 'bg-green-500/20 text-green-400' : 'text-white'
                        }`}
                      >
                        {time === 'today' ? 'Today' : time}
                      </button>
                    ))}
                  </div>
                )}
                </div>
              </div>
              {/* Green pulsing underline */}
              <div className="w-full h-0.5 bg-green-500 animate-pulse"></div>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 hide-scrollbar">
              {postsQuery.isLoading && (
                <div className="glass-card p-6 rounded-xl text-center">
                  <p className="text-muted-foreground">Loading posts...</p>
                </div>
              )}
              {!postsQuery.isLoading && popularPosts.length === 0 && (
                <div className="glass-card p-6 rounded-xl text-center">
                  <p className="text-muted-foreground">No popular posts in the last 6 hours.</p>
                </div>
              )}
              {popularPosts.map((post, index) => {
                const currentRank = index + 1;
                const previousRank = previousPopularRankings.get(post.id);
                const rankingChange = previousRank ? previousRank - currentRank : undefined;
                const reactionIncrease = post.previousReactions && post.reactions > post.previousReactions 
                  ? post.reactions - post.previousReactions 
                  : undefined;
                
                return (
                  <PostCard 
                    key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}-mobile-popular`} 
                    post={post} 
                    reactionIncrease={reactionIncrease}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex flex-col items-center mb-3 flex-shrink-0">
              <div className="flex items-center justify-center gap-3 mb-2">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <h2 className="text-lg font-semibold text-blue-400">
                  Twitter Feed
                </h2>
                <button
                  onClick={() => setTwitterPlaying(!twitterPlaying)}
                  className={`p-1.5 rounded-full transition-all ${
                    twitterPlaying
                      ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-500/50'
                      : 'bg-gray-600 hover:bg-gray-500 text-white shadow-lg'
                  }`}
                  title={twitterPlaying ? 'Pause Twitter updates' : 'Resume Twitter updates'}
                >
                  {twitterPlaying ? (
                    <Pause className="h-3 w-3" />
                  ) : (
                    <Play className="h-3 w-3" />
                  )}
                </button>
              </div>
              {/* Blue pulsing underline */}
              <div className="w-full h-0.5 bg-blue-500 animate-pulse"></div>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 hide-scrollbar">
              {twitterQuery.isLoading && (
                <div className="glass-card p-6 rounded-xl text-center">
                  <p className="text-muted-foreground">Loading tweets...</p>
                </div>
              )}
              {!twitterQuery.isLoading && (!twitterQuery.data?.tweets || twitterQuery.data.tweets.length === 0) && (
                <div className="glass-card p-6 rounded-xl text-center">
                  <p className="text-muted-foreground">{twitterPlaying ? 'No tweets found in your list.' : 'Twitter updates paused. Click play to resume.'}</p>
                </div>
              )}
              {twitterQuery.data?.tweets?.filter((tweet: any) => tweet.image).map((tweet: any) => {
                const getTimeAgo = (dateString: string): string => {
                  const date = new Date(dateString);
                  const now = new Date();
                  const diffMs = now.getTime() - date.getTime();
                  const diffMins = Math.floor(diffMs / 60000);
                  
                  if (diffMins < 1) return 'just now';
                  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
                  
                  const diffHours = diffMins / 60;
                  const roundedHours = Math.round(diffHours);
                  
                  if (roundedHours < 24) {
                    return `${roundedHours} hour${roundedHours === 1 ? '' : 's'} ago`;
                  }
                  
                  const diffDays = Math.round(diffHours / 24);
                  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
                };
                
                const timeAgo = tweet.createdAt ? getTimeAgo(tweet.createdAt) : '';
                // Remove t.co URLs from tweet text
                const cleanText = tweet.text ? tweet.text.replace(/https:\/\/t\.co\/\S+/g, '').trim() : '';
                
                const handleDownload = async (imageUrl: string) => {
                  try {
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `tweet-${tweet.id}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                  } catch (error) {
                    console.error('Download failed:', error);
                  }
                };
                
                return (
                <div key={tweet.id} className="glass-card rounded-xl overflow-hidden hover:bg-white/5 transition-colors">
                  {/* Profile Header */}
                  <div className="p-4 flex items-center gap-3">
                    <img src={tweet.author.avatar} alt={tweet.author.name} className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{tweet.author.name}</span>
                        <span className="text-gray-500 text-sm">@{tweet.author.username}</span>
                      </div>
                      {timeAgo && <p className="text-xs text-gray-500">{timeAgo}</p>}
                    </div>
                  </div>
                  
                  {/* Tweet Text */}
                  {cleanText && (
                    <div className="px-4 pb-3">
                      <p className="text-sm text-white/90">{cleanText}</p>
                    </div>
                  )}
                  
                  {/* Tweet Image */}
                  <div className="relative w-full overflow-hidden group">
                    <img 
                      src={tweet.image} 
                      alt="Tweet image" 
                      className="w-full h-auto object-contain"
                      draggable="true"
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/uri-list', tweet.image);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                    />
                    <button
                      onClick={() => handleDownload(tweet.image)}
                      className="absolute top-2 right-2 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Download image"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Engagement Stats */}
                  <div className="px-4 py-3 flex items-center gap-4 text-sm text-gray-500">
                    <span>❤️ {tweet.engagement.likes.toLocaleString()}</span>
                    <span>🔁 {tweet.engagement.retweets.toLocaleString()}</span>
                    <span>💬 {tweet.engagement.replies.toLocaleString()}</span>
                    {tweet.engagement.views > 0 && <span>👁️ {tweet.engagement.views.toLocaleString()}</span>}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <SettingsDialog 
        open={showSettings} 
        onOpenChange={setShowSettings}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onManualFetch={handleManualFetch}
        isFetching={manualFetchMutation.isPending}
      />
      <AlertsDialog open={showAlerts} onOpenChange={setShowAlerts} />
      <CreatePostDialog 
        open={showCreatePost} 
        onOpenChange={(open) => {
          setShowCreatePost(open);
          if (!open) setDroppedImage(null); // Clear dropped image when dialog closes
        }}
        initialImage={droppedImage}
      />
    </div>
  );
}

