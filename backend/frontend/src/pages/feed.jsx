import { useContext, useEffect, useState } from "react";
import { UserContext } from "../context/UserContext";
import { getSmartFeed } from "../utils/smartFeed";
import { getRank } from "../utils/rankSystem";
import { useNavigate } from "react-router-dom";
import { getFeed } from "../api";

const Feed = () => {
  const { user = null, giveRespect } = useContext(UserContext) || {};
  const [feedData, setFeedData] = useState([]);
  const [respectedPosts, setRespectedPosts] = useState({});
  const [savedPosts, setSavedPosts] = useState({});
  const [activeComment, setActiveComment] = useState(null);
  const [activeShare, setActiveShare] = useState(null);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadFeed = async () => {
      setLoading(true);
      setLoadError("");

      try {
        const token =
          localStorage.getItem("token") ||
          localStorage.getItem("accessToken") ||
          "";

        const res = await getFeed(token);
        const apiPosts = Array.isArray(res?.posts) ? res.posts : [];

        const smartFeed = getSmartFeed(apiPosts, user || {}, { limit: 20 });

        if (mounted) {
          setFeedData(smartFeed);

          const initialCounts = {};
          smartFeed.forEach((p) => {
            initialCounts[p.id] = p.totalRespects || 0;
          });
          setCounts(initialCounts);
        }
      } catch (error) {
        console.error("Feed load error:", error);
        if (mounted) {
          setLoadError("Failed to load feed");
          setFeedData([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadFeed();

    return () => {
      mounted = false;
    };
  }, [user]);

  const handleRespect = (postId) => {
    if (respectedPosts[postId]) return;
    setRespectedPosts((prev) => ({ ...prev, [postId]: true }));
    setCounts((prev) => ({
      ...prev,
      [postId]: (prev[postId] || 0) + 1,
    }));
    giveRespect && giveRespect(postId);
  };

  const handleSave = (postId) => {
    setSavedPosts((prev) => ({ ...prev, [postId]: !prev[postId] }));
  };

  const formatCount = (n) => {
    if (!n) return "0";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return n.toString();
  };

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <button style={styles.topIcon} onClick={() => navigate("/upload")}>
          <UploadIcon />
        </button>
        <span style={styles.appName}>
          Dra<span style={styles.accent}>n</span>dee
        </span>
        <button style={styles.topIcon}>
          <BellIcon />
        </button>
      </div>

      <div style={styles.feedWrap}>
        {loading && <p style={styles.empty}>Loading feed...</p>}
        {!loading && loadError && <p style={styles.empty}>{loadError}</p>}
        {!loading && !loadError && feedData.length === 0 && (
          <p style={styles.empty}>No content available</p>
        )}

        {feedData.map((post) => {
          const rank = getRank(post.totalRespects || 0);
          const respected = respectedPosts[post.id];
          const saved = savedPosts[post.id];
          const respectCount = counts[post.id] || 0;

          return (
            <div key={post.id} style={styles.card}>
              <div style={styles.videoWrap}>
                {post.videoUrl ? (
                  <video
                    src={post.videoUrl}
                    style={styles.video}
                    autoPlay
                    muted
                    loop
                    playsInline
                  />
                ) : (
                  <div style={styles.noVideo} />
                )}

                <div style={styles.overlay} />

                <div style={styles.cardBody}>
                  <div style={styles.left}>
                    <div style={styles.creatorRow}>
                      <div style={styles.avatar}>
                        {post.creatorName?.charAt(0).toUpperCase()}
                      </div>
                      <span
                        style={styles.uname}
                        onClick={() => navigate(`/profile/${post.creatorId}`)}
                      >
                        @{post.creatorName}
                      </span>
                      <span style={styles.rankBadge}>{rank}</span>
                    </div>
                    <div style={styles.caption}>
                      {post.caption || "No caption"}
                    </div>
                    <div style={styles.tags}>
                      {(post.tags || []).map((tag, i) => (
                        <span key={i} style={styles.tag}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div style={styles.actions}>
                    <button
                      style={styles.actionBtn}
                      onClick={() => handleRespect(post.id)}
                    >
                      <HandIcon active={respected} />
                      <span
                        style={{
                          ...styles.actionCount,
                          color: respected ? "#e05555" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {formatCount(respectCount)}
                      </span>
                    </button>

                    <button
                      style={styles.actionBtn}
                      onClick={() => setActiveComment(post.id)}
                    >
                      <CommentIcon />
                      <span style={styles.actionCount}>
                        {formatCount(post.comments || 0)}
                      </span>
                    </button>

                    <button
                      style={styles.actionBtn}
                      onClick={() => setActiveShare(post.id)}
                    >
                      <ShareIcon />
                      <span style={styles.actionCount}>
                        {formatCount(post.shares || 0)}
                      </span>
                    </button>

                    <button
                      style={styles.actionBtn}
                      onClick={() => handleSave(post.id)}
                    >
                      <BookmarkIcon active={saved} />
                      <span
                        style={{
                          ...styles.actionCount,
                          color: saved ? "#AFA9EC" : "rgba(255,255,255,0.45)",
                        }}
                      >
                        {formatCount(post.saves || 0)}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ paddingBottom: "80px" }} />

      {activeComment && (
        <div style={styles.sheetBg} onClick={() => setActiveComment(null)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.handle} />
            <p style={styles.sheetTitle}>Comments</p>
            <p style={styles.noComments}>No comments yet — be first!</p>
            <div style={styles.commentInput}>
              <input placeholder="Add a comment..." style={styles.input} />
              <button style={styles.sendBtn}>➤</button>
            </div>
          </div>
        </div>
      )}

      {activeShare && (
        <div style={styles.sheetBg} onClick={() => setActiveShare(null)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.handle} />
            <p style={styles.sheetTitle}>Share</p>
            <div style={styles.shareGrid}>
              {["WhatsApp", "Instagram", "Copy link", "More"].map((s) => (
                <div key={s} style={styles.shareOpt}>
                  <div style={styles.shareIcon} />
                  <span style={styles.shareLabel}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const HandIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
    <path
      d="M10 20V10.5C10 9.67 10.67 9 11.5 9C12.33 9 13 9.67 13 10.5V15M13 15V9.5C13 8.67 13.67 8 14.5 8C15.33 8 16 8.67 16 9.5V15M16 15V10.5C16 9.67 16.67 9 17.5 9C18.33 9 19 9.67 19 10.5V15M19 15V12.5C19 11.67 19.67 11 20.5 11C21.33 11 22 11.67 22 12.5V17C22 20.31 19.31 23 16 23H14C11.79 23 9.85 21.73 8.9 19.87L6.5 15C6.06 14.18 6.36 13.16 7.18 12.72C8 12.28 9.02 12.58 9.46 13.4L10 14.5"
      stroke={active ? "#e05555" : "rgba(255,255,255,0.7)"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CommentIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.9021 3.5901 15.6665 4.59721 17.1199L3 21L6.88007 19.4028C8.33347 20.4099 10.0979 21 12 21Z"
      stroke="rgba(255,255,255,0.7)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ShareIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M15 5L20 10M20 10L15 15M20 10H9C6.79086 10 5 11.7909 5 14V19"
      stroke="rgba(255,255,255,0.7)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BookmarkIcon = ({ active }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path
      d="M5 4C5 3.44772 5.44772 3 6 3H18C18.5523 3 19 3.44772 19 4V21L12 17.5L5 21V4Z"
      stroke={active ? "#AFA9EC" : "rgba(255,255,255,0.7)"}
      strokeWidth="1.5"
      fill={active ? "rgba(127,119,221,0.2)" : "none"}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const UploadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M12 16V4M12 4L8 8M12 4L16 8M4 20H20"
      stroke="rgba(255,255,255,0.7)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path
      d="M15 17H9V18.5C9 19.8807 10.1193 21 11.5 21H12.5C13.8807 21 15 19.8807 15 18.5V17ZM18 17H6V10C6 7.23858 8.23858 5 11 5H13C15.7614 5 18 7.23858 18 10V17Z"
      stroke="rgba(255,255,255,0.7)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const styles = {
  page: {
    minHeight: "100vh",
    background: "#050505",
    color: "#fff",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", sans-serif',
  },
  topbar: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    height: "56px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 16px",
    background: "rgba(5,5,5,0.8)",
    backdropFilter: "blur(10px)",
    zIndex: 100,
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  topIcon: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    padding: "8px",
    display: "flex",
    alignItems: "center",
  },
  appName: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#fff",
  },
  accent: {
    color: "#7F77DD",
  },
  feedWrap: {
    paddingTop: "56px",
  },
  card: {
    borderBottom: "1px solid rgba(255,255,255,0.05)",
  },
  videoWrap: {
    position: "relative",
    width: "100%",
    height: "100vh",
    background: "#000",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  noVideo: {
    width: "100%",
    height: "100%",
    background: "#111",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "50%",
    background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
    pointerEvents: "none",
  },
  cardBody: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: "16px",
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  left: {
    flex: 1,
    paddingRight: "16px",
  },
  creatorRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#7F77DD",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "700",
  },
  uname: {
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
  },
  rankBadge: {
    background: "rgba(127,119,221,0.2)",
    color: "#AFA9EC",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "11px",
    fontWeight: "600",
  },
  caption: {
    fontSize: "14px",
    marginBottom: "8px",
    lineHeight: 1.4,
  },
  tags: {
    display: "flex",
    gap: "6px",
    flexWrap: "wrap",
  },
  tag: {
    color: "#AFA9EC",
    fontSize: "13px",
    fontWeight: "500",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    alignItems: "center",
  },
  actionBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.7)",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
  },
  actionCount: {
    fontSize: "12px",
    fontWeight: "600",
  },
  empty: {
    textAlign: "center",
    padding: "60px 20px",
    color: "rgba(255,255,255,0.4)",
    fontSize: "14px",
  },
  sheetBg: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "flex-end",
    zIndex: 200,
  },
  sheet: {
    width: "100%",
    background: "#0f0f12",
    borderTopLeftRadius: "20px",
    borderTopRightRadius: "20px",
    padding: "20px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
  },
  handle: {
    width: "40px",
    height: "4px",
    background: "rgba(255,255,255,0.2)",
    borderRadius: "2px",
    margin: "0 auto 20px",
  },
  sheetTitle: {
    fontSize: "18px",
    fontWeight: "700",
    marginBottom: "16px",
  },
  noComments: {
    color: "rgba(255,255,255,0.4)",
    fontSize: "14px",
    textAlign: "center",
    padding: "20px",
  },
  commentInput: {
    display: "flex",
    gap: "10px",
    marginTop: "16px",
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "20px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontSize: "14px",
    outline: "none",
  },
  sendBtn: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "#7F77DD",
    border: "none",
    color: "#fff",
    fontSize: "16px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  shareGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  },
  shareOpt: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  shareIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    background: "rgba(127,119,221,0.2)",
  },
  shareLabel: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.7)",
  },
};

export default Feed;