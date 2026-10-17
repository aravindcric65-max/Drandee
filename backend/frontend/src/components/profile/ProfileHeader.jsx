import DefaultAvatar from "../DefaultAvatar";

/* ── Frame gradient map ── */
const FRAME_GRADIENTS = {
  gradient: "linear-gradient(135deg, #7F77DD, #E040FB)",
  gold:     "linear-gradient(135deg, #FFD700, #FFA500)",
  neon:     "linear-gradient(135deg, #00F2FE, #4FACFE)",
  crimson:  "linear-gradient(135deg, #FF4B2B, #FF416C)",
};

const getRank = (r) => {
  if (r >= 1000000) return { label: "Legend",     color: "#FFD700", glow: "rgba(255,215,0,0.4)" };
  if (r >= 500000)  return { label: "Icon",        color: "#E040FB", glow: "rgba(224,64,251,0.4)" };
  if (r >= 200000)  return { label: "Influencer",  color: "#FF6B6B", glow: "rgba(255,107,107,0.4)" };
  if (r >= 50000)   return { label: "Creator",     color: "#FF8E53", glow: "rgba(255,142,83,0.4)" };
  if (r >= 10000)   return { label: "Rising",      color: "#7F77DD", glow: "rgba(127,119,221,0.4)" };
  return                   { label: "Explorer",   color: "rgba(255,255,255,0.45)", glow: "rgba(255,255,255,0.1)" };
};

const fmt = (n) => {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "k";
  return String(n);
};

/* ─── ProfileHeader ─────────────────────────────────────── */
const ProfileHeader = ({
  user,
  isOwn,
  targetId,
  targetName,
  targetUsername,
  postsCount,
  totalRespects,
  isFollowing,
  followLoading,
  onEditOpen,
  onShareOpen,
  onFollowersOpen,
  onFollowingOpen,
  onFollow,
  onUnfollow,
}) => {
  const rank = getRank(totalRespects);

  return (
    <div style={S.hero}>
      {/* ── Avatar + frame ring ── */}
      <div style={{ position: "relative", marginBottom: 14 }}>
        <div style={{ ...S.frameRing, background: FRAME_GRADIENTS[user?.frameStyle || "gradient"] }}>
          <div style={S.picWrap}>
            {user?.profilePic ? (
              <img src={user.profilePic} alt={targetName} style={S.picImg} />
            ) : (
              <DefaultAvatar size={88} creatorId={targetId} creatorName={targetName} />
            )}
          </div>
        </div>
        {isOwn && (
          <button
            type="button"
            aria-label="Edit profile picture"
            style={S.picBadge}
            onClick={onEditOpen}
          >
            <CameraIcon />
          </button>
        )}
      </div>

      {/* ── Name / username / bio ── */}
      <span style={S.name}>{targetName}</span>
      {targetUsername ? (
        <span style={S.username}>@{targetUsername}</span>
      ) : null}

      {user?.bio ? (
        <p style={S.bio}>{user.bio}</p>
      ) : (
        isOwn && (
          <p style={{ ...S.bio, fontStyle: "italic", opacity: 0.35 }}>
            Add a bio to tell the world about you
          </p>
        )
      )}

      {/* ── Niche badge ── */}
      {user?.niche && (
        <div style={S.nicheBadge}>
          {Array.isArray(user.niche) ? user.niche.join(" · ") : user.niche}
        </div>
      )}

      {/* ── Rank tier ── */}
      <div style={{ ...S.rankBadge, borderColor: rank.color, boxShadow: `0 0 14px ${rank.glow}` }}>
        <StarSmIcon color={rank.color} />
        <span style={{ ...S.rankTxt, color: rank.color }}>{rank.label} Tier</span>
      </div>

      {/* ── Stats bar ── */}
      <div style={S.statsRow}>
        <div style={S.stat}>
          <span style={S.statNum}>{fmt(postsCount)}</span>
          <span style={S.statLbl}>Journeys</span>
        </div>
        <div
          style={{ ...S.stat, borderLeft: "0.5px solid #1e1e1e", borderRight: "0.5px solid #1e1e1e" }}
          role="button"
          tabIndex={0}
          onClick={onFollowersOpen}
          onKeyDown={(e) => e.key === "Enter" && onFollowersOpen()}
        >
          <span style={S.statNum}>{fmt(user?.followersCount ?? (user?.followers?.length ?? 0))}</span>
          <span style={S.statLbl}>Followers</span>
        </div>
        <div
          style={S.stat}
          role="button"
          tabIndex={0}
          onClick={onFollowingOpen}
          onKeyDown={(e) => e.key === "Enter" && onFollowingOpen()}
        >
          <span style={S.statNum}>{fmt(user?.followingCount ?? (user?.following?.length ?? 0))}</span>
          <span style={S.statLbl}>Following</span>
        </div>
      </div>

      {/* ── Respect impact banner ── */}
      <div style={S.respectBanner}>
        <div style={S.respectIcon}><HandIcon /></div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={S.respectNum}>{fmt(totalRespects)}</span>
            <span style={S.respectTag}>Arena Impact</span>
          </div>
          <span style={S.respectLbl}>cumulative platform respect points</span>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={S.actions}>
        {isOwn ? (
          <>
            <button type="button" style={S.btnPrimary} onClick={onEditOpen}>
              <EditIcon /> Edit Profile
            </button>
            <button type="button" style={S.btnSec} onClick={onShareOpen}>
              <ShareIcon /> Share
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              style={{
                ...S.btnPrimary,
                background: isFollowing ? "#1a1a1a" : "#7F77DD",
                border: isFollowing ? "0.5px solid #2a2a2a" : "none",
                opacity: followLoading ? 0.6 : 1,
              }}
              onClick={() => isFollowing ? onUnfollow(targetId) : onFollow(targetId)}
              disabled={followLoading}
            >
              {followLoading ? "..." : isFollowing ? "Following ✓" : "Follow"}
            </button>
            <button type="button" style={S.btnSec} onClick={onShareOpen}>
              <ShareIcon /> Share
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/* ── Icons ── */
const si = (d, w = 16, s = "#fff") => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
    <path d={d} stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CameraIcon = () => si("M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", 15);
const EditIcon   = () => si("M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z", 15);
const ShareIcon  = () => si("M15 5L20 10M20 10L15 15M20 10H9C6.79 10 5 11.79 5 14V19", 15);
const HandIcon   = () => si("M7 11v8a1 1 0 0 0 1 1h7.5a2.5 2.5 0 0 0 2.45-2L19 13.5a1.5 1.5 0 0 0-1.5-1.8h-3.6l.5-3A2 2 0 0 0 12.4 6.3L9 11H7zM3 11h4v9H3v-9z", 18, "#7F77DD");
const StarSmIcon = ({ color = "#7F77DD" }) => si("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z", 13, color);

/* ── Styles ── */
const S = {
  hero: { display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 20px 18px" },
  frameRing: { padding: 4, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(127,119,221,0.25)" },
  picWrap: { width: 90, height: 90, borderRadius: "50%", overflow: "hidden", background: "#111", display: "flex", alignItems: "center", justifyContent: "center" },
  picImg: { width: "100%", height: "100%", objectFit: "cover" },
  picBadge: { position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: "50%", background: "#7F77DD", border: "2.5px solid #080808", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  name: { fontSize: "20px", fontWeight: "700", color: "#fff", marginBottom: 2, textAlign: "center" },
  username: { fontSize: "13px", color: "rgba(255,255,255,0.4)", marginBottom: 8 },
  bio: { fontSize: "13px", color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 1.55, maxWidth: 290, marginBottom: 10 },
  nicheBadge: { fontSize: "11px", color: "#7F77DD", background: "rgba(127,119,221,0.1)", border: "0.5px solid rgba(127,119,221,0.25)", borderRadius: 20, padding: "4px 14px", marginBottom: 12 },
  rankBadge: { display: "flex", alignItems: "center", gap: 6, background: "#141414", border: "0.5px solid", borderRadius: 20, padding: "5px 14px", marginBottom: 16 },
  rankTxt: { fontSize: "12px", fontWeight: "600" },
  statsRow: { display: "flex", width: "100%", background: "#0e0e0e", border: "0.5px solid #1e1e1e", borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  stat: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "13px 8px", cursor: "pointer" },
  statNum: { fontSize: "18px", fontWeight: "700", color: "#fff", lineHeight: 1 },
  statLbl: { fontSize: "10px", color: "rgba(255,255,255,0.4)", marginTop: 4, letterSpacing: "0.4px", textTransform: "uppercase" },
  respectBanner: { display: "flex", alignItems: "center", gap: 12, background: "linear-gradient(135deg,#121025 0%,#0a0a0a 100%)", border: "0.5px solid rgba(127,119,221,0.3)", borderRadius: 14, padding: "12px 16px", width: "100%", marginBottom: 14 },
  respectIcon: { width: 36, height: 36, borderRadius: "50%", background: "rgba(127,119,221,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  respectNum: { fontSize: "20px", fontWeight: "700", color: "#fff" },
  respectTag: { fontSize: "10px", fontWeight: "700", color: "#7F77DD", textTransform: "uppercase", letterSpacing: "0.5px" },
  respectLbl: { fontSize: "11px", color: "rgba(255,255,255,0.4)" },
  actions: { display: "flex", gap: 8, width: "100%" },
  btnPrimary: { flex: 1, height: 44, borderRadius: 12, background: "#7F77DD", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: "13px", fontWeight: "700", color: "#fff", cursor: "pointer", transition: "opacity 0.15s" },
  btnSec: { flex: 1, height: 44, borderRadius: 12, background: "#151515", border: "0.5px solid #252525", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontSize: "13px", fontWeight: "600", color: "#fff", cursor: "pointer" },
};

export { getRank, fmt };
export default ProfileHeader;
