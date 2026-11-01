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
    borderTop: "1px solid #E8E8EC",
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
    color: "#111111",
    margin: "0 0 16px 0",
    letterSpacing: "-0.02em",
  },
  subheading: {
    fontSize: "20px",
    color: "var(--primary, #7F77DD)",
    fontWeight: "600",
    margin: "0 0 48px 0",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  },
  ctaBtn: {
    background: "#F7F7F9",
    border: "1px solid #E8E8EC",
    color: "#111111",
    padding: "18px 40px",
    borderRadius: "100px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
};
