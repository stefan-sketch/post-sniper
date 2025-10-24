import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Settings, Play, Pause, Bell, TrendingUp, Loader2, RefreshCw, ArrowUp, Plus, ImagePlus, Download, Heart, Repeat2, MessageCircle, Copy, Trash2, ImageIcon } from "lucide-react";
import PostCard from "@/components/PostCard";
import FacebookPageColumn from "@/components/FacebookPageColumn";

// Lazy load heavy components for better initial load performance
const SettingsDialog = lazy(() => import("@/components/SettingsDialog"));
const PagesSettingsDialog = lazy(() => import("@/components/PagesSettingsDialog"));
const AlertsDialog = lazy(() => import("@/components/AlertsDialog"));
const CreatePostDialog = lazy(() => import("@/components/CreatePostDialog").then(m => ({ default: m.CreatePostDialog })));
const LiveFootballHub = lazy(() => import("@/components/LiveFootballHub"));
import { toast } from "sonner";

export default function Home() {
  // No authentication required - public access
  const utils = trpc.useUtils();
  
  // Detect iOS devices
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
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
  const justSwitchedToFeed = useRef(false); // Track if we just switched to feed view to prevent MATCHDAY animation
  const wasMatchdayOpenBeforeSwitch = useRef(false); // Track if MATCHDAY was open before switching to Pages

  // For mobile dropdown
  const [minutesSinceUpdate, setMinutesSinceUpdate] = useState(0);
  const [popularTimeFilter, setPopularTimeFilter] = useState<'2hr' | '6hr' | 'today'>('2hr');
  const [feedType, setFeedType] = useState<'popular' | 'twitter' | 'reddit'>('popular');
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
  const [showAllLivePosts, setShowAllLivePosts] = useState(false); // Track if "SEE MORE" clicked for Live posts
  const [showAllPopularPosts, setShowAllPopularPosts] = useState(false); // Track if "SEE MORE" clicked for Popular posts
  const [showAllTwitterPosts, setShowAllTwitterPosts] = useState(false); // Track if "SEE MORE" clicked for Twitter posts
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
      refetchInterval: isIOS ? 90000 : 60000, // Refresh UI every 90s on iOS, 60s on desktop (battery optimization)
      staleTime: 30000, // Consider data fresh for 30 seconds
    }
  );
  
  // Twitter: Mutation to fetch from API and store in database
  const twitterFetchMutation = trpc.twitter.fetchAndStoreListTweets.useMutation({
    onSuccess: () => {
      twitterQuery.refetch(); // Refresh UI after fetching new tweets
    },
  });
  
  // Function to handle view switching (used by both button and keyboard shortcut)
  const handleViewSwitch = () => {
    const newView = currentView === 'feed' ? 'pages' : 'feed';
    setIsViewSwitching(true);
    setViewTransition(newView === 'pages' ? 'to-pages' : 'to-feed');
    if (newView === 'pages') {
      // Save MATCHDAY state before switching to Pages
      wasMatchdayOpenBeforeSwitch.current = feedColumns === 3;
    } else if (newView === 'feed') {
      justSwitchedToFeed.current = true;
    }
    setTimeout(() => {
      setCurrentView(newView);
      setViewTransition('none');
      // Keep isViewSwitching true longer to prevent post animations during transition
      setTimeout(() => {
        setIsViewSwitching(false);
        // Reset flags after animations complete
        if (newView === 'feed') {
          setTimeout(() => {
            justSwitchedToFeed.current = false;
            // Don't reset wasMatchdayOpenBeforeSwitch here - it should only be reset when manually toggling MATCHDAY
          }, 100);
        }
      }, 600);
    }, 500);
  };

  // Keyboard shortcut: CMD+D to toggle between Feed and Pages
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for CMD+D (Mac) or Ctrl+D (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault(); // Prevent browser bookmark dialog
        handleViewSwitch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentView, feedColumns]); // Re-bind when dependencies change

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
    refetchInterval: isIOS ? 15000 : 10000, // Poll every 15s on iOS, 10s on desktop (battery optimization)
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

  // Handle copy image to clipboard for tweets
  const handleCopyTweetImage = async (imageUrl: string) => {
    try {
      // Detect iOS devices specifically (iPhone, iPad, iPod)
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      
      // Check if clipboard API is available
      const isClipboardAvailable = navigator.clipboard && typeof ClipboardItem !== 'undefined';
      
      // Only use download fallback on iOS devices where clipboard might not work in PWA
      if (isIOS && !isClipboardAvailable) {
        // Fallback for iOS PWA: Download the image instead
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tweet-image.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image downloaded! (Clipboard not available in PWA)");
        return;
      }
      
      // Safari PWA requires clipboard.write() to be called synchronously in the user gesture
      // We pass a Promise to ClipboardItem to maintain the gesture chain
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': fetch(imageUrl)
            .then(response => response.blob())
            .then(blob => {
              // Convert to PNG for better compatibility
              return new Promise<Blob>((resolve) => {
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  canvas.width = img.width;
                  canvas.height = img.height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0);
                  canvas.toBlob((pngBlob) => resolve(pngBlob!), 'image/png');
                };
                img.src = URL.createObjectURL(blob);
              });
            })
        })
      ]);
      
      toast.success("Image copied to clipboard!");
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback: Try to download instead
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tweet-image.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Image downloaded! (Copy to clipboard failed)");
      } catch (downloadError) {
        toast.error("Failed to copy or download image");
      }
    }
  };

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
      name: page.profileName,
      profilePicture: page.profilePicture
    }));
  }, [pagesQuery.data]);

  // Detect new posts for animation - animate any post that's new to the user
  useEffect(() => {
    if (livePosts.length > 0) {
      const currentPostIds = new Set(livePosts.map(p => p.id));
      
      // Find posts that are not in previous set (new to the user)
      const newIds = new Set<string>();
      livePosts.forEach(post => {
        if (!previousPostIds.has(post.id)) {
          newIds.add(post.id);
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

  // Detect new popular posts for animation - animate any post that's new to the user
  useEffect(() => {
    if (popularPosts.length > 0) {
      const currentPostIds = new Set(popularPosts.map(p => p.id));
      
      // Find posts that are not in previous set (new to the user)
      const newIds = new Set<string>();
      popularPosts.forEach(post => {
        if (!previousPopularPostIds.has(post.id)) {
          newIds.add(post.id);
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
    }
  }, [popularPosts]);

  // Detect new tweets for animation - animate any tweet that's new to the user
  useEffect(() => {
    if (twitterQuery.data?.tweets && twitterQuery.data.tweets.length > 0) {
      const currentTweetIds = new Set(twitterQuery.data.tweets.map((t: any) => t.id));
      
      // Find tweets that are not in previous set (new to the user)
      const newIds = new Set<string>();
      twitterQuery.data.tweets.forEach((tweet: any) => {
        if (!previousTweetIds.has(tweet.id)) {
          newIds.add(tweet.id);
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
    }
  }, [twitterQuery.data?.tweets]);

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
    <div className="w-full md:w-[770px] md:mx-auto px-2 md:px-4 flex flex-col max-w-full" style={{ height: '100dvh', paddingTop: 'max(1rem, env(safe-area-inset-top))', touchAction: 'none', overscrollBehavior: 'none' }}>
      {/* Header */}
      <header className="mb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left: API Status (mobile) + View Toggle + Column Toggle */}
          <div className="flex items-center gap-2">
            {/* Online Status - far left on mobile, hidden on desktop */}
            <div className="flex md:hidden items-center gap-1.5 text-xs">
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
            <button
              onClick={handleViewSwitch}
              className="hidden md:flex group relative p-2 rounded-full bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm text-gray-400 hover:text-cyan-400 transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-95"
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
                  // Reset the flag when manually toggling MATCHDAY
                  wasMatchdayOpenBeforeSwitch.current = false;
                  
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
                className="hidden md:block group relative p-2 rounded-full bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm text-white hover:text-white transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-white/20 active:scale-95"
                title={feedColumns === 2 ? 'Show Live Football Hub' : 'Hide Live Football Hub'}
              >
                {/* Animated glow ring */}
                <div className={`absolute inset-0 rounded-full bg-gradient-to-r opacity-0 blur-sm transition-opacity duration-300 ${
                  feedColumns === 3 || isAnimatingOut
                    ? 'from-white/50 via-white/80 to-white/50 opacity-100 animate-pulse'
                    : 'from-white/0 via-white/50 to-white/0 group-hover:opacity-100'
                }`}></div>
                
                {/* Football Icon */}
                <svg 
                  className="relative z-10 text-white transition-all duration-300"
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  {/* Football/Soccer ball */}
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2 L15 8 L21 9 L16 14 L12 22 L8 14 L3 9 L9 8 Z" />
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

          {/* Right: Settings + Notifications + Online Status (desktop) + Drag-drop icon (desktop only) */}
          <div className="flex items-center gap-1">
            {/* Online Status - hidden on mobile (shown on left), visible on desktop */}
            <div className="hidden md:flex items-center gap-1.5 text-xs md:order-2 md:mr-1">
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
            {/* Settings button - mobile only, after API light */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => currentView === 'feed' ? setShowSettings(true) : setShowPagesSettings(true)}
              className="md:hidden relative h-8 w-8 flex-shrink-0 md:order-1"
            >
              <Settings className="h-4 w-4" />
            </Button>
            {/* Alerts button - after settings */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowAlerts(true)}
              className="relative h-8 w-8 md:h-10 md:w-10 flex-shrink-0 md:order-3"
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
      <div className="flex-1 flex flex-col overflow-hidden relative">
      {/* Feed View */}
      <div 
        className={`flex-1 flex flex-col overflow-hidden ${currentView === 'feed' ? '' : 'hidden'}`}
      >
      {currentView === 'feed' && (
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
              animation: (isViewSwitching || viewTransition === 'to-feed' || justSwitchedToFeed.current || wasMatchdayOpenBeforeSwitch.current) ? 'none' : (isAnimatingOut ? 'slideOutToLeft 0.5s ease-in-out forwards' : 'slideInFromLeft 0.5s ease-in-out')
            }}
          >
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              </div>
            }>
              <LiveFootballHub />
            </Suspense>
          </div>
        )}

        {/* Live Posts Column */}
        <div 
          className="flex flex-col h-full overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2" style={{ minHeight: '28px' }}>
            <div className="flex items-center justify-center gap-2 flex-1">
              <h2 className="text-base font-semibold text-[#1877F2] flex items-center gap-2" style={{ lineHeight: '1.5rem', margin: 0, padding: 0 }}>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                LIVE
              </h2>
              {/* Page filter dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowPageFilter(!showPageFilter)}
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-all bg-[#1877F2] hover:bg-[#1877F2]/80 text-white shadow-sm flex items-center gap-1"
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
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-[100] p-2 flex flex-wrap gap-2 max-w-[calc(100vw-2rem)]">
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
                          className="relative transition-all"
                          title={page.name}
                        >
                          <div className={`w-10 h-10 rounded-full overflow-hidden ${
                            isSelected ? 'ring-2 ring-[#1877F2]' : 'opacity-60 hover:opacity-100'
                          }`}>
                            {page.profilePicture ? (
                              <img 
                                src={page.profilePicture} 
                                alt={page.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
                                {page.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
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
            {(showAllLivePosts || !isIOS ? livePosts : livePosts.slice(0, 25)).map((post) => {
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
            {(!showAllLivePosts && isIOS && livePosts.length > 25) && (
              <button
                onClick={() => setShowAllLivePosts(true)}
                className="w-full py-3 px-4 bg-[#1877F2]/20 hover:bg-[#1877F2]/30 text-[#1877F2] font-semibold rounded-lg transition-all"
              >
                SEE MORE ({livePosts.length - 25} more posts)
              </button>
            )}
          </div>
        </div>

        {/* Popular Posts Column */}
        <div 
          className="flex flex-col h-full overflow-hidden"
        >
          <div className="flex items-center justify-between mb-2" style={{ minHeight: '28px' }}>
            <div className="flex items-center justify-center gap-2 flex-1">
              <TrendingUp className="h-5 w-5 animate-pulse text-cyan-400" />
              
              {/* Three Logo Buttons */}
              <div className="flex gap-1">
                {/* Facebook Button */}
                <button
                  onClick={() => setFeedType('popular')}
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    feedType === 'popular' 
                      ? 'bg-[#1877F2] text-white scale-110 shadow-lg shadow-[#1877F2]/50' 
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                  }`}
                  title="Facebook Posts"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </button>

                {/* X (Twitter) Button */}
                <button
                  onClick={() => setFeedType('twitter')}
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    feedType === 'twitter' 
                      ? 'bg-gray-900 text-white scale-110 shadow-lg shadow-gray-900/50' 
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                  }`}
                  title="X (Twitter) Posts"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </button>

                {/* Reddit Button */}
                <button
                  onClick={() => setFeedType('reddit')}
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    feedType === 'reddit' 
                      ? 'bg-[#FF4500] text-white scale-110 shadow-lg shadow-[#FF4500]/50' 
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                  }`}
                  title="Reddit Posts"
                >                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498 .056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                  </svg>
                </button>
              </div>
            
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
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-all bg-[#1877F2] hover:bg-[#1877F2]/80 text-white shadow-sm flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {popularTimeFilter === 'today' ? 'Today' : popularTimeFilter}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTimeFilter && (
                  <div className="absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[80px] max-w-[calc(100vw-2rem)]">
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
            {feedType === 'reddit' ? (
              <>
                {/* Mock Reddit Posts */}
                <div className="sticky top-0 z-10 relative h-0.5 bg-[#FF4500]/30 mb-3 overflow-hidden flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#FF4500] to-transparent animate-pulse"></div>
                </div>
                {[
                  {
                    id: '1',
                    title: 'Maccabi Tel Aviv 0-2 Midtjylland - Philip Billing 71\'',
                    author: 'u/soccer_fan',
                    subreddit: 'soccer',
                    upvotes: 6835,
                    comments: 251,
                    created: Date.now() - 3600000,
                    url: 'https://v.redd.it/t3oe1zd09xwf1',
                    thumbnail: 'https://via.placeholder.com/140x140?text=Video'
                  },
                  {
                    id: '2',
                    title: 'Sheffield Wednesday file for administration',
                    author: 'u/football_news',
                    subreddit: 'soccer',
                    upvotes: 363,
                    comments: 126,
                    created: Date.now() - 7200000,
                    url: 'https://news.sky.com/story/sheffield-wednesday',
                    thumbnail: 'https://via.placeholder.com/140x140?text=News'
                  },
                  {
                    id: '3',
                    title: 'Morgan Gibbs-White: "I feel like I can finally breathe. Happy to get our first win in 9..."',
                    author: 'u/premier_league',
                    subreddit: 'soccer',
                    upvotes: 3701,
                    comments: 344,
                    created: Date.now() - 10800000,
                    url: 'https://v.redd.it/2wkq34a5kxwf1',
                    thumbnail: 'https://via.placeholder.com/140x140?text=Video'
                  },
                  {
                    id: '4',
                    title: 'Free Talk Friday',
                    author: 'u/AutoModerator',
                    subreddit: 'soccer',
                    upvotes: 9,
                    comments: 448,
                    created: Date.now() - 14400000,
                    url: 'https://www.reddit.com/r/soccer/comments/1oesr4z/free_talk_friday/',
                    thumbnail: 'https://via.placeholder.com/140x140?text=Discussion'
                  },
                  {
                    id: '5',
                    title: 'Daily Discussion',
                    author: 'u/AutoModerator',
                    subreddit: 'soccer',
                    upvotes: 26,
                    comments: 719,
                    created: Date.now() - 18000000,
                    url: 'https://www.reddit.com/r/soccer/comments/1oe4246/daily_discussion/',
                    thumbnail: 'https://via.placeholder.com/140x140?text=Discussion'
                  }
                ].map((redditPost) => (
                  <div key={redditPost.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-[#FF4500] transition-all">
                    <div className="flex gap-3">
                      {/* Upvote section */}
                      <div className="flex flex-col items-center gap-1 text-xs">
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 4l8 8h-6v8h-4v-8H4z"/>
                        </svg>
                        <span className="font-bold text-[#FF4500]">{redditPost.upvotes.toLocaleString()}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 20l-8-8h6V4h4v8h6z"/>
                        </svg>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                          <span className="font-semibold text-[#FF4500]">r/{redditPost.subreddit}</span>
                          <span>•</span>
                          <span>{redditPost.author}</span>
                          <span>•</span>
                          <span>{Math.floor((Date.now() - redditPost.created) / 3600000)}h ago</span>
                        </div>
                        <h3 className="text-white font-semibold mb-2 line-clamp-2">{redditPost.title}</h3>
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <MessageCircle className="w-4 h-4" />
                            <span>{redditPost.comments} comments</span>
                          </div>
                          <button className="flex items-center gap-1 hover:text-white transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            <span>Share</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : feedType === 'popular' ? (
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
                {(showAllPopularPosts || !isIOS ? popularPosts : popularPosts.slice(0, 25)).map((post, index) => {
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
                {(!showAllPopularPosts && isIOS && popularPosts.length > 25) && (
                  <button
                    onClick={() => setShowAllPopularPosts(true)}
                    className="w-full py-3 px-4 bg-[#1877F2]/20 hover:bg-[#1877F2]/30 text-[#1877F2] font-semibold rounded-lg transition-all"
                  >
                    SEE MORE ({popularPosts.length - 25} more posts)
                  </button>
                )}
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
                {(showAllTwitterPosts || !isIOS ? twitterQuery.data?.tweets : twitterQuery.data?.tweets?.slice(0, 25))?.map((tweet: any) => {
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
                    <div className="glass-card rounded-xl overflow-hidden hover:bg-white/5 transition-colors" data-tweet-id={tweet.id}>
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
                        {tweet.text && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                              onClick={() => {
                                const cleanText = tweet.text.replace(/https:\/\/t\.co\/\S+/g, '').trim();
                                navigator.clipboard.writeText(cleanText);
                                toast.success('Caption copied to clipboard');
                              }}
                              title="Copy caption"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>

                          </>
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
                        {/* Copy image button overlay - always visible on hover */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyTweetImage(tweet.image);
                            }}
                            className="h-8 w-8 rounded bg-black/50 hover:bg-black/70 text-white flex items-center justify-center transition-all hover:scale-110 backdrop-blur-sm"
                            title="Copy image to clipboard"
                          >
                            <ImageIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                    </div>
                  </div>
                  );
                 })}
                {(!showAllTwitterPosts && isIOS && twitterQuery.data?.tweets && twitterQuery.data.tweets.length > 25) && (
                  <button
                    onClick={() => setShowAllTwitterPosts(true)}
                    className="w-full py-3 px-4 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-lg transition-all"
                  >
                    SEE MORE ({twitterQuery.data.tweets.length - 25} more tweets)
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: Single Column with Switchable View */}
      <div className="md:hidden flex flex-col flex-1 overflow-hidden">
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
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium transition-all bg-[#1877F2] hover:bg-[#1877F2]/80 text-white shadow-sm flex items-center gap-1"
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
                  <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-[100] p-2 flex flex-wrap gap-2 max-w-[calc(100vw-2rem)]">
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
                          className="relative transition-all"
                          title={page.name}
                        >
                          <div className={`w-10 h-10 rounded-full overflow-hidden ${
                            isSelected ? 'ring-2 ring-[#1877F2]' : 'opacity-60 hover:opacity-100'
                          }`}>
                            {page.profilePicture ? (
                              <img 
                                src={page.profilePicture} 
                                alt={page.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">
                                {page.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
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
                  <div className="absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[80px] max-w-[calc(100vw-2rem)]">
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
                      {tweet.text && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-300"
                          onClick={() => {
                            const cleanText = tweet.text.replace(/https:\/\/t\.co\/\S+/g, '').trim();
                            navigator.clipboard.writeText(cleanText);
                            toast.success('Caption copied to clipboard');
                          }}
                          title="Copy caption"
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
        
      </div>

        </>
      )}
      </div>
      
      {/* Pages View */}
      <div 
        className={`flex-1 flex flex-col overflow-hidden ${currentView === 'pages' ? '' : 'hidden'}`}
      >
      {currentView === 'pages' && (
        /* Pages View - 3 Facebook Pages */
        <>
          {/* Mobile View Selector - Hidden, moved to footer */}
          <div className="hidden">
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
                      className="h-8 w-8 rounded-full overflow-hidden flex-shrink-0"
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
                    hidePageHeader={true}
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
      </div>

      {/* Bottom Navigation Bar - Feed View */}
      {currentView === 'feed' && createPortal(
        <>
          <div className="md:hidden fixed left-0 right-0 bg-gray-900/30 backdrop-blur-md border-t border-white/10" style={{ bottom: 0, zIndex: 9999, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="flex items-center justify-between px-4" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
              {/* Switch Button - Left Corner */}
              <button
                onClick={() => {
                  setIsViewSwitching(true);
                  setViewTransition('to-pages');
                  setTimeout(() => {
                    setCurrentView('pages');
                    setViewTransition('none');
                    setTimeout(() => {
                      setIsViewSwitching(false);
                    }, 600);
                  }, 500);
                }}
                className="flex items-center justify-center p-3 rounded-full bg-gray-800/80 backdrop-blur-sm text-gray-300 hover:text-white transition-all active:scale-90"
                title="Switch to Pages"
              >
                <svg 
                  width="24" 
                  height="24" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <polyline points="17 1 21 5 17 9"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <polyline points="7 23 3 19 7 15"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
              </button>
              
              {/* Center Navigation - 3 items */}
              <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => setMobileView('live')}
                className={`flex items-center justify-center transition-all p-2 ${
                  mobileView === 'live' ? 'text-[#1877F2]' : 'text-gray-400'
                }`}
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
              
              <button
                onClick={() => setMobileView('popular')}
                className={`flex items-center justify-center transition-all p-2 ${
                  mobileView === 'popular' ? 'text-green-500' : 'text-gray-400'
                }`}
              >
                <TrendingUp className="w-8 h-8" />
              </button>
              
              <button
                onClick={() => setMobileView('twitter')}
                className={`flex items-center justify-center transition-all p-2 ${
                  mobileView === 'twitter' ? 'text-white' : 'text-gray-400'
                }`}
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>
              </div>
              
              {/* Create Post Button - Right Corner */}
              <button
                onClick={() => {
                  setDroppedImage(null);
                  setShowCreatePost(true);
                }}
                className="flex items-center justify-center p-3 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white transition-all active:scale-90"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Floating Action Buttons - Pages View */}
      {currentView === 'pages' && (() => {
        const activePage = managedPagesQuery.data?.find((page: any, index: number) => 
          (index === 0 && pagesView === 'away-days') || 
          (index === 1 && pagesView === 'funnys') || 
          (index === 2 && pagesView === 'footy-feed')
        );
        const tintColor = activePage?.borderColor || '#1F2937';
        
        return createPortal(
          <>
            {/* Bottom Navigation Bar - Pages View */}
            <div 
              className="md:hidden fixed left-0 right-0 backdrop-blur-md border-t border-white/10" 
              style={{ 
                bottom: 0, 
                zIndex: 9999, 
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                backgroundColor: `${tintColor}15` // 15 is ~8% opacity in hex
              }}
            >
              <div className="flex items-center justify-between px-4" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
                {/* Switch Button - Left Corner */}
                <button
                  onClick={() => {
                    setIsViewSwitching(true);
                    setViewTransition('to-feed');
                    justSwitchedToFeed.current = true;
                    // Note: On mobile, MATCHDAY is never visible, so no need to track state
                    setTimeout(() => {
                      setCurrentView('feed');
                      setViewTransition('none');
                      setTimeout(() => {
                        setIsViewSwitching(false);
                        setTimeout(() => {
                          justSwitchedToFeed.current = false;
                        }, 100);
                      }, 600);
                    }, 500);
                  }}
                  className="flex items-center justify-center p-3 rounded-full bg-gray-800/80 backdrop-blur-sm text-gray-300 hover:text-white transition-all active:scale-90"
                  title="Switch to Feed"
                >
                  <svg 
                    width="24" 
                    height="24" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <polyline points="17 1 21 5 17 9"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                </button>
                
                {/* Center Navigation - 3 page selectors */}
                <div className="flex items-center justify-center gap-8">
                {/* Page Selector Buttons */}
                {managedPagesQuery.data && managedPagesQuery.data.map((page: any, index: number) => {
                  const isActive = (index === 0 && pagesView === 'away-days') || 
                                   (index === 1 && pagesView === 'funnys') || 
                                   (index === 2 && pagesView === 'footy-feed');
                  const viewName = index === 0 ? 'away-days' : index === 1 ? 'funnys' : 'footy-feed';
                  
                  return (
                    <button
                      key={page.id}
                      onClick={() => {
                        console.log('Switching to page:', viewName);
                        setPagesView(viewName as any);
                      }}
                      className="flex items-center justify-center transition-all p-2"
                    >
                      <div 
                        className={`h-8 w-8 rounded-full overflow-hidden flex-shrink-0 transition-all ${
                          isActive 
                            ? 'ring-2 ring-white/50 scale-110' 
                            : 'opacity-60'
                        }`}
                        style={{ 
                          border: `2px solid ${page.borderColor}`,
                          backgroundColor: isActive ? `${page.borderColor}20` : 'transparent'
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
                
                {/* Create Post Button - Right Corner */}
                <button
                  onClick={() => {
                    setDroppedImage(null);
                    setShowCreatePost(true);
                  }}
                  className="flex items-center justify-center p-3 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white transition-all active:scale-90"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>
          </>,
          document.body
        );
      })()}

      {/* Dialogs - Rendered outside view conditionals to appear as overlays */}
      <Suspense fallback={null}>
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
      </Suspense>
    </div>
  );
}

