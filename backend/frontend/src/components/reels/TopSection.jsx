import React from 'react';
import { EyeIcon, SearchIcon } from './ReelsIcons';

const fmt = (n) => {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
};

const TABS = [
  { id: 'all', label: 'For You' },
  { id: 'friends', label: 'Friends' },
  { id: 'saved', label: 'Saved' },
];

export const TopSection = ({ activeTab, onTabChange, onSearch, onViewsClick, currentPost, scrollCount = 0, user, onBadgeClick, selectedCollection, onCollectionChange }) => {
  const friends = Array.isArray(user?.following) ? user.following.slice(0, 8) : [];
  const collections = ['all', ...Array.from(new Set(Object.values(user?.savedCollections || {})))];
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50, padding: '24px 16px 0' }}>
      {/* Tab row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Views */}
        <div
          onClick={onViewsClick}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(4px)', width: 80, justifyContent: 'center', cursor: 'pointer' }}>
          <EyeIcon w={14} stroke="rgba(255,255,255,0.85)" />
          <span>{fmt(currentPost?.watchCount || currentPost?.views || 0)}</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {TABS.map(t => (
            <div key={t.id} onClick={() => onTabChange(t.id)} style={{ fontSize: 16, cursor: 'pointer', position: 'relative', textShadow: '0 1px 4px rgba(0,0,0,0.8)', color: activeTab === t.id ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: activeTab === t.id ? 600 : 400, transition: 'color 0.2s' }}>
              {t.label}
              {activeTab === t.id && <div style={{ position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)', width: 12, height: 3, borderRadius: 2, background: '#fff' }} />}
            </div>
          ))}
        </div>

        {/* Search */}
        <button type="button" aria-label="Search" onClick={onSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', width: 80, justifyContent: 'flex-end' }}>
          <SearchIcon />
        </button>
      </div>

      {/* Dynamic section */}
      {activeTab === 'saved' && collections.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', pointerEvents: 'auto' }}>
          {collections.map(c => (
            <div 
              key={c}
              onClick={(e) => { e.stopPropagation(); onCollectionChange(c); }}
              style={{
                padding: '4px 12px', borderRadius: 16, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                background: selectedCollection === c ? '#fff' : 'rgba(255,255,255,0.15)',
                color: selectedCollection === c ? '#000' : '#fff',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
              {c === 'all' ? 'All Saved' : c}
            </div>
          ))}
        </div>
      )}

      {/* Friends row — pointer-events auto so taps work */}
      {activeTab === 'friends' && friends.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, overflowX: 'auto', paddingBottom: 4 }}>
          {friends.map((friendId, i) => (
            <div key={friendId || i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0, cursor: 'pointer' }}>
              <div style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', border: '2px solid #9c27b0', overflow: 'hidden' }}>
                <img 
                   src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${friendId}`} 
                   alt="" 
                   style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                   onError={(e) => {
                     e.target.style.display = 'none';
                     e.target.nextSibling.style.display = 'flex';
                   }}
                />
                <div style={{ width: '100%', height: '100%', background: '#e0e0e0', display: 'none', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '65%', height: '65%', color: '#9e9e9e' }}>
                    <path d="M12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2ZM5 7C5 3.13401 8.13401 0 12 0C15.866 0 19 3.13401 19 7C19 10.866 15.866 14 12 14C8.13401 14 5 10.866 5 7ZM12 16C7.58172 16 4 19.5817 4 24H2C2 18.4772 6.47715 14 12 14C17.5228 14 22 18.4772 22 24H20C20 19.5817 16.4183 16 12 16Z" fill="currentColor"/>
                  </svg>
                </div>
                {i % 3 !== 0 && (
                  <div style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: '#4CAF50', borderRadius: '50%', border: '2px solid #090A0F' }} />
                )}
              </div>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)', maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                user_{String(friendId).slice(-4)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopSection;
