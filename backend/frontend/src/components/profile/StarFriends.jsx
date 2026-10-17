import { useNavigate } from "react-router-dom";
import DefaultAvatar from "../DefaultAvatar";

/* ─── StarFriends ───────────────────────────────────────── */
/**
 * Props:
 *   starFriends   – [{ id, name, username, profilePic }]
 *   allFollowing  – [{ id, name, username, profilePic }] (editable pool)
 *   isOwn
 *   onToggleStar  – (userId) => void
 *   onOpenFollowing – () => void  (shortcut to open following modal)
 */
const StarFriends = ({ starFriends = [], allFollowing = [], isOwn, onToggleStar, onOpenFollowing }) => {
  const navigate = useNavigate();

  return (
    <div style={S.wrap}>
      {/* ── Section header ── */}
      <div style={S.hdr}>
        <div style={S.hdrLeft}>
          <span style={S.hdrIcon}>⭐</span>
          <span style={S.hdrTitle}>Star Friends</span>
          <span style={S.hdrCount}>{starFriends.length}/5</span>
        </div>
        {isOwn && (
          <button type="button" style={S.editBtn} onClick={onOpenFollowing}>
            Manage
          </button>
        )}
      </div>

      {/* ── Stars row ── */}
      {starFriends.length > 0 ? (
        <div style={S.starsRow}>
          {starFriends.map((sf, i) => (
            <div key={sf.id} style={S.starCard}>
              {/* rank badge */}
              <div style={{ ...S.rankBadge, background: i === 0 ? "rgba(255,215,0,0.2)" : "rgba(127,119,221,0.15)" }}>
                {i === 0 ? "👑" : `#${i + 1}`}
              </div>

              {/* avatar */}
              <div
                style={S.avatarWrap}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/profile/${sf.id}`)}
                onKeyDown={(e) => e.key === "Enter" && navigate(`/profile/${sf.id}`)}
              >
                <div style={{ ...S.avatarRing, border: i === 0 ? "2px solid #FFD700" : "2px solid rgba(127,119,221,0.6)" }}>
                  {sf.profilePic ? (
                    <img src={sf.profilePic} alt={sf.name} style={S.avatarImg} />
                  ) : (
                    <DefaultAvatar size={54} creatorId={sf.id} creatorName={sf.name} />
                  )}
                </div>
                <div style={S.starIcon}>⭐</div>
              </div>

              <span style={S.starName} onClick={() => navigate(`/profile/${sf.id}`)}>
                {sf.username ? `@${sf.username}` : sf.name}
              </span>

              {isOwn && (
                <button
                  type="button"
                  style={S.removeBtn}
                  onClick={(e) => { e.stopPropagation(); onToggleStar?.(sf.id); }}
                  aria-label={`Remove ${sf.name} from star friends`}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {/* Empty star slots */}
          {isOwn && starFriends.length < 5 &&
            Array.from({ length: 5 - starFriends.length }).map((_, i) => (
              <div key={`empty-${i}`} style={S.emptySlot} onClick={onOpenFollowing}>
                <div style={S.emptyCircle}>
                  <span style={S.emptyPlus}>+</span>
                </div>
                <span style={S.emptyLabel}>Add</span>
              </div>
            ))
          }
        </div>
      ) : isOwn ? (
        <div style={S.emptyState}>
          <p style={S.emptyTitle}>No star friends yet</p>
          <p style={S.emptyDesc}>Mark up to 5 people from your following as star friends</p>
          <button type="button" style={S.addBtn} onClick={onOpenFollowing}>
            + Select from Following
          </button>
        </div>
      ) : (
        <div style={S.emptyState}>
          <p style={S.emptyDesc}>No star friends yet</p>
        </div>
      )}

      {/* ── Full following list (visible when star friends exist) ── */}
      {isOwn && allFollowing.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={S.followingHdr}>
            <span style={S.followingTitle}>Following</span>
            <span style={S.followingCount}>{allFollowing.length} people</span>
          </div>
          {allFollowing.map((u) => {
            const isStar = starFriends.some((sf) => sf.id === u.id);
            return (
              <div key={u.id} style={S.followRow}>
                <div
                  style={S.followAvatarWrap}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/profile/${u.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/profile/${u.id}`)}
                >
                  {u.profilePic ? (
                    <img src={u.profilePic} alt={u.name} style={S.followAvatar} />
                  ) : (
                    <DefaultAvatar size={42} creatorId={u.id} creatorName={u.name} />
                  )}
                </div>
                <div style={S.followInfo} onClick={() => navigate(`/profile/${u.id}`)}>
                  <span style={S.followName}>{u.name}</span>
                  {u.username && <span style={S.followUsername}>@{u.username}</span>}
                </div>
                <button
                  type="button"
                  style={{
                    ...S.starToggle,
                    background: isStar ? "rgba(255,215,0,0.12)" : "#131313",
                    border: isStar ? "0.5px solid rgba(255,215,0,0.35)" : "0.5px solid #222",
                    color: isStar ? "#FFD700" : "rgba(255,255,255,0.4)",
                    opacity: !isStar && starFriends.length >= 5 ? 0.35 : 1,
                  }}
                  onClick={() => onToggleStar?.(u.id)}
                  disabled={!isStar && starFriends.length >= 5}
                  aria-label={isStar ? "Remove star" : "Add star"}
                >
                  ⭐ {isStar ? "Starred" : "Star"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const S = {
  wrap: { padding: "16px" },
  hdr: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  hdrLeft: { display: "flex", alignItems: "center", gap: 8 },
  hdrIcon: { fontSize: 16 },
  hdrTitle: { fontSize: "14px", fontWeight: "700", color: "#fff" },
  hdrCount: { fontSize: "12px", color: "rgba(255,255,255,0.35)", background: "#1a1a1a", padding: "2px 8px", borderRadius: 20 },
  editBtn: { background: "none", border: "0.5px solid #333", color: "#7F77DD", borderRadius: 20, padding: "5px 14px", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  starsRow: { display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" },
  starCard: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 72, position: "relative", cursor: "pointer" },
  rankBadge: { fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: 20, color: "#fff" },
  avatarWrap: { position: "relative" },
  avatarRing: { borderRadius: "50%", padding: 2, display: "inline-block" },
  avatarImg: { width: 54, height: 54, borderRadius: "50%", objectFit: "cover", display: "block" },
  starIcon: { position: "absolute", bottom: -2, right: -2, fontSize: 14 },
  starName: { fontSize: "11px", color: "#fff", fontWeight: "600", textAlign: "center", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer" },
  removeBtn: { background: "rgba(255,107,107,0.12)", border: "0.5px solid rgba(255,107,107,0.3)", color: "#FF6B6B", borderRadius: "50%", width: 20, height: 20, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  emptySlot: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 72, cursor: "pointer" },
  emptyCircle: { width: 54, height: 54, borderRadius: "50%", border: "1.5px dashed #333", display: "flex", alignItems: "center", justifyContent: "center", background: "#111" },
  emptyPlus: { fontSize: "22px", color: "rgba(255,255,255,0.2)", lineHeight: 1 },
  emptyLabel: { fontSize: "11px", color: "rgba(255,255,255,0.3)" },
  emptyState: { display: "flex", flexDirection: "column", alignItems: "center", padding: "28px 0", gap: 8 },
  emptyTitle: { fontSize: "14px", fontWeight: "600", color: "rgba(255,255,255,0.55)" },
  emptyDesc: { fontSize: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center", maxWidth: 220 },
  addBtn: { marginTop: 4, background: "#7F77DD", color: "#fff", border: "none", borderRadius: 20, padding: "8px 20px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  followingHdr: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  followingTitle: { fontSize: "12px", fontWeight: "700", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.5px" },
  followingCount: { fontSize: "12px", color: "rgba(255,255,255,0.3)" },
  followRow: { display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "0.5px solid #141414" },
  followAvatarWrap: { cursor: "pointer", flexShrink: 0 },
  followAvatar: { width: 42, height: 42, borderRadius: "50%", objectFit: "cover" },
  followInfo: { flex: 1, cursor: "pointer", minWidth: 0 },
  followName: { display: "block", fontSize: "14px", fontWeight: "600", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  followUsername: { display: "block", fontSize: "12px", color: "rgba(255,255,255,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  starToggle: { flexShrink: 0, padding: "6px 12px", borderRadius: 20, fontSize: "12px", cursor: "pointer", fontWeight: "600" },
};

export default StarFriends;
