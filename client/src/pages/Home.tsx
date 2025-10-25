import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useMemo, useRef, lazy, Suspense } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { Settings, Play, Pause, Bell, TrendingUp, Loader2, RefreshCw, ArrowUp, Plus, ImagePlus, Download, Heart, Repeat2, MessageCircle, Copy, Trash2, ImageIcon, ExternalLink, X } from "lucide-react";
import PostCard from "@/components/PostCard";
import FacebookPageColumn from "@/components/FacebookPageColumn";
import { RedditFeed } from "@/components/RedditFeed";
import { ImageModal } from "@/components/ImageModal";
import { PostCardSkeletonList } from "@/components/PostCardSkeleton";
import { TwitterPostSkeletonList } from "@/components/TwitterPostSkeleton";

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
  const [isCreatePostMinimized, setIsCreatePostMinimized] = useState(false);
  const [droppedImage, setDroppedImage] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'facebook' | 'twitter' | 'reddit' | 'matchday'>('facebook');
  const [facebookView, setFacebookView] = useState<'live' | 'popular'>('live');
  const [lastTapTime, setLastTapTime] = useState(0);

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
  const [twitterTimeFilter, setTwitterTimeFilter] = useState<'live' | '2hr' | '6hr' | 'today'>('live');
  const [redditSort, setRedditSort] = useState<'new' | 'popular'>('new');
  const [feedType, setFeedType] = useState<'popular' | 'twitter' | 'reddit'>('popular');
  const [pendingFeedType, setPendingFeedType] = useState<'popular' | 'twitter' | 'reddit' | null>(null);
  const [isFeedTypeAnimating, setIsFeedTypeAnimating] = useState(false);
  const [isPopularTimeFilterAnimating, setIsPopularTimeFilterAnimating] = useState(false);
  const [isTwitterTimeFilterAnimating, setIsTwitterTimeFilterAnimating] = useState(false);
  const [pendingPopularTimeFilter, setPendingPopularTimeFilter] = useState<string | null>(null);
  const [pendingTwitterTimeFilter, setPendingTwitterTimeFilter] = useState<string | null>(null);
  const [showTimeFilter, setShowTimeFilter] = useState(false);
  const [openIconDropdown, setOpenIconDropdown] = useState<'popular' | 'twitter' | 'reddit' | null>(null); // Track which icon's dropdown is open
  const [selectedPageFilters, setSelectedPageFilters] = useState<Set<string>>(new Set()); // Set of selected page IDs
  const [showPageFilter, setShowPageFilter] = useState(false);
  const [newPostIds, setNewPostIds] = useState<Set<string>>(new Set());
  const [previousPostIds, setPreviousPostIds] = useState<Set<string>>(new Set());

  // Handle icon click: navigate on first click, toggle dropdown on second click
  const handleIconClick = (type: 'popular' | 'twitter' | 'reddit') => {
    if (feedType === type) {
      // Already on this feed, toggle dropdown
      setOpenIconDropdown(openIconDropdown === type ? null : type);
    } else {
      // Navigate to this feed
      handleFeedTypeChange(type);
      setOpenIconDropdown(null); // Close any open dropdown
    }
  };

  // Handle animated feed type switching
  const handleFeedTypeChange = (newType: 'popular' | 'twitter' | 'reddit') => {
    if (newType === feedType || isFeedTypeAnimating) return;
    
    setPendingFeedType(newType);
    setIsFeedTypeAnimating(true);
    
    // After slide-out animation completes (300ms), change feed type
    setTimeout(() => {
      setFeedType(newType);
      setPendingFeedType(null);
      
      // After slide-in animation completes (300ms), reset animating state
      setTimeout(() => {
        setIsFeedTypeAnimating(false);
      }, 300);
    }, 300);
  };

  // Handle animated time filter switching
  const handlePopularTimeFilterChange = (newFilter: '2hr' | '6hr' | 'today') => {
    if (newFilter === popularTimeFilter || isPopularTimeFilterAnimating) return;
    
    setPendingPopularTimeFilter(newFilter);
    setIsPopularTimeFilterAnimating(true);
    setShowTimeFilter(false);
    
    setTimeout(() => {
      setPopularTimeFilter(newFilter);
      setPendingPopularTimeFilter(null);
      
      setTimeout(() => {
        setIsPopularTimeFilterAnimating(false);
      }, 300);
    }, 300);
  };

  const handleTwitterTimeFilterChange = (newFilter: 'live' | '2hr' | '6hr' | 'today') => {
    if (newFilter === twitterTimeFilter || isTwitterTimeFilterAnimating) return;
    
    setPendingTwitterTimeFilter(newFilter);
    setIsTwitterTimeFilterAnimating(true);
    setShowTimeFilter(false);
    
    setTimeout(() => {
      setTwitterTimeFilter(newFilter);
      setPendingTwitterTimeFilter(null);
      
      setTimeout(() => {
        setIsTwitterTimeFilterAnimating(false);
      }, 300);
    }, 300);
  };
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
  // Auto-pause Twitter between midnight and 8am UK time
  const isTwitterActiveTime = () => {
    const now = new Date();
    const ukTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/London' }));
    const hour = ukTime.getHours();
    return hour >= 8 || hour < 0; // Active from 8am to midnight (0-23, so >= 8)
  };
  
  const [twitterPlaying, setTwitterPlaying] = useState(isTwitterActiveTime());
  const [showAllLivePosts, setShowAllLivePosts] = useState(false); // Track if "SEE MORE" clicked for Live posts
  const [showAllPopularPosts, setShowAllPopularPosts] = useState(false); // Track if "SEE MORE" clicked for Popular posts
  const [showAllTwitterPosts, setShowAllTwitterPosts] = useState(false); // Track if "SEE MORE" clicked for Twitter posts
  const [expandedTwitterImage, setExpandedTwitterImage] = useState<string | null>(null); // Track expanded Twitter image
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
    { 
      limit: 50,
      timeFilter: twitterTimeFilter
    }, 
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

  // Twitter: Periodically fetch from API when in active time window
  useEffect(() => {
    // Check if we're in active time window
    const checkAndUpdate = () => {
      const isActive = isTwitterActiveTime();
      setTwitterPlaying(isActive);
      return isActive;
    };
    
    // Initial check
    if (!checkAndUpdate()) return;
    
    // Fetch immediately when starting
    twitterQuery.refetch();
    
    // Check every minute if we should still be active
    const timeCheckInterval = setInterval(() => {
      checkAndUpdate();
    }, 60000); // Check every minute
    
    // Fetch tweets every 30 seconds when active
    const fetchInterval = setInterval(() => {
      if (isTwitterActiveTime()) {
        twitterQuery.refetch();
      }
    }, 30000);
    
    return () => {
      clearInterval(timeCheckInterval);
      clearInterval(fetchInterval);
    };
  }, []);
  
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

  // Click-away behavior for icon dropdowns
  useEffect(() => {
    if (!openIconDropdown) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the dropdown and its trigger button
      if (!target.closest('.icon-dropdown') && !target.closest('.icon-dropdown-trigger')) {
        setOpenIconDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openIconDropdown]);

  // Click-away behavior for time filter dropdown
  useEffect(() => {
    if (!showTimeFilter) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the dropdown and its trigger button
      if (!target.closest('.time-filter-dropdown') && !target.closest('.time-filter-trigger')) {
        setShowTimeFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTimeFilter]);

  // Click-away behavior for page filter dropdown
  useEffect(() => {
    if (!showPageFilter) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // Check if click is outside the dropdown and its trigger button
      if (!target.closest('.page-filter-dropdown') && !target.closest('.page-filter-trigger')) {
        setShowPageFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPageFilter]);

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

  // Animate all posts when switching from Pages to Feed
  useEffect(() => {
    if (currentView === 'feed' && viewTransition === 'to-feed' && !isViewSwitching) {
      // Mark all current posts as new to trigger printer animation
      const allLivePostIds = new Set(postsQuery.data?.posts.map(p => p.id) || []);
      const allPopularPostIds = new Set(popularPosts.map(p => p.id));
      const allTweetIds = new Set(twitterQuery.data?.tweets.map(t => t.id) || []);
      
      if (allLivePostIds.size > 0) {
        setNewPostIds(allLivePostIds);
        setTimeout(() => setNewPostIds(new Set()), 2000);
      }
      
      if (allPopularPostIds.size > 0) {
        setNewPopularPostIds(allPopularPostIds);
        setTimeout(() => setNewPopularPostIds(new Set()), 2000);
      }
      
      if (allTweetIds.size > 0) {
        setNewTweetIds(allTweetIds);
        setTimeout(() => setNewTweetIds(new Set()), 2000);
      }
    }
  }, [currentView, viewTransition, isViewSwitching, postsQuery.data?.posts, popularPosts, twitterQuery.data?.tweets]);

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
          {/* Left: MATCHDAY football (iOS) or Football Toggle/Search (Desktop) */}
          <div className="flex items-center gap-2">
            {/* Search button - Desktop only, Pages mode only, far left */}
            {currentView === 'pages' && (
              <button
                onClick={() => {
                  // Navigate to coming soon page
                  window.location.href = '/coming-soon';
                }}
                className="hidden md:flex items-center justify-center text-gray-400 hover:text-cyan-400 transition-colors duration-200 active:scale-95"
                title="Search"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                {/* Magnifying glass icon */}
                <svg 
                  className="w-[18px] h-[18px]"
                  viewBox="0 0 24 24" 
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </button>
            )}
            
            {/* MATCHDAY button - iOS only, far left, works in both Feed and Pages mode */}
            <button
              onClick={() => {
                if (mobileView === 'matchday') {
                  // If already in MATCHDAY, go back to facebook
                  setMobileView('facebook');
                } else {
                  // Open MATCHDAY
                  setMobileView('matchday');
                }
              }}
              className={`md:hidden flex items-center justify-center transition-all active:scale-95 ${
                mobileView === 'matchday' ? 'text-green-500' : 'text-gray-400 hover:text-green-500'
              }`}
              title={mobileView === 'matchday' ? 'Close MATCHDAY' : 'Open MATCHDAY'}
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              {/* Football/Soccer ball icon */}
              <svg 
                className="w-5 h-5 transition-all duration-300"
                viewBox="0 0 24 24" 
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8l-2 3h4l-2 3" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="M4.93 4.93l1.41 1.41" />
                <path d="M17.66 17.66l1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="M6.34 17.66l-1.41 1.41" />
                <path d="M19.07 4.93l-1.41 1.41" />
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
                className={`hidden md:flex items-center justify-center transition-colors duration-200 active:scale-95 ${
                  feedColumns === 3 || isAnimatingOut
                    ? 'text-green-400'
                    : 'text-gray-400 hover:text-green-400'
                }`}
                title={feedColumns === 2 ? 'Show Live Football Hub' : 'Hide Live Football Hub'}
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                {/* Football/Soccer ball icon - matches iOS design */}
                <svg 
                  className="w-[18px] h-[18px] transition-all duration-300"
                  viewBox="0 0 24 24" 
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8l-2 5h4l-2 5" />
                  <path d="M8.5 14.5l-3 1.5" />
                  <path d="M15.5 14.5l3 1.5" />
                  <path d="M6.34 6.34l1.41 1.41" />
                  <path d="M17.66 6.34l-1.41 1.41" />
                  <path d="M4.93 17.07l1.41-1.41" />
                  <path d="M17.66 17.66l1.41-1.41" />
                  <path d="M6.34 17.66l-1.41 1.41" />
                  <path d="M19.07 4.93l-1.41 1.41" />
                </svg>
              </button>
            )}
          </div>

          {/* Center: SDL MEDIA title with switch button on desktop */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className="flex items-center gap-3">
              {/* Switch button - Desktop only, left of SDL MEDIA */}
              <button
                onClick={() => setCurrentView(currentView === 'feed' ? 'pages' : 'feed')}
                className="hidden md:flex items-center justify-center text-gray-400 hover:text-white transition-colors duration-200 active:scale-95"
                title={currentView === 'feed' ? 'Switch to Pages' : 'Switch to Feed'}
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12m-12 5h12M4 7h.01M4 12h.01M4 17h.01" />
                </svg>
              </button>
              {/* SDL MEDIA logo as clickable upload button with animation */}
              <button
                onClick={() => {
                  setDroppedImage(null);
                  setShowCreatePost(true);
                }}
                className="group flex items-center gap-2 transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                title="Create Post"
                style={{ background: 'none', border: 'none', padding: 0 }}
              >
                <h1 className="text-xl md:text-2xl font-bold text-white tracking-wider group-hover:text-[#1877F2] transition-colors duration-300" style={{ fontFamily: 'Impact, "Arial Black", sans-serif' }}>
                  SDL MEDIA
                </h1>
              </button>
              
              {/* Online Status light - always visible, no text */}
              <div className="flex items-center">
                {settingsQuery.data?.lastAPIStatus === "success" ? (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Settings (always visible) or Drag-drop icon (desktop) */}
          <div className="flex items-center gap-1">
            {/* Settings button - always visible on both mobile and desktop */}
            <button
              onClick={() => currentView === 'feed' ? setShowSettings(true) : setShowPagesSettings(true)}
              className="flex items-center justify-center text-gray-400 hover:text-white transition-colors duration-200 active:scale-95"
              title="Settings"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
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
        style={{
          animation: viewTransition === 'to-feed'
            ? 'slideInFromRight 0.5s ease-in-out'
            : viewTransition === 'to-pages'
              ? 'slideOutToRight 0.5s ease-in-out forwards'
              : 'none'
        }}
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
              {/* Facebook LIVE with integrated dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowPageFilter(!showPageFilter)}
                  className="page-filter-trigger text-base font-semibold text-[#1877F2] flex items-center gap-2 hover:opacity-80 transition-opacity"
                  style={{ lineHeight: '1.5rem', margin: 0, padding: 0, background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  LIVE
                </button>
                {showPageFilter && (
                  <div className="page-filter-dropdown absolute top-full left-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-[100] p-2 flex flex-wrap gap-2 max-w-[calc(100vw-2rem)]">
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
          </div>
          <div 
            ref={liveScrollRef} 
            className={`space-y-3 relative overflow-y-auto flex-1 pr-2 hide-scrollbar ${feedColumns === 3 || isAnimatingOut ? 'compact-posts' : ''}`} 
            style={{ 
              touchAction: 'pan-y'
            }}
          >
            {postsQuery.isLoading && (
              <PostCardSkeletonList count={3} />
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
          <div className="flex items-center justify-center mb-2" style={{ minHeight: '28px' }}>
            <div className="flex items-center justify-center gap-2 flex-1">
              
              {/* Three Logo Buttons with Integrated Dropdowns */}
              <div className="flex gap-2 items-center">
                {/* Facebook/Popular Button with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => handleIconClick('popular')}
                    className={`icon-dropdown-trigger flex items-center justify-center transition-colors ${
                      feedType === 'popular' 
                        ? 'text-[#1877F2]' 
                        : 'text-gray-400 hover:text-[#1877F2]'
                    }`}
                    title="Facebook Posts"
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </button>
                  {openIconDropdown === 'popular' && (
                    <div className="icon-dropdown absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[80px]">
                      {(['2hr', '6hr', 'today'] as const).map((time) => (
                        <button
                          key={time}
                          onClick={() => {
                            handlePopularTimeFilterChange(time);
                            setOpenIconDropdown(null);
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

                {/* X (Twitter) Button with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => handleIconClick('twitter')}
                    className={`icon-dropdown-trigger flex items-center justify-center transition-colors ${
                      feedType === 'twitter' 
                        ? 'text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                    title="X (Twitter) Posts"
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </button>
                  {openIconDropdown === 'twitter' && (
                    <div className="icon-dropdown absolute top-full mt-1 bg-black/90 border border-white/20 rounded-lg shadow-xl z-50 min-w-[80px] backdrop-blur-sm">
                      {(['live', '2hr', '6hr', 'today'] as const).map((time) => (
                        <button
                          key={time}
                          onClick={() => {
                            handleTwitterTimeFilterChange(time);
                            setOpenIconDropdown(null);
                          }}
                          className={`w-full px-3 py-2 text-xs font-medium text-left hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                            twitterTimeFilter === time ? 'text-white' : 'text-gray-400'
                          }`}
                        >
                          {time === 'live' ? 'LIVE' : time === 'today' ? 'Today' : time}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reddit Button with Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => handleIconClick('reddit')}
                    className={`icon-dropdown-trigger flex items-center justify-center transition-colors ${
                      feedType === 'reddit' 
                        ? 'text-[#FF4500]' 
                        : 'text-gray-400 hover:text-[#FF4500]'
                    }`}
                    title="Reddit Posts"
                    style={{ background: 'none', border: 'none', padding: 0 }}
                  >
                    <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498 .056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                    </svg>
                  </button>
                  {openIconDropdown === 'reddit' && (
                    <div className="icon-dropdown absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[80px]">
                      {(['today', '2hr'] as const).map((time) => (
                        <button
                          key={time}
                          onClick={() => {
                            handlePopularTimeFilterChange(time);
                            setOpenIconDropdown(null);
                          }}
                          className={`w-full px-3 py-2 text-xs font-medium text-left hover:bg-white/10 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                            popularTimeFilter === time ? 'text-secondary' : 'text-white/60'
                          }`}
                        >
                          {time === 'today' ? 'Popular' : 'Newest'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div 
            ref={popularScrollRef} 
            className={`space-y-3 overflow-y-auto flex-1 pr-2 hide-scrollbar relative ${feedColumns === 3 || isAnimatingOut ? 'compact-posts' : ''}`} 
            style={{ 
              touchAction: 'pan-y',
              animation: (isFeedTypeAnimating && pendingFeedType) || 
                         (feedType === 'popular' && isPopularTimeFilterAnimating && pendingPopularTimeFilter) ||
                         (feedType === 'twitter' && isTwitterTimeFilterAnimating && pendingTwitterTimeFilter)
                ? 'slideOutToRight 0.3s ease-in-out forwards' 
                : (isFeedTypeAnimating || 
                   (feedType === 'popular' && isPopularTimeFilterAnimating) ||
                   (feedType === 'twitter' && isTwitterTimeFilterAnimating))
                  ? 'slideInFromRight 0.3s ease-in-out' 
                  : 'none'
            }}
          >
            {feedType === 'reddit' ? (
              <RedditFeed sort={popularTimeFilter === 'today' ? 'top' : 'new'} />
            ) : feedType === 'popular' ? (
              <>
                {postsQuery.isLoading && (
                  <PostCardSkeletonList count={3} />
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
                  <TwitterPostSkeletonList count={3} />
                )}
                {!twitterQuery.isLoading && (!twitterQuery.data?.tweets || twitterQuery.data.tweets.length === 0) && (
                  <div className="glass-card p-6 rounded-xl text-center">
                    <p className="text-muted-foreground">{twitterPlaying ? 'No tweets found in your list.' : 'Twitter updates paused (midnight-8am UK time).'}</p>
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
                    <div className="group glass-card rounded-xl overflow-hidden hover:bg-white/5 transition-colors relative" data-tweet-id={tweet.id}>
                    {/* Profile Header */}
                    <div className="p-4 flex items-center gap-3">
                      <a
                        href={`https://twitter.com/${tweet.author.username}/status/${tweet.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 hover:opacity-80 transition-opacity"
                        title="Open tweet on X"
                      >
                        <img src={tweet.author.avatar} alt={tweet.author.name} className="w-12 h-12 rounded-full" loading="lazy" decoding="async" />
                      </a>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-white text-base">{tweet.author.name}</span>
                          {tweet.author.verified && (
                            <svg className="w-4 h-4 text-[#1D9BF0]" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/>
                            </svg>
                          )}
                        </div>
                        <p className="text-sm text-gray-500">@{tweet.author.username}</p>
                      </div>
                    </div>
                    
                    {/* Tweet Text */}
                    {cleanText && (
                      <div 
                        className="px-4 pb-2 cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => {
                          navigator.clipboard.writeText(cleanText);
                          toast.success('Caption copied to clipboard');
                        }}
                        title="Click to copy caption"
                      >
                        <p className="text-sm text-white/90">{cleanText}</p>
                      </div>
                    )}
                    
                    {/* Tweet Image (if available) */}
                    {tweet.image && (
                      <div 
                        className={`w-full overflow-hidden cursor-pointer relative group ${feedColumns === 3 || isAnimatingOut ? '-mx-2 mt-2' : 'mt-2'}`}
                        style={{
                          width: feedColumns === 3 || isAnimatingOut ? 'calc(100% + 1rem)' : '100%'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedTwitterImage(tweet.image);
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
                        {/* Image action buttons overlay */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyTweetImage(tweet.image);
                            }}
                            className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-900/80 backdrop-blur-sm hover:bg-gray-800 text-gray-300 hover:text-white transition-all border border-gray-700/50 hover:border-gray-600"
                            title="Copy image"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(tweet.image);
                            }}
                            className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-900/80 backdrop-blur-sm hover:bg-gray-800 text-gray-300 hover:text-white transition-all border border-gray-700/50 hover:border-gray-600"
                            title="Download image"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Engagement Stats - positioned after image */}
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
                      {timeAgo && (
                        <span className="text-gray-500 text-xs">{timeAgo}</span>
                      )}
                    </div>
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
        {mobileView === 'matchday' ? (
          <div className="flex flex-col h-full overflow-hidden">
            <Suspense fallback={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              </div>
            }>
              <LiveFootballHub />
            </Suspense>
          </div>
        ) : mobileView === 'facebook' ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Clean LIVE/POPULAR toggle - redesigned from scratch */}
            <div className="flex items-center justify-between px-4 py-2">
              {/* Left: LIVE/POPULAR buttons */}
              <div className="flex items-center gap-4">
                {/* LIVE button */}
                <button
                  onClick={() => setFacebookView('live')}
                  className="relative transition-all"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  <span className={`text-sm font-bold tracking-wide ${
                    facebookView === 'live' ? 'text-[#1877F2]' : 'text-gray-500'
                  }`}>
                    LIVE
                  </span>
                </button>
                
                {/* POPULAR button */}
                <button
                  onClick={() => setFacebookView('popular')}
                  className="relative transition-all"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  <span className={`text-sm font-bold tracking-wide ${
                    facebookView === 'popular' ? 'text-[#22c55e]' : 'text-gray-500'
                  }`}>
                    POPULAR
                  </span>
                </button>
              </div>
              
              {/* Right: Divider + Filter/Time button */}
              <div className="flex items-center gap-3">
                <div className="h-4 w-px bg-gray-700" />
              
              {/* Filter button - always visible, changes based on mode */}
              {facebookView === 'live' ? (
              <div className="relative">
                <button
                  onClick={() => setShowPageFilter(!showPageFilter)}
                  className="page-filter-trigger px-2 py-1 rounded text-[10px] font-bold text-[#1877F2] hover:bg-[#1877F2]/10 transition-all flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  FILTER
                </button>
                {showPageFilter && (
                  <div className="page-filter-dropdown absolute top-full left-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-[100] p-2 flex flex-wrap gap-2 max-w-[calc(100vw-2rem)]">
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
              ) : (
              <div className="relative">
                <button
                  onClick={() => setShowTimeFilter(!showTimeFilter)}
                  className="time-filter-trigger px-2 py-1 rounded text-[10px] font-bold text-[#22c55e] hover:bg-[#22c55e]/10 transition-all flex items-center gap-1"
                >
                  {popularTimeFilter === 'today' ? 'TODAY' : popularTimeFilter.toUpperCase()}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTimeFilter && (
                  <div className="time-filter-dropdown absolute top-full mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[80px] max-w-[calc(100vw-2rem)]">
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
              )}
              </div>
            </div>
            {/* Printer line - thin red line where new posts emerge from */}
            <div className="relative h-0.5 bg-red-500/30 mb-2 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-pulse"></div>
            </div>
            <div className="space-y-3 relative overflow-y-auto flex-1 hide-scrollbar" style={{ touchAction: 'pan-y' }}>
              {postsQuery.isLoading && (
                <PostCardSkeletonList count={3} />
              )}
              {!postsQuery.isLoading && (facebookView === 'live' ? livePosts : popularPosts).length === 0 && (
                <div className="glass-card p-6 rounded-xl text-center">
                  <p className="text-muted-foreground">No posts yet. Configure pages in Settings.</p>
                </div>
              )}
              {(facebookView === 'live' ? livePosts : popularPosts).map((post) => {
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
        ) : mobileView === 'twitter' ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Simplified Twitter header - centered X logo with dropdown */}
            <div className="flex items-center justify-center px-4 py-2 mb-3 flex-shrink-0">
              {/* Centered X logo */}
              <svg className="h-6 w-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              
              {/* Spacer */}
              <div className="flex-1" />
              
              {/* Time filter dropdown on right */}
              <div className="relative">
                <button
                  onClick={() => setShowTimeFilter(!showTimeFilter)}
                  className="time-filter-trigger px-2 py-1 rounded text-[10px] font-bold text-white hover:bg-white/10 transition-all flex items-center gap-1"
                >
                  {twitterTimeFilter === 'live' ? 'LIVE' : twitterTimeFilter === 'today' ? 'TODAY' : twitterTimeFilter.toUpperCase()}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showTimeFilter && (
                  <div className="time-filter-dropdown absolute top-full right-0 mt-1 bg-gray-900 border border-white/10 rounded-lg shadow-xl z-50 min-w-[80px]">
                    {(['live', '2hr', '6hr', 'today'] as const).map((time) => (
                      <button
                        key={time}
                        onClick={() => {
                          handleTwitterTimeFilterChange(time);
                          setShowTimeFilter(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-white/10 first:rounded-t-lg last:rounded-b-lg transition-colors ${
                          twitterTimeFilter === time ? 'bg-white/20 text-white' : 'text-gray-400'
                        }`}
                      >
                        {time === 'live' ? 'LIVE' : time === 'today' ? 'Today' : time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 hide-scrollbar" style={{ touchAction: 'pan-y' }}>
              {twitterQuery.isLoading && (
                <TwitterPostSkeletonList count={3} />
              )}
              {!twitterQuery.isLoading && (!twitterQuery.data?.tweets || twitterQuery.data.tweets.length === 0) && (
                <div className="glass-card p-6 rounded-xl text-center">
                  <p className="text-muted-foreground">{twitterPlaying ? 'No tweets found in your list.' : 'Twitter updates paused (midnight-8am UK time).'}</p>
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
                  <div className="group glass-card rounded-xl overflow-hidden hover:bg-white/5 transition-colors relative">
                  {/* Profile Header */}
                  <div className="p-4 flex items-center gap-3">
                    <a
                      href={`https://twitter.com/${tweet.author.username}/status/${tweet.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 hover:opacity-80 transition-opacity"
                      title="Open tweet on X"
                    >
                      <img src={tweet.author.avatar} alt={tweet.author.name} className="w-12 h-12 rounded-full" loading="lazy" decoding="async" />
                    </a>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-base">{tweet.author.name}</span>
                        {tweet.author.verified && (
                          <svg className="w-4 h-4 text-[#1D9BF0]" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/>
                          </svg>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">@{tweet.author.username}</p>
                    </div>
                  </div>
                  
                  {/* Tweet Text */}
                  {cleanText && (
                    <div 
                      className="px-4 pb-2 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => {
                        navigator.clipboard.writeText(cleanText);
                        toast.success('Caption copied to clipboard');
                      }}
                      title="Click to copy caption"
                    >
                      <p className="text-sm text-white/90">{cleanText}</p>
                    </div>
                  )}
                  
                  {/* Tweet Image (if available) */}
                  {tweet.image && (
                    <div 
                      className="w-full overflow-hidden cursor-pointer relative group"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedTwitterImage(tweet.image);
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
                      {/* Image action buttons overlay */}
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyTweetImage(tweet.image);
                          }}
                          className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-900/80 backdrop-blur-sm hover:bg-gray-800 text-gray-300 hover:text-white transition-all border border-gray-700/50 hover:border-gray-600"
                          title="Copy image"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const handleDownload = async () => {
                              try {
                                const response = await fetch(tweet.image);
                                const blob = await response.blob();
                                const url = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `tweet-${tweet.id}.jpg`;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(url);
                                document.body.removeChild(a);
                                toast.success('Image downloaded!');
                              } catch (error) {
                                console.error('Download failed:', error);
                                toast.error('Failed to download image');
                              }
                            };
                            handleDownload();
                          }}
                          className="flex items-center justify-center w-7 h-7 rounded-md bg-gray-900/80 backdrop-blur-sm hover:bg-gray-800 text-gray-300 hover:text-white transition-all border border-gray-700/50 hover:border-gray-600"
                          title="Download image"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
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
                    {timeAgo && (
                      <span className="text-gray-500 text-xs">{timeAgo}</span>
                    )}
                  </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        ) : mobileView === 'reddit' ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Minimalistic Reddit header - centered logo with NEW/POPULAR toggle */}
            <div className="flex items-center justify-between px-4 py-2 mb-3 flex-shrink-0">
              {/* Left: NEW/POPULAR buttons */}
              <div className="flex items-center gap-4">
                {/* NEW button */}
                <button
                  onClick={() => setRedditSort('new')}
                  className="relative transition-all"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  <span className={`text-sm font-bold tracking-wide ${
                    redditSort === 'new' ? 'text-[#FF4500]' : 'text-gray-500'
                  }`}>
                    NEW
                  </span>
                </button>
                
                {/* POPULAR button */}
                <button
                  onClick={() => setRedditSort('popular')}
                  className="relative transition-all"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                >
                  <span className={`text-sm font-bold tracking-wide ${
                    redditSort === 'popular' ? 'text-[#FF4500]' : 'text-gray-500'
                  }`}>
                    POPULAR
                  </span>
                </button>
              </div>
              
              {/* Center: Reddit logo */}
              <div className="absolute left-1/2 transform -translate-x-1/2">
                <svg className="w-6 h-6 text-[#FF4500]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                </svg>
              </div>
              
              {/* Right: Empty spacer for balance */}
              <div className="w-16" />
            </div>
            <div className="space-y-3 overflow-y-auto flex-1 hide-scrollbar" style={{ touchAction: 'pan-y' }}>
              <RedditFeed sort={redditSort === 'popular' ? 'top' : 'new'} />
            </div>
          </div>
        ) : null}
        
      </div>

        </>
      )}
      </div>
      
      {/* Pages View */}
      <div 
        className={`flex-1 flex flex-col overflow-hidden ${currentView === 'pages' ? '' : 'hidden'}`}
        style={{
          animation: viewTransition === 'to-pages'
            ? 'slideInFromRight 0.5s ease-in-out'
            : viewTransition === 'to-feed'
              ? 'slideOutToRight 0.5s ease-in-out forwards'
              : 'none'
        }}
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
          
          <div 
            className="md:hidden fixed left-0 right-0 bg-gray-900/30 backdrop-blur-md border-t border-white/10" 
            style={{ bottom: 0, zIndex: 9999, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            onTouchEnd={(e) => {
              const now = Date.now();
              const timeSinceLastTap = now - lastTapTime;
              
              if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
                // Double tap detected - switch to Pages view
                e.preventDefault();
                handleViewSwitch();
              }
              
              setLastTapTime(now);
            }}
          >
            <div className="flex items-center justify-center px-4" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
              {/* Center Navigation - 3 items (Facebook, Twitter, Reddit) */}
              <div className="flex items-center justify-center gap-8">
              <button
                onClick={() => setMobileView('facebook')}
                className={`flex items-center justify-center transition-all p-2 ${
                  mobileView === 'facebook' ? 'text-[#1877F2]' : 'text-gray-400'
                }`}
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </button>
              
              <button
                onClick={() => setMobileView('twitter')}
                className={`flex items-center justify-center transition-all p-2 ${
                  mobileView === 'twitter' ? 'text-white' : 'text-gray-400'
                }`}
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </button>
              
              <button
                onClick={() => setMobileView('reddit')}
                className={`flex items-center justify-center transition-all p-2 ${
                  mobileView === 'reddit' ? 'text-[#FF4500]' : 'text-gray-400'
                }`}
              >
                <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                </svg>
              </button>
              </div>
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
              onTouchEnd={(e) => {
                const now = Date.now();
                const timeSinceLastTap = now - lastTapTime;
                
                if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
                  // Double tap detected - switch to Feed view
                  e.preventDefault();
                  handleViewSwitch();
                }
                
                setLastTapTime(now);
              }}
            >
              <div className="flex items-center justify-center px-4" style={{ paddingTop: '8px', paddingBottom: '8px' }}>
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
                        className={`h-7 w-7 rounded-full overflow-hidden flex-shrink-0 transition-all ${
                          isActive 
                            ? 'ring-2 ring-white/50' 
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
          open={showCreatePost && !isCreatePostMinimized} 
          onOpenChange={(open) => {
            setShowCreatePost(open);
            setIsCreatePostMinimized(false);
            if (!open) setDroppedImage(null); // Clear dropped image when dialog closes
          }}
          onMinimize={() => {
            setIsCreatePostMinimized(true);
          }}
          initialImage={droppedImage}
        />
        
        {/* Minimized Create Post Floating Button */}
        {showCreatePost && isCreatePostMinimized && (
          <button
            onClick={() => setIsCreatePostMinimized(false)}
            className="fixed bottom-6 right-6 z-[9998] px-6 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-semibold shadow-2xl transition-all hover:scale-110 animate-pulse"
            title="Resume creating post"
          >
            Continue Post
          </button>
        )}
      </Suspense>
      
      {/* Twitter Image Modal with iOS gestures */}
      <ImageModal 
        imageUrl={expandedTwitterImage} 
        onClose={() => setExpandedTwitterImage(null)} 
      />
    </div>
  );
}

