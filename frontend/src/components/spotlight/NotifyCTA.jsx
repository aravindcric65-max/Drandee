import React from "react";

export default function NotifyCTA({ onNotifyClick, status, sectionRef }) {
  const isLoading = status === "loading";
  const isSuccess = status === "success";
  const isAlready = status === "already";

  return (
    <section className="spotlight-section" aria-label="Keep me posted">
      <div style={styles.card}>
        <div style={styles.iconWrapper} aria-hidden="true">
          🔔
        </div>
        
        <h2 style={styles.heading}>Keep Me Posted</h2>
        <p style={styles.subheading}>
          Be among the first to know when Spotlight goes live.
        </p>

        {isSuccess ? (
          <div style={styles.successState} role="alert">
            <span style={styles.successIcon}>✓</span>
            <span style={styles.successText}>You're on the list. We'll be in touch!</span>
          </div>
        ) : isAlready ? (
          <div style={styles.alreadyState} role="alert">
            <span style={styles.alreadyText}>You're already on the list!</span>
          </div>
        ) : (
          <button 
            style={{
              ...styles.notifyBtn,
              opacity: isLoading ? 0.7 : 1,
              cursor: isLoading ? "wait" : "pointer"
            }}
            onClick={onNotifyClick}
            disabled={isLoading}
            aria-label="Notify me when Spotlight launches"
          >
            {isLoading ? "Joining..." : "Notify Me"}
          </button>
        )}
      </div>
    </section>
  );
}

const styles = {
  section: {
    width: "100%",
    display: "flex",
    justifyContent: "center",
    padding: "80px 24px",
  },
  card: {
    width: "100%",
    maxWidth: "480px",
    background: "#FFFFFF",
    border: "1px solid #E8E8EC",
    borderRadius: "24px",
    padding: "48px 32px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
  iconWrapper: {
    fontSize: "40px",
    marginBottom: "24px",
    filter: "drop-shadow(0 0 20px rgba(127,119,221,0.6))",
  },
  heading: {
    fontSize: "clamp(24px, 4vw, 32px)",
    fontWeight: "800",
    color: "#111111",
    margin: "0 0 12px 0",
    letterSpacing: "-0.02em",
  },
  subheading: {
    fontSize: "16px",
    color: "#666666",
    margin: "0 0 32px 0",
    lineHeight: "1.5",
  },
  notifyBtn: {
    width: "100%",
    background: "linear-gradient(135deg, var(--primary, #7F77DD) 0%, var(--primary-dark, #6A61C9) 100%)",
    color: "#fff",
    border: "none",
    padding: "16px",
    borderRadius: "14px",
    fontSize: "16px",
    fontWeight: "700",
    boxShadow: "0 8px 24px rgba(127,119,221,0.3)",
    transition: "transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease",
  },
  successState: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.2)",
    padding: "16px",
    borderRadius: "14px",
  },
  successIcon: {
    color: "#34D399",
    fontWeight: "bold",
  },
  successText: {
    color: "#34D399",
    fontWeight: "600",
    fontSize: "15px",
  },
  alreadyState: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    padding: "16px",
    borderRadius: "14px",
  },
  alreadyText: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
    fontSize: "15px",
  },
};
