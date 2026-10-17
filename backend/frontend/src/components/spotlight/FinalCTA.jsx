import React from "react";
import { useNavigate } from "react-router-dom";

export default function FinalCTA() {
  const navigate = useNavigate();

  return (
    <section style={styles.section} aria-label="Final Call to Action">
      <div style={styles.content}>
        <h2 style={styles.heading}>Ready to discover someone new?</h2>
        <p style={styles.subheading}>Spotlight is coming.</p>
        
        <button 
          style={styles.ctaBtn} 
          onClick={() => navigate("/feed")}
          aria-label="Explore Drandee feed"
        >
          Explore Drandee
        </button>
      </div>
    </section>
  );
}

const styles = {
  section: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    padding: "100px 24px",
    borderTop: "1px solid rgba(255,255,255,0.05)",
    background: "linear-gradient(180deg, transparent 0%, rgba(127,119,221,0.05) 100%)",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    maxWidth: "600px",
  },
  heading: {
    fontSize: "clamp(28px, 5vw, 42px)",
    fontWeight: "900",
    color: "#fff",
    margin: "0 0 16px 0",
    letterSpacing: "-0.02em",
  },
  subheading: {
    fontSize: "20px",
    color: "var(--primary-light, #9F99E8)",
    fontWeight: "600",
    margin: "0 0 48px 0",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  ctaBtn: {
    background: "rgba(255,255,255,0.1)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
    padding: "18px 40px",
    borderRadius: "100px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
    boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
  },
};
