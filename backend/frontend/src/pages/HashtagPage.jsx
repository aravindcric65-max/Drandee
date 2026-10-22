import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, Eye, Heart, Video, Image as ImageIcon, Music, RefreshCw } from 'lucide-react';
import { ProfileContentViewer } from '../components/profile/ProfileContentViewer';
import DefaultAvatar from '../components/DefaultAvatar';
import { UserContext } from '../context/UserContext';

const fmt = (n) => {
  if (n == null || n === 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
};

const TABS = [
  { id: 'top',      label: 'Top' },
  { id: 'recent',   label: 'Recent' },
  { id: 'video',    label: 'Reels' },
  { id: 'image',    label: 'Images' },
  { id: 'text',     label: 'Text' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'audio',    label: 'Audio' },
];

export const HashtagPage = () => {
  const { tag } = useParams();
  const navigate = useNavigate();
  const { followUser, unfollowUser, user: currentUser } = useContext(UserContext) || {};

  const tagStr = String(tag || '').replace(/^#+/, '').toLowerCase();

  const [activeTab, setActiveTab] = useState('top');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [openPostIndex, setOpenPostIndex] = useState(null);
  const [followedMap, setFollowedMap] = useState({});

  const fetchSummary = useCallback(async () => {
    if (!tagStr) return;
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/hashtags/${encodeURIComponent(tagStr)}/summary`);
      const data = await res.json();
      if (data.success) setSummary(data);
      else throw new Error(data.error || 'Failed');
    } catch (err) {
    } finally {
      setSummaryLoading(false);
    }
  }, [tagStr]);

  const fetchPosts = useCallback(async (reset = false) => {
    if (!tagStr || activeTab === 'accounts' || activeTab === 'audio') return;
    setPostsLoading(true);
    setPostsError(null);
    const currentOffset = reset ? 0 : offset;
    const sort = activeTab === 'recent' ? 'recent' : 'top';
    const type = activeTab === 'video' ? 'video'
               : activeTab === 'image' ? 'image'
               : activeTab === 'text' ? 'text'
               : 'all';
    try {
      const res = await fetch(
        `/api/hashtags/${encodeURIComponent(tagStr)}/posts?sort=${sort}&type=${type}&limit=30&offset=${currentOffset}`
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed');
      const incoming = data.posts || [];
      if (reset) {
        setPosts(incoming);
      } else {
        setPosts(prev => {
          const ids = new Set(prev.map(p => p.id));
          return [...prev, ...incoming.filter(p => !ids.has(p.id))];
        });
      }
      setOffset(currentOffset + incoming.length);
      setHasMore(data.pagination?.hasMore ?? false);
    } catch (err) {
      setPostsError(err.message);
    } finally {
      setPostsLoading(false);
    }
  }, [tagStr, activeTab, offset]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  useEffect(() => {
    setPosts([]);
    setOffset(0);
    setHasMore(true);
    setPostsError(null);
    setOpenPostIndex(null);
    if (activeTab !== 'accounts' && activeTab !== 'audio') {
      fetchPosts(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagStr, activeTab]);

  useEffect(() => {
    const handler = (e) => {
      const { postId, action, delta } = e.detail || {};
      if (!postId) return;
      setPosts(prev => prev.map(p => {
        if (String(p.id) !== String(postId)) return p;
        const u = { ...p };
        if (action === 'respect') u.totalRespects = Math.max(0, (u.totalRespects || 0) + delta);
        if (action === 'comment') u.comments = Math.max(0, (u.comments || 0) + delta);
        if (action === 'share') u.shares = Math.max(0, (u.shares || 0) + delta);
        if (action === 'save') u.saves = Math.max(0, (u.saves || 0) + delta);
        return u;
      }));
    };
    const delHandler = (e) => {
      const { postId } = e.detail || {};
      if (postId) setPosts(prev => prev.filter(p => String(p.id) !== String(postId)));
    };
    window.addEventListener('engagement_updated', handler);
    window.addEventListener('post_deleted', delHandler);
    return () => {
      window.removeEventListener('engagement_updated', handler);
      window.removeEventListener('post_deleted', delHandler);
    };
  }, []);

  const handleFollow = useCallback(async (userId, isCurrentlyFollowing) => {
    setFollowedMap(prev => ({ ...prev, [userId]: !isCurrentlyFollowing }));
    try {
      if (isCurrentlyFollowing) await unfollowUser?.(userId);
      else await followUser?.(userId);
    } catch {
      setFollowedMap(prev => ({ ...prev, [userId]: isCurrentlyFollowing }));
    }
  }, [followUser, unfollowUser]);

  const getThumb = (post) =>
    post.content?.thumbnailUrl || post.thumbnailUrl ||
    post.content?.imageUrl || post.imageUrl ||
    post.content?.videoUrl || post.videoUrl || null;

  const isContentTab = !['accounts', 'audio'].includes(activeTab);

  return (
    <div className="w-full min-h-screen bg-[#F7F7F9] flex flex-col md:ml-20 lg:ml-64">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-[#E8E8EC] px-4 pt-3 pb-0">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-[#F7F7F9] rounded-full transition-colors"
            aria-label="Back"
          >
            <ArrowLeft size={24} color="#111111" />
          </button>
          <div className="w-10 h-10 rounded-full bg-[#7F77DD]/10 flex items-center justify-center text-[#7F77DD]">
            <Hash size={20} strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[18px] font-bold text-[#111111] truncate">#{tagStr}</h1>
            {!summaryLoading && summary && (
              <p className="text-[12px] text-[#666666]">
                {fmt(summary.postCount)} posts · {fmt(summary.totalViews)} views · {fmt(summary.totalRespects)} respects
              </p>
            )}
          </div>
        </div>

        {/* Related tag chips */}
        {summary?.relatedTags?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {summary.relatedTags.map(rt => (
              <button
                key={rt.tag}
                onClick={() => navigate(`/tag/${rt.tag}`)}
                className="shrink-0 px-3 py-1 rounded-full bg-[#7F77DD]/10 text-[#7F77DD] text-[13px] font-medium hover:bg-[#7F77DD]/20 transition-colors"
              >
                #{rt.tag}
              </button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto hide-scrollbar border-t border-[#E8E8EC]">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 px-4 py-2.5 text-[13px] font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-[#7F77DD] text-[#7F77DD]'
                  : 'border-transparent text-[#666666] hover:text-[#111111]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 p-3">

        {/* Grid for content tabs */}
        {isContentTab && (
          <>
            {postsLoading && posts.length === 0 ? (
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-[#E8E8EC] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : postsError && posts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <p className="text-[#666666] text-[14px]">{postsError}</p>
                <button
                  onClick={() => { setPosts([]); setOffset(0); fetchPosts(true); }}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-[#E8E8EC] text-[#111111] text-[13px] font-semibold"
                >
                  <RefreshCw size={14} />Retry
                </button>
              </div>
            ) : posts.length === 0 && !postsLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-full bg-[#E8E8EC] flex items-center justify-center mb-4">
                  <Hash size={32} color="#666666" />
                </div>
                <p className="text-[20px] font-bold text-[#111111] mb-1">No posts yet</p>
                <p className="text-[#666666] text-[14px]">Be the first to post with #{tagStr}</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1">
                  {posts.map((post, idx) => {
                    const thumb = getThumb(post);
                    const isText = post.type === 'text' || post.content_type === 'text';
                    const isVid = post.type === 'video' || post.content_type === 'video';
                    return (
                      <button
                        key={post.id}
                        onClick={() => setOpenPostIndex(idx)}
                        className="relative aspect-square rounded-lg overflow-hidden bg-[#E8E8EC] focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50"
                        aria-label={`Open post ${idx + 1}`}
                      >
                        {isText ? (
                          <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center p-2">
                            <p className="text-white text-[10px] line-clamp-4 text-center leading-tight">
                              {post.caption || post.content?.text || ''}
                            </p>
                          </div>
                        ) : thumb ? (
                          <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-[#1a1a2e] flex items-center justify-center">
                            {isVid
                              ? <Video size={24} color="rgba(255,255,255,0.4)" />
                              : <ImageIcon size={24} color="rgba(255,255,255,0.4)" />}
                          </div>
                        )}
                        {isVid && (
                          <div className="absolute top-1.5 right-1.5 bg-black/60 rounded px-1 py-0.5">
                            <Video size={10} color="white" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 flex items-center gap-2">
                          <span className="flex items-center gap-0.5 text-white text-[10px] font-semibold">
                            <Eye size={9} />{fmt(post.stats?.views ?? post.watchCount ?? 0)}
                          </span>
                          <span className="flex items-center gap-0.5 text-white text-[10px] font-semibold">
                            <Heart size={9} />{fmt(post.stats?.respects ?? post.totalRespects ?? 0)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {hasMore && (
                  <button
                    onClick={() => fetchPosts(false)}
                    disabled={postsLoading}
                    className="w-full mt-4 py-3 rounded-xl bg-[#E8E8EC] text-[#111111] text-[14px] font-semibold hover:bg-[#d8d8dc] transition-colors disabled:opacity-50"
                  >
                    {postsLoading ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* Accounts tab */}
        {activeTab === 'accounts' && (
          <div className="flex flex-col gap-3">
            {summaryLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-[#E8E8EC] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 bg-[#E8E8EC] rounded" />
                    <div className="h-2 w-20 bg-[#E8E8EC] rounded" />
                  </div>
                </div>
              ))
            ) : !summary?.topCreators?.length ? (
              <p className="text-center py-12 text-[#666666]">No creators for #{tagStr}</p>
            ) : summary.topCreators.map(c => {
              const isFollowing = followedMap[c.id] !== undefined ? followedMap[c.id] : c.isFollowing;
              const isSelf = String(c.id) === String(currentUser?.id);
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-white rounded-xl">
                  <button onClick={() => navigate(`/profile/${c.id}`)} className="shrink-0">
                    <DefaultAvatar src={c.avatarUrl} creatorName={c.displayName || c.username} size={44} />
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/profile/${c.id}`)}>
                    <p className="text-[#111111] font-semibold text-[14px] truncate">{c.displayName || c.username}</p>
                    <p className="text-[#666666] text-[12px]">@{c.username} · {c.postCount} posts</p>
                  </div>
                  {!isSelf && (
                    <button
                      onClick={() => handleFollow(c.id, isFollowing)}
                      className={`px-4 py-1.5 rounded-full text-[13px] font-bold transition-colors ${
                        isFollowing ? 'bg-[#E8E8EC] text-[#111111]' : 'bg-[#7F77DD] text-white'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Audio tab */}
        {activeTab === 'audio' && (
          <div className="flex flex-col gap-3">
            {summaryLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl animate-pulse">
                  <div className="w-11 h-11 rounded-xl bg-[#E8E8EC] shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-32 bg-[#E8E8EC] rounded" />
                    <div className="h-2 w-20 bg-[#E8E8EC] rounded" />
                  </div>
                </div>
              ))
            ) : !summary?.topAudio?.length ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Music size={40} color="#E8E8EC" />
                <p className="text-[#666666] text-[14px]">No audio for #{tagStr}</p>
              </div>
            ) : summary.topAudio.map(a => (
              <div key={a.audioId} className="flex items-center gap-3 p-3 bg-white rounded-xl">
                <div className="w-11 h-11 rounded-xl bg-[#7F77DD]/10 flex items-center justify-center shrink-0 overflow-hidden">
                  {a.thumbnailUrl
                    ? <img src={a.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    : <Music size={20} color="#7F77DD" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#111111] font-semibold text-[14px] truncate">{a.audioName}</p>
                  <p className="text-[#666666] text-[12px]">{a.artist || 'Unknown'} · {fmt(a.usageCount)} uses</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post viewer */}
      {openPostIndex !== null && posts[openPostIndex] && (
        <ProfileContentViewer
          posts={posts}
          selectedPostId={posts[openPostIndex].id}
          tab="all"
          onClose={() => setOpenPostIndex(null)}
          isOwn={false}
          onNavigate={() => {}}
        />
      )}
    </div>
  );
};

export default HashtagPage;
