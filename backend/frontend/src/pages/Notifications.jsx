import { useContext, useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";
import { motion } from "framer-motion";

const AnimatedNumber = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const targetValue = Math.min(value, 99);

  useEffect(() => {
    const duration = 1500;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      
      setDisplayValue(Math.floor(easeProgress * targetValue));

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
      }
    };

    requestAnimationFrame(animate);
  }, [targetValue]);

  return <>{displayValue}{value > 99 ? "+" : ""}</>;
};

const Notifications = () => {
  const {
    notifications = [],
    markRead,
    markAllRead,
    followUser,
    unfollowUser,
    user = null,
    posts = [],
  } = useContext(UserContext) || {};

  const navigate = useNavigate();

  useEffect(() => {
    if (markAllRead) markAllRead();
  }, [markAllRead]);
  const [followState, setFollowState] = useState({});
  const [requestedState, setRequestedState] = useState({});
  const [followLoading, setFollowLoading] = useState({});
  const [toast, setToast] = useState(null);

  const totalRespects = posts.reduce((s, p) => s + (p.totalRespects || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
  const totalSaves = posts.reduce((s, p) => s + (p.saves || 0), 0);
  const totalFollowers = user?.followers?.length || 0;
  const unreadCount = notifications.filter((n) => !n.read).length;

  const timeAgo = (iso) => {
    const d = (Date.now() - new Date(iso)) / 1000;
    if (d < 60) return "now";
    if (d < 3600) return `${Math.floor(d / 60)}m`;
    if (d < 86400) return `${Math.floor(d / 3600)}h`;
    if (d < 604800) return `${Math.floor(d / 86400)}d`;
    return `${Math.floor(d / 604800)}w`;
  };

  const grouped = useMemo(() => {
    const today = [], week = [], earlier = [];
    notifications.forEach((n) => {
      const h = (Date.now() - new Date(n.createdAt || n.time)) / 3600000;
      if (h < 24) today.push(n);
      else if (h < 168) week.push(n);
      else earlier.push(n);
    });
    return { today, week, earlier };
  }, [notifications]);

  const isFollowing = (id) =>
    followState[id] ?? user?.following?.includes(id) ?? false;
  const isRequested = (id) => requestedState[id] ?? false;

  const handleTap = (n) => {
    markRead && markRead(n.id);
    if (n.actorId && n.type !== 'respect' && n.type !== 'comment') {
      navigate(`/profile/${n.actorId}`);
    } else if (n.postId) {
      navigate(`/reels?postId=${n.postId}`);
    } else if (n.actorId) {
      navigate(`/profile/${n.actorId}`);
    }
  };

  const handleFollow = async (e, n) => {
    e.stopPropagation();
    const id = n.actorId;
    if (!id || followLoading[id]) return;
    
    setFollowLoading((p) => ({ ...p, [id]: true }));
    
    try {
      if (isFollowing(id)) {
        setFollowState((p) => ({ ...p, [id]: false }));
        unfollowUser && unfollowUser(id);
      } else if (isRequested(id)) {
        setRequestedState((p) => ({ ...p, [id]: false }));
      } else if (n.creatorIsPrivate) {
        setRequestedState((p) => ({ ...p, [id]: true }));
      } else {
        setFollowState((p) => ({ ...p, [id]: true }));
        followUser && followUser(id);
        setToast(`Now following @${n.actorName}`);
        setTimeout(() => setToast(null), 2000);
      }
    } finally {
      setFollowLoading((p) => ({ ...p, [id]: false }));
    }
  };

  const getBadge = (type) =>
    ({
      respect: { icon: <HBadge />, bg: "#e05555" },
      follow: { icon: <UBadge />, bg: "#7F77DD" },
      comment: { icon: <CBadge />, bg: "#1D9E75" },
      spotlight: { icon: <SBadge />, bg: "#D85A30" },
      milestone: { icon: <TBadge />, bg: "#D85A30" },
    }[type] || { icon: <BellBadge />, bg: "#7F77DD" });

  const getText = (n) => {
    const B = ({ c }) => <b style={S.bold}>{c}</b>;
    switch (n.type) {
      case "respect":
        return <><B c={`@${n.actorName || "someone"}`} /> respected your post</>;
      case "follow":
        return <><B c={`@${n.actorName || "someone"}`} /> started following you</>;
      case "comment":
        return <><B c={`@${n.actorName || "someone"}`} /> commented: <span style={S.dim}>"{n.message || ""}"</span></>;
      case "spotlight":
        return <>You've been featured in <B c="Spotlight" /></>;
      case "milestone":
        return <B c={n.message || "Milestone reached"} />;
      default:
        return n.message;
    }
  };

  const hasAny = grouped.today.length + grouped.week.length + grouped.earlier.length > 0;

  return (
    <div style={S.page}>

      {/* Topbar */}
      <div style={S.topbar}>
        <button type="button" aria-label="Back" style={S.backBtn} onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <span style={S.title}>Activity</span>
        {unreadCount > 0 ? (
          <button type="button" style={S.markAll} onClick={() => markAllRead && markAllRead()}>
            Mark all
          </button>
        ) : <div style={{ width: 60 }} />}
      </div>

      {toast && (
        <div style={S.toast}>
          <ChkIcon />
          <span>{toast}</span>
        </div>
      )}

      {/* TikTok 4-metric animated bar */}
      <div style={S.metricBar}>
        {[
          { label: "Respects", val: totalRespects, icon: <HMetric /> },
          { label: "Comments", val: totalComments, icon: <CMetric /> },
          { label: "Followers", val: totalFollowers, icon: <FMetric /> },
          { label: "Saved", val: totalSaves, icon: <SMetric /> },
        ].map((m, i) => (
          <div key={m.label} style={{ ...S.metricBox, borderRight: i < 3 ? "0.5px solid #E8E8EC" : "none" }}>
            {unreadCount > 0 && <div style={S.redDot} />}
            <div style={{ ...S.metricIcon, background: "rgba(127,119,221,0.15)" }}>{m.icon}</div>
            <span style={{ ...S.metricVal, color: "#AFA9EC", textShadow: "0 0 10px rgba(127,119,221,0.5)" }}>
              <AnimatedNumber value={m.val} />
            </span>
            <span style={S.metricLbl}>{m.label}</span>
          </div>
        ))}
      </div>

      {/* Tab strip */}
      <div style={S.tabStrip}>
        <span style={S.tabActive}>All activity</span>
      </div>

      <div style={S.scroll}>
        {!hasAny ? (
          <div style={S.empty}>
            <div style={S.emptyCircle}><BellBadge /></div>
            <p style={S.emptyTitle}>No notifications yet</p>
            <p style={S.emptySub}>When someone respects, follows, or comments, you'll see it here.</p>
          </div>
        ) : (
          <>
            {grouped.today.length > 0 && (
              <Group label="Today" items={grouped.today} getBadge={getBadge} getText={getText}
                timeAgo={timeAgo} onTap={handleTap} onFollow={handleFollow}
                isFollowing={isFollowing} isRequested={isRequested} followLoading={followLoading} />
            )}
            {grouped.week.length > 0 && (
              <Group label="This week" items={grouped.week} getBadge={getBadge} getText={getText}
                timeAgo={timeAgo} onTap={handleTap} onFollow={handleFollow}
                isFollowing={isFollowing} isRequested={isRequested} followLoading={followLoading} />
            )}
            {grouped.earlier.length > 0 && (
              <Group label="Earlier" items={grouped.earlier} getBadge={getBadge} getText={getText}
                timeAgo={timeAgo} onTap={handleTap} onFollow={handleFollow}
                isFollowing={isFollowing} isRequested={isRequested} followLoading={followLoading} />
            )}
          </>
        )}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
};

const Group = ({ label, items, getBadge, getText, timeAgo, onTap, onFollow, isFollowing, isRequested, followLoading }) => (
  <>
    <div style={S.secLabel}>{label}</div>
    {items.map((n) => {
      const badge = getBadge(n.type);
      const following = n.actorId ? isFollowing(n.actorId) : false;
      const requested = n.actorId ? isRequested(n.actorId) : false;
      return (
        <div
          key={n.id}
          role="button"
          tabIndex={0}
          style={{ ...S.row, background: n.read ? "transparent" : "rgba(127,119,221,0.04)" }}
          onClick={() => onTap(n)}
          onKeyDown={(e) => e.key === "Enter" && onTap(n)}
        >
          <div style={S.avWrap}>
            {n.actorAvatar ? (
              <img src={n.actorAvatar} alt="" style={S.av} />
            ) : (
              <div style={S.av}>{(n.actorName || "?").charAt(0).toUpperCase()}</div>
            )}
            <div style={{ ...S.badge, background: badge.bg }}>{badge.icon}</div>
          </div>

          <div style={S.rowContent}>
            <span style={S.rowText}>{getText(n)}</span>
            <span style={S.rowTime}>{timeAgo(n.createdAt || n.time)}</span>
          </div>

          <div style={S.rowRight}>
            {n.type === "follow" && n.actorId && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="button"
                disabled={followLoading[n.actorId]}
                aria-label={following ? "Unfollow" : "Follow back"}
                style={{
                  ...S.followBtn,
                  background: following ? "#E8E8EC" : "#111111",
                  color: following ? "#111111" : "#FFFFFF",
                  opacity: followLoading[n.actorId] ? 0.6 : 1
                }}
                onClick={(e) => onFollow(e, n)}
              >
                {followLoading[n.actorId] ? "Loading..." : following ? "Following" : requested ? "Requested" : "Follow"}
              </motion.button>
            )}
            {!n.read && <div style={S.unreadDot} />}
          </div>
        </div>
      );
    })}
  </>
);

/* ===== ICONS ===== */
const ic = (d, w = 11) => (
  <svg width={w} height={w} viewBox="0 0 24 24" fill="none">
    <path d={d} stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const HBadge = () => (
  <svg width="11" height="11" viewBox="0 0 28 28" fill="none">
    <path d="M10 20V10.5C10 9.67 10.67 9 11.5 9C12.33 9 13 9.67 13 10.5V15M13 15V9.5C13 8.67 13.67 8 14.5 8C15.33 8 16 8.67 16 9.5V15M16 15V10.5C16 9.67 16.67 9 17.5 9C18.33 9 19 9.67 19 10.5V15M19 15V12.5C19 11.67 19.67 11 20.5 11C21.33 11 22 11.67 22 12.5V17C22 20.31 19.31 23 16 23H14C11.79 23 9.85 21.73 8.9 19.87L6.5 15C6.06 14.18 6.36 13.16 7.18 12.72C8 12.28 9.02 12.58 9.46 13.4L10 14.5"
      stroke="#fff" strokeWidth="2" strokeLinecap="round" />
  </svg>
);
const UBadge = () => ic("M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6");
const CBadge = () => ic("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z");
const SBadge = () => ic("M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z");
const TBadge = () => ic("M8 21h8M12 17v4M17 4H7v6a5 5 0 0 0 10 0V4zM7 4H4v2a3 3 0 0 0 3 3M17 4h3v2a3 3 0 0 1-3 3");
const BellBadge = () => ic("M15 17H9V18.5C9 19.88 10.12 21 11.5 21H12.5C13.88 21 15 19.88 15 18.5V17ZM18 17H6V10C6 7.24 8.24 5 11 5H13C15.76 5 18 7.24 18 10V17Z");
const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M19 12H5M5 12L12 19M5 12L12 5" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const ChkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M20 6L9 17l-5-5" stroke="#1D9E75" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const HMetric = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M7 11v8a1 1 0 0 0 1 1h7.5a2.5 2.5 0 0 0 2.45-2L19 13.5a1.5 1.5 0 0 0-1.5-1.8h-3.6l.5-3A2 2 0 0 0 12.4 6.3L9 11H7zM3 11h4v9H3v-9z"
      stroke="#7F77DD" fill="rgba(127,119,221,0.15)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const CMetric = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
      stroke="#7F77DD" fill="rgba(127,119,221,0.15)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const FMetric = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#7F77DD" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="9" cy="7" r="4" stroke="#7F77DD" strokeWidth="1.6" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#7F77DD" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
const SMetric = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="#7F77DD" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const S = {
  page: {
    background: "#FFFFFF", minHeight: "100vh", color: "#111111",
    fontFamily: "-apple-system,system-ui,sans-serif",
    display: "flex", flexDirection: "column",
  },
  topbar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 16px", borderBottom: "0.5px solid #E8E8EC",
    position: "sticky", top: 0, background: "#FFFFFF", zIndex: 100,
  },
  backBtn: {
    width: 32, height: 32, background: "none", border: "none",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", padding: 0,
  },
  title: { fontSize: "17px", fontWeight: "600", color: "#111111" },
  markAll: {
    background: "none", border: "none", fontSize: "13px",
    color: "#7F77DD", cursor: "pointer", padding: 0,
    width: 60, textAlign: "right",
  },
  toast: {
    display: "flex", alignItems: "center", gap: 8,
    margin: "10px 16px 0", padding: "10px 14px",
    background: "rgba(29,158,117,0.1)", border: "0.5px solid rgba(29,158,117,0.25)",
    borderRadius: 10, fontSize: "13px", color: "#111111",
  },
  metricBar: { display: "flex", background: "#FFFFFF", borderBottom: "0.5px solid #E8E8EC" },
  metricBox: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    padding: "16px 6px 14px", position: "relative", cursor: "pointer", gap: 5,
  },
  redDot: {
    position: "absolute", top: 10, right: 16,
    width: 7, height: 7, borderRadius: "50%",
    background: "#e05555", border: "1.5px solid #FFFFFF",
  },
  metricIcon: {
    width: 42, height: 42, borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  metricVal: { fontSize: "20px", fontWeight: "700", lineHeight: 1 },
  metricLbl: { fontSize: "10px", color: "#8A8A8F", letterSpacing: "0.3px" },
  tabStrip: {
    display: "flex", padding: "0 16px",
    borderBottom: "0.5px solid #E8E8EC",
  },
  tabActive: {
    fontSize: "13px", fontWeight: "600", color: "#111111",
    padding: "10px 0", borderBottom: "2px solid #111111", cursor: "pointer",
  },
  scroll: { flex: 1, overflowY: "auto", paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" },
  secLabel: {
    fontSize: "11px", fontWeight: "600", color: "#8A8A8F",
    padding: "14px 16px 4px", letterSpacing: "0.8px", textTransform: "uppercase",
  },
  row: {
    display: "flex", alignItems: "center", gap: 12,
    padding: "12px 16px", cursor: "pointer", outline: "none", position: "relative",
  },
  avWrap: { position: "relative", flexShrink: 0 },
  av: {
    width: 48, height: 48, borderRadius: "50%", background: "#534AB7",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "17px", fontWeight: "600", color: "#fff",
  },
  badge: {
    position: "absolute", bottom: -2, right: -2,
    width: 20, height: 20, borderRadius: "50%",
    border: "2px solid #FFFFFF",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  rowContent: { flex: 1, minWidth: 0 },
  rowText: {
    fontSize: "13.5px", color: "#111111",
    lineHeight: "1.45", display: "block",
  },
  bold: { fontWeight: "700", color: "#111111" },
  dim: { color: "#666666", fontStyle: "italic" },
  rowTime: {
    fontSize: "11px", color: "#8A8A8F",
    marginTop: 3, display: "block",
  },
  rowRight: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  followBtn: {
    fontSize: "12px", fontWeight: "600", borderRadius: 8,
    padding: "7px 16px", cursor: "pointer", flexShrink: 0,
    transition: "background 0.15s",
  },
  unreadDot: {
    width: 8, height: 8, borderRadius: "50%", background: "#7F77DD", flexShrink: 0,
  },
  empty: {
    display: "flex", flexDirection: "column", alignItems: "center",
    textAlign: "center", padding: "70px 32px", gap: 10,
  },
  emptyCircle: {
    width: 64, height: 64, borderRadius: "50%",
    background: "#F7F7F9", border: "0.5px solid #E8E8EC",
    display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  emptyTitle: { fontSize: "15px", fontWeight: "600", color: "#111111" },
  emptySub: { fontSize: "13px", color: "#666666", lineHeight: "1.6", maxWidth: 280 },
};

export default Notifications;