import React from 'react';
import DefaultAvatar from '../DefaultAvatar';
import { getRank } from '../../utils/rankSystem';
import { getBadge } from '../../utils/badgeSystem';
import { MusicNoteIcon } from './ReelsIcons';

// eslint-disable-next-line no-unused-vars
const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

export const BottomSection = ({
  post, following, saved, collectionName, user, posts = [], paused,
  expandedCaption, onToggleCaption, onFollow, onTagClick, onAudioClick, onCreatorClick,
}) => {
  if (!post) return null;

  const isSelf = post.creatorId === user?.id;
  const creatorRespects = isSelf
    ? (user?.respects || 0)
    : posts.filter(p => p.creatorId === post.creatorId).reduce((sum, p) => sum + (p.totalRespects || 0), 0);

  const rankObj = getRank(creatorRespects);
  const rankTitle = typeof rankObj === 'object' ? rankObj.title : rankObj;
  const rankKey = rankTitle ? String(rankTitle).toLowerCase().replace(/\s+/g, '_') : '';
  const badgeTitle = getBadge(creatorRespects);

  // Rank pill colors
  const RANK_COLORS = {
    legend: { bg: 'rgba(255,215,0,0.15)', border: 'rgba(255,215,0,0.4)', color: '#ffd700' },
    icon: { bg: 'rgba(229,228,226,0.15)', border: 'rgba(229,228,226,0.4)', color: '#E5E4E2' },
    master: { bg: 'rgba(192,192,192,0.15)', border: 'rgba(192,192,192,0.4)', color: '#C0C0C0' },
    expert: { bg: 'rgba(205,127,50,0.15)', border: 'rgba(205,127,50,0.4)', color: '#CD7F32' },
    pro: { bg: 'rgba(74,144,226,0.15)', border: 'rgba(74,144,226,0.4)', color: '#4A90E2' },
    advanced: { bg: 'rgba(123,104,238,0.15)', border: 'rgba(123,104,238,0.4)', color: '#7B68EE' },
    intermediate: { bg: 'rgba(147,112,219,0.15)', border: 'rgba(147,112,219,0.4)', color: '#9370DB' },
    beginner: { bg: 'rgba(255,107,107,0.15)', border: 'rgba(255,107,107,0.4)', color: '#FF6B6B' },
    novice: { bg: 'rgba(78,205,196,0.15)', border: 'rgba(78,205,196,0.4)', color: '#4ECDC4' },
    newcomer: { bg: 'rgba(149,165,166,0.15)', border: 'rgba(149,165,166,0.4)', color: '#95A5A6' },
  };
  const rankStyle = RANK_COLORS[rankKey] || {};

  const renderCaption = () => {
    if (!post.caption) return null;
    const hashtags = post.caption.match(/#\w+/g) || [];
    const cleanCaption = post.caption.replace(/#\w+/g, '').trim();

    return (
      <div 
        className="caption-container"
        onClick={(e) => {
          e.stopPropagation(); // Don't pause video
          if (!expandedCaption) onToggleCaption();
        }}
      >
        <p className={`caption-text ${expandedCaption ? 'expanded' : ''}`}>
          {expandedCaption ? cleanCaption : (cleanCaption.length > 100 ? cleanCaption.substring(0, 100) + '...' : cleanCaption)}
        </p>
        
        {cleanCaption.length > 100 && (
          <button 
            type="button" 
            onClick={(e) => { 
              e.stopPropagation(); 
              onToggleCaption(); 
            }} 
            className="more-less-btn"
          >
            {expandedCaption ? 'Less' : 'More'}
          </button>
        )}
        
        {hashtags.length > 0 && (
          <div className="hashtags">
            {hashtags.map((tag, i) => (
              <span 
                key={i} 
                className="hashtag" 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  onTagClick(tag.slice(1)); 
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ flex: 1, padding: '0 8px 0 16px', minWidth: 0 }}>
      {/* Creator row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <div
          style={{ flexShrink: 0, cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onCreatorClick(post.creatorId); }}
        >
          <DefaultAvatar
            size={36}
            src={post.profilePic || post.creatorAvatarUrl}
            creatorName={post.creatorName || "Creator"}
            style={{ border: '1px solid #d0d0d0' }}
          />
        </div>

        <span style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }} onClick={(e) => { e.stopPropagation(); onCreatorClick(post.creatorId); }}>
          @{(post.creatorName || `user_${post.creatorId}`).toLowerCase().replace(/\s+/g, '')}
        </span>

        {/* Rank pill */}
        {rankTitle && (
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5, background: rankStyle.bg, border: `1px solid ${rankStyle.border}`, color: rankStyle.color }}>
            {rankTitle}
          </span>
        )}

        {/* Badge pill */}
        {badgeTitle && (
          <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5, background: 'linear-gradient(135deg, #9c27b0, #c51162)', color: '#fff', boxShadow: '0 1px 4px rgba(156,39,176,0.4)' }}>
            {badgeTitle}
          </span>
        )}

        {/* Follow button */}
        {!isSelf && (
          <button
            type="button"
            style={{ fontSize: 12, fontWeight: 600, border: `1px solid ${following ? 'rgba(255,255,255,0.15)' : '#fff'}`, borderRadius: 14, padding: '4px 12px', cursor: 'pointer', outline: 'none', transition: 'all 0.2s', background: following ? 'rgba(255,255,255,0.08)' : '#fff', color: following ? 'rgba(255,255,255,0.65)' : '#000' }}
            onClick={(e) => { e.stopPropagation(); onFollow(post.creatorId); }}
          >
            {following ? 'Following' : 'Follow'}
          </button>
        )}
      </div>

      {/* Caption */}
      {renderCaption()}

      {/* Audio row */}
      <div
        onClick={(e) => { e.stopPropagation(); onAudioClick(); }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, padding: '4px 8px', background: 'rgba(255,255,255,0.06)', borderRadius: 8, maxWidth: 240, cursor: 'pointer', backdropFilter: 'blur(4px)' }}>
        <div style={{ flexShrink: 0, animation: paused ? 'none' : 'spinDisc 3s linear infinite' }}>
          <MusicNoteIcon />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
          {post.audioName || 'Original Audio'}
        </span>
        {post.audioCreator && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>· {post.audioCreator}</span>
        )}
      </div>

    </div>
  );
};

export default BottomSection;
