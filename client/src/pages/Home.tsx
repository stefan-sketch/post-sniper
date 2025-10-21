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
  const [popularTimeFilter, setPopularTimeFilter] = useState<'30min' | '2hr' | '3hr' | '6hr'>('6hr');
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [previousPostIds, setPreviousPostIds] = useState<Set<string>>(new Set());
  const [isFetching, setIsFetching] = useState(false);
  const [previousPopularRankings, setPreviousPopularRankings] = useState<Map<string, number>>(new Map());
  
  const settingsQuery = trpc.settings.get.useQuery();
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

    const interval = settingsQuery.data?.refreshInterval || 300; // 5 minutes = 300 seconds
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
    const timeThresholds = {
      '30min': 30 * 60 * 1000,
      '2hr': 2 * 60 * 60 * 1000,
      '3hr': 3 * 60 * 60 * 1000,
      '6hr': 6 * 60 * 60 * 1000,
    };
    const timeAgo = new Date(now.getTime() - timeThresholds[popularTimeFilter]);

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
      kpi: {
        page_posts_comments_count: { value: post.comments || 0 },
        page_posts_shares_count: { value: post.shares || 0 },
      },
      alertThreshold: post.alertThreshold,
      alertEnabled: post.alertEnabled,
    }));

    // Sort all posts by date (newest first) for live posts
    const live = [...allPosts].sort((a, b) => b.postDate.getTime() - a.postDate.getTime());

    // Get dismissed post IDs
    const dismissedIds = settingsQuery.data?.dismissedPosts 
      ? JSON.parse(settingsQuery.data.dismissedPosts) 
      : [];

    // Popular posts: posts from selected time period sorted by reactions (highest first), excluding dismissed
    const popular = allPosts
      .filter(post => post.postDate >= timeAgo && !dismissedIds.includes(post.id))
      .sort((a, b) => b.reactions - a.reactions);

    return { livePosts: live, popularPosts: popular };
  }, [postsQuery.data, settingsQuery.data?.dismissedPosts, popularTimeFilter]);

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
        setPreviousPopularRankings(currentRankings);
      } else {
        // First load, just store rankings without showing changes
        setPreviousPopularRankings(currentRankings);
      }
    }
  }, [popularPosts]);

  // No authentication required - removed loading and login screens

  // API status based on postsQuery success/error
  const apiStatus = postsQuery.isError ? "error" : postsQuery.isSuccess ? "success" : "unknown";

  return (
    <div className="min-h-screen w-full md:w-[770px] md:mx-auto px-4 md:px-6 py-4">
      {/* Header */}
      <header className="glass-card p-2 md:p-3 mb-4 rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 md:gap-4">
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-bold">SDL MEDIA</h1>
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">LIVE</span>
            </div>
            {isFetching ? (
              <span className="text-xs md:text-sm text-green-400 font-semibold hidden sm:inline animate-pulse">
                Fetching Data...
              </span>
            ) : postsQuery.data?.lastFetchedAt && (
              <span className="text-xs md:text-sm text-white/60 hidden sm:inline">
                Last updated: {minutesSinceUpdate === 0 ? 'just now' : `${minutesSinceUpdate}m ago`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAlerts(true)}
              className="relative h-8 w-8 md:h-10 md:w-10"
            >
              <Bell className="h-4 w-4 md:h-5 md:w-5" />
              {(unreadCountQuery.data || 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCountQuery.data}
                </span>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="relative h-8 w-8 md:h-10 md:w-10"
            >
              <Settings className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile View Selector - Only visible on mobile */}
      <div className="md:hidden mb-4 glass-card p-1 rounded-xl flex gap-1">
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
          className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-all ${
            mobileView === 'popular' 
              ? 'bg-secondary text-secondary-foreground' 
              : 'text-white/60 hover:text-white/80'
          }`}
        >
          📈 Popular
        </button>
      </div>

      {/* Desktop: Two Column Layout */}
      <div className="hidden md:grid grid-cols-2 gap-6">
        {/* Live Posts Column */}
        <div>
          <h2 className="text-lg font-semibold mb-3 text-primary text-center flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            Live Posts
          </h2>
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
              return (
                <div
                  key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}`}
                  className={isNew ? 'animate-slideIn' : ''}
                  style={{
                    animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                  }}
                >
                  <PostCard post={post} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Posts Column */}
        <div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="h-5 w-5 text-secondary" />
            <h2 className="text-lg font-semibold text-secondary">
              Popular Posts
            </h2>
            <select
              value={popularTimeFilter}
              onChange={(e) => setPopularTimeFilter(e.target.value as '30min' | '2hr' | '3hr' | '6hr')}
              className="ml-2 px-2 py-1 rounded-lg text-sm font-medium bg-white/5 text-white/80 border border-white/10 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
            >
              <option value="30min" className="bg-background">30min</option>
              <option value="2hr" className="bg-background">2hr</option>
              <option value="3hr" className="bg-background">3hr</option>
              <option value="6hr" className="bg-background">6hr</option>
            </select>
          </div>
          
          <div className="space-y-3">
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
              
              return (
                <PostCard 
                  key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}-popular`} 
                  post={post} 
                  showDismiss={true}
                  onDismiss={() => dismissPostMutation.mutate({ postId: post.id })}
                  rankingChange={rankingChange}
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
            <h2 className="text-lg font-semibold mb-3 text-primary text-center flex items-center justify-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              Live Posts
            </h2>
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
                return (
                  <div
                    key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}-mobile`}
                    className={isNew ? 'animate-slideIn' : ''}
                    style={{
                      animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                    }}
                  >
                    <PostCard post={post} />
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <h2 className="text-lg font-semibold mb-3 text-secondary text-center flex items-center justify-center gap-2">
              <TrendingUp className="h-5 w-5 text-secondary" />
              Popular Posts
            </h2>
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
                
                return (
                  <PostCard 
                    key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}-mobile-popular`} 
                    post={post} 
                    showDismiss={true}
                    onDismiss={() => dismissPostMutation.mutate({ postId: post.id })}
                    rankingChange={rankingChange}
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

