import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import DefaultAvatar from "../DefaultAvatar";

/* ─── FollowersModal ────────────────────────────────────── */
/**
 * Props:
 *   mode          – "followers" | "following"
 *   userId        – owner user id
 *   currentUserId – logged-in user id
 *   starFriends   – array of userIds marked as star friends
 *   onClose
 *   onToggleStar  – (userId) => void
 *   fetchList     – async (userId, mode) => [{ id, name, username, profilePic }]
 */
const FollowersModal = ({
  mode = "followers",
  userId,
  currentUserId,
  starFriends = [],
  onClose,
  onToggleStar,
  fetchList,
}) => {
  const navigate = useNavigate();
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchList(userId, mode);
      setList(data || []);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [userId, mode, fetchList]);

  useEffect(() => { load(); }, [load]);

  const filtered = list.filter((u) => {
    const q = search.toLowerCase();
    return !q || (u.name || "").toLowerCase().includes(q) || (u.username || "").toLowerCase().includes(q);
  });

  const isOwn = userId === currentUserId;
  const title = mode === "followers" ? "Followers" : "Following";

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <div style={S.handle} />

        {/* header */}
        <div style={S.header}>
          <span style={S.title}>{title}</span>
          <button type="button" style={S.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* search */}
        <div style={S.searchRow}>
          <SearchIcon />
          <input
            style={S.searchInput}
            placeholder={`Search ${title.toLowerCase()}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* star friends header — only for following tab */}
        {mode === "following" && isOwn && starFriends.length > 0 && !search && (
          <div style={S.starBanner}>
            <StarIcon /> <span style={S.starBannerTxt}>Star Friends ({starFriends.length}/5)</span>
          </div>
        )}

        {/* list */}
        <div style={S.listWrap}>
          {loading ? (
            <div style={S.center}>
              <div style={S.loader} />
            </div>
          ) : filtered.length === 0 ? (
            <div style={S.center}>
              <p style={S.empty}>
                {search ? "No results found" : mode === "followers" ? "No followers yet" : "Not following anyone yet"}
              </p>
            </div>
          ) : (
            filtered.map((u) => {
              const isStar = starFriends.includes(u.id);
              const isCurrentUser = u.id === currentUserId;
              return (
                <div key={u.id} style={{ ...S.row, background: isStar ? "rgba(255,215,0,0.05)" : "transparent" }}>
                  {/* avatar */}
                  <div
                    style={S.avatarWrap}
                    role="button"
                    tabIndex={0}
                    onClick={() => { onClose(); navigate(`/profile/${u.id}`); }}
                    onKeyDown={(e) => e.key === "Enter" && (onClose(), navigate(`/profile/${u.id}`))}
                  >
                    {u.profilePic ? (
                      <img src={u.profilePic} alt={u.name} style={S.avatar} />
                    ) : (
                      <DefaultAvatar size={46} creatorId={u.id} creatorName={u.name} />
                    )}
                    {isStar && <div style={S.starBadge}>⭐</div>}
                  </div>

                  {/* info */}
                  <div
                    style={S.info}
                    role="button"
                    tabIndex={0}
                    onClick={() => { onClose(); navigate(`/profile/${u.id}`); }}
                    onKeyDown={(e) => e.key === "Enter" && (onClose(), navigate(`/profile/${u.id}`))}
                  >
                    <span style={S.name}>{u.name || u.username}</span>
                    {u.username && <span style={S.username}>@{u.username}</span>}
                    {isStar && <span style={S.starLabel}>Star Friend</span>}
                  </div>

                  {/* star toggle — only for own following */}
                  {mode === "following" && isOwn && !isCurrentUser && (
                    <button
                      type="button"
                      style={{
                        ...S.starBtn,
                        background: isStar ? "rgba(255,215,0,0.15)" : "#151515",
                        border: isStar ? "0.5px solid rgba(255,215,0,0.4)" : "0.5px solid #252525",
                        color: isStar ? "#FFD700" : "rgba(255,255,255,0.4)",
                      }}
                      onClick={() => onToggleStar?.(u.id)}
                      aria-label={isStar ? "Remove star friend" : "Add star friend"}
                      title={!isStar && starFriends.length >= 5 ? "Max 5 star friends" : ""}
                      disabled={!isStar && starFriends.length >= 5}
                    >
                      ⭐ {isStar ? "Starred" : "Star"}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Icons ── */
const SearchIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" />
    <path d="M21 21l-4.35-4.35" stroke="rgba(255,255,255,0.3)" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);
const StarIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="#FFD700">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

/* ── Styles ── */
const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1200, display: "flex", alignItems: "flex-end", backdropFilter: "blur(6px)" },
  sheet: { width: "100%", maxWidth: 540, margin: "0 auto", background: "#0c0c0c", borderTop: "0.5px solid #222", borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "80vh", display: "flex", flexDirection: "column" },
  handle: { width: 36, height: 4, background: "#2a2a2a", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 0, flexShrink: 0 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", flexShrink: 0 },
  title: { fontSize: "16px", fontWeight: "700", color: "#fff" },
  closeBtn: { background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "16px", cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" },
  searchRow: { display: "flex", alignItems: "center", gap: 10, margin: "0 16px 12px", background: "#151515", border: "0.5px solid #222", borderRadius: 12, padding: "10px 12px", flexShrink: 0 },
  searchInput: { flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: "14px" },
  starBanner: { display: "flex", alignItems: "center", gap: 6, margin: "0 16px 10px", padding: "8px 12px", background: "rgba(255,215,0,0.08)", border: "0.5px solid rgba(255,215,0,0.2)", borderRadius: 10, flexShrink: 0 },
  starBannerTxt: { fontSize: "12px", fontWeight: "600", color: "#FFD700" },
  listWrap: { overflowY: "auto", flex: 1, padding: "0 16px 20px", WebkitOverflowScrolling: "touch" },
  center: { display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0" },
  loader: { width: 28, height: 28, borderRadius: "50%", border: "3px solid #222", borderTopColor: "#7F77DD", animation: "spin 0.8s linear infinite" },
  empty: { fontSize: "13px", color: "rgba(255,255,255,0.35)", textAlign: "center" },
  row: { display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderRadius: 12, marginBottom: 2 },
  avatarWrap: { position: "relative", cursor: "pointer", flexShrink: 0 },
  avatar: { width: 46, height: 46, borderRadius: "50%", objectFit: "cover" },
  starBadge: { position: "absolute", bottom: -2, right: -2, fontSize: 12, lineHeight: 1 },
  info: { flex: 1, display: "flex", flexDirection: "column", gap: 2, cursor: "pointer", minWidth: 0 },
  name: { fontSize: "14px", fontWeight: "600", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  username: { fontSize: "12px", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  starLabel: { fontSize: "11px", color: "#FFD700", fontWeight: "600" },
  starBtn: { flexShrink: 0, padding: "6px 12px", borderRadius: 20, fontSize: "12px", cursor: "pointer", fontWeight: "600" },
};

export default FollowersModal;
