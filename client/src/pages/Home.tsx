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

    const interval = settingsQuery.data?.refreshInterval || 600;
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

  // No authentication required - removed loading and login screens

  // API status based on postsQuery success/error
  const apiStatus = postsQuery.isError ? "error" : postsQuery.isSuccess ? "success" : "unknown";

  return (
    <div className="min-h-screen w-full" style={{ width: '770px', margin: '0 auto' }}>
      {/* Header */}
      <header className="glass-card p-3 mb-4 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">Post Sniper 🎯</h1>
            {postsQuery.data?.lastFetchedAt && (
              <span className="text-sm text-white/60">
                Last updated: {minutesSinceUpdate === 0 ? 'just now' : `${minutesSinceUpdate}m ago`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="relative"
            >
              <Settings className="h-5 w-5" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
              className="relative"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleManualFetch}
              disabled={manualFetchMutation.isPending}
              className="relative"
              title="Fetch Now"
            >
              <RefreshCw className={`h-5 w-5 ${manualFetchMutation.isPending ? 'animate-spin' : ''}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAlerts(true)}
              className="relative"
            >
              <Bell className="h-5 w-5" />
              {(unreadCountQuery.data || 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCountQuery.data}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile View Selector - Only visible on mobile */}
      <div className="md:hidden mb-4">
        <select 
          value={mobileView} 
          onChange={(e) => setMobileView(e.target.value as 'live' | 'popular')}
          className="w-full glass-card p-3 rounded-xl text-sm font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="live" className="bg-[#0a0e27] text-white">🔴 Live Posts</option>
          <option value="popular" className="bg-[#0a0e27] text-white">📈 Popular Posts</option>
        </select>
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
          <div className="space-y-3">
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
            {livePosts.map((post, index) => (
              <PostCard key={`${post.pageId}-${post.id}-${index}`} post={post} />
            ))}
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
            {popularPosts.map((post, index) => (
              <PostCard 
                key={`${post.pageId}-${post.id}-popular-${index}`} 
                post={post} 
                showDismiss={true}
                onDismiss={() => dismissPostMutation.mutate({ postId: post.id })}
              />
            ))}
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
            <div className="space-y-3">
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
              {livePosts.map((post, index) => (
                <PostCard key={`${post.pageId}-${post.id}-${index}`} post={post} />
              ))}
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
              {popularPosts.map((post, index) => (
                <PostCard 
                  key={`${post.pageId}-${post.id}-popular-${index}`} 
                  post={post} 
                  showDismiss={true}
                  onDismiss={() => dismissPostMutation.mutate({ postId: post.id })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <AlertsDialog open={showAlerts} onOpenChange={setShowAlerts} />
    </div>
  );
}

