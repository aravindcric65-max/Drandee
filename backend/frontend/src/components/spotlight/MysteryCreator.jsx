import React from "react";

export default function MysteryCreator({ onFindOutClick }) {
  return (
    <section className="spotlight-section" aria-label="Mystery Creator">
      {/* Blurred/Abstract Creator Visual */}
      <div style={styles.visualContainer} aria-hidden="true">
        <div style={styles.blurBackdrop} />
        <div className="animate-heartbeat" style={styles.silhouetteWrapper}>
          {/* Using a highly blurred, abstract gradient shape to represent an unknown person */}
          <div style={styles.abstractHead} />
          <div style={styles.abstractBody} />
        </div>
        <div style={styles.badge}>UNDISCOVERED</div>
      </div>
      
      {/* Text Content */}
      <div style={styles.textContent}>
        <h2 style={styles.heading}>Someone is waiting to be discovered.</h2>
        <p style={styles.subheading}>Who will be next?</p>
        
        {/* CTA */}
        <button 
          style={styles.ctaButton} 
          onClick={onFindOutClick}
          aria-label="Find Out Soon"
        >
          Find Out Soon
        </button>
      </div>
    </section>
  );
}

const styles = {
  section: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "80px 24px",
    textAlign: "center",
    maxWidth: "800px",
    margin: "0 auto",
  },
  visualContainer: {
    position: "relative",
    width: "280px",
    height: "340px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "48px",
    animation: "float 6s ease-in-out infinite",
  },
  blurBackdrop: {
    position: "absolute",
    inset: 0,
    background: "radial-gradient(circle at center, rgba(127,119,221,0.2) 0%, transparent 70%)",
    filter: "blur(20px)",
    borderRadius: "50%",
  },
  silhouetteWrapper: {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-end",
    filter: "blur(12px) contrast(1.2)",
    opacity: 0.8,
  },
  abstractHead: {
    width: "80px",
    height: "100px",
    borderRadius: "40px",
    background: "linear-gradient(180deg, #9F99E8 0%, #7F77DD 100%)",
    marginBottom: "10px",
  },
  abstractBody: {
    width: "160px",
    height: "140px",
    borderTopLeftRadius: "80px",
    borderTopRightRadius: "80px",
    background: "linear-gradient(180deg, #7F77DD 0%, rgba(106,97,201,0.2) 100%)",
  },
  badge: {
    position: "absolute",
    bottom: "20px",
    background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#fff",
    padding: "8px 20px",
    borderRadius: "100px",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.2em",
    textTransform: "uppercase",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
  },
  textContent: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  heading: {
    fontSize: "clamp(28px, 5vw, 42px)",
    fontWeight: "800",
    color: "#fff",
    margin: "0 0 16px 0",
    letterSpacing: "-0.02em",
    lineHeight: "1.2",
  },
  subheading: {
    fontSize: "clamp(18px, 3vw, 24px)",
    color: "var(--primary-light, #9F99E8)",
    fontWeight: "600",
    margin: "0 0 40px 0",
  },
  ctaButton: {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(12px)",
    border: "1px solid rgba(255,255,255,0.2)",
    color: "#fff",
    padding: "16px 36px",
    borderRadius: "100px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
};
