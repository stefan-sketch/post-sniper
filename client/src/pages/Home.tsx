import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Settings, Play, Pause, Bell } from "lucide-react";
import SettingsDialog from "@/components/SettingsDialog";
import AlertsDialog from "@/components/AlertsDialog";
import PostCard from "@/components/PostCard";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0); // seconds until next refresh
  const [showSettings, setShowSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  
  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const setPlayingMutation = trpc.settings.setPlaying.useMutation();

  // Sync isPlaying state from database on load
  useEffect(() => {
    if (settingsQuery.data?.isPlaying !== undefined && settingsQuery.data.isPlaying !== null) {
      setIsPlaying(settingsQuery.data.isPlaying);
    }
  }, [settingsQuery.data?.isPlaying]);

  // Update database when isPlaying changes
  useEffect(() => {
    if (isAuthenticated && settingsQuery.data) {
      setPlayingMutation.mutate({ isPlaying });
    }
  }, [isPlaying, isAuthenticated]);
  const apiCheckQuery = trpc.posts.checkApi.useQuery(undefined, { 
    enabled: isAuthenticated && isPlaying,
    refetchInterval: 60000 // Check API status every minute
  });
  const postsQuery = trpc.posts.fetchAll.useQuery(undefined, {
    enabled: isAuthenticated && isPlaying,
    refetchInterval: (settingsQuery.data?.refreshInterval || 600) * 1000,
  });
  const unreadCountQuery = trpc.alerts.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Timer countdown
  useEffect(() => {
    if (!isPlaying) {
      setTimer(0);
      return;
    }

    const interval = settingsQuery.data?.refreshInterval || 600;
    setTimer(interval);

    const countdown = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          return interval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, [isPlaying, settingsQuery.data?.refreshInterval]);

  // Format timer as MM:SS
  const formattedTimer = useMemo(() => {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [timer]);

  const alertsListQuery = trpc.alerts.list.useQuery(undefined, { enabled: isAuthenticated });
  const createAlertMutation = trpc.alerts.create.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      utils.alerts.unreadCount.invalidate();
    },
  });

  // Process and organize posts
  const { livePosts, popularPosts } = useMemo(() => {
    if (!postsQuery.data) return { livePosts: [], popularPosts: [] };

    const allPosts: any[] = [];
    const now = new Date();
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    postsQuery.data.forEach((pageData: any) => {
      if (pageData.data?.posts) {
        pageData.data.posts.forEach((post: any) => {
          const postDate = new Date(post.date);
          const reactions = post.kpi?.page_posts_reactions?.value || 0;
          
          allPosts.push({
            ...post,
            pageId: pageData.pageId,
            pageName: pageData.pageName,
            borderColor: pageData.borderColor,
            profilePicture: pageData.profilePicture,
            alertThreshold: pageData.alertThreshold,
            alertEnabled: pageData.alertEnabled,
            postDate,
            reactions,
          });

          // Check if alert should be triggered
          if (
            pageData.alertEnabled &&
            reactions >= pageData.alertThreshold &&
            postDate >= tenMinutesAgo // Only check recent posts
          ) {
            // Check if alert already exists for this post
            const existingAlert = alertsListQuery.data?.find(
              (alert) => alert.postId === post.id && alert.pageId === pageData.pageId
            );
            
            if (!existingAlert) {
              // Create alert
              createAlertMutation.mutate({
                pageId: pageData.pageId,
                postId: post.id,
                postLink: post.link,
                postMessage: post.message,
                postImage: post.image,
                reactionCount: reactions,
                threshold: pageData.alertThreshold,
                postDate: postDate,
              });
            }
          }
        });
      }
    });

    // Sort all posts by date (newest first) for live posts
    const live = [...allPosts].sort((a, b) => b.postDate.getTime() - a.postDate.getTime());

    // Filte    // Popular posts: posts from last 6 hours sorted by reactions (highest first)
    const popular = allPosts
      .filter(post => post.postDate >= sixHoursAgo)
      .sort((a, b) => b.reactions - a.reactions);

    return { livePosts: live, popularPosts: popular };
  }, [postsQuery.data]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Post Sniper 🎯</h1>
          <p className="text-muted-foreground">Monitor your social media posts in real-time</p>
          <Button onClick={() => window.location.href = getLoginUrl()}>
            Sign In to Continue
          </Button>
        </div>
      </div>
    );
  }

  const apiStatus = apiCheckQuery.data?.status || "unknown";

  return (
    <div className="min-h-screen w-full" style={{ width: '770px', margin: '0 auto' }}>
      {/* Header */}
      <header className="glass-card p-4 mb-6 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Post Sniper 🎯</h1>
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

            <div className="flex items-center gap-2">
              <div 
                className={`h-3 w-3 rounded-full ${
                  apiStatus === "success" ? "bg-green-500 glow-cyan" : "bg-red-500"
                }`}
              />
              <span className="text-sm font-mono">{formattedTimer}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-4">
        {/* Live Posts Column */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-primary">Live Posts</h2>
          <div className="space-y-4">
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
          <h2 className="text-xl font-semibold mb-4 text-secondary">Popular Posts</h2>
          <div className="space-y-4">
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
              <PostCard key={`${post.pageId}-${post.id}-popular-${index}`} post={post} />
            ))}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
      <AlertsDialog open={showAlerts} onOpenChange={setShowAlerts} />
    </div>
  );
}

