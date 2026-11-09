import { useMemo, useState } from "react";

/* ── QR code generator (deterministic, permanent per userId) ── */
const generateQRCells = (userId) => {
  const seed = String(userId)
    .split("")
    .reduce((a, c) => (Math.imul(31, a) + c.charCodeAt(0)) | 0, 0);
  const abs = Math.abs(seed);
  const cells = [];

  for (let r = 0; r < 25; r++) {
    for (let c = 0; c < 25; c++) {
      // Finder patterns (top-left, top-right, bottom-left corners)
      const isFinderPattern =
        (r < 9 && c < 9) ||
        (r < 9 && c > 15) ||
        (r > 15 && c < 9);

      let filled;
      if (isFinderPattern) {
        // Classic finder pattern squares
        const inTopLeft   = r < 8 && c < 8;
        const inTopRight  = r < 8 && c > 16;
        const inBotLeft   = r > 16 && c < 8;
        const borderTL    = inTopLeft   && (r === 0 || r === 6 || c === 0 || c === 6);
        const centerTL    = inTopLeft   && r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const borderTR    = inTopRight  && (r === 0 || r === 6 || c === 17 || c === 24);
        const centerTR    = inTopRight  && r >= 2 && r <= 4 && c >= 19 && c <= 22;
        const borderBL    = inBotLeft   && (r === 17 || r === 24 || c === 0 || c === 6);
        const centerBL    = inBotLeft   && r >= 19 && r <= 22 && c >= 2 && c <= 4;
        filled = borderTL || centerTL || borderTR || centerTR || borderBL || centerBL;
      } else {
        filled = ((abs * (r + 3) * (c + 7) + r * c) % 5) < 2;
      }
      if (filled) cells.push({ r, c });
    }
  }
  return cells;
};

const QRCode = ({ userId, size = 180 }) => {
  const cells = useMemo(() => generateQRCells(userId), [userId]);
  const cell  = size / 25;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label="Profile QR Code"
    >
      <rect width={size} height={size} fill="#0a0a0a" rx={14} />
      {cells.map(({ r, c }) => (
        <rect
          key={`${r}-${c}`}
          x={c * cell + 0.5}
          y={r * cell + 0.5}
          width={cell - 1}
          height={cell - 1}
          fill="#7F77DD"
          rx={1}
        />
      ))}
      {/* Center logo mark */}
      <rect x={size / 2 - 14} y={size / 2 - 14} width={28} height={28} fill="#0a0a0a" rx={6} />
      <text x={size / 2} y={size / 2 + 5} textAnchor="middle" fill="#7F77DD" fontSize={12} fontWeight="700" fontFamily="system-ui">D</text>
    </svg>
  );
};

/* ─── ShareProfileModal ─────────────────────────────────── */
const ShareProfileModal = ({ user, onClose }) => {
  const [copied, setCopied] = useState(false);
  const profileUrl = `https://drandee.vercel.app/u/${user?.username || user?.id || "user"}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = profileUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${user?.name || "Drandee"} on Drandee`,
          text: `Check out my Drandee profile`,
          url: profileUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      copyLink();
    }
  };

  const shareToWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(`Check out my Drandee profile: ${profileUrl}`)}`, "_blank");

  const shareToTwitter = () =>
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Find me on @DrandeeApp 🌟 ${profileUrl}`)}`, "_blank");

  const shareToTelegram = () =>
    window.open(`https://t.me/share/url?url=${encodeURIComponent(profileUrl)}&text=${encodeURIComponent("Check out my Drandee profile!")}`, "_blank");

  const shareToInstagram = () => {
    copyLink();
    window.open("https://www.instagram.com", "_blank");
  };

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        <div style={S.handle} />

        {/* header */}
        <div style={S.header}>
          <span style={S.title}>Share Profile</span>
          <button type="button" style={S.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* QR section */}
        <div style={S.qrSection}>
          <div style={S.qrCard}>
            <div style={S.qrGlow} />
            <QRCode userId={user?.id || "default"} size={180} />
          </div>
          <p style={S.qrName}>@{user?.username || user?.name || "profile"}</p>
          <p style={S.qrHint}>Scan to visit profile</p>
        </div>

        {/* URL row */}
        <div style={S.urlRow}>
          <span style={S.urlText} title={profileUrl}>{profileUrl}</span>
          <button type="button" style={{ ...S.copyBtn, background: copied ? "rgba(29,158,117,0.2)" : "#1a1a1a", borderColor: copied ? "rgba(29,158,117,0.5)" : "#2a2a2a", color: copied ? "#1D9E75" : "rgba(255,255,255,0.6)" }} onClick={copyLink}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        {/* Platform buttons */}
        <div style={S.platformGrid}>
          {[
            { label: "WhatsApp",  color: "#25D366", icon: "💬", fn: shareToWhatsApp },
            { label: "Telegram",  color: "#0088cc", icon: "✈️", fn: shareToTelegram },
            { label: "Twitter",   color: "#1DA1F2", icon: "🐦", fn: shareToTwitter },
            { label: "Instagram", color: "#E1306C", icon: "📸", fn: shareToInstagram },
          ].map((p) => (
            <button
              key={p.label}
              type="button"
              style={{
                ...S.platBtn,
                background: `${p.color}12`,
                border: `0.5px solid ${p.color}30`,
                color: p.color,
              }}
              onClick={p.fn}
            >
              <span style={{ fontSize: 18 }}>{p.icon}</span>
              <span style={S.platLabel}>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Native share */}
        {typeof navigator !== "undefined" && navigator.share && (
          <button type="button" style={S.nativeShareBtn} onClick={shareNative}>
            Share via...
          </button>
        )}

        <div style={{ height: 16 }} />
      </div>
    </div>
  );
};

const S = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", padding: "16px" },
  modal: { width: "100%", maxWidth: 400, background: "#0c0c0c", border: "0.5px solid #1e1e1e", borderRadius: 24, maxHeight: "90vh", overflowY: "auto", WebkitOverflowScrolling: "touch" },
  handle: { width: 36, height: 4, background: "#2a2a2a", borderRadius: 2, margin: "10px auto 0" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 0" },
  title: { fontSize: "16px", fontWeight: "700", color: "#fff" },
  closeBtn: { background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "16px", cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center" },
  qrSection: { display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 20px 16px" },
  qrCard: { position: "relative", padding: 16, background: "#111", border: "0.5px solid #222", borderRadius: 20, marginBottom: 12 },
  qrGlow: { position: "absolute", inset: -10, borderRadius: 30, background: "radial-gradient(ellipse at center, rgba(127,119,221,0.15) 0%, transparent 70%)", pointerEvents: "none" },
  qrName: { fontSize: "15px", fontWeight: "700", color: "#fff", marginBottom: 4 },
  qrHint: { fontSize: "12px", color: "rgba(255,255,255,0.35)" },
  urlRow: { display: "flex", alignItems: "center", margin: "0 16px 16px", background: "#111", border: "0.5px solid #222", borderRadius: 12, padding: "10px 12px", gap: 10 },
  urlText: { flex: 1, fontSize: "12px", color: "rgba(255,255,255,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  copyBtn: { flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: "0.5px solid", fontSize: "12px", fontWeight: "600", cursor: "pointer" },
  platformGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "0 16px 14px" },
  platBtn: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "14px 10px", borderRadius: 14, cursor: "pointer", transition: "transform 0.15s" },
  platLabel: { fontSize: "12px", fontWeight: "600" },
  nativeShareBtn: { width: "calc(100% - 32px)", margin: "0 16px", height: 46, background: "#1a1a1a", border: "0.5px solid #2a2a2a", borderRadius: 14, color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer" },
};

export default ShareProfileModal;
