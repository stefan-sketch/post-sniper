import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Settings, Play, Pause, Bell, TrendingUp, Loader2, RefreshCw } from "lucide-react";
import SettingsDialog from "@/components/SettingsDialog";
import AlertsDialog from "@/components/AlertsDialog";
import PostCard from "@/components/PostCard";

export default function Home() {
  // No authentication required - public access
  const utils = trpc.useUtils();
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0); // seconds until next refresh
  const [showSettings, setShowSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [mobileView, setMobileView] = useState<'live' | 'popular'>('live'); // For mobile dropdown
  const [minutesSinceUpdate, setMinutesSinceUpdate] = useState(0);
  const [popularTimeFilter, setPopularTimeFilter] = useState<'2hr' | '6hr' | 'today'>('2hr');
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [livePageFilter, setLivePageFilter] = useState<string>('all'); // 'all' or pageId
  const [showPageFilter, setShowPageFilter] = useState(false);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [previousPostIds, setPreviousPostIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [previousReactionCounts, setPreviousReactionCounts] = useState<Map<string, number>>(new Map());
  const [previousPopularRankings, setPreviousPopularRankings] = useState<Map<string, number>>(new Map());
  const [indicatorTimestamps, setIndicatorTimestamps] = useState<Map<string, number>>(new Map());
  
  const settingsQuery = trpc.settings.get.useQuery();
  const pagesQuery = trpc.pages.list.useQuery();
  const setPlayingMutation = trpc.settings.setPlaying.useMutation();
  const manualFetchMutation = trpc.manualFetch.triggerFetch.useMutation();
  
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
      <header className="glass-card p-2 md:p-3 mb-4 rounded-xl flex-shrink-0">
        <div className="flex items-center justify-between gap-2 md:gap-4">
          {/* Spacer for balance */}
          <div className="w-8 md:w-10 flex-shrink-0"></div>

          {/* Centered group: API indicator + SDL MEDIA + Bell */}
          <div className="flex-1 flex items-center justify-center gap-2">
            {/* API Status Indicator - Before SDL */}
            <div className="relative flex h-3 w-3 flex-shrink-0" title={settingsQuery.data?.lastAPIStatus === "success" ? "API Status: OK" : "API Status: Error"}>
              {settingsQuery.data?.lastAPIStatus === "success" ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              )}
            </div>

            <h1 className="text-xl md:text-2xl font-bold text-white tracking-wider" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              SDL MEDIA
            </h1>

            {/* Alerts Icon - After MEDIA */}
            <div
              onClick={() => setShowAlerts(true)}
              className="relative cursor-pointer flex-shrink-0"
            >
              <Bell className="h-4 w-4 md:h-5 md:w-5 text-white" />
              {(unreadCountQuery.data || 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCountQuery.data}
                </span>
              )}
            </div>
          </div>

          {/* Settings Icon - Right Corner */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            className="relative h-8 w-8 md:h-10 md:w-10 flex-shrink-0"
          >
            <Settings className="h-4 w-4 md:h-5 md:w-5" />
          </Button>
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
          🔴 Live Posts
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
          <div className="space-y-3 relative overflow-y-auto flex-1 pr-2 hide-scrollbar">
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
          </div>
        </div>

        {/* Popular Posts Column */}
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center justify-center gap-3 mb-3">
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
          </div>
          
          {/* Green separator line */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-green-500 to-transparent mb-3 flex-shrink-0"></div>
          
          <div className="space-y-3 overflow-y-auto flex-1 pr-2 hide-scrollbar">
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
          </div>
        </div>
      </div>

      {/* Mobile: Single Column with Switchable View */}
      <div className="md:hidden">
        {mobileView === 'live' ? (
          <div>
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
            <div className="space-y-3 relative">
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
        ) : (
          <div>
            <div className="flex flex-col items-center mb-3">
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
            <div className="space-y-3">
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
    </div>
  );
}

