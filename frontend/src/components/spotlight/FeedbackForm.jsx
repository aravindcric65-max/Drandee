import React from "react";

export default function FeedbackForm({ 
  feedbackText, 
  onFeedbackChange, 
  onSubmit, 
  status 
}) {
  const isSubmitting = status === "submitting";
  const isSuccess = status === "success";
  const isDuplicate = status === "duplicate";
  const isError = status === "error";

  return (
    <section className="spotlight-section" aria-label="Feedback Form">
      <div style={styles.container}>
        <h3 style={styles.heading}>Help shape Spotlight.</h3>
        <p style={styles.subheading}>Tell us what you'd love to see in a creator discovery feed.</p>

      <form 
        style={styles.form} 
        onSubmit={(e) => { 
          e.preventDefault(); 
          onSubmit(); 
        }}
      >
        <div style={styles.textareaWrapper}>
          <textarea
            style={styles.textarea}
            placeholder="I'd love to discover creators who..."
            value={feedbackText}
            onChange={(e) => onFeedbackChange(e.target.value)}
            maxLength={500}
            disabled={isSubmitting || isSuccess}
            aria-label="Your feedback"
          />
          <div style={styles.charCount}>
            {feedbackText.length}/500
          </div>
        </div>

        {/* Status Messages */}
        {isSuccess && (
          <div style={styles.msgSuccess} role="alert">
            ✓ Thanks! Your feedback helps shape Spotlight.
          </div>
        )}
        {isDuplicate && (
          <div style={styles.msgWarning} role="alert">
            You've already shared feedback today. Try again tomorrow!
          </div>
        )}
        {isError && (
          <div style={styles.msgError} role="alert">
            Something went wrong submitting your feedback. Please try again.
          </div>
        )}

        <button 
          type="submit" 
          style={{
            ...styles.submitBtn,
            opacity: (isSubmitting || isSuccess) ? 0.7 : 1,
            cursor: (isSubmitting || isSuccess) ? "not-allowed" : "pointer"
          }}
          disabled={isSubmitting || isSuccess}
        >
          {isSubmitting ? "Submitting..." : isSuccess ? "Submitted" : "Submit Feedback"}
        </button>
      </form>
      </div>
    </section>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    maxWidth: "600px",
    margin: "0 auto",
    padding: "0 24px 64px 24px",
    textAlign: "center",
  },
  heading: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111111",
    margin: "0 0 8px 0",
  },
  subheading: {
    fontSize: "16px",
    color: "#666666",
    margin: "0 0 24px 0",
  },
  form: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  textareaWrapper: {
    position: "relative",
    width: "100%",
  },
  textarea: {
    width: "100%",
    minHeight: "120px",
    background: "#F7F7F9",
    border: "1px solid #E8E8EC",
    borderRadius: "16px",
    padding: "16px",
    color: "#111111",
    fontSize: "15px",
    lineHeight: "1.5",
    resize: "vertical",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    fontFamily: "inherit",
  },
  charCount: {
    position: "absolute",
    bottom: "16px",
    right: "16px",
    fontSize: "12px",
    color: "#8A8A8F",
    pointerEvents: "none",
  },
  submitBtn: {
    background: "linear-gradient(135deg, var(--primary, #7F77DD) 0%, var(--primary-dark, #6A61C9) 100%)",
    color: "#fff",
    border: "none",
    padding: "16px",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: "700",
    transition: "opacity 0.2s ease",
  },
  msgSuccess: {
    color: "#34D399",
    background: "rgba(52, 211, 153, 0.1)",
    border: "1px solid rgba(52, 211, 153, 0.2)",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
  },
  msgWarning: {
    color: "#FBBF24",
    background: "rgba(251, 191, 36, 0.1)",
    border: "1px solid rgba(251, 191, 36, 0.2)",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
  },
  msgError: {
    color: "#F87171",
    background: "rgba(248, 113, 113, 0.1)",
    border: "1px solid rgba(248, 113, 113, 0.2)",
    padding: "12px",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
  },
};
