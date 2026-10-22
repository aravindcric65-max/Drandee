import React, { useState } from 'react';
import { SlashIcon, MuteIcon, FlagIcon, ShieldIcon, DownloadIcon, BookmarkIcon } from './ReelsIcons';

const API_BASE = (process.env.REACT_APP_API_URL || "").replace(/\/$/, "") + "/api";
const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate content',  emoji: '🚫' },
  { id: 'harassment',    label: 'Harassment or bullying', emoji: '😡' },
  { id: 'hate_speech',   label: 'Hate speech',            emoji: '⚠️' },
  { id: 'violence',      label: 'Violence or danger',     emoji: '🆘' },
  { id: 'misinformation',label: 'Misinformation',         emoji: '📢' },
  { id: 'spam',          label: 'Spam or misleading',     emoji: '📨' },
  { id: 'other',         label: 'Other',                  emoji: '💬' },
];

const CONTENT_CATEGORIES = [
  'Comedy', 'Dance', 'Food', 'Travel', 'Gaming', 'Sports',
  'Beauty', 'Fashion', 'Tech', 'News', 'Music', 'Other',
];

const PRIVACY_OPTIONS = ['Public', 'Friends Only', 'Private', 'Custom'];

const Row = ({ icon, label, sub, labelStyle = {}, onClick, right, danger }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: 'none', border: 'none',
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      padding: '15px 0', cursor: 'pointer', textAlign: 'left', width: '100%'}}
  >
    <div style={{
      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
      background: danger ? 'rgba(224,85,85,0.1)' : 'rgba(255,255,255,0.05)',
      display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
      {icon}
    </div>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 14, fontWeight: 500, color: danger ? '#e05555' : '#fff', ...labelStyle }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{sub}</div>}
    </div>
    {right}
  </button>
);

export const PrivacyMenu = ({
  post, isMuted, user, speed,
  onNotInterested, onMute, onReport, onBlock,
  onDownload, onSave, onViewProfile, onToggleSpeedControl, onClose}) => {
  const [view, setView] = useState('main'); // main | report | content | privacy | about
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);
  const [selectedPrivacy, setSelectedPrivacy] = useState('Public');
  const [blocking, setBlocking] = useState(false);
  const [blockDone, setBlockDone] = useState(false);
  const [notIntDone, setNotIntDone] = useState(false);

  if (!post) return null;

  const isSelf = post.creatorId === user?.id;
  const allowDownload = post.allowDownload !== false;

  /* ── API helpers ── */
  const apiPost = async (path, body = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(body)});
    return res.json();
  };

  const handleReport = async (reasonId) => {
    setReportSubmitting(true);
    try {
      await apiPost(`/reports/post/${post.id}`, { reason: reasonId, category: reasonId });
      onReport && onReport(post.id, reasonId);
      setReportDone(true);
      setTimeout(() => onClose(), 1800);
    } catch {
      setReportDone(true);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleBlock = async () => {
    setBlocking(true);
    try {
      await apiPost(`/engagement/block/${post.creatorId}`);
      onBlock && onBlock(post.creatorId);
      setBlockDone(true);
      setTimeout(() => onClose(), 1400);
    } catch {
      setBlockDone(true);
    } finally {
      setBlocking(false);
    }
  };

  const handleNotInterested = async () => {
    try {
      await apiPost(`/engagement/not-interested/${post.id}`);
    } catch { /* silent — already handled optimistically */ }
    onNotInterested && onNotInterested(post.id);
    setNotIntDone(true);
    setTimeout(() => onClose(), 900);
  };

  const handleHideCategory = async (category) => {
    try {
      await apiPost('/engagement/content-preferences', { category, action: 'hide' });
    } catch { /* silent */ }
    onNotInterested && onNotInterested(post.id);
    setTimeout(() => onClose(), 700);
  };

  const handleSave = async () => {
    try {
      await apiPost(`/engagement/save/${post.id}`, { collectionName: 'Saved' });
    } catch { /* handled via onSave */ }
    onSave && onSave(post.id);
    onClose();
  };

  /* ── Overlay wrapper ── */
  return (
    <div
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', zIndex: 110, display: 'flex', alignItems: 'flex-end', animation: 'fadeIn 0.2s ease' }}
      onClick={onClose}
    >
      <div
        style={{ width: '100%', background: '#10101a', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTop: '1px solid rgba(255,255,255,0.07)', padding: '0 20px 32px', maxHeight: '85vh', overflowY: 'auto', animation: 'slideUp 0.28s cubic-bezier(0.4,0,0.2,1)', boxShadow: '0 -12px 48px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '12px auto 4px' }} />

        {/* ══ REPORT VIEW ══ */}
        {view === 'report' && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center', margin: '10px 0 4px' }}>Report this video</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 14 }}>Your report is anonymous and confidential</p>

            {reportDone ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: '#4CAF50' }}>Report submitted</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>We'll review this content within 24h</p>
              </div>
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                {REPORT_REASONS.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    disabled={reportSubmitting}
                    onClick={() => handleReport(r.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      width: '100%', background: 'none', border: 'none',
                      borderBottom: i < REPORT_REASONS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      padding: '14px 16px', cursor: reportSubmitting ? 'wait' : 'pointer',
                      opacity: reportSubmitting ? 0.6 : 1}}
                  >
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{r.emoji}</span>
                    <span style={{ fontSize: 14, color: '#fff', fontWeight: 400 }}>{r.label}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 16, color: 'rgba(255,255,255,0.25)' }}>›</span>
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setView('main')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', padding: '14px 0', fontSize: 14, cursor: 'pointer', width: '100%', textAlign: 'center', marginTop: 8 }}>
              Back
            </button>
          </>
        )}

        {/* ══ HIDE CONTENT TYPE VIEW ══ */}
        {view === 'content' && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center', margin: '10px 0 4px' }}>Hide this type of content</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 14 }}>Choose a content category to see less of</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {CONTENT_CATEGORIES.map(cat => (
                <button key={cat} type="button" onClick={() => handleHideCategory(cat)}
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '7px 14px', color: '#fff', fontSize: 13, cursor: 'pointer', transition: 'background 0.15s' }}>
                  {cat}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setView('main')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', padding: '12px 0', fontSize: 14, cursor: 'pointer', width: '100%', textAlign: 'center' }}>
              Back
            </button>
          </>
        )}

        {/* ══ ABOUT VIEW ══ */}
        {view === 'about' && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center', margin: '10px 0 16px' }}>About this reel</p>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginBottom: 16 }}>
              {[
                { label: 'Creator', value: `@${post.creatorName || 'unknown'}` },
                { label: 'Posted', value: post.createdAt ? new Date(post.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Unknown' },
                { label: 'Audio', value: post.audioName || 'Original Audio' },
                { label: 'Views', value: (post.watchCount || post.views || 0).toLocaleString() },
                { label: 'Respects', value: (post.totalRespects || 0).toLocaleString() },
                { label: 'Downloads', value: post.allowDownload ? 'Allowed' : 'Not allowed' },
              ].map((item, i, arr) => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 16px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{item.label}</span>
                  <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{item.value}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setView('main')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', padding: '12px 0', fontSize: 14, cursor: 'pointer', width: '100%', textAlign: 'center' }}>
              Back
            </button>
          </>
        )}

        {/* ══ PRIVACY VIEW ══ */}
        {view === 'privacy' && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center', margin: '10px 0 4px' }}>Who can see this?</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 14 }}>Manage audience for this reel</p>
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 16 }}>
              {PRIVACY_OPTIONS.map((opt, i) => (
                <button key={opt} type="button" onClick={() => setSelectedPrivacy(opt)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', borderBottom: i < PRIVACY_OPTIONS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none', padding: '14px 16px', cursor: 'pointer' }}>
                  <span style={{ fontSize: 14, color: '#fff' }}>{opt}</span>
                  {selectedPrivacy === opt && <span style={{ color: '#9c27b0', fontSize: 18, fontWeight: 700 }}>✓</span>}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setView('main')} style={{ background: 'linear-gradient(135deg, #9c27b0, #c51162)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 600, cursor: 'pointer', width: '100%', marginBottom: 8 }}>
              Save
            </button>
            <button type="button" onClick={() => setView('main')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', padding: '10px', fontSize: 14, cursor: 'pointer', width: '100%', textAlign: 'center' }}>
              Back
            </button>
          </>
        )}

        {/* ══ MAIN VIEW ══ */}
        {view === 'main' && (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#fff', textAlign: 'center', margin: '10px 0 6px' }}>More options</p>

            {/* Feedback / Safety section */}
            <div style={{ marginBottom: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', letterSpacing: 1, margin: '8px 0 2px' }}>Safety</p>
              <Row icon={<FlagIcon />} danger label="Report this video" sub="Inappropriate, spam, harassment, etc." onClick={() => setView('report')} />
              {!isSelf && (
                blockDone ? (
                  <div style={{ padding: '12px 0', color: '#4CAF50', fontSize: 13, textAlign: 'center' }}>✅ Creator blocked</div>
                ) : (
                  <Row
                    icon={<ShieldIcon />}
                    danger
                    label={blocking ? 'Blocking...' : `Block @${post.creatorName || 'creator'}`}
                    sub="You won't see their content again"
                    onClick={handleBlock}
                  />
                )
              )}
              {notIntDone ? (
                <div style={{ padding: '12px 0', color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center' }}>Got it — we'll show fewer like this</div>
              ) : (
                <Row icon={<SlashIcon />} label="Not interested" sub="Show less content like this" onClick={handleNotInterested} />
              )}
              <Row icon={<SlashIcon />} label="Hide this type of content" sub="Manage the categories you see" onClick={() => setView('content')} />
            </div>

            {/* Action section */}
            <div style={{ marginBottom: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', letterSpacing: 1, margin: '12px 0 2px' }}>Actions</p>
              
              <Row
                icon={<DownloadIcon />}
                label="Playback Speed"
                sub={speed ? `${speed}x` : 'Normal'}
                onClick={() => { onToggleSpeedControl && onToggleSpeedControl(); onClose(); }}
              />

              {allowDownload ? (
                <Row
                  icon={<DownloadIcon />}
                  label="Download video"
                  sub="Save to your device"
                  onClick={() => { onDownload && onDownload(post.videoUrl); onClose(); }}
                />
              ) : (
                <Row icon={<DownloadIcon />} label="Download not available" sub="Creator has disabled downloads" labelStyle={{ color: 'rgba(255,255,255,0.35)' }} onClick={() => {}} />
              )}
              <Row
                icon={<MuteIcon />}
                label={isMuted ? `Unmute @${post.creatorName || 'creator'}` : `Mute @${post.creatorName || 'creator'}`}
                sub={isMuted ? "You'll see their posts again" : "Their reels won't appear in your feed"}
                right={
                  <div style={{ width: 38, height: 22, borderRadius: 11, background: isMuted ? '#9c27b0' : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: isMuted ? 18 : 2, transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </div>
                }
                onClick={() => { onMute(post.creatorId); onClose(); }}
              />
              <Row
                icon={<BookmarkIcon active={false} />}
                label="Save to Favorites"
                sub="Save this reel to your collection"
                onClick={handleSave}
              />
            </div>

            {/* Info section */}
            <div style={{ marginBottom: 4 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', letterSpacing: 1, margin: '12px 0 2px' }}>Info</p>
              <Row icon={<ShieldIcon />} label="View creator profile" sub={`Open @${post.creatorName || 'creator'}'s profile`} onClick={() => { onViewProfile && onViewProfile(post.creatorId); onClose(); }} />
              <Row icon={<ShieldIcon />} label="About this reel" sub="Upload date, audio, engagement stats" onClick={() => setView('about')} />
              {isSelf && (
                <Row icon={<ShieldIcon />} label="Audience controls" sub="Change who can see this reel" onClick={() => setView('privacy')} />
              )}
            </div>

            <button type="button" onClick={onClose} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, color: 'rgba(255,255,255,0.55)', padding: '13px', fontSize: 14, fontWeight: 500, cursor: 'pointer', width: '100%', marginTop: 12, textAlign: 'center' }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default PrivacyMenu;
