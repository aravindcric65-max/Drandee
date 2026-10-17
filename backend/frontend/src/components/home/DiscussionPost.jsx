import React, { useMemo, useCallback } from 'react';
import { MessageCircle, MapPin, Users } from 'lucide-react';
import { FeedCreatorHeader } from './FeedCreatorHeader';
import { PostActions } from './PostActions';

export const DiscussionPost = ({ post, isActive, interactionProps }) => {
  const fullText = useMemo(() => {
    return post.content?.text || post.caption || '';
  }, [post.content, post.caption]);

  const replyCount = useMemo(() => {
    return post.stats?.comments || 0;
  }, [post.stats]);

  const isLocal = useMemo(() => {
    return post.metadata?.context === 'local' || post.location_context !== null;
  }, [post.metadata, post.location_context]);

  const handleJoinDiscussion = useCallback(() => {
    if (interactionProps?.onComment) {
      interactionProps.onComment(post.id);
    }
  }, [interactionProps, post.id]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleJoinDiscussion();
    }
  }, [handleJoinDiscussion]);

  const hasText = fullText.trim().length > 0;

  return (
    <div 
      className="w-full bg-transparent flex flex-col"
      role="article"
      aria-label="Discussion post"
    >
      <FeedCreatorHeader 
        post={post} 
        onFollow={interactionProps.onFollow} 
        onMore={interactionProps.onMore} 
      />
      
      <div className="w-full pt-4 pb-2 flex flex-col relative overflow-hidden px-1">
        
        {/* Discussion Label */}
        <div className="flex items-center gap-2.5 mb-4" role="banner">
          <div className="w-7 h-7 rounded-full bg-[#7F77DD]/15 flex items-center justify-center text-[#7F77DD] border border-[#7F77DD]/20">
            {isLocal ? (
              <MapPin size={13} strokeWidth={2.5} />
            ) : (
              <MessageCircle size={13} strokeWidth={2.5} />
            )}
          </div>
          <span className="text-[#7F77DD] text-[10px] font-bold tracking-[0.15em] uppercase">
            {isLocal ? 'Local Discussion' : 'Discussion'}
          </span>
        </div>
        
        {/* Question Typography */}
        {hasText ? (
          <h2 
            className="text-white text-[20px] sm:text-[22px] md:text-[24px] font-bold leading-[1.35] tracking-tight mb-6 relative z-10"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
          >
            {fullText}
          </h2>
        ) : (
          <div className="text-white/40 text-sm mb-6 italic">
            No question text available
          </div>
        )}
        
        {/* Footer: Replies & CTA */}
        <div className="flex items-center justify-between relative z-10 mt-auto pt-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            {/* Conversation Preview Avatars */}
            {replyCount > 0 ? (
              <>
                <div className="flex -space-x-2" aria-hidden="true">
                  {[1, 2, 3].slice(0, Math.min(replyCount, 3)).map((n) => (
                    <div 
                      key={n} 
                      className="w-7 h-7 rounded-full border-2 border-[#0a0a0a] bg-[#7F77DD]/20 overflow-hidden flex items-center justify-center"
                    >
                      <span className="text-[#7F77DD] font-bold text-[10px]">
                        {String.fromCharCode(64 + n)}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="text-white/60 text-[13px] sm:text-[14px] font-medium" aria-live="polite">
                  <span className="text-white font-bold">{replyCount}</span>{' '}
                  {replyCount === 1 ? 'reply' : 'replies'}
                </div>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full border-2 border-[#0a0a0a] bg-white/5 overflow-hidden flex items-center justify-center" aria-hidden="true">
                  <Users size={12} className="text-white/30" />
                </div>
                <div className="text-white/40 text-[13px] sm:text-[14px] font-medium">
                  No replies yet
                </div>
              </>
            )}
          </div>
          
          <button 
            onClick={handleJoinDiscussion}
            onKeyDown={handleKeyDown}
            className="px-4 sm:px-5 py-1.5 sm:py-2 rounded-full bg-[#7F77DD] text-white text-[12px] sm:text-[13px] font-semibold hover:bg-[#7F77DD]/90 active:bg-[#7F77DD]/80 transition-all active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/50 min-h-[36px] min-w-[100px]"
            aria-label={`Join discussion with ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
          >
            Join discussion
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="mt-2 px-1">
        <PostActions post={post} {...interactionProps} />
      </div>
    </div>
  );
};

export default DiscussionPost;