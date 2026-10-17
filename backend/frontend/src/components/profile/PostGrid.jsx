import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StarFriends from "./StarFriends";

const fmt = (n) => {
  if (!n && n !== 0) return "0";
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000)    return (n / 1000).toFixed(1) + "k";
  return String(n);
};

const CELL_COLORS = [
  "#0c0820", "#080d1a", "#0a1408", "#120808",
  "#0a0c08", "#08100a", "#100c08", "#080a10",
];

/* ─── PostGrid ──────────────────────────────────────────── */
/**
 * Props:
 *   posts          – all posts array
 *   reels          – filtered reels (optional, auto-derived if not passed)
 *   userId         – profile owner id
 *   isOwn
 *   starFriends    – [{ id, name, username, profilePic }]
 *   allFollowing   – [{ id, name, username, profilePic }]
 *   onToggleStar   – (userId) => void
 *   onOpenFollowing
 */
const PostGrid = ({
  posts = [],
  userId,
  isOwn,
  starFriends = [],
  allFollowing = [],
  onToggleStar,
  onOpenFollowing,
}) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("posts");

  // Separate images vs reels
  const imagePosts = posts.filter((p) => p.type !== "reel" && !p.videoUrl?.trim());
  const reelPosts  = posts.filter((p) => p.type === "reel" || !!p.videoUrl?.trim());

  const TABS = [
    { id: "posts",  label: "Posts",   Icon: GridIcon },
    { id: "reels",  label: "Reels",   Icon: ReelIcon },
    { id: "star",   label: "Stars",   Icon: StarIcon },
  ];

  return (
    <div style={S.wrap}>
      {/* ── Tab row ── */}
      <div style={S.tabRow}>
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            style={{
              ...S.tabBtn,
              borderBottom: tab === id ? `2px solid ${id === "star" ? "#FFD700" : "#fff"}` : "2px solid transparent",
              color: tab === id
                ? id === "star" ? "#FFD700" : "#fff"
                : "rgba(255,255,255,0.35)",
            }}
            onClick={() => setTab(id)}
          >
            <Icon active={tab === id} id={id} />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── Posts grid ── */}
      {tab === "posts" && (
        imagePosts.length === 0 && posts.length === 0 ? (
          <EmptyState icon="📸" text="No posts yet" />
        ) : (
          <GridView items={posts} navigate={navigate} />
        )
      )}

      {/* ── Reels grid ── */}
      {tab === "reels" && (
        reelPosts.length === 0 ? (
          <EmptyState icon="🎬" text="No reels yet" />
        ) : (
          <GridView items={reelPosts} navigate={navigate} isReel />
        )
      )}

      {/* ── Star Friends tab ── */}
      {tab === "star" && (
        <StarFriends
          starFriends={starFriends}
          allFollowing={allFollowing}
          isOwn={isOwn}
          onToggleStar={onToggleStar}
          onOpenFollowing={onOpenFollowing}
        />
      )}
    </div>
  );
};

/* ── Grid renderer ── */
const GridView = ({ items, navigate, isReel = false }) => (
  <div style={S.grid}>
    {items.map((post, i) => (
      <div
        key={post.id}
        style={S.cell}
        role="button"
        tabIndex={0}
        onClick={() => navigate(isReel ? "/reels" : "/feed")}
        onKeyDown={(e) => e.key === "Enter" && navigate(isReel ? "/reels" : "/feed")}
        aria-label={post.caption || "Post"}
      >
        {post.videoUrl?.trim() ? (
          <video
            src={post.videoUrl}
            style={S.media}
            muted
            playsInline
            preload="metadata"
          />
        ) : post.imageUrl?.trim() ? (
          <img src={post.imageUrl} alt={post.caption || ""} style={S.media} />
        ) : (
          <div style={{ ...S.placeholder, background: CELL_COLORS[i % CELL_COLORS.length] }}>
            {isReel ? <PlayIcon /> : <CameraIcon />}
          </div>
        )}

        {/* Respect overlay */}
        <div style={S.overlay}>
          <RespectIcon />
          <span style={S.overlayTxt}>{fmt(post.totalRespects || 0)}</span>
        </div>

        {/* Reel badge */}
        {isReel && (
          <div style={S.reelBadge}>
            <ReelSmIcon />
          </div>
        )}
      </div>
    ))}
  </div>
);

/* ── Empty state ── */
const EmptyState = ({ icon, text }) => (
  <div style={S.empty}>
    <span style={{ fontSize: 40 }}>{icon}</span>
    <span style={S.emptyTxt}>{text}</span>
  </div>
);

/* ── Icons ── */
const si = (d, w = 16, s = "currentColor") => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
    <path d={d} stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const GridIcon    = ({ active }) => si("M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z", 16, active ? "#fff" : "rgba(255,255,255,0.4)");
const ReelIcon    = ({ active }) => si("M22 12A10 10 0 1 1 12 2a10 10 0 0 1 10 10zM10 8.5l6 3.5-6 3.5z", 16, active ? "#fff" : "rgba(255,255,255,0.4)");
const StarIcon    = ({ active }) => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill={active ? "#FFD700" : "none"}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke={active ? "#FFD700" : "rgba(255,255,255,0.4)"} strokeWidth="1.8" />
  </svg>
);
const PlayIcon    = () => si("M6 4L20 12L6 20V4Z", 22, "rgba(255,255,255,0.18)");
const CameraIcon  = () => si("M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", 22, "rgba(255,255,255,0.18)");
const RespectIcon = () => si("M7 11v8a1 1 0 0 0 1 1h7.5a2.5 2.5 0 0 0 2.45-2L19 13.5a1.5 1.5 0 0 0-1.5-1.8h-3.6l.5-3A2 2 0 0 0 12.4 6.3L9 11H7zM3 11h4v9H3v-9z", 11, "rgba(255,255,255,0.75)");
const ReelSmIcon  = () => si("M22 12A10 10 0 1 1 12 2a10 10 0 0 1 10 10zM10 8.5l6 3.5-6 3.5z", 12, "#fff");

/* ── Styles ── */
const S = {
  wrap: { paddingBottom: 80 },
  tabRow: { display: "flex", borderBottom: "0.5px solid #161616" },
  tabBtn: { flex: 1, height: 44, background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "color 0.15s" },
  grid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 },
  cell: { position: "relative", aspectRatio: "4/5", background: "#111", cursor: "pointer", overflow: "hidden" },
  media: { width: "100%", height: "100%", objectFit: "cover" },
  placeholder: { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" },
  overlay: { position: "absolute", bottom: 6, left: 6, display: "flex", alignItems: "center", gap: 3, background: "rgba(0,0,0,0.55)", padding: "3px 7px", borderRadius: 10, backdropFilter: "blur(4px)" },
  overlayTxt: { fontSize: "11px", fontWeight: "600", color: "#fff" },
  reelBadge: { position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.55)", borderRadius: 6, padding: "2px 4px" },
  empty: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: 12 },
  emptyTxt: { fontSize: "13px", color: "rgba(255,255,255,0.35)" },
};

export default PostGrid;
