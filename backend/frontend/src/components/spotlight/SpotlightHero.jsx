import React from "react";
import { ChevronDown } from "lucide-react";

export default function SpotlightHero({ onDiscoverClick, onNotifyClick }) {
  return (
    <section className="spotlight-section animate-slide-in" aria-labelledby="hero-heading" style={{ justifyContent: 'center' }}>
      <div style={styles.badge}>
        <span style={styles.badgeDot} aria-hidden="true" />
        <span style={styles.badgeText}>Something is coming</span>
      </div>
      
      <h1 id="hero-heading" style={styles.heroTitle}>
        SPOT<span style={styles.heroAccent}>LIGHT</span>
      </h1>
      
      <p style={styles.heroTagline}>Talent deserves to be discovered.</p>
      <p style={styles.heroSub}>Something new is coming to Drandee.</p>
      
      <div style={styles.heroCtas}>
        <button 
          style={styles.btnPrimary} 
          onClick={onDiscoverClick} 
          aria-label="Discover what's coming"
        >
          Discover What's Coming <span aria-hidden="true">↓</span>
        </button>
        <button 
          style={styles.btnSecondary} 
          onClick={onNotifyClick} 
          aria-label="Keep me posted"
        >
          Keep Me Posted
        </button>
      </div>

      {/* Swipe Up Hint */}
      <div className="swipe-hint" style={{ bottom: '20px' }}>
        <span>Swipe Up</span>
        <ChevronDown size={24} className="animate-bounce-subtle" />
      </div>
    </section>
  );
}

const styles = {
  hero: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "85vh",
    textAlign: "center",
    padding: "0 24px",
    marginTop: "60px",
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(127, 119, 221, 0.1)",
    border: "1px solid rgba(127, 119, 221, 0.2)",
    padding: "6px 16px",
    borderRadius: "100px",
    marginBottom: "32px",
  },
  badgeDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--primary, #7F77DD)",
    boxShadow: "0 0 12px var(--primary, #7F77DD)",
    animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  },
  badgeText: {
    color: "var(--primary-light, #9F99E8)",
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: "clamp(64px, 12vw, 120px)",
    fontWeight: "900",
    lineHeight: "1",
    letterSpacing: "-0.04em",
    color: "#fff",
    margin: "0 0 24px 0",
    textShadow: "0 0 80px rgba(127, 119, 221, 0.3)",
  },
  heroAccent: {
    background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.4) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroTagline: {
    fontSize: "clamp(20px, 4vw, 32px)",
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    margin: "0 0 12px 0",
    maxWidth: "800px",
  },
  heroSub: {
    fontSize: "clamp(16px, 2vw, 20px)",
    color: "rgba(255,255,255,0.5)",
    margin: "0 0 48px 0",
    maxWidth: "600px",
  },
  heroCtas: {
    display: "flex",
    gap: "16px",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, var(--primary, #7F77DD) 0%, var(--primary-dark, #6A61C9) 100%)",
    color: "#fff",
    border: "none",
    padding: "16px 32px",
    borderRadius: "100px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    boxShadow: "0 8px 32px rgba(127, 119, 221, 0.3)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  btnSecondary: {
    background: "rgba(255, 255, 255, 0.05)",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    padding: "16px 32px",
    borderRadius: "100px",
    fontSize: "16px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background 0.2s ease, border-color 0.2s ease",
  },
};
