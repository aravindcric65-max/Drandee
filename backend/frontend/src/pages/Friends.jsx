import { useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserContext } from "../context/UserContext";

const Friends = () => {
  const {
    posts = [],
    user = null,
    followUser,
    unfollowUser,
  } = useContext(UserContext) || {};

  const navigate = useNavigate();
  const [localFollowing, setLocalFollowing] = useState(
    user?.following || []
  );

  // ===== UNIQUE CREATOR LIST (one row per person, not per post) =====
  const allCreators = useMemo(() => {
    const seen = new Map();
    posts.forEach((p) => {
      if (!seen.has(p.creatorId)) {
        seen.set(p.creatorId, {
          id: p.creatorId,
          name: p.creatorName,
          gender: (p.creatorGender || "").toLowerCase(),
          totalRespects: p.totalRespects || 0,
        });
      }
    });
    return Array.from(seen.values());
  }, [posts]);

  // ===== GENDER-AWARE SUGGESTION LOGIC =====
  // Male -> only Female creators suggested
  // Female -> mixed (all genders) creators suggested
  // Unknown -> mixed
  const suggestedCreators = useMemo(() => {
    const myGender = (user?.gender || "").toLowerCase();
    const notFollowed = allCreators.filter(
      (c) => !localFollowing.includes(c.id)
    );

    if (myGender === "male") {
      return notFollowed.filter((c) => c.gender === "female");
    }
    // female or unknown -> mixed pool
    return notFollowed;
  }, [allCreators, localFollowing, user]);

  // Already following — shown at top, "your circle"
  const myCircle = useMemo(
    () => allCreators.filter((c) => localFollowing.includes(c.id)),
    [allCreators, localFollowing]
  );

  const handleFollow = (creatorId) => {
    const isFollowing = localFollowing.includes(creatorId);
    if (isFollowing) {
      unfollowUser && unfollowUser(creatorId);
      setLocalFollowing((prev) => prev.filter((id) => id !== creatorId));
    } else {
      followUser && followUser(creatorId);
      setLocalFollowing((prev) => [...prev, creatorId]);
    }
  };

  const fmt = (n) => {
    if (!n) return "0";
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  };

  return (
    <div style={S.page}>

      {/* Topbar — white theme */}
      <div style={S.topbar}>
        <button style={S.backBtn} onClick={() => navigate(-1)}>
          <BackIcon />
        </button>
        <span style={S.title}>Friends</span>
        <div style={{ width: 32 }} />
      </div>

      <div style={S.scroll}>

        {/* Your Circle — already following */}
        {myCircle.length > 0 && (
          <>
            <div style={S.sectionLabel}>Your Circle</div>
            {myCircle.map((creator) => (
              <CreatorRow
                key={creator.id}
                creator={creator}
                navigate={navigate}
                isFollowing={true}
                onFollow={() => handleFollow(creator.id)}
                fmt={fmt}
              />
            ))}
          </>
        )}

        {/* Suggestions */}
        <div style={S.sectionLabel}>
          Suggested for you
        </div>

        {suggestedCreators.length === 0 ? (
          <div style={S.emptyWrap}>
            <p style={S.emptyText}>No more suggestions right now</p>
          </div>
        ) : (
          suggestedCreators.map((creator) => (
            <CreatorRow
              key={creator.id}
              creator={creator}
              navigate={navigate}
              isFollowing={false}
              onFollow={() => handleFollow(creator.id)}
              fmt={fmt}
            />
          ))
        )}

        <div style={{ height: "30px" }} />
      </div>
    </div>
  );
};

/* ===== CREATOR ROW — Facebook style: avatar | name + gap | follow ===== */
const CreatorRow = ({ creator, navigate, isFollowing, onFollow, fmt }) => (
  <div style={S.row}>
    <div
      style={S.rowLeft}
      onClick={() => navigate(`/profile/${creator.id}`)}
    >
      <div style={S.avatar}>
        {creator.name?.charAt(0).toUpperCase()}
      </div>
      <div style={S.nameBlock}>
        <span style={S.username}>{creator.name}</span>
        <span style={S.respectCount}>
          {fmt(creator.totalRespects)} respects
        </span>
      </div>
    </div>

    <button
      style={{
        ...S.followBtn,
        background: isFollowing ? "#f0f0f0" : "#7F77DD",
        color: isFollowing ? "#333" : "#fff",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onFollow();
      }}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  </div>
);

/* ===== ICONS ===== */
const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
    <path
      d="M19 12H5M5 12L12 19M5 12L12 5"
      stroke="#000"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ===== STYLES — White, pure, minimal ===== */
const S = {
  page: {
    background: "#ffffff",
    minHeight: "100vh",
    color: "#000",
    fontFamily: "-apple-system,system-ui,sans-serif",
    display: "flex",
    flexDirection: "column",
  },
  topbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 16px",
    borderBottom: "0.5px solid #eaeaea",
    position: "sticky",
    top: 0,
    background: "#ffffff",
    zIndex: 100,
  },
  backBtn: {
    width: "32px",
    height: "32px",
    background: "none",
    border: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    padding: 0,
  },
  title: {
    fontSize: "17px",
    fontWeight: "600",
    color: "#000",
  },
  scroll: { flex: 1, overflowY: "auto" },
  sectionLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#000",
    padding: "16px 16px 8px",
  },

  /* Row — Facebook style */
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 16px",
    gap: "12px",
  },
  rowLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer",
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "#7F77DD",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "17px",
    fontWeight: "600",
    color: "#fff",
    flexShrink: 0,
  },
  nameBlock: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  username: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#000",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
  respectCount: {
    fontSize: "12px",
    color: "#888",
    marginTop: "2px",
  },
  followBtn: {
    fontSize: "13px",
    fontWeight: "600",
    border: "none",
    borderRadius: "8px",
    padding: "8px 18px",
    cursor: "pointer",
    flexShrink: 0,
  },

  emptyWrap: {
    padding: "40px 20px",
    textAlign: "center",
  },
  emptyText: {
    fontSize: "13px",
    color: "#999",
  },
};

export default Friends;