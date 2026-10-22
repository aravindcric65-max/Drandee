import { useContext, useEffect, useRef, useState, useCallback, useMemo } from "react";
import { UserContext } from "../context/UserContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSwipeable } from "react-swipeable";
import "./Reels.css";

// Sub-components
import { VideoPlayer } from "../components/reels/VideoPlayer";
import { ProgressBar } from "../components/reels/ProgressBar";
import { TopSection } from "../components/reels/TopSection";
import { BottomSection } from "../components/reels/BottomSection";
import { RightActionBar } from "../components/reels/RightActionBar";
import { AudioPage } from "../components/reels/AudioPage";
import { PrivacyMenu } from "../components/reels/PrivacyMenu";
import { VelocityIndicator } from "../components/reels/VelocityIndicator";
import { ReportModal } from "../components/home/ReportModal";
import { CommentModal } from "../components/home/CommentModal";
import { ViewersModal } from "../components/home/ViewersModal";
import { determineContentType } from "../utils/contentType";

// Icons (kept for sheets)
import {
  DoubleTapIcon, LinkIcon, LoopIcon, ChevSmIcon, BookmarkSolidIcon,
  BookmarkSmIcon, WAIcon, TGIcon, TWIcon, MoreIcon,
} from "../components/reels/ReelsIcons";
import Navbar from "../components/Navbar";

/* ── Constants ── */
const API_BASE_URL = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "") + "/api";


/* Report options are now owned by ReportModal.
const REPORT_REASONS = [
  { id: "unwanted",       label: "Unwanted content",        emoji: "🚫" },
  { id: "sexual",         label: "Sexual or adult content", emoji: "⚠️" },
  { id: "illegal",        label: "Illegal content",         emoji: "⚖️" },
  { id: "misinformation", label: "False information",       emoji: "📢" },
  { id: "spam",           label: "Spam or misleading",      emoji: "📨" },
  { id: "violence",       label: "Violence or danger",      emoji: "🆘" },
]; */

/* ── Persist scroll position across mounts ── */
let _savedCur = 0;
let _savedApiFeed = [];
let _savedOffset = 0;
let _savedTab = "all";

/* ================================================================
   MAIN COMPONENT
================================================================ */
const Reels = () => {
  const {
    posts = [],
    user = null,
    giveRespect,
    savePost,
    followUser,
    unfollowUser,
    incrementShare,
    markWatched,
    markNotInterested,
    muteCreator,
    reportPost,
    userFeedback = {},
    // eslint-disable-next-line no-unused-vars
    postComments = {},
  } = useContext(UserContext) || {};

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetPostId = searchParams.get('postId');

  /* ── Feed ── */
  const [activeTab, setActiveTab] = useState(_savedTab);
  const [selectedCollection, setSelectedCollection] = useState("all");
  
  const [feed, setFeed] = useState([]);
  const [cur, setCur] = useState(_savedCur);
  const [paused, setPaused] = useState(false);
  const [apiFeed, setApiFeed] = useState(_savedApiFeed);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState(null);
  const [scrollCount, setScrollCount] = useState(0);

  /* ── Infinite Scroll Pagination ── */
  const [offset, setOffset] = useState(_savedOffset);
  const [hasMore, setHasMore] = useState(true);

  /* ── Optimistic trackers ── */
  const [respectedTracker, setRespectedTracker] = useState({});
  const [savedTracker, setSavedTracker] = useState({});
  const [followTracker, setFollowTracker] = useState({});
  const [savedCollNames, setSavedCollNames] = useState({});
  /* Live server-synced respect counts: { postId: number } */
  const [liveRespectCounts, setLiveRespectCounts] = useState({});
  /* Live server-synced comment counts: { postId: number } */
  const [liveCommentCounts, setLiveCommentCounts] = useState({});

  /* ── Caption ── */
  const [expandedCaption, setExpandedCaption] = useState({});

  /* ── Comment sheet ── */
  const [openCmt, setOpenCmt] = useState(null);
  const [openViews, setOpenViews] = useState(null);

  /* ── Share sheet ── */
  const [openShare, setOpenShare] = useState(null);
  const [shareCounts, setShareCounts] = useState({});
  const [copied, setCopied] = useState(false);

  /* ── Save sheet ── */
  const [openSave, setOpenSave] = useState(null);
  const [collectionName, setCollectionName] = useState("");

  /* ── Privacy / Audio / Badge ── */
  const [openPrivacy, setOpenPrivacy] = useState(null);
  const [openAudio, setOpenAudio] = useState(null);
  const [openReport, setOpenReport] = useState(null);
  const [feedbackMsg, setFeedbackMsg] = useState({});
  const [openAvOptions, setAvOptions] = useState(null);

  /* ── Mute / Speed Control / Pause Icon ── */
  const [speed, setSpeed] = useState(1.0);
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  const [showPauseIcon, setShowPauseIcon] = useState(false);
  
  const longPressTimer = useRef(null);
  const pauseTimer = useRef(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const handleMuteToggle = () => setIsMuted(prev => !prev);
  
  const handleSpeedLongPress = () => {
    longPressTimer.current = setTimeout(() => setShowSpeedControl(true), 500);
  };
  const handleSpeedRelease = () => clearTimeout(longPressTimer.current);

  /* ── Floating hearts ── */
  const [floatingIcons, setFloatingIcons] = useState([]);

  /* ── Refs ── */
  const isSharing = useRef(false);
  const isFetchingFeed = useRef(false);
  const lastTapRef = useRef(0);

  const anySheetOpen = openCmt || openShare || openSave || openPrivacy || openViews || openAvOptions || openAudio || openReport;

  /* ================================================================
     1. API FEED (Infinite Scroll)
  ================================================================ */
  const loadFeed = useCallback(async (isRefresh = false) => {
    if (isFetchingFeed.current || (!hasMore && !isRefresh)) return;
    
    isFetchingFeed.current = true;
    setFeedLoading(true);
    setFeedError(null);
    
    try {
      
      
      const currentOffset = isRefresh ? 0 : offset;
      const res = await fetch(`${API_BASE_URL}/feed?limit=20&offset=${currentOffset}`);

      if (res.status === 401) {
        setFeedError("Please login to view feed");
        return;
      }

      if (res.status === 429) { console.log("Rate limited"); return; }

      const data = await res.json();
      if (data.success) { 
        if (isRefresh) {
          setApiFeed(data.posts || []);
        } else {
          setApiFeed(prev => [...prev, ...(data.posts || [])]);
        }
        setOffset(currentOffset + 20);
        setHasMore(data.pagination?.hasMore ?? false);
        setFeedError(null);
      }
      else { console.log("Feed API failed", data); }
    } catch (err) {
      console.log("Feed API error:", err.message);
    } finally {
      setFeedLoading(false);
      isFetchingFeed.current = false;
    }
  }, [offset, hasMore]);

  // Initial load
  useEffect(() => { 
    if (apiFeed.length === 0) loadFeed(true); 
  }, [loadFeed, apiFeed.length]);

  // Load more when reaching near the end
  useEffect(() => {
    if (feed.length > 0 && cur >= feed.length - 3 && hasMore && !feedLoading) {
      loadFeed();
    }
  }, [cur, feed.length, hasMore, feedLoading, loadFeed]);

  /* ── Filter by tab ── */
  const filteredFeed = useMemo(() => {
    const videoPosts = apiFeed.filter(p => (p?.content_type === 'video' || determineContentType(p) === 'video'));
    if (activeTab === "saved") {
      let saved = videoPosts.filter((p) => user?.savedPosts?.includes(p.id) || savedTracker[p.id]);
      if (selectedCollection !== "all") {
        saved = saved.filter(p => user?.savedCollections?.[p.id] === selectedCollection);
      }
      return saved;
    }
    if (activeTab === "friends")
      return videoPosts.filter(p => user?.following?.includes(p.creatorId));
    return videoPosts;
  }, [apiFeed, activeTab, user?.savedPosts, user?.following, savedTracker, selectedCollection, user?.savedCollections]);

  useEffect(() => {
    const prevId = feed[_savedCur]?.id;
    const nextIdx = prevId ? filteredFeed.findIndex(p => p.id === prevId) : -1;
    setFeed(filteredFeed);
    if (targetPostId) {
      // Try to find the post index and jump directly to it
      const idx = filteredFeed.findIndex(p => String(p.id) === String(targetPostId));
      setCur(idx >= 0 ? idx : 0);
    } else if (nextIdx >= 0) {
      // Keep viewer on the same post after feed update
      setCur(nextIdx);
    } else {
      setCur(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFeed]);

  /* ── Mark watched ── */
  useEffect(() => {
    if (feed[cur] && markWatched && user?.id) markWatched(feed[cur].id);
  }, [cur, feed, markWatched, user?.id]);

  /* ── Persist tab / cursor ── */
  useEffect(() => { _savedCur = cur; }, [cur]);
  useEffect(() => { _savedApiFeed = apiFeed; }, [apiFeed]);
  useEffect(() => { _savedOffset = offset; }, [offset]);
  useEffect(() => { _savedTab = activeTab; }, [activeTab]);

  /* ================================================================
     NAVIGATION
  ================================================================ */

  const feedRef = useRef(feed);
  useEffect(() => { feedRef.current = feed; }, [feed]);

  useEffect(() => {
    const handleEngagement = (e) => {
      const { postId, engagement, action, delta } = e.detail || {};
      if (!postId) return;

      if (engagement) {
        if (engagement.respectCount !== undefined) {
          setLiveRespectCounts(prev => ({ ...prev, [postId]: engagement.respectCount }));
        }
        if (engagement.hasRespected !== undefined) {
          setRespectedTracker(prev => ({ ...prev, [postId]: engagement.hasRespected }));
        }
        if (engagement.hasSaved !== undefined) {
          setSavedTracker(prev => ({ ...prev, [postId]: engagement.hasSaved }));
        }
        if (engagement.shareCount !== undefined) {
          setShareCounts(prev => ({ ...prev, [postId]: engagement.shareCount }));
        }
        if (engagement.commentCount !== undefined) {
          setLiveCommentCounts(prev => ({ ...prev, [postId]: engagement.commentCount }));
        }
      } else if (action && typeof delta === 'number') {
        const p = feedRef.current?.find(x => x.id === postId) || {};
        if (action === 'respect') {
          setLiveRespectCounts(prev => {
            const current = prev[postId] !== undefined ? prev[postId] : (p.totalRespects || 0);
            return { ...prev, [postId]: Math.max(0, current + delta) };
          });
          setRespectedTracker(prev => ({ ...prev, [postId]: delta > 0 }));
        } else if (action === 'comment') {
          setLiveCommentCounts(prev => {
            const current = prev[postId] !== undefined ? prev[postId] : (p.comments || 0);
            return { ...prev, [postId]: Math.max(0, current + delta) };
          });
        } else if (action === 'share') {
          setShareCounts(prev => {
            const current = prev[postId] !== undefined ? prev[postId] : (p.shares || 0);
            return { ...prev, [postId]: Math.max(0, current + delta) };
          });
        } else if (action === 'save') {
          setSavedTracker(prev => ({ ...prev, [postId]: delta > 0 }));
        }
      }
    };
    window.addEventListener('engagement_updated', handleEngagement);
    return () => window.removeEventListener('engagement_updated', handleEngagement);
  }, []);

  const closeAllSheets = useCallback(() => {
    setOpenCmt(null);
    setOpenViews(null);
    setOpenShare(null);
    setOpenSave(null);
    setOpenPrivacy(null);
    setAvOptions(null);
    setOpenAudio(null);
    setOpenReport(null);
  }, []);

  const goTo = useCallback((n) => {
    if (n < 0 || n >= feed.length) return;
    closeAllSheets();
    setCur(n);
    setScrollCount((prev) => prev + 1);
  }, [feed.length, closeAllSheets]);

  /* ── Swipeable ── */
  const swipeHandlers = useSwipeable({
    onSwipedUp:    () => { if (!anySheetOpen) goTo(cur + 1); },
    onSwipedDown:  () => { if (!anySheetOpen) goTo(cur - 1); },
    onSwipedLeft:  () => { if (!anySheetOpen && feed[cur]) navigate(`/profile/${feed[cur].creatorId}`); },
    onSwipedRight: () => { if (!anySheetOpen && feed[cur]) { setOpenCmt(feed[cur].id); } },
    preventScrollOnSwipe: true,
    trackMouse: true,
  });

  /* ── Double tap / single tap ── */
  const handleViewportClick = useCallback((e) => {
    if (anySheetOpen) return;
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap → respect
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const colors = ["#FF3B30","#34C759","#007AFF","#FF9500","#AF52DE","#FFCC00"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const id = Date.now() + Math.random();
      setFloatingIcons((prev) => [...prev, { id, x, y, color }]);
      setTimeout(() => setFloatingIcons((prev) => prev.filter((f) => f.id !== id)), 1000);
      if (feed[cur]) {
        const postId = feed[cur].id;
        const currentPost = feed[cur];
        const isCurrently = respectedTracker[postId] !== undefined
          ? respectedTracker[postId]
          : (currentPost?.hasRespected || currentPost?.has_respected || user?.respectedVideos?.includes(postId) || false);
        if (!isCurrently) handleRespect(postId);
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      setPaused((p) => !p);
      setShowPauseIcon(true);
      clearTimeout(pauseTimer.current);
      pauseTimer.current = setTimeout(() => {
        setShowPauseIcon(false);
      }, 2000);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anySheetOpen, feed, cur, respectedTracker, user?.respectedVideos]);

  /* ================================================================
     2. RESPECT — Optimistic + server sync
  ================================================================ */
  const handleRespect = useCallback(async (postId) => {
    if (giveRespect) {
      giveRespect(postId);
    }
  }, [giveRespect]);

  /* ================================================================
     3. COMMENT
  ================================================================ */

  /* ================================================================
     4. SAVE
  ================================================================ */
  const handleSavePress = (postId) => {
    const isSaved = savedTracker[postId] !== undefined ? savedTracker[postId] : (user?.savedPosts?.includes(postId) ?? false);
    if (isSaved) {
      setSavedTracker((prev) => ({ ...prev, [postId]: false }));
      setSavedCollNames((prev) => { const n = { ...prev }; delete n[postId]; return n; });
      savePost && savePost(postId);
    } else {
      setOpenSave(postId);
      setCollectionName("");
      setOpenCmt(null);
      setOpenShare(null);
    }
  };

  const handleConfirmSave = (quickName) => {
    if (!openSave) return;
    const colName = quickName || collectionName.trim() || "Saved";
    setSavedTracker((prev) => ({ ...prev, [openSave]: true }));
    setSavedCollNames((prev) => ({ ...prev, [openSave]: colName }));
    savePost && savePost(openSave, colName);
    setOpenSave(null);
    setCollectionName("");
  };

  /* ================================================================
     5. SHARE
  ================================================================ */
  const handleShare = async (platform, postId) => {
    const deepLink = `https://drandee.app/reel/${postId}`;
    const shareText = "Check out this reel on Drandee!";
    // incrementShare is called only AFTER a confirmed share action, not on modal open
    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText + " " + deepLink)}`, "_blank");
      incrementShare && incrementShare(postId);
    } else if (platform === "telegram") {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`, "_blank");
      incrementShare && incrementShare(postId);
    } else if (platform === "twitter") {
      window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(deepLink)}&text=${encodeURIComponent(shareText)}`, "_blank");
      incrementShare && incrementShare(postId);
    } else if (platform === "more" || platform === "copy") {
      if (isSharing.current) return;
      try {
        if (navigator.share) {
          isSharing.current = true;
          await navigator.share({ title: "Drandee Reel", text: shareText, url: deepLink });
          incrementShare && incrementShare(postId); // only on confirmed share
        } else {
          await navigator.clipboard.writeText(deepLink);
          incrementShare && incrementShare(postId); // only on successful copy
          if (platform === "copy") {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } else {
            alert("Link copied to clipboard!");
          }
        }
      } catch (error) {
        console.log("Share cancelled or failed");
        // incrementShare is NOT called — user cancelled
      } finally {
        isSharing.current = false;
      }
    }
  };

  /* ================================================================
     6. FOLLOW
  ================================================================ */
  const handleFollow = (creatorId) => {
    const isFollowing = followTracker[creatorId] !== undefined ? followTracker[creatorId] : (user?.following?.includes(creatorId) ?? false);
    setFollowTracker((prev) => ({ ...prev, [creatorId]: !isFollowing }));
    if (isFollowing) unfollowUser && unfollowUser(creatorId);
    else followUser && followUser(creatorId);
  };

  /* ================================================================
     7. FEEDBACK
  ================================================================ */
  const handleNotInterested = (postId) => {
    markNotInterested && markNotInterested(postId);
    setFeedbackMsg((prev) => ({ ...prev, [postId]: "notInterested" }));
    setOpenPrivacy(null);
    setTimeout(() => goTo(cur + 1 < feed.length ? cur + 1 : Math.max(0, cur - 1)), 800);
  };

  const handleMute = (creatorId) => {
    muteCreator && muteCreator(creatorId);
    setOpenPrivacy(null);
    setTimeout(() => goTo(cur + 1 < feed.length ? cur + 1 : Math.max(0, cur - 1)), 400);
  };

  /* Legacy report callback retained temporarily while ReportModal owns submission.
  const handleReport = (reason) => {
    if (!openReport) return;
    reportPost && reportPost(openReport.postId, reason);
    setOpenReport(null);
    setOpenPrivacy(null);
    setFeedbackMsg((prev) => ({ ...prev, [openReport.postId]: "reported" }));
    setTimeout(() => goTo(cur + 1 < feed.length ? cur + 1 : Math.max(0, cur - 1)), 600);
  }; */

  /* ================================================================
     RENDER
  ================================================================ */
  return (
    <div className="reels-page">
      {/* ── CSS Keyframes injected inline so CSS file doesn't need @keyframes duplicated ── */}
      <style>{`
        @keyframes slideDown { from { transform:translateY(-20px); opacity:0; } to { transform:translateY(0); opacity:1; } }
        @keyframes slideUp   { from { transform:translateY(100%); } to { transform:translateY(0); } }
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
        @keyframes spinDisc  { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        @keyframes pulseGlow { 0%,100% { box-shadow:0 0 8px rgba(156,39,176,0.4); } 50% { box-shadow:0 0 22px rgba(156,39,176,0.8), 0 0 40px rgba(197,17,98,0.3); } }
        @keyframes floatUp   { 0% { transform:scale(0) rotate(-15deg); opacity:0; } 20% { transform:scale(1.2) rotate(10deg); opacity:1; } 100% { transform:scale(1) translateY(-120px); opacity:0; } }
        @keyframes badgeGlow { 0%,100% { background-position:0% 50%; } 50% { background-position:100% 50%; } }
        
        .mute-icon-overlay { position: absolute; top: calc(50% - 60px); left: 50%; transform: translateX(-50%); z-index: 160; }
        .mute-btn { width: 40px; height: 40px; border-radius: 50%; background: rgba(0, 0, 0, 0.6); border: 1px solid rgba(255, 255, 255, 0.3); display: flex; align-items: center; justify-content: center; cursor: pointer; }
        .pause-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 150; animation: fadeInOut 0.3s ease-out; }
        
        .speed-indicator { position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%); background: rgba(0, 0, 0, 0.8); padding: 8px 16px; border-radius: 20px; border: 1px solid rgba(156, 39, 176, 0.5); z-index: 300; animation: fadeIn 0.2s; }
        .speed-indicator span { font-size: 13px; color: #FFFFFF; font-weight: 600; }

        /* Speed Modal */
        .speed-modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7); display: flex; align-items: flex-end; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease-out; }
        .speed-modal-content { background: rgba(9, 10, 15, 0.98); width: 100%; max-width: 500px; padding: 24px; border-radius: 16px 16px 0 0; border-top: 1px solid rgba(156, 39, 176, 0.3); animation: slideUp 0.3s ease-out; }
        .speed-modal-content h4 { font-size: 18px; color: #FFFFFF; margin-bottom: 16px; text-align: center; font-weight: 700; margin-top: 0; }
        .speed-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        .speed-grid button { padding: 12px 8px; background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(156, 39, 176, 0.3); border-radius: 8px; color: #FFFFFF; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .speed-grid button.active { background: linear-gradient(135deg, #9c27b0, #c51162); border-color: #9c27b0; box-shadow: 0 0 10px rgba(156, 39, 176, 0.5); }
        .speed-grid button:hover { background: rgba(156, 39, 176, 0.2); transform: scale(1.05); }
        .speed-modal-content .close-btn { width: 100%; padding: 12px; background: linear-gradient(135deg, #9c27b0, #c51162); border: none; border-radius: 8px; color: #FFFFFF; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
        .speed-modal-content .close-btn:hover { opacity: 0.9; }

        /* Caption */
        .caption-container { max-width: 85%; background: rgba(0, 0, 0, 0.6); padding: 10px 14px; border-radius: 8px; margin: 8px 0; cursor: pointer; }
        .caption-text { font-size: 14px; color: #FFFFFF; line-height: 1.5; word-wrap: break-word; margin-bottom: 8px; max-height: 60px; overflow: hidden; }
        .caption-text.expanded { max-height: none; overflow: visible; }
        .more-less-btn { font-size: 12px; color: #9c27b0; background: none; border: none; cursor: pointer; font-weight: 600; display: block; margin-top: 4px; padding: 0; }
        .hashtags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .hashtag { font-size: 13px; color: #9c27b0; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
        .hashtag:hover { opacity: 0.8; text-decoration: underline; }
        /* Tag Page */
        .tag-page-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.2s ease; }
        .tag-page-content { background: rgba(9, 10, 15, 0.98); width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto; border-radius: 16px; padding: 20px; animation: slideUp 0.3s ease; }
        .tag-page-content .close-btn { font-size: 16px; color: #FFFFFF; background: none; border: none; cursor: pointer; margin-bottom: 16px; }
        .tag-title { font-size: 20px; color: #FFFFFF; margin-bottom: 4px; }
        .tag-count { font-size: 14px; color: rgba(255, 255, 255, 0.6); margin-bottom: 16px; }
        .tag-reels-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .tag-reel { position: relative; aspect-ratio: 9/16; border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform 0.2s; }
        .tag-reel:hover { transform: scale(0.98); }
        .tag-reel img { width: 100%; height: 100%; object-fit: cover; }
        .tag-reel-stats { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0, 0, 0, 0.7); padding: 4px; display: flex; flex-direction: column; gap: 2px; font-size: 10px; color: #FFFFFF; }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInOut { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>

      {/* Progress bar */}
      <ProgressBar current={cur} total={feed.length} onSeek={(i) => goTo(i)} />

      {/* Top dynamic section */}
      <VelocityIndicator />
      <TopSection
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onSearch={() => navigate("/search")}
        onViewsClick={() => feed[cur] && setOpenViews(feed[cur].id)}
        currentPost={feed[cur]}
        scrollCount={scrollCount}
        user={user}
        selectedCollection={selectedCollection}
        onCollectionChange={setSelectedCollection}
      />

      {/* Swipeable viewport */}
      <div className="reels-viewport" {...swipeHandlers} onClick={handleViewportClick}>
        {feedLoading ? (
          <div className="reels-empty-wrap">
            <div style={{ width: 40, height: 40, border: '3px solid rgba(156,39,176,0.3)', borderTopColor: '#9c27b0', borderRadius: '50%', animation: 'spinDisc 0.8s linear infinite', marginBottom: 16 }} />
            <p className="reels-empty-txt">Loading feed...</p>
          </div>
        ) : feedError && !feedLoading ? (
          <div className="reels-empty-wrap">
            <p className="reels-empty-txt">Error: {feedError}</p>
            <button className="reels-retry-btn" onClick={loadFeed}>Retry</button>
          </div>
        ) : feed.length === 0 ? (
          <div className="reels-empty-wrap">
            <p className="reels-empty-txt">
              {activeTab === "friends" ? "Follow creators to see their reels"
               : activeTab === "saved" ? "No saved reels — tap bookmark to save"
               : "No reels yet — check back soon"}
            </p>
            <button className="reels-retry-btn" onClick={() => loadFeed(true)}>Retry</button>
          </div>
        ) : (
          feed.map((p, i) => {
            const respected = respectedTracker[p.id] !== undefined
              ? respectedTracker[p.id]
              : (p.hasRespected || p.has_respected || user?.respectedVideos?.includes(p.id) || false);
            const saved = savedTracker[p.id] !== undefined
              ? savedTracker[p.id]
              : (p.hasSaved || p.has_saved || user?.savedPosts?.includes(p.id) || false);
            const following = followTracker[p.creatorId] !== undefined ? followTracker[p.creatorId] : (user?.following?.includes(p.creatorId) ?? false);
            const colName = savedCollNames[p.id] || null;
            /* Use server-synced count first, then context, then feed data */
            const liveRespects = liveRespectCounts[p.id] !== undefined
              ? liveRespectCounts[p.id]
              : (posts.find((x) => x.id === p.id)?.totalRespects ?? p.totalRespects ?? 0);
            const isCreatorMuted = userFeedback?.muted?.includes(p.creatorId) ?? false;
            const isActive = i === cur;

            return (
              <div
                key={p.id}
                className="reels-card"
                style={{ transform: `translateY(${(i - cur) * 100}%)`, background: "#090A0F" }}
              >
                {/* Video — only mount adjacent for performance */}
                {Math.abs(i - cur) <= 1 && (
                  <VideoPlayer post={p} isActive={isActive} paused={paused} speed={speed} globalMuted={isMuted} />
                )}

                {/* Floating double-tap hearts */}
                {isActive && floatingIcons.map((f) => (
                  <div key={f.id} style={{ position: 'absolute', left: f.x - 40, top: f.y - 40, pointerEvents: 'none', animation: 'floatUp 1s ease-out forwards', zIndex: 100 }}>
                    <DoubleTapIcon color={f.color} />
                  </div>
                ))}

                {/* Feedback overlay */}
                {feedbackMsg[p.id] && isActive && (
                  <div className="reels-fb-overlay">
                    <span className="reels-fb-title">
                      {feedbackMsg[p.id] === "reported" ? "Report submitted" : "Thanks for your feedback"}
                    </span>
                    <span className="reels-fb-sub">We'll show fewer posts like this</span>
                  </div>
                )}

                {/* Pause icon & Mute overlay on tap */}
                {showPauseIcon && isActive && (
                  <>
                    <div className="pause-icon">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="white">
                        {paused ? (
                          <path d="M8 5v14l11-7z"/>
                        ) : (
                          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                        )}
                      </svg>
                    </div>
                    <div className="mute-icon-overlay" onClick={(e) => e.stopPropagation()}>
                      <button onClick={handleMuteToggle} className="mute-btn">
                        {isMuted ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                          </svg>
                        ) : (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* Card body */}
                <div className="reels-card-body">
                  {/* Bottom section (left) */}
                  <BottomSection
                    post={p}
                    following={following}
                    saved={saved}
                    collectionName={colName}
                    user={user}
                    posts={posts}
                    paused={paused}
                    expandedCaption={expandedCaption[p.id] || false}
                    onToggleCaption={() => setExpandedCaption((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                    onFollow={handleFollow}
                    onTagClick={(tag) => navigate(`/tag/${tag}`)}
                    onAudioClick={() => setOpenAudio(p)}
                    onCreatorClick={(id) => navigate(`/profile/${id}`)}
                  />

                  {/* Right action bar */}
                  <RightActionBar
                    post={p}
                    respected={respected}
                    saved={saved}
                    liveRespects={liveRespects}
                    commentCount={liveCommentCounts[p.id] !== undefined ? liveCommentCounts[p.id] : (p.comments || 0)}
                    shareCount={shareCounts[p.id] !== undefined ? shareCounts[p.id] : (p.shares || 0)}
                    paused={paused}
                    onRespect={() => handleRespect(p.id)}
                    onComment={() => { setOpenCmt(p.id); setOpenShare(null); setOpenSave(null); }}
                    onShare={() => { setOpenShare(p.id); setOpenCmt(null); setOpenSave(null); }}
                    onSave={() => handleSavePress(p.id)}
                    onMore={() => { setOpenPrivacy({ post: p, isMuted: isCreatorMuted }); setOpenCmt(null); setOpenShare(null); setOpenSave(null); setShowSpeedControl(false); }}
                    onAudioClick={() => setOpenAudio(p)}
                    onSpeedLongPress={handleSpeedLongPress}
                    onSpeedRelease={handleSpeedRelease}
                  />
                </div>
              </div>
            );
          })
        )}

        {/* ── Bottom navigation ── */}
        <Navbar />
      </div>

      {/* ================================================================
          AUDIO PAGE
      ================================================================ */}
      {openAudio && (
        <AudioPage
          post={openAudio}
          audioName={openAudio.audioName || "Original Audio"}
          audioCreator={openAudio.audioCreator || openAudio.creatorName}
          audioId={openAudio.audioId || encodeURIComponent(openAudio.audioName || "")}
          onClose={() => setOpenAudio(null)}
          onUseAudio={() => { navigate("/upload"); setOpenAudio(null); }}
          onPlayReel={(reel) => {
            // inject this reel at current position in feed if not already present
            const exists = feed.find(f => f.id === reel.id);
            if (!exists) setApiFeed(prev => [reel, ...prev]);
            setCur(0);
            setOpenAudio(null);
          }}
        />
      )}



      {/* ================================================================
          PRIVACY MENU
      ================================================================ */}
      {openPrivacy && (
        <PrivacyMenu
          post={openPrivacy.post}
          isMuted={openPrivacy.isMuted}
          user={user}
          onNotInterested={handleNotInterested}
          onMute={handleMute}
          onReport={(postId, reason) => {
            reportPost && reportPost(postId, reason);
            setFeedbackMsg((prev) => ({ ...prev, [postId]: "reported" }));
            setOpenPrivacy(null);
            setTimeout(() => goTo(cur + 1 < feed.length ? cur + 1 : Math.max(0, cur - 1)), 600);
          }}
          onBlock={(creatorId) => {
            // hide all posts from this creator in local feed
            setApiFeed(prev => prev.filter(p => p.creatorId !== creatorId));
          }}
          onDownload={(url) => { if (url) window.open(url, "_blank"); }}
          onSave={(postId) => handleSavePress(postId)}
          onViewProfile={(creatorId) => navigate(`/profile/${creatorId}`)}
          onClose={() => setOpenPrivacy(null)}
        />
      )}

      {/* ================================================================
          SHEET — REPORT
      ================================================================ */}
      <ReportModal 
        isOpen={!!openReport} 
        onClose={() => setOpenReport(null)} 
        postId={openReport}
        dark={true}
      />

      {/* ================================================================
          SHEET — VIEWS
      ================================================================ */}
      <ViewersModal 
        isOpen={!!openViews} 
        onClose={() => setOpenViews(null)} 
        postId={openViews}
        dark={true}
      />

      {/* ================================================================
          SHEET — COMMENT
      ================================================================ */}
      <CommentModal 
        isOpen={!!openCmt} 
        onClose={() => setOpenCmt(null)} 
        postId={openCmt}
        postCreatorId={feed.find(p => p.id === openCmt)?.creatorId}
        dark={true}
      />

      {/* ================================================================
          SHEET — SHARE
      ================================================================ */}
      {openShare && (
        <div className="reels-overlay" onClick={() => setOpenShare(null)}>
          <div className="reels-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="reels-handle" />
            <p className="reels-sheet-title">Share</p>
            <div className="reels-share-banner">
              <LoopIcon />
              <span className="reels-share-banner-txt">Every share helps this creator get discovered</span>
            </div>
            <div className="reels-share-grid">
              {[
                { label: "WhatsApp", platform: "whatsapp", icon: <WAIcon />, color: "#25D366" },
                { label: "Telegram", platform: "telegram", icon: <TGIcon />, color: "#0088cc" },
                { label: "Twitter",  platform: "twitter",  icon: <TWIcon />, color: "#1DA1F2" },
                { label: "More",     platform: "more",     icon: <MoreIcon />, color: "#7F77DD" },
              ].map((s) => (
                <button key={s.label} type="button" aria-label={`Share via ${s.label}`} className="reels-share-opt" onClick={() => handleShare(s.platform, openShare)}>
                  <div className="reels-share-ico" style={{ background: `${s.color}15`, border: `0.5px solid ${s.color}30` }}>{s.icon}</div>
                  <span className="reels-share-label">{s.label}</span>
                </button>
              ))}
            </div>
            <button type="button" aria-label="Copy link" className="reels-copy-row" onClick={() => handleShare("copy", openShare)}>
              <LinkIcon />
              <span className="reels-copy-url">drandee.app/reel/{openShare}</span>
              <span className="reels-copy-btn" style={{ color: copied ? "#1D9E75" : "#7F77DD" }}>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          SHEET — SAVE
      ================================================================ */}
      {openSave && (
        <div className="reels-overlay" onClick={(e) => e.target === e.currentTarget && setOpenSave(null)}>
          <div className="reels-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="reels-handle" />
            <p className="reels-sheet-title">Save post</p>
            <div className="reels-save-body">
              <button type="button" className="reels-save-quick" onClick={() => handleConfirmSave("Saved")}>
                <div className="reels-save-quick-ico"><BookmarkSolidIcon /></div>
                <div style={{ flex: 1 }}>
                  <div className="reels-save-quick-label">Save</div>
                  <div className="reels-save-quick-sub">Added to your Saved list</div>
                </div>
                <ChevSmIcon />
              </button>
              <div className="reels-save-divider">
                <div className="reels-save-line" />
                <span className="reels-save-div-txt">or name your collection</span>
                <div className="reels-save-line" />
              </div>
              <label htmlFor="reels-coll-input" className="reels-input-label">Collection name</label>
              <input id="reels-coll-input" name="collectionName" className="reels-input" placeholder="e.g. Travel inspo, Cooking ideas..." value={collectionName} onChange={(e) => setCollectionName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && collectionName.trim() && handleConfirmSave()} autoFocus />
              {collectionName.trim() && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <BookmarkSmIcon />
                  <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.5)" }}>Will save to <b style={{ color: "#AFA9EC" }}>"{collectionName.trim()}"</b></span>
                </div>
              )}
              <button type="button" className="reels-save-confirm" onClick={() => handleConfirmSave()} disabled={!collectionName.trim()} style={{ opacity: collectionName.trim() ? 1 : 0.4 }}>
                Save to "{collectionName.trim() || "collection"}"
              </button>
              <button type="button" className="reels-cancel-btn" onClick={() => setOpenSave(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}


      {/* ================================================================
          SPEED CONTROL MODAL
      ================================================================ */}
      {showSpeedControl && (
        <>
          <div className="speed-modal-overlay" onClick={() => setShowSpeedControl(false)}>
            <div className="speed-modal-content" onClick={(e) => e.stopPropagation()}>
              <h4>Playback Speed</h4>
              
              <div className="speed-grid">
                {[0.3, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0].map(s => (
                  <button
                    key={s}
                    onClick={() => {
                      setSpeed(s);
                      setShowSpeedControl(false);
                    }}
                    className={speed === s ? 'active' : ''}
                  >
                    {s === 1.0 ? 'Normal' : `${s}x`}
                  </button>
                ))}
              </div>
              
              <button onClick={() => setShowSpeedControl(false)} className="close-btn">Close</button>
            </div>
          </div>
          
          <div className="speed-indicator">
            <span>Video playing at {speed}x speed</span>
          </div>
        </>
      )}

    </div>
  );
};

export default Reels;
