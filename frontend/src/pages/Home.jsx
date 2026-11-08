import React, { useState, useContext, useCallback } from 'react';
import FeedModeTabs from '../components/home/FeedModeTabs';
import { Feed } from '../components/home/Feed';
import { MoreMenu } from '../components/home/MoreMenu';
import CommentModal from '../components/home/CommentModal';
import { ReportModal } from '../components/home/ReportModal';
import { ViewersModal } from '../components/home/ViewersModal';
import SaveModal from '../components/home/SaveModal';
import { ShareModal } from '../components/home/ShareModal';
import { UserContext } from '../context/UserContext';
import { Search, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AudioPage from '../components/reels/AudioPage';
import { AnimatePresence, motion } from 'framer-motion';
import DrandeeLogo from '../components/brand/DrandeeLogo';
import DrandeeWordmark from '../components/brand/DrandeeWordmark';
import { ProfileContentViewer } from '../components/profile/ProfileContentViewer';

const FEED_MODES = ['for_you', 'following', 'local'];


const Home = () => {
  const navigate = useNavigate();
  const [feedMode, setFeedMode] = useState('for_you');
  const [activeMorePostId, setActiveMorePostId] = useState(null);
  const [activeMoreCreatorId, setActiveMoreCreatorId] = useState(null);
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [activeReportPostId, setActiveReportPostId] = useState(null);
  const [activeViewsPostId, setActiveViewsPostId] = useState(null);
  const [activeSavePostId, setActiveSavePostId] = useState(null);
  const [activeSharePostId, setActiveSharePostId] = useState(null);
  const [activeViewPostId, setActiveViewPostId] = useState(null);
  const [activeViewPostSnapshot, setActiveViewPostSnapshot] = useState(null);
  const [allFeedPosts, setAllFeedPosts] = useState([]);
  const [hiddenPosts, setHiddenPosts] = useState([]);
  
  // Overlays state
  const [activeAudioPost, setActiveAudioPost] = useState(null);


  // Track which feeds have been rendered at least once to preserve state but avoid initial 3x loading
  const [renderedFeeds, setRenderedFeeds] = useState(new Set(['for_you']));

  React.useEffect(() => {
    setRenderedFeeds(prev => {
      const newSet = new Set(prev);
      newSet.add(feedMode);
      return newSet;
    });
  }, [feedMode]);
  
  const { giveRespect, unreadCount, muteCreator, user } = useContext(UserContext) || {};
  
  const handleNotInterested = async (postId) => {
    setHiddenPosts((prev) => (prev.includes(postId) ? prev : [...prev, postId]));
    try {
      await fetch(`/api/engagement/not-interested/${postId}`, {
        method: 'POST'});
    } catch (err) {
      console.log("Failed to mark not interested", err);
    }
  };

  // Stable callbacks — prevent Feed useEffect re-firing on every Home render
  const handleViewPost = useCallback((postId, post) => {
    setActiveViewPostId(postId);
    setActiveViewPostSnapshot(post || null);
  }, []);
  const handlePostsLoaded = useCallback((posts) => {
    setAllFeedPosts(prev => {
      const ids = new Set(prev.map(p => p.id));
      const unique = posts.filter(p => !ids.has(p.id));
      return unique.length ? [...prev, ...unique] : prev;
    });
  }, []);
  
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
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-0 text-[var(--text-primary)]"
                onClick={() => navigate('/notifications')}
                aria-label="Open notifications"
              >
                <Bell size={22} strokeWidth={2} />
                <AnimatePresence>
                  {unreadCount > 0 && (
                    <motion.span 
                      initial={{ scale: 0 }}
                      animate={{ scale: [0, 1.2, 1], transition: { duration: 0.5, ease: 'easeOut' } }}
                      exit={{ scale: 0 }}
                      key={unreadCount}
                      className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-[#09090e] bg-red-500 px-1 text-[10px] font-bold text-white shadow-sm"
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </motion.span>
                  )}
                </AnimatePresence>
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
                    onMore={(postId, creatorId) => { setActiveMorePostId(postId); setActiveMoreCreatorId(creatorId ?? null); }}
                    onComment={(postId) => setActiveCommentPostId(postId)}
                    onShare={(postId) => setActiveSharePostId(postId)}
                    onSave={(postId) => setActiveSavePostId(postId)}
                    onRespect={giveRespect}
                    hiddenPosts={hiddenPosts}
                    onViewPost={handleViewPost}
                    onPostsLoaded={handlePostsLoaded}
                    interactionProps={{
                      onAudioClick: (post) => setActiveAudioPost(post),
                      onTagClick: (tag) => navigate(`/tag/${tag}`),
                      onViewsClick: (postId, creatorId) => {
                        if (String(creatorId) === String(user?.id)) {
                          setActiveViewsPostId(postId);
                        }
                      }
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
        onClose={() => { setActiveMorePostId(null); setActiveMoreCreatorId(null); }} 
        postId={activeMorePostId}
        creatorId={activeMoreCreatorId}
        onNotInterested={handleNotInterested}
        onMute={muteCreator}
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
        isOwner={true}
        viewCount={0}
      />

        <SaveModal
          isOpen={!!activeSavePostId}
          onClose={() => setActiveSavePostId(null)}
          postId={activeSavePostId}
        />

        <ShareModal
          isOpen={!!activeSharePostId}
          onClose={() => setActiveSharePostId(null)}
          postId={activeSharePostId}
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
      </AnimatePresence>

      {activeViewPostId && (
        <ProfileContentViewer
          posts={allFeedPosts}
          selectedPostId={activeViewPostId}
          selectedPostSnapshot={activeViewPostSnapshot}
          tab="all"
          onClose={() => { setActiveViewPostId(null); setActiveViewPostSnapshot(null); }}
          onNavigate={() => {}}
        />
      )}
    </>
  );
};

export default Home;
