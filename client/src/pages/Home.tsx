import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Settings, Play, Pause, Bell, TrendingUp, Loader2, RefreshCw, ArrowUp, Plus, ImagePlus, Download, Heart, Repeat2, MessageCircle, Copy, Trash2 } from "lucide-react";
import SettingsDialog from "@/components/SettingsDialog";
import PagesSettingsDialog from "@/components/PagesSettingsDialog";
import AlertsDialog from "@/components/AlertsDialog";
import PostCard from "@/components/PostCard";
import FacebookPageColumn from "@/components/FacebookPageColumn";
import { CreatePostDialog } from "@/components/CreatePostDialog";
import LiveFootballHub from "@/components/LiveFootballHub";
import { toast } from "sonner";

export default function Home() {
  // No authentication required - public access
  const utils = trpc.useUtils();
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0); // seconds until next refresh
  const [showSettings, setShowSettings] = useState(false);
  const [showPagesSettings, setShowPagesSettings] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [droppedImage, setDroppedImage] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'live' | 'popular' | 'twitter'>('live');

  const [currentView, setCurrentView] = useState<'feed' | 'pages'>('feed');
  const [pagesView, setPagesView] = useState<'away-days' | 'funnys' | 'footy-feed'>('away-days');
  const [feedColumns, setFeedColumns] = useState<2 | 3>(2); // Toggle between 2 and 3 columns
  const [isAnimatingOut, setIsAnimatingOut] = useState(false); // Track when Football Hub is sliding out
  const [viewTransition, setViewTransition] = useState<'none' | 'to-pages' | 'to-feed'>('none'); // Track view transition direction
  const [isViewSwitching, setIsViewSwitching] = useState(false); // Prevent post animations during view switch

  // For mobile dropdown
  const [minutesSinceUpdate, setMinutesSinceUpdate] = useState(0);
  const [popularTimeFilter, setPopularTimeFilter] = useState<'2hr' | '6hr' | 'today'>('2hr');
  const [feedType, setFeedType] = useState<'popular' | 'twitter'>('popular');
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [selectedPageFilters, setSelectedPageFilters] = useState<Set<string>>(new Set()); // Set of selected page IDs
  const [showPageFilter, setShowPageFilter] = useState(false);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [previousPostIds, setPreviousPostIds] = useState<Set<string>>(new Set());
  const [newPopularPostIds, setNewPopularPostIds] = useState<Set<string>>(new Set());
  const [previousPopularPostIds, setPreviousPopularPostIds] = useState<Set<string>>(new Set());
  const [newTweetIds, setNewTweetIds] = useState<Set<string>>(new Set());
  const [previousTweetIds, setPreviousTweetIds] = useState<Set<string>>(new Set());
  const [newManagedPostIds, setNewManagedPostIds] = useState<Set<string>>(new Set());
  const [previousManagedPostIds, setPreviousManagedPostIds] = useState<Set<string>>(new Set());
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
  const managedPagesQuery = trpc.managedPages.list.useQuery(undefined, {
    refetchInterval: 10000, // Poll every 10 seconds to sync with background job
    staleTime: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const setPlayingMutation = trpc.settings.setPlaying.useMutation();
  const manualFetchMutation = trpc.manualFetch.triggerFetch.useMutation();


  // Twitter: Fetch from database (always enabled)
  const twitterQuery = trpc.twitter.getListTweets.useQuery(
    { limit: 50 }, 
    { 
      refetchInterval: 60000, // Refresh UI every 60 seconds from database (reduced from 30s)
      staleTime: 30000, // Consider data fresh for 30 seconds
    }
  );
  
  // Twitter: Mutation to fetch from API and store in database
  const twitterFetchMutation = trpc.twitter.fetchAndStoreListTweets.useMutation({
    onSuccess: () => {
      twitterQuery.refetch(); // Refresh UI after fetching new tweets
    },
  });
  
  // Twitter: Periodically fetch from API when playing
  useEffect(() => {
    if (!twitterPlaying) return;
    
    // Fetch immediately when starting
    twitterFetchMutation.mutate();
    
    // Then fetch every 5 minutes
    const interval = setInterval(() => {
      twitterFetchMutation.mutate();
    }, 300000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [twitterPlaying]);
  
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
    refetchInterval: 10000, // Poll every 10 seconds to get latest cached data (reduced from 5s)
    staleTime: 5000, // Consider data fresh for 5 seconds
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
    
    // Filter by selected pages (if any pages are selected)
    if (selectedPageFilters.size > 0) {
      live = live.filter(post => selectedPageFilters.has(post.pageId));
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
  }, [postsQuery.data, settingsQuery.data?.dismissedPosts, popularTimeFilter, selectedPageFilters]);

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
    if (livePosts.length > 0 && !isViewSwitching) {
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
    } else if (livePosts.length > 0 && isViewSwitching) {
      // Update previousPostIds without triggering animation during view switch
      setPreviousPostIds(new Set(livePosts.map(p => p.id)));
    }
  }, [livePosts, isViewSwitching]);

  // Detect new popular posts for animation
  useEffect(() => {
    if (popularPosts.length > 0 && !isViewSwitching) {
      const currentPostIds = new Set(popularPosts.map(p => p.id));
      
      // Find new posts that weren't in the previous set
      const newIds = new Set<string>();
      currentPostIds.forEach(id => {
        if (!previousPopularPostIds.has(id)) {
          newIds.add(id);
        }
      });
      
      if (newIds.size > 0) {
        setNewPopularPostIds(newIds);
        // Remove animation after 2 seconds
        setTimeout(() => {
          setNewPopularPostIds(new Set());
        }, 2000);
      }
      
      setPreviousPopularPostIds(currentPostIds);
    } else if (popularPosts.length > 0 && isViewSwitching) {
      // Update previousPopularPostIds without triggering animation during view switch
      setPreviousPopularPostIds(new Set(popularPosts.map(p => p.id)));
    }
  }, [popularPosts, isViewSwitching]);

  // Detect new tweets for animation
  useEffect(() => {
    if (twitterQuery.data?.tweets && twitterQuery.data.tweets.length > 0 && !isViewSwitching) {
      const currentTweetIds = new Set(twitterQuery.data.tweets.map((t: any) => t.id));
      
      // Find new tweets that weren't in the previous set
      const newIds = new Set<string>();
      currentTweetIds.forEach(id => {
        if (!previousTweetIds.has(id)) {
          newIds.add(id);
        }
      });
      
      if (newIds.size > 0) {
        setNewTweetIds(newIds);
        // Remove animation after 2 seconds
        setTimeout(() => {
          setNewTweetIds(new Set());
        }, 2000);
      }
      
      setPreviousTweetIds(currentTweetIds);
    } else if (twitterQuery.data?.tweets && twitterQuery.data.tweets.length > 0 && isViewSwitching) {
      // Update previousTweetIds without triggering animation during view switch
      setPreviousTweetIds(new Set(twitterQuery.data.tweets.map((t: any) => t.id)));
    }
  }, [twitterQuery.data?.tweets, isViewSwitching]);

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
    <div className="w-full md:w-[770px] md:mx-auto px-4 md:px-6 flex flex-col max-w-full" style={{ height: '100dvh', paddingTop: 'max(1rem, env(safe-area-inset-top))', touchAction: 'none', overscrollBehavior: 'none' }}>
      {/* Header */}
      <header className="mb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left: View Toggle + Column Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const newView = currentView === 'feed' ? 'pages' : 'feed';
                setIsViewSwitching(true);
                setViewTransition(newView === 'pages' ? 'to-pages' : 'to-feed');
                setTimeout(() => {
                  setCurrentView(newView);
                  setViewTransition('none');
                  // Keep isViewSwitching true for a bit longer to prevent animations
                  setTimeout(() => {
                    setIsViewSwitching(false);
                  }, 100);
                }, 500);
              }}
              className="group relative p-2 rounded-full bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm text-gray-400 hover:text-cyan-400 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-95"
              title={currentView === 'feed' ? 'Switch to Pages' : 'Switch to Feed'}
            >
              {/* Animated glow ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-500/0 via-cyan-500/50 to-cyan-500/0 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300"></div>
              
              {/* Icon with rotation animation */}
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="relative z-10 transition-transform duration-500 group-hover:rotate-180"
              >
                <polyline points="17 1 21 5 17 9"/>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </button>

            {/* Football Toggle - Desktop only, Feed view only */}
            {currentView === 'feed' && (
              <button
                onClick={() => {
                  if (feedColumns === 3) {
                    // Trigger exit animation
                    setIsAnimatingOut(true);
                    // Wait for animation to complete before changing columns
                    setTimeout(() => {
                      setFeedColumns(2);
                      setIsAnimatingOut(false);
                    }, 500);
                  } else {
                    setFeedColumns(3);
                  }
                }}
                className="hidden md:block group relative p-2 rounded-full bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm text-gray-400 hover:text-green-400 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-green-500/20 active:scale-95"
                title={feedColumns === 2 ? 'Show Live Football Hub' : 'Hide Live Football Hub'}
              >
                {/* Animated glow ring */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r opacity-0 blur-sm transition-opacity duration-300 ${
                  feedColumns === 3 || isAnimatingOut
                    ? 'from-green-500/50 via-green-500/80 to-green-500/50 opacity-100 animate-pulse'
                    : 'from-green-500/0 via-green-500/50 to-green-500/0 group-hover:opacity-100'
                }`}></div>
                
                {/* M Icon */}
                <svg 
                  className={`relative z-10 transition-all duration-300 ${
                    feedColumns === 3 || isAnimatingOut
                      ? 'text-green-400'
                      : 'text-gray-400 group-hover:text-green-400'
                  }`}
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {/* Circle */}
                  <circle cx="12" cy="12" r="10" />
                  {/* M Letter */}
                  <path d="M7 15V9l2.5 4L12 9l2.5 4L17 9v6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            )}
          </div>

          {/* Center: SDL MEDIA title */}
          <div className="flex items-center gap-2 absolute left-1/2 transform -translate-x-1/2">
            {/* Settings button - desktop only */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => currentView === 'feed' ? setShowSettings(true) : setShowPagesSettings(true)}
              className="hidden md:flex relative h-8 w-8 md:h-10 md:w-10 flex-shrink-0"
            >
              <Settings className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <h1 className="text-xl md:text-2xl font-bold text-white tracking-wider" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
              SDL MEDIA
            </h1>
            {/* Create post button - desktop only */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setDroppedImage(null);
                setShowCreatePost(true);
              }}
              className="hidden md:flex relative h-8 w-8 md:h-10 md:w-10 flex-shrink-0"
            >
              <Plus className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
          </div>

          {/* Right: Settings (mobile only) + Online Status + Notifications + Drag-drop icon (desktop only) */}
          <div className="flex items-center gap-1">
            {/* Settings button - mobile only */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => currentView === 'feed' ? setShowSettings(true) : setShowPagesSettings(true)}
              className="md:hidden relative h-8 w-8 flex-shrink-0"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {/* Online Status */}
            <div className="flex items-center gap-1.5 text-xs mr-1">
              {settingsQuery.data?.lastAPIStatus === "success" ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span className="text-green-400 font-medium hidden md:inline">Online</span>
                </>
              ) : (
                <>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  <span className="text-red-400 font-medium hidden md:inline">Offline</span>
                </>
              )}
            </div>
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
            {/* Drag-drop area - desktop only */}
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
              className="hidden h-8 w-8 md:h-10 md:w-10 items-center justify-center border-2 border-dashed border-gray-600 rounded-lg hover:border-cyan-500 transition-colors cursor-pointer group"
              title="Drag & drop image here"
            >
              <ImagePlus className="h-4 w-4 md:h-5 md:w-5 text-gray-500 group-hover:text-cyan-500 transition-colors" />
            </div>
          </div>
        </div>
      </header>

      {/* Conditional Content Based on View */}
      <div 
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          animation: viewTransition === 'to-pages' ? 'slideOutToLeft 0.5s ease-in-out forwards' : 
                     viewTransition === 'to-feed' ? 'slideInFromLeft 0.5s ease-in-out' : 'none'
        }}
      >
      {currentView === 'feed' ? (
        <>


      {/* Desktop: Two/Three Column Layout with smooth transition */}
      <div 
        className={`hidden md:grid flex-1 overflow-hidden ${feedColumns === 3 || isAnimatingOut ? 'gap-1' : 'gap-6'}`}
        style={{
          gridTemplateColumns: feedColumns === 3 || isAnimatingOut ? '0.9fr 1fr 1fr' : '1fr 1fr',
          transition: 'grid-template-columns 0.5s ease-in-out, gap 0.5s ease-in-out'
        }}
      >
        {/* Live Football Hub - Slides in from LEFT, positioned first in grid */}
        {(feedColumns === 3 || isAnimatingOut) && (
          <div 
            className="flex flex-col h-full overflow-hidden"
            style={{
              animation: isViewSwitching ? 'none' : (isAnimatingOut ? 'slideOutToLeft 0.5s ease-in forwards' : 'slideInFromLeft 0.5s ease-out')
            }}
          >
            <LiveFootballHub />
          </div>
        )}

        {/* Live Posts Column */}
        <div 
          className="flex flex-col h-full overflow-hidden transition-all duration-500 ease-in-out"
          style={{
            transform: feedColumns === 3 || isAnimatingOut ? 'scale(0.98)' : 'scale(1)',
            opacity: feedColumns === 3 || isAnimatingOut ? 0.95 : 1
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center justify-center gap-2 flex-1">
              <h2 className="text-lg font-semibold text-[#1877F2] flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                LIVE
              </h2>
              {/* Page filter dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowPageFilter(!showPageFilter)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all bg-[#1877F2] hover:bg-[#1877F2]/80 text-white shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  {selectedPageFilters.size === 0 ? 'All' : `${selectedPageFilters.size} selected`}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPageFilter && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-[100] min-w-[220px] max-h-[300px] overflow-y-auto">
                    {availablePages.map((page) => {
                      const isSelected = selectedPageFilters.has(page.id);
                      return (
                        <button
                          key={page.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newFilters = new Set(selectedPageFilters);
                            if (isSelected) {
                              newFilters.delete(page.id);
                            } else {
                              newFilters.add(page.id);
                            }
                            setSelectedPageFilters(newFilters);
                          }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-[#1877F2] border-[#1877F2]' : 'border-gray-600'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={isSelected ? 'text-white font-medium' : 'text-gray-400'}>{page.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              {showLiveScrollTop && (
                <button
                  onClick={() => scrollToTop(liveScrollRef)}
                  className="p-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 hover:text-cyan-300 transition-all"
                  aria-label="Scroll to top"
                  title="Back to top"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div ref={liveScrollRef} className={`space-y-3 relative overflow-y-auto flex-1 pr-2 hide-scrollbar ${feedColumns === 3 || isAnimatingOut ? 'compact-posts' : ''}`} style={{ touchAction: 'pan-y' }}>
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
            {/* Printer line - thin red line where new posts emerge from */}
            {livePosts.length > 0 && (
              <div className="sticky top-0 z-10 relative h-0.5 bg-red-500/30 mb-3 overflow-hidden flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
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
        <div 
          className="flex flex-col h-full overflow-hidden transition-all duration-500 ease-in-out"
          style={{
            transform: feedColumns === 3 || isAnimatingOut ? 'scale(0.98)' : 'scale(1)',
            opacity: feedColumns === 3 || isAnimatingOut ? 0.95 : 1
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center justify-center gap-3 flex-1">
              <div className="flex items-center gap-2">
                <TrendingUp className={`h-5 w-5 animate-pulse transition-colors ${
                  feedType === 'popular' ? 'text-[#1877F2]' : 'text-white'
                }`} />
              </div>
            {/* Toggle Switch - Smaller */}
            <button
              onClick={() => setFeedType(feedType === 'popular' ? 'twitter' : 'popular')}
              className="relative inline-flex h-7 w-24 items-center rounded-full bg-gray-700 transition-all hover:bg-gray-600 overflow-hidden"
            >
              <span
                className={`inline-block h-6 w-12 transform rounded-full shadow-lg transition-all ${
                  feedType === 'twitter' 
                    ? 'translate-x-[45px] bg-gray-800' 
                    : 'translate-x-0.5 bg-[#1877F2]'
                }`}
              />
              <span className={`absolute left-2 flex items-center pointer-events-none transition-colors ${
                feedType === 'popular' ? 'text-white' : 'text-gray-900'
              }`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </span>
              <span className={`absolute right-2 flex items-center pointer-events-none transition-colors ${
                feedType === 'twitter' ? 'text-white' : 'text-gray-900'
              }`}>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </span>
            </button>
            
            {/* Conditional Button: Time Filter (Popular) or Play/Pause (Twitter) */}
            {feedType === 'twitter' ? (
              <button
                onClick={() => setTwitterPlaying(!twitterPlaying)}
                className="px-3 py-1 transition-all flex items-center justify-center"
                style={{ minWidth: '60px', height: '28px' }}
                title={twitterPlaying ? 'Pause Twitter updates' : 'Resume Twitter updates'}
              >
                {twitterPlaying ? (
                  <Pause className="h-4 w-4 text-white" />
                ) : (
                  <Play className="h-4 w-4 text-white" />
                )}
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setShowTimeFilter(!showTimeFilter)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 bg-[#1877F2] hover:bg-[#1664D8] text-white shadow-lg"
                  style={{ minWidth: '60px', height: '28px' }}
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
            <div className="flex-shrink-0">
              {showPopularScrollTop && (
                <button
                  onClick={() => scrollToTop(popularScrollRef)}
                  className={`p-1.5 rounded-lg transition-all ${
                    feedType === 'popular' 
                      ? 'bg-[#1877F2]/20 hover:bg-[#1877F2]/30 text-[#1877F2] hover:text-[#1664D8]'
                      : 'bg-white/20 hover:bg-white/30 text-white hover:text-gray-200'
                  }`}
                  aria-label="Scroll to top"
                  title="Back to top"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          
          <div ref={popularScrollRef} className={`space-y-3 overflow-y-auto flex-1 pr-2 hide-scrollbar relative ${feedColumns === 3 || isAnimatingOut ? 'compact-posts' : ''}`} style={{ touchAction: 'pan-y' }}>
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
                {/* Printer line - thin blue line where new posts emerge from */}
                {popularPosts.length > 0 && (
                  <div className="sticky top-0 z-10 relative h-0.5 bg-[#1877F2]/30 mb-3 overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#1877F2] to-transparent animate-pulse"></div>
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
                  const isNew = newPopularPostIds.has(post.id);
                  
                  return (
                    <div
                      key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}-popular`}
                      className={isNew ? 'animate-slideIn' : ''}
                      style={{
                        animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                      }}
                    >
                      <PostCard 
                        post={post} 
                        reactionIncrease={reactionIncrease}
                      />
                    </div>
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
                {/* Printer line - thin white line where new tweets emerge from */}
                {twitterQuery.data?.tweets && twitterQuery.data.tweets.length > 0 && (
                  <div className="sticky top-0 z-10 relative h-0.5 bg-white/30 mb-3 overflow-hidden flex-shrink-0">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent animate-pulse"></div>
                  </div>
                )}
                {twitterQuery.data?.tweets?.map((tweet: any) => {
                  const isNew = newTweetIds.has(tweet.id);
                  
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
                  <div 
                    key={tweet.id} 
                    className={isNew ? 'animate-slideIn' : ''}
                    style={{
                      animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                    }}
                  >
                    <div className="glass-card rounded-xl overflow-hidden hover:bg-white/5 transition-colors">
                    {/* Profile Header */}
                    <div className="p-4 flex items-center gap-3">
                      <img src={tweet.author.avatar} alt={tweet.author.name} className="w-10 h-10 rounded-full flex-shrink-0" loading="lazy" decoding="async" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{tweet.author.name}</span>
                          {!(feedColumns === 3 || isAnimatingOut) && (
                            <span className="text-gray-500 text-sm">@{tweet.author.username}</span>
                          )}
                        </div>
                        {timeAgo && <p className="text-xs text-gray-500">{timeAgo}</p>}
                      </div>
                    </div>
                    
                    {/* Tweet Text */}
                    {cleanText && (
                      <div className="px-4 pb-2">
                        <p className="text-sm text-white/90">{cleanText}</p>
                      </div>
                    )}
                    
                    {/* Engagement Stats */}
                    <div className="px-4 pb-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-gray-400" strokeWidth={2} />
                          <span className="text-gray-300 font-medium">{tweet.engagement.likes.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Repeat2 className="h-4 w-4 text-gray-400" strokeWidth={2} />
                          <span className="text-gray-300 font-medium">{tweet.engagement.retweets.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MessageCircle className="h-4 w-4 text-gray-400" strokeWidth={2} />
                          <span className="text-gray-300 font-medium">{tweet.engagement.replies.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {tweet.image && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                            onClick={() => handleDownload(tweet.image)}
                            title="Download image"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        {tweet.text && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                            onClick={() => {
                              const cleanText = tweet.text.replace(/https:\/\/t\.co\/\S+/g, '').trim();
                              navigator.clipboard.writeText(cleanText);
                              toast.success('Tweet copied to clipboard');
                            }}
                            title="Copy tweet"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    {/* Tweet Image (if available) */}
                    {tweet.image && (
                      <div 
                        className={`w-full overflow-hidden cursor-pointer relative group ${feedColumns === 3 || isAnimatingOut ? '-mx-2 mt-2' : 'mt-2'}`}
                        style={{
                          width: feedColumns === 3 || isAnimatingOut ? 'calc(100% + 1rem)' : '100%'
                        }}
                        onClick={() => {
                          // Deep link to X app on mobile, fallback to web on desktop
                          const tweetUrl = `https://twitter.com/${tweet.author.username}/status/${tweet.id}`;
                          const xAppUrl = `twitter://status?id=${tweet.id}`;
                          
                          // Detect if mobile
                          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                          
                          if (isMobile) {
                            // Try to open X app, fallback to web after timeout
                            window.location.href = xAppUrl;
                            setTimeout(() => {
                              window.open(tweetUrl, '_blank');
                            }, 500);
                          } else {
                            // Desktop: open in new tab
                            window.open(tweetUrl, '_blank');
                          }
                        }}
                      >
                        <img 
                          src={tweet.image}
                          loading="lazy"
                          decoding="async" 
                          alt="Tweet image" 
                          className={`w-full h-auto ${feedColumns === 3 || isAnimatingOut ? 'object-cover' : 'object-contain'}`}
                          style={{
                            maxHeight: feedColumns === 3 || isAnimatingOut ? '400px' : 'none',
                            minHeight: feedColumns === 3 || isAnimatingOut ? '200px' : 'auto'
                          }}
                          draggable="true"
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/uri-list', tweet.image);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                        />
                        {/* Overlay buttons in 3-column mode */}
                        {(feedColumns === 3 || isAnimatingOut) && (
                          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownload(tweet.image);
                              }}
                              title="Download image"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {tweet.text && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const cleanText = tweet.text.replace(/https:\/\/t\.co\/\S+/g, '').trim();
                                  navigator.clipboard.writeText(cleanText);
                                  toast.success('Tweet copied to clipboard');
                                }}
                                title="Copy tweet"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                  </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Single Column with Switchable View */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden" style={{ paddingBottom: 'calc(60px + env(safe-area-inset-bottom))' }}>
        {mobileView === 'live' ? (
          <div className="flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-lg font-semibold text-[#1877F2] flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                LIVE
              </h2>
              {/* Page filter dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowPageFilter(!showPageFilter)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all bg-[#1877F2] hover:bg-[#1877F2]/80 text-white shadow-sm flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  {selectedPageFilters.size === 0 ? 'All' : `${selectedPageFilters.size} selected`}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showPageFilter && (
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-[100] min-w-[220px] max-h-[300px] overflow-y-auto">
                    {availablePages.map((page) => {
                      const isSelected = selectedPageFilters.has(page.id);
                      return (
                        <button
                          key={page.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newFilters = new Set(selectedPageFilters);
                            if (isSelected) {
                              newFilters.delete(page.id);
                            } else {
                              newFilters.add(page.id);
                            }
                            setSelectedPageFilters(newFilters);
                          }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-white/10 transition-colors flex items-center gap-2 first:rounded-t-lg last:rounded-b-lg"
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-[#1877F2] border-[#1877F2]' : 'border-gray-600'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={isSelected ? 'text-white font-medium' : 'text-gray-400'}>{page.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {/* Printer line - thin red line where new posts emerge from */}
            <div className="relative h-0.5 bg-red-500/30 mb-2 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
            </div>
            <div className="space-y-3 relative overflow-y-auto flex-1 hide-scrollbar" style={{ touchAction: 'pan-y' }}>
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
            <div className="space-y-3 overflow-y-auto flex-1 hide-scrollbar" style={{ touchAction: 'pan-y' }}>
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
                const isNew = newPopularPostIds.has(post.id);
                
                return (
                  <div
                    key={`${post.id}-${post.reactions}-${post.kpi.page_posts_comments_count.value}-${post.kpi.page_posts_shares_count.value}-mobile-popular`}
                    className={isNew ? 'animate-slideIn' : ''}
                    style={{
                      animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                    }}
                  >
                    <PostCard 
                      post={post} 
                      reactionIncrease={reactionIncrease}
                    />
                  </div>
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
                  X Football Feed
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
            <div className="space-y-3 overflow-y-auto flex-1 hide-scrollbar" style={{ touchAction: 'pan-y' }}>
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
              {twitterQuery.data?.tweets?.map((tweet: any) => {
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
                
                const isNew = newTweetIds.has(tweet.id);
                
                return (
                <div
                  key={tweet.id}
                  className={isNew ? 'animate-slideIn' : ''}
                  style={{
                    animation: isNew ? 'slideIn 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
                  }}
                >
                  <div className="glass-card rounded-xl overflow-hidden hover:bg-white/5 transition-colors">
                  {/* Profile Header */}
                  <div className="p-4 flex items-center gap-3">
                    <img src={tweet.author.avatar} alt={tweet.author.name} className="w-10 h-10 rounded-full flex-shrink-0" loading="lazy" decoding="async" />
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
                    <div className="px-4 pb-2">
                      <p className="text-sm text-white/90">{cleanText}</p>
                    </div>
                  )}
                  
                  {/* Tweet Image (if available) */}
                  {tweet.image && (
                    <div 
                      className="w-full overflow-hidden cursor-pointer"
                      onClick={() => {
                        // Deep link to X app on mobile, fallback to web on desktop
                        const tweetUrl = `https://twitter.com/${tweet.author.username}/status/${tweet.id}`;
                        const xAppUrl = `twitter://status?id=${tweet.id}`;
                        
                        // Detect if mobile
                        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
                        
                        if (isMobile) {
                          // Try to open X app, fallback to web after timeout
                          window.location.href = xAppUrl;
                          setTimeout(() => {
                            window.open(tweetUrl, '_blank');
                          }, 500);
                        } else {
                          // Desktop: open in new tab
                          window.open(tweetUrl, '_blank');
                        }
                      }}
                    >
                      <img 
                        src={tweet.image} 
                        alt="Tweet image"
                        loading="lazy"
                        decoding="async" 
                        className="w-full h-auto object-contain"
                        draggable="true"
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/uri-list', tweet.image);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                      />
                    </div>
                  )}
                  
                  {/* Engagement Stats */}
                  <div className="px-4 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-5">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4 text-gray-400" strokeWidth={2} />
                        <span className="text-gray-300 font-medium">{tweet.engagement.likes.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Repeat2 className="h-4 w-4 text-gray-400" strokeWidth={2} />
                        <span className="text-gray-300 font-medium">{tweet.engagement.retweets.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-gray-400" strokeWidth={2} />
                        <span className="text-gray-300 font-medium">{tweet.engagement.replies.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {tweet.image && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                          onClick={() => handleDownload(tweet.image)}
                          title="Download image"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      {tweet.text && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                          onClick={() => {
                            const cleanText = tweet.text.replace(/https:\/\/t\.co\/\S+/g, '').trim();
                            navigator.clipboard.writeText(cleanText);
                            toast.success('Tweet copied to clipboard');
                          }}
                          title="Copy tweet"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Floating Create Post Button - Mobile Only */}
        <button
          onClick={() => setShowCreatePost(true)}
          className="fixed right-6 p-4 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/50 transition-all z-50 md:bottom-6"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
          aria-label="Create post"
        >
          <ImagePlus className="h-6 w-6" />
        </button>
        
      </div>

        </>
      ) : (
        /* Pages View - 3 Facebook Pages */
        <>
          {/* Mobile View Selector - Icons only */}
          <div className="md:hidden mb-2 flex gap-2 justify-center items-center flex-shrink-0">
            {managedPagesQuery.data && managedPagesQuery.data.map((page: any, index: number) => {
              const isActive = (index === 0 && pagesView === 'away-days') || 
                               (index === 1 && pagesView === 'funnys') || 
                               (index === 2 && pagesView === 'footy-feed');
              const viewName = index === 0 ? 'away-days' : index === 1 ? 'funnys' : 'footy-feed';
              
              return (
                <button
                  key={page.id}
                  onClick={() => setPagesView(viewName as any)}
                  className={`p-1 rounded-full transition-all ${
                    isActive 
                      ? 'ring-2 ring-white/30 scale-110' 
                      : 'opacity-60 hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: isActive ? page.borderColor : 'transparent'
                  }}
                >
                  <div 
                    className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0"
                    style={{ 
                      border: `1px solid ${page.borderColor}`
                    }}
                  >
                    {page.profilePicture ? (
                      <img 
                        src={page.profilePicture} 
                        alt={page.profileName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center text-xs font-bold">
                        {page.profileName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          
          {/* Blue divider line under page icons - Mobile only */}
          <div className="md:hidden h-[2px] bg-gradient-to-r from-transparent via-[#1877F2] to-transparent mb-2 flex-shrink-0"></div>

          {/* Desktop: Three Column Layout */}
          <div className="hidden md:grid grid-cols-3 gap-4 flex-1 overflow-hidden overflow-x-hidden max-w-full">
            {managedPagesQuery.data && managedPagesQuery.data.length > 0 ? (
              managedPagesQuery.data.slice(0, 3).map((page: any) => (
                <div key={page.id} className="flex flex-col h-full overflow-hidden overflow-x-hidden max-w-full min-w-0">
                  {/* Page Header with Icon */}
                  <div className="flex items-center gap-3 mb-3 px-2">
                    <div 
                      className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0"
                      style={{ 
                        border: `1px solid ${page.borderColor}`,
                        boxShadow: `0 0 10px ${page.borderColor}40`
                      }}
                    >
                      {page.profilePicture ? (
                        <img 
                          src={page.profilePicture} 
                          alt={page.profileName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-muted flex items-center justify-center text-sm font-bold">
                          {page.profileName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <h2 
                      className="text-sm font-semibold"
                      style={{ 
                        color: page.profileName === 'Football Funnys' ? '#FCD34D' : 
                               page.profileName === 'The Footy Feed' ? '#FFFFFF' : 
                               page.profileName === 'Football Away Days' ? '#EF4444' : 
                               page.borderColor 
                      }}
                    >
                      {page.profileName}
                    </h2>
                  </div>
                  <FacebookPageColumn 
                    pageId={page.id}
                    pageName={page.profileName}
                    borderColor={page.borderColor}
                  />
                </div>
              ))
            ) : (
              <div className="col-span-3 flex items-center justify-center">
                <p className="text-gray-400 text-sm">No pages configured. Click Settings to add pages.</p>
              </div>
            )}
          </div>

          {/* Mobile: Single Column - Button Navigation Only */}
          <div className="md:hidden flex-1 overflow-hidden flex flex-col">
            {managedPagesQuery.data && managedPagesQuery.data.length > 0 ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                {managedPagesQuery.data.map((page: any, index: number) => (
                  <div 
                    key={page.id}
                    className={`h-full flex flex-col scrollbar-hide ${index === 0 && pagesView === 'away-days' ? 'flex' : index === 1 && pagesView === 'funnys' ? 'flex' : index === 2 && pagesView === 'footy-feed' ? 'flex' : 'hidden'}`}
                  >
                    <FacebookPageColumn 
                      pageId={page.id}
                      pageName={page.profileName}
                      borderColor={page.borderColor}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-gray-400 text-sm">No pages configured. Click Settings to add pages.</p>
              </div>
            )}
          </div>
        </>
      )}
      </div>

      {/* Bottom Navigation Bar - Rendered via Portal directly into body to bypass all container constraints */}
      {currentView === 'feed' && createPortal(
        <div className="md:hidden fixed left-0 right-0 bg-gray-900/30 border-t border-white/10" style={{ bottom: 0, zIndex: 9999, paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
          <div className="flex items-center justify-around px-4" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
            <button
              onClick={() => setMobileView('live')}
              className={`flex flex-col items-center gap-1 transition-all ${
                mobileView === 'live' ? 'text-[#1877F2]' : 'text-gray-400'
              }`}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              <span className="text-xs font-medium">Live</span>
            </button>
            
            <button
              onClick={() => setMobileView('popular')}
              className={`flex flex-col items-center gap-1 transition-all ${
                mobileView === 'popular' ? 'text-green-500' : 'text-gray-400'
              }`}
            >
              <TrendingUp className="w-6 h-6" />
              <span className="text-xs font-medium">Popular</span>
            </button>
            
            <button
              onClick={() => setMobileView('twitter')}
              className={`flex flex-col items-center gap-1 transition-all ${
                mobileView === 'twitter' ? 'text-white' : 'text-gray-400'
              }`}
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span className="text-xs font-medium">X.com</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Dialogs - Rendered outside view conditionals to appear as overlays */}
      <SettingsDialog 
        open={showSettings} 
        onOpenChange={setShowSettings}
        isPlaying={isPlaying}
        onTogglePlay={() => setIsPlaying(!isPlaying)}
        onManualFetch={handleManualFetch}
        isFetching={manualFetchMutation.isPending}
      />
      <PagesSettingsDialog 
        open={showPagesSettings} 
        onOpenChange={setShowPagesSettings}
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

