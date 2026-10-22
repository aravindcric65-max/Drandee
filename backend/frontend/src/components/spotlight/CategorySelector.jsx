import React from "react";

const CATEGORIES = [
  "Music",
  "Art",
  "Comedy",
  "Dance",
  "Gaming",
  "Education",
  "Technology",
  "Photography",
  "Fashion",
  "Storytelling",
  "Other",
];

export default function CategorySelector({ selectedCategories, onToggleCategory }) {
  const handleSelect = (cat) => {
    if (navigator.vibrate) navigator.vibrate(50);
    onToggleCategory(cat);
  };

  return (
    <section className="spotlight-section" aria-label="Category Selection">
      <div style={styles.container}>
        <h3 style={styles.title}>What do you want to see?</h3>
        <p style={styles.subtitle}>Select the types of creators you love.</p>
        
        <div style={styles.chipGroup} role="group" aria-label="Creator categories">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => handleSelect(cat)}
                aria-pressed={isSelected}
                className={isSelected ? "animate-pop" : ""}
                style={{
                  ...styles.chip,
                  ...(isSelected ? styles.chipActive : styles.chipInactive),
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    maxWidth: "800px",
    margin: "0 auto",
    padding: "40px 24px",
  },
  title: {
    fontSize: "24px",
    fontWeight: "700",
    color: "#111111",
    margin: "0 0 8px 0",
  },
  subtitle: {
    fontSize: "16px",
    color: "#666666",
    margin: "0 0 32px 0",
  },
  chipGroup: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "12px",
  },
  chip: {
    padding: "12px 24px",
    borderRadius: "100px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    border: "1px solid transparent",
  },
  chipInactive: {
    background: "#F7F7F9",
    color: "#666666",
    borderColor: "#E8E8EC",
  },
  chipActive: {
    background: "var(--primary, #7F77DD)",
    color: "#fff",
    borderColor: "var(--primary-light, #9F99E8)",
    boxShadow: "0 0 20px rgba(127,119,221,0.4)",
    transform: "scale(1.05)",
  },
};
