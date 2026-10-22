import { useState, useMemo } from "react";
import { getRank } from "../utils/rankSystem";
import { useNavigate } from "react-router-dom";
import { getBadge } from "../utils/badgeSystem";

const FeedCard = ({ post, allPosts = [], onRespect }) => {
  const [showEffect, setShowEffect] = useState(false);
  const [respected, setRespected] = useState(false);

  const badge = useMemo(() => getBadge(post.totalRespects), [post.totalRespects]);

  const creatorTotalRespects = useMemo(() => {
    return allPosts
      .filter((p) => p.creatorId === post.creatorId)
      .reduce((sum, p) => sum + p.totalRespects, 0);
  }, [allPosts, post.creatorId]);

  const creatorRank = useMemo(
    () => getRank(creatorTotalRespects),
    [creatorTotalRespects]
  );

  const navigate = useNavigate();

  const handleRespectClick = () => {
    if (respected) return;
    setRespected(true);
    onRespect && onRespect(post.id);
    setShowEffect(true);
    setTimeout(() => setShowEffect(false), 1000);
  };

  return (
    <div className="feed-card" style={FS.card}>
      {badge && (
        <div className="feed-badge" style={FS.badge}>{badge}</div>
      )}

      {/* Dynamic Video Element Box Area Canvas */}
      <video
        /* ✅ FIXED: Added || null fallback to prevent empty string browser reload error */
        src={post.videoUrl || null}
        loop
        muted
        autoPlay
        playsInline
        style={FS.video}
        onTimeUpdate={(e) => {
          if (post?.endTime && e.target.currentTime >= post.endTime) {
            e.target.pause();
          }
        }}
        onLoadedMetadata={(e) => {
          if (post?.startTime) {
            e.target.currentTime = post.startTime;
          }
        }}
      />

      {post.overlayText && (
        <div className={`overlay ${post.textPosition}`} style={FS.overlayText}>
          {post.overlayText}
        </div>
      )}

      {showEffect && (
        <div className="respect-effect" style={FS.effect}>Respect +1</div>
      )}

      {/* Engagement Metadata Row Info Grid */}
      <div className="creator-info" style={FS.creatorInfo}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            className="creator-name"
            onClick={() => navigate(`/profile/${post.creatorId}`)}
            style={FS.creatorName}
          >
            @{post.creatorName}
          </span>
          <span className="creator-rank" style={FS.rankTag}>{creatorRank}</span>
        </div>
        <span style={FS.respectCount}>{post.totalRespects} Respects</span>
      </div>

      {post.caption && (
        <div style={FS.captionContainer}>
          <p style={FS.captionText}>
            {post.caption.split(/(#\w+)/g).map((part, index) => 
              part.startsWith('#') ? (
                <span key={index} style={FS.hashtag} onClick={(e) => { e.stopPropagation(); navigate(`/discover?q=${part.slice(1)}`); }}>
                  {part}
                </span>
              ) : (
                part
              )
            )}
          </p>
        </div>
      )}

      <div style={{ padding: "0 16px 16px" }}>
        <button
          onClick={handleRespectClick}
          disabled={respected}
          style={{
            ...FS.respectBtn,
            opacity: respected ? 0.4 : 1,
            background: respected ? "#12121a" : "linear-gradient(90deg, #6355eb 0%, #8a7ffd 100%)",
            border: respected ? "1px solid #1c1c2b" : "none"
          }}
        >
          {respected ? "✓ Respected" : "Give Respect"}
        </button>
      </div>
    </div>
  );
};

/* Micro Premium Internal Aesthetic Design Layout Properties Matrix */
const FS = {
  card: { background: "#09090e", border: "1px solid #11111a", borderRadius: "20px", margin: "16px", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)", position: "relative" },
  badge: { position: "absolute", top: "16px", left: "16px", background: "rgba(138,127,253,0.15)", backdropFilter: "blur(10px)", border: "1px solid rgba(138,127,253,0.3)", borderRadius: "8px", padding: "4px 10px", fontSize: "11px", color: "#8a7ffd", fontWeight: "600", zIndex: 10 },
  video: { width: "100%", aspectRatio: "16/9", objectFit: "cover", display: "block" },
  overlayText: { position: "absolute", bottom: "80px", left: "16px", background: "rgba(0,0,0,0.6)", padding: "6px 12px", borderRadius: "8px", fontSize: "13px", color: "#fff", backdropFilter: "blur(4px)" },
  effect: { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,255,179,0.1)", border: "1px solid #00ffb3", borderRadius: "12px", padding: "10px 20px", fontSize: "16px", fontWeight: "700", color: "#00ffb3", textShadow: "0 0 10px rgba(0,255,179,0.5)", animation: "fadeOut 1s ease-out forwards", zIndex: 11 },
  creatorInfo: { padding: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  creatorName: { fontSize: "14.5px", fontWeight: "600", color: "#ffffff", cursor: "pointer" },
  rankTag: { fontSize: "11px", color: "#00e5ff", background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", padding: "2px 6px", borderRadius: "6px", fontWeight: "600" },
  respectCount: { fontSize: "13px", color: "rgba(255,255,255,0.45)" },
  captionContainer: { padding: "0 16px 12px", marginTop: "-8px" },
  captionText: { fontSize: "14px", color: "#d1d1d6", margin: 0, lineHeight: "1.4", wordBreak: "break-word" },
  hashtag: { color: "#0a84ff", cursor: "pointer", fontWeight: "500" },
  respectBtn: { width: "100%", borderRadius: "12px", padding: "12px 20px", fontSize: "13.5px", fontWeight: "600", color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease", transform: "scale(1)" }
};

export default FeedCard;