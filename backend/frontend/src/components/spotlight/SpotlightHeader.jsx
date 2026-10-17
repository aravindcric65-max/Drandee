import React from "react";

export default function SpotlightHeader() {
  return (
    <header style={styles.header}>
      {/* Ambient background orbs */}
      <div style={styles.orb1} aria-hidden="true" />
      <div style={styles.orb2} aria-hidden="true" />
      
      {/* Grid overlay */}
      <div style={styles.gridOverlay} aria-hidden="true" />
      
      <div style={styles.content}>
        <div style={styles.logoGroup}>
          <div style={styles.logoMark} aria-hidden="true">D</div>
          <span style={styles.logoText}>Drandee</span>
        </div>
        
        <h1 style={styles.title}>
          SPOT<span style={styles.accent}>LIGHT</span>
        </h1>
        
        {/* Empty div for flex balance */}
        <div style={{ width: 72 }} />
      </div>
    </header>
  );
}

const styles = {
  header: {
    position: "absolute",
    top: 0, left: 0, right: 0,
    padding: "24px 32px",
    zIndex: 10,
  },
  content: { 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "space-between",
    maxWidth: "1200px",
    margin: "0 auto"
  },
  logoGroup: { display: "flex", alignItems: "center", gap: "10px" },
  logoMark: {
    width: "32px", height: "32px", borderRadius: "8px",
    background: "linear-gradient(135deg, var(--primary, #7F77DD) 0%, var(--primary-dark, #6A61C9) 100%)",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "16px", fontWeight: "900", color: "#fff",
    boxShadow: "0 0 16px rgba(127,119,221,0.4)",
  },
  logoText: { fontSize: "18px", fontWeight: "800", color: "#fff", letterSpacing: "-0.02em" },
  title: {
    fontSize: "20px",
    fontWeight: "800",
    color: "#fff",
    letterSpacing: "0.15em",
    margin: 0,
    textTransform: "uppercase"
  },
  accent: {
    color: "var(--primary-light, #9F99E8)"
  },
  orb1: {
    position: "fixed", top: "-20%", left: "50%", transform: "translateX(-50%)",
    width: "100vw", height: "60vh",
    background: "radial-gradient(ellipse at center, rgba(127,119,221,0.12) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  orb2: {
    position: "fixed", bottom: "-20%", right: "-10%",
    width: "70vw", height: "60vh",
    background: "radial-gradient(ellipse at center, rgba(175,169,236,0.08) 0%, transparent 70%)",
    pointerEvents: "none", zIndex: 0,
  },
  gridOverlay: {
    position: "fixed", inset: 0, backgroundSize: "40px 40px",
    backgroundImage: "linear-gradient(to right, rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)",
    pointerEvents: "none", zIndex: 1,
  }
};
