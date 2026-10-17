import { useState, useRef, useEffect } from "react";
import DefaultAvatar from "../DefaultAvatar";

const NICHES = [
  "Art & Design", "Comedy & Memes", "Cooking & Food", "Dance",
  "Education", "Fashion & Style", "Finance & Business", "Fitness & Gym",
  "Gaming", "Health & Wellness", "Music", "Nature & Travel",
  "News & Politics", "Photography", "Science & Tech", "Spirituality",
  "Sports", "Tamil Culture", "Vlogs", "Other",
];

const GENDERS = ["Male", "Female", "Non-binary", "Transgender", "Prefer not to say", "Other"];

const FRAMES = [
  { id: "gradient", label: "Nebula Glow",    preview: "linear-gradient(135deg,#7F77DD,#E040FB)" },
  { id: "gold",     label: "Legendary Gold", preview: "linear-gradient(135deg,#FFD700,#FFA500)" },
  { id: "neon",     label: "Cyber Neon",     preview: "linear-gradient(135deg,#00F2FE,#4FACFE)" },
  { id: "crimson",  label: "Crimson Flare",  preview: "linear-gradient(135deg,#FF4B2B,#FF416C)" },
];

/* ─── EditProfileModal ──────────────────────────────────── */
const EditProfileModal = ({ user, onSave, onClose, isSaving }) => {
  const [name,       setName]       = useState(user?.name       || "");
  const [username,   setUsername]   = useState(user?.username   || "");
  const [bio,        setBio]        = useState(user?.bio        || "");
  const [gender,     setGender]     = useState(user?.gender     || "");
  const [niches,     setNiches]     = useState(
    Array.isArray(user?.niche) ? user.niche : (user?.niche ? [user.niche] : [])
  );
  const [birthday,   setBirthday]   = useState(user?.birthday   || "");
  const [email]                     = useState(user?.email      || "");
  const [phone,      setPhone]      = useState(user?.phone      || "");
  const [profilePic, setProfilePic] = useState(user?.profilePic || null);
  const [frameStyle, setFrameStyle] = useState(user?.frameStyle || "gradient");
  const [usernameErr,setUsernameErr]= useState("");
  const [picLoading, setPicLoading] = useState(false);

  const fileRef = useRef(null);

  // Reset on open
  useEffect(() => {
    setName(user?.name || "");
    setUsername(user?.username || "");
    setBio(user?.bio || "");
    setGender(user?.gender || "");
    setNiches(Array.isArray(user?.niche) ? user.niche : (user?.niche ? [user.niche] : []));
    setBirthday(user?.birthday || "");
    setPhone(user?.phone || "");
    setProfilePic(user?.profilePic || null);
    setFrameStyle(user?.frameStyle || "gradient");
    setUsernameErr("");
  }, [user]);

  const toggleNiche = (n) => {
    setNiches((prev) =>
      prev.includes(n)
        ? prev.filter((x) => x !== n)
        : prev.length < 5
          ? [...prev, n]
          : prev
    );
  };

  const handlePicFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPicLoading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setProfilePic(ev.target.result);
      setPicLoading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, "");
    if (!name.trim()) return;
    if (!cleanUsername) { setUsernameErr("Username cannot be empty"); return; }
    if (cleanUsername.length < 3) { setUsernameErr("Min 3 characters"); return; }

    onSave({
      name: name.trim(),
      username: cleanUsername,
      bio: bio.trim(),
      gender,
      niche: niches,
      birthday,
      phone: phone.trim(),
      profilePic,
      frameStyle,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        {/* handle */}
        <div style={S.handle} />
        <div style={S.header}>
          <button type="button" style={S.cancelHdr} onClick={onClose}>Cancel</button>
          <span style={S.title}>Edit Profile</span>
          <button type="button" style={{ ...S.saveHdr, opacity: isSaving ? 0.5 : 1 }} onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        <div style={S.scroll}>
          {/* ── Avatar section ── */}
          <div style={S.avatarRow}>
            <div style={{ ...S.avatarRing, background: FRAMES.find(f => f.id === frameStyle)?.preview }}>
              <div style={S.avatarCircle} onClick={() => fileRef.current?.click()}>
                {picLoading ? (
                  <div style={S.picLoader} />
                ) : profilePic ? (
                  <img src={profilePic} alt="preview" style={S.picImg} />
                ) : (
                  <DefaultAvatar size={76} creatorId={user?.id} creatorName={name || user?.name} />
                )}
                <div style={S.picOverlay}>
                  <CameraIcon />
                </div>
              </div>
            </div>
            <div style={S.avatarInfo}>
              <span style={S.avatarHint}>Tap to change photo</span>
              <span style={S.avatarSub}>JPG or PNG, max 5MB</span>
            </div>
          </div>

          {/* ── Frame theme picker ── */}
          <Field label="Profile Frame">
            <div style={S.frameRow}>
              {FRAMES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  style={{ ...S.frameBtn, border: frameStyle === f.id ? "2px solid #7F77DD" : "2px solid transparent" }}
                  onClick={() => setFrameStyle(f.id)}
                  aria-label={f.label}
                  title={f.label}
                >
                  <div style={{ ...S.frameSwatch, background: f.preview }} />
                  <span style={S.frameLabel}>{f.label}</span>
                </button>
              ))}
            </div>
          </Field>

          {/* ── Name ── */}
          <Field label="Display Name *">
            <input
              style={S.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              maxLength={50}
            />
          </Field>

          {/* ── Username ── */}
          <Field label="Username *">
            <div style={S.prefixRow}>
              <span style={S.at}>@</span>
              <input
                style={S.prefixInput}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""));
                  setUsernameErr("");
                }}
                placeholder="username"
                maxLength={30}
              />
            </div>
            {usernameErr && <span style={S.errMsg}>{usernameErr}</span>}
          </Field>

          {/* ── Bio ── */}
          <Field label="Bio">
            <textarea
              style={S.textarea}
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 150))}
              placeholder="Share your story..."
            />
            <span style={S.charCount}>{bio.length}/150</span>
          </Field>

          {/* ── Gender ── */}
          <Field label="Gender">
            <div style={S.chips}>
              {GENDERS.map((g) => (
                <button
                  key={g}
                  type="button"
                  style={{ ...S.chip, background: gender === g ? "#7F77DD" : "#131313", border: gender === g ? "none" : "0.5px solid #252525" }}
                  onClick={() => setGender(gender === g ? "" : g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </Field>

          {/* ── Niches (multi-select, max 5) ── */}
          <Field label={`Niches (${niches.length}/5 selected)`}>
            <div style={S.nicheGrid}>
              {NICHES.map((n) => (
                <button
                  key={n}
                  type="button"
                  style={{
                    ...S.nicheBtn,
                    background: niches.includes(n) ? "#7F77DD" : "#131313",
                    border: niches.includes(n) ? "none" : "0.5px solid #252525",
                    opacity: !niches.includes(n) && niches.length >= 5 ? 0.4 : 1,
                  }}
                  onClick={() => toggleNiche(n)}
                >
                  {niches.includes(n) && <span style={{ marginRight: 4, fontSize: 10 }}>✓</span>}
                  {n}
                </button>
              ))}
            </div>
          </Field>

          {/* ── Personal Information ── */}
          <div style={S.sectionTitle}>Personal Information</div>

          <Field label="Email (read-only)">
            <input
              type="email"
              style={{ ...S.input, opacity: 0.5, cursor: "not-allowed" }}
              value={email}
              readOnly
            />
          </Field>

          <Field label="Birthday">
            <input
              type="date"
              style={S.input}
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
            />
          </Field>

          <Field label="Phone">
            <input
              type="tel"
              style={S.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 00000 00000"
            />
          </Field>

          {/* ── Add Accounts ── */}
          <div style={S.addAccountRow}>
            <span style={S.addAccountLabel}>Linked Drandee Accounts</span>
            <button type="button" style={S.addAccountBtn}>+ Add Account</button>
          </div>

          <button type="button" style={{ ...S.saveBtnFull, opacity: isSaving ? 0.6 : 1 }} onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={S.spinner} /> Saving...
              </span>
            ) : "Save Changes"}
          </button>
          <div style={{ height: 20 }} />
        </div>

        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePicFile} />
      </div>
    </div>
  );
};

/* ── Helpers ── */
const Field = ({ label, children }) => (
  <div style={{ marginBottom: 18 }}>
    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "rgba(255,255,255,0.55)", marginBottom: 8, letterSpacing: "0.3px" }}>
      {label}
    </label>
    {children}
  </div>
);

const CameraIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 1100, display: "flex", alignItems: "flex-end", backdropFilter: "blur(6px)" },
  sheet: { width: "100%", maxWidth: 540, margin: "0 auto", background: "#0d0d0d", borderTop: "0.5px solid #222", borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: "92vh", display: "flex", flexDirection: "column" },
  handle: { width: 36, height: 4, background: "#2a2a2a", borderRadius: 2, alignSelf: "center", marginTop: 10, marginBottom: 4, flexShrink: 0 },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 14px", flexShrink: 0, borderBottom: "0.5px solid #1a1a1a" },
  title: { fontSize: "15px", fontWeight: "700", color: "#fff" },
  cancelHdr: { background: "none", border: "none", color: "rgba(255,255,255,0.5)", fontSize: "14px", cursor: "pointer", padding: "4px 0" },
  saveHdr: { background: "none", border: "none", color: "#7F77DD", fontSize: "14px", fontWeight: "700", cursor: "pointer", padding: "4px 0" },
  scroll: { overflowY: "auto", flex: 1, padding: "20px 16px 0", WebkitOverflowScrolling: "touch" },
  avatarRow: { display: "flex", alignItems: "center", gap: 16, marginBottom: 22, background: "#111", borderRadius: 16, padding: 14 },
  avatarRing: { padding: 3, borderRadius: "50%", flexShrink: 0 },
  avatarCircle: { width: 80, height: 80, borderRadius: "50%", overflow: "hidden", position: "relative", cursor: "pointer", background: "#1c1c1c", display: "flex", alignItems: "center", justifyContent: "center" },
  picOverlay: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center" },
  picImg: { width: "100%", height: "100%", objectFit: "cover" },
  picLoader: { width: 28, height: 28, borderRadius: "50%", border: "3px solid #333", borderTopColor: "#7F77DD", animation: "spin 0.8s linear infinite" },
  avatarInfo: { display: "flex", flexDirection: "column", gap: 4 },
  avatarHint: { fontSize: "13px", fontWeight: "600", color: "#fff" },
  avatarSub: { fontSize: "11px", color: "rgba(255,255,255,0.4)" },
  frameRow: { display: "flex", gap: 8 },
  frameBtn: { flex: 1, background: "#131313", borderRadius: 10, padding: "8px 4px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  frameSwatch: { width: 28, height: 28, borderRadius: "50%", flexShrink: 0 },
  frameLabel: { fontSize: "9px", color: "rgba(255,255,255,0.5)", textAlign: "center", lineHeight: 1.2 },
  input: { width: "100%", background: "#131313", border: "0.5px solid #222", borderRadius: 10, padding: "12px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" },
  prefixRow: { display: "flex", alignItems: "center", background: "#131313", border: "0.5px solid #222", borderRadius: 10, padding: "0 12px" },
  at: { color: "rgba(255,255,255,0.4)", fontSize: "14px", marginRight: 4 },
  prefixInput: { flex: 1, background: "transparent", border: "none", outline: "none", color: "#fff", fontSize: "14px", padding: "12px 0" },
  errMsg: { fontSize: "11px", color: "#FF6B6B", marginTop: 4, display: "block" },
  textarea: { width: "100%", background: "#131313", border: "0.5px solid #222", borderRadius: 10, padding: "12px", color: "#fff", fontSize: "14px", outline: "none", resize: "none", boxSizing: "border-box", fontFamily: "inherit" },
  charCount: { fontSize: "11px", color: "rgba(255,255,255,0.3)", display: "block", textAlign: "right", marginTop: 4 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: { padding: "7px 14px", borderRadius: 20, fontSize: "12px", color: "#fff", cursor: "pointer", fontWeight: "500" },
  nicheGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 },
  nicheBtn: { padding: "9px 12px", borderRadius: 10, fontSize: "12px", color: "#fff", cursor: "pointer", fontWeight: "500", textAlign: "left" },
  sectionTitle: { fontSize: "11px", fontWeight: "700", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 16, marginTop: 8, paddingTop: 16, borderTop: "0.5px solid #1a1a1a" },
  addAccountRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderTop: "0.5px solid #1a1a1a", marginBottom: 20 },
  addAccountLabel: { fontSize: "13px", color: "rgba(255,255,255,0.55)", fontWeight: "500" },
  addAccountBtn: { fontSize: "12px", color: "#7F77DD", background: "none", border: "none", cursor: "pointer", fontWeight: "600" },
  saveBtnFull: { width: "100%", height: 50, borderRadius: 14, background: "#7F77DD", border: "none", color: "#fff", fontSize: "15px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" },
  spinner: { width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite", display: "inline-block" },
};

export default EditProfileModal;
