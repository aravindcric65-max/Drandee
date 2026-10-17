import React, { useState, useContext } from 'react';
import FeedModeTabs from '../components/home/FeedModeTabs';
import { Feed } from '../components/home/Feed';
import { MoreMenu } from '../components/home/MoreMenu';
import CommentModal from '../components/home/CommentModal';
import { ReportModal } from '../components/home/ReportModal';
import { ViewersModal } from '../components/home/ViewersModal';
import { UserContext } from '../context/UserContext';
import { Search, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AudioPage from '../components/reels/AudioPage';
import TagPage from '../components/reels/TagPage';
import { AnimatePresence, motion } from 'framer-motion';
import DrandeeLogo from '../components/brand/DrandeeLogo';
import DrandeeWordmark from '../components/brand/DrandeeWordmark';

const FEED_MODES = ['for_you', 'following', 'local'];


const Home = () => {
  const navigate = useNavigate();
  const [feedMode, setFeedMode] = useState('for_you');
  const [activeMorePostId, setActiveMorePostId] = useState(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [activeReportPostId, setActiveReportPostId] = useState(null);
  const [activeViewsPostId, setActiveViewsPostId] = useState(null);
  const [toast, setToast] = useState(null);
  const [hiddenPosts, setHiddenPosts] = useState([]);
  
  // Overlays state
  const [activeAudioPost, setActiveAudioPost] = useState(null);
  const [activeTag, setActiveTag] = useState(null);

  // Track which feeds have been rendered at least once to preserve state but avoid initial 3x loading
  const [renderedFeeds, setRenderedFeeds] = useState(new Set(['for_you']));

  React.useEffect(() => {
    setRenderedFeeds(prev => {
      const newSet = new Set(prev);
      newSet.add(feedMode);
      return newSet;
    });
  }, [feedMode]);
  
  const { token, giveRespect, savePost } = useContext(UserContext) || {};
  
  const handleNotInterested = async (postId) => {
    setHiddenPosts((prev) => (prev.includes(postId) ? prev : [...prev, postId]));
    const authToken = token || localStorage.getItem('token');
    try {
      await fetch(`/api/engagement/not-interested/${postId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    } catch (err) {
      console.log("Failed to mark not interested", err);
    }
  };
  
  const handleShareClick = async (postId) => {
    const deepLink = `https://drandee.app/post/${postId}`;
    const shareData = { title: "Drandee", text: "Check out this post on Drandee!", url: deepLink };

    if (navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err.name !== 'AbortError') console.log("Share failed", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(deepLink);
        setToast("Link copied to clipboard");
        setTimeout(() => setToast(null), 2000);
      } catch (err) {
        console.error("Clipboard failed", err);
      }
    }
  };
  
  return (
    <>
      <main className="h-[100dvh] overflow-hidden bg-[var(--bg-primary)] text-[var(--text-primary)] pb-[calc(64px+env(safe-area-inset-bottom))]">
        <section className="mx-auto flex h-full w-full max-w-[640px] md:max-w-[760px] flex-col border-x border-[var(--border)] bg-[var(--bg-primary)]">
          <header className="flex-none border-b border-[var(--border)] bg-[var(--bg-primary)]">
            <div className="mx-auto flex h-16 w-full max-w-lg items-center justify-between px-4">
              <div className="flex items-center gap-3">
                <DrandeeLogo className="w-8 h-8" />
                <DrandeeWordmark className="text-xl" showGradient={false} />
              </div>
              <div className="flex items-center gap-2">
              <button 
                onClick={() => navigate('/search')}
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-0 text-[var(--text-primary)]"
                aria-label="Search posts and creators"
              >
                <Search size={22} strokeWidth={2} />
              </button>
              <button 
                onClick={() => navigate('/notifications')}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-0 text-[var(--text-primary)]"
                aria-label="Open notifications"
              >
                <Bell size={22} strokeWidth={2} />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full border border-[#09090e] bg-[#7F77DD]" aria-hidden="true" />
              </button>
              </div>
            </div>

            <FeedModeTabs mode={feedMode} setMode={setFeedMode} />
          </header>
      
          <section className="relative h-full w-full flex-1 overflow-hidden" aria-label="Home feed">
            {FEED_MODES.map((mode) => {
              // Only render if it's the active mode OR it has been rendered before (to keep DOM/scroll state)
              if (!renderedFeeds.has(mode)) return null;
              
              return (
                <div
                  key={mode}
                  className={`absolute inset-0 h-full w-full transition-opacity duration-300 ${
                    feedMode === mode ? 'z-10 opacity-100 pointer-events-auto' : 'z-0 opacity-0 pointer-events-none'
                  }`}
                >
                  <Feed 
                    mode={mode} 
                    isActive={feedMode === mode}
                    onMore={(postId) => setActiveMorePostId(postId)}
                    onComment={(postId) => setActiveCommentPostId(postId)}
                    onShare={handleShareClick}
                    onSave={savePost}
                    onRespect={giveRespect}
                    hiddenPosts={hiddenPosts}
                    token={token}
                    interactionProps={{
                      onAudioClick: (post) => setActiveAudioPost(post),
                      onTagClick: (tag) => setActiveTag(tag),
                      onViewsClick: (postId) => setActiveViewsPostId(postId)
                    }}
                  />
                </div>
              );
            })}
          </section>
        </section>
        <Navbar />
      </main>
      {/* Global Modals/Overlays */}
      <MoreMenu 
        isOpen={!!activeMorePostId} 
        onClose={() => setActiveMorePostId(null)} 
        postId={activeMorePostId} 
        onNotInterested={handleNotInterested}
        onReport={(postId) => {
          setActiveReportPostId(postId);
        }}
      />
      
      <CommentModal 
        isOpen={!!activeCommentPostId}
        onClose={() => setActiveCommentPostId(null)}
        postId={activeCommentPostId}
      />
      
      <ReportModal 
        isOpen={!!activeReportPostId} 
        onClose={() => setActiveReportPostId(null)} 
        postId={activeReportPostId} 
      />
      
      <ViewersModal
        isOpen={!!activeViewsPostId}
        onClose={() => setActiveViewsPostId(null)}
        postId={activeViewsPostId}
      />

      <AnimatePresence>
        {activeAudioPost && (
          <AudioPage 
            post={activeAudioPost} 
            audioName={activeAudioPost.audioName || 'Original Audio'}
            audioCreator={activeAudioPost.creator?.displayName || activeAudioPost.creator?.username || 'Author'}
            onClose={() => setActiveAudioPost(null)} 
          />
        )}
        {activeTag && (
          <TagPage 
            tagName={activeTag} 
            onClose={() => setActiveTag(null)} 
          />
        )}
      </AnimatePresence>

      {/* Global Share Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-[100px] left-1/2 -translate-x-1/2 z-[200] bg-black/90 backdrop-blur-md border border-white/10 px-5 py-3 rounded-full text-white text-sm font-medium flex items-center gap-2 shadow-2xl"
          >
            <div className="w-5 h-5 rounded-full bg-[#7F77DD]/20 flex items-center justify-center text-[#7F77DD]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Home;
