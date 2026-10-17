import React, { useEffect, useState, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserContext } from '../../context/UserContext';
import { X, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRank } from '../../utils/rankSystem';
import { getBadge } from '../../utils/badgeSystem';
import DefaultAvatar from '../DefaultAvatar';

export const ViewersModal = ({ isOpen, onClose, postId }) => {
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(false);
  const { token, followUser, unfollowUser, user: currentUser } = useContext(UserContext) || {};
  const navigate = useNavigate();

  useEffect(() => {
    const fetchViewers = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/engagement/viewers/${postId}?limit=20`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success) {
          setViewers(data.data.viewers || []);
        }
      } catch (err) {
        console.error('Failed to fetch viewers', err);
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && postId) {
      fetchViewers();
    }
  }, [isOpen, postId, token]);

  const handleFollowToggle = async (e, targetUserId, isFollowing) => {
    e.stopPropagation();
    try {
      if (isFollowing) {
        await unfollowUser(targetUserId);
      } else {
        await followUser(targetUserId);
      }
      // Optimistic update
      setViewers(prev => prev.map(v => 
        v.id === targetUserId ? { ...v, isFollowing: !isFollowing } : v
      ));
    } catch (error) {
      console.error('Follow error:', error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Half-screen Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="fixed inset-x-0 bottom-0 z-50 h-[60vh] rounded-t-3xl bg-[#09090e] border-t border-white/10 flex flex-col shadow-2xl"
          >
            {/* Handle Bar */}
            <div className="w-full flex justify-center pt-3 pb-1" onPointerDown={(e) => e.preventDefault()} onClick={onClose} style={{ touchAction: 'none' }}>
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-[#7F77DD]" />
                <h3 className="text-lg font-bold text-white">Views</h3>
              </div>
              <button 
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Viewers List */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {loading ? (
                <div className="flex flex-col gap-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-3 animate-pulse">
                      <div className="w-10 h-10 rounded-full bg-white/10" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 bg-white/10 rounded" />
                        <div className="h-2 w-16 bg-white/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : viewers.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {viewers.map((viewer) => {
                    const isSelf = currentUser?.id === viewer.id;
                    const rank = getRank(viewer.totalRespects || 0);
                    const rankTitle = typeof rank === 'object' ? rank.title : rank;
                    const badge = getBadge(viewer.totalRespects || 0);

                    return (
                      <div 
                        key={viewer.id} 
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                        onClick={() => {
                          onClose();
                          navigate(`/profile/${viewer.id}`);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <DefaultAvatar
                            size={44}
                            src={viewer.avatarUrl}
                            creatorName={viewer.displayName || viewer.username}
                            className="flex-shrink-0"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white/90">
                              {viewer.displayName || viewer.username}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                              {rankTitle && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                                  {rankTitle}
                                </span>
                              )}
                              {badge && (
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#7F77DD]/20 text-[#7F77DD]">
                                  {badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {!isSelf && (
                          <button
                            onClick={(e) => handleFollowToggle(e, viewer.id, viewer.isFollowing)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                              viewer.isFollowing 
                                ? 'bg-white/10 text-white/90 hover:bg-white/20' 
                                : 'bg-[#7F77DD] text-white hover:bg-[#6e66cc]'
                            }`}
                          >
                            {viewer.isFollowing ? 'Following' : 'Follow'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-white/50">
                  <Eye size={40} className="mb-3 opacity-20" />
                  <p className="text-sm">No views yet</p>
                </div>
              )}
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
};
