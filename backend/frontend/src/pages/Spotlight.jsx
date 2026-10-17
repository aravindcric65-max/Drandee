import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase/config";

// CSS
import "../styles/spotlight.css";

// Child Components
import SpotlightHeader from "../components/spotlight/SpotlightHeader";
import SpotlightHero from "../components/spotlight/SpotlightHero";
import MysteryCreator from "../components/spotlight/MysteryCreator";
import CategorySelector from "../components/spotlight/CategorySelector";
import FeedbackForm from "../components/spotlight/FeedbackForm";
import NotifyCTA from "../components/spotlight/NotifyCTA";
import FinalCTA from "../components/spotlight/FinalCTA";

// Analytics Helper
const trackEvent = (name, props = {}) => {
  try {
    if (window.__drandeeAnalytics) window.__drandeeAnalytics(name, props);
  } catch (_) {}
};

export default function Spotlight() {
  const navigate = useNavigate();
  const containerRef = useRef(null);

  // Form States
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackState, setFeedbackState] = useState("idle");
  const [notifyState, setNotifyState] = useState("idle");
  const [activeSection, setActiveSection] = useState(0);

  const sections = [
    { id: "hero" },
    { id: "mystery" },
    { id: "category" },
    { id: "feedback" },
    { id: "notify" },
    { id: "final" }
  ];

  // SEO & Analytics Initialization
  useEffect(() => {
    trackEvent("spotlight_page_view");
    
    // SEO Meta Tags
    document.title = "Spotlight | Drandee";
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      metaDesc.content = "Spotlight is coming to Drandee. Discover the best creators before anyone else.";
    }

    // Intersection Observer for active section tracking
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-index') || "0", 10);
            setActiveSection(index);
          }
        });
      },
      { root: containerRef.current, threshold: 0.5 }
    );

    const sectionElements = document.querySelectorAll('.spotlight-section');
    sectionElements.forEach((el, index) => {
      el.setAttribute('data-index', index.toString());
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const handleToggleCategory = useCallback((cat) => {
    setSelectedCategories((prev) => {
      const selected = prev.includes(cat);
      if (!selected) trackEvent("spotlight_category_selected", { category: cat });
      return selected ? prev.filter((c) => c !== cat) : [...prev, cat];
    });
  }, []);

  const handleFeedbackSubmit = useCallback(async () => {
    if (feedbackState === "submitting" || feedbackState === "success") return;
    if (!auth.currentUser) { navigate("/login"); return; }
    
    trackEvent("spotlight_feedback_started", { categories: selectedCategories });
    setFeedbackState("submitting");
    
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/spotlight/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ categories: selectedCategories, feedback_text: feedbackText.slice(0, 500) })
      });
      
      const data = await res.json();
      
      if (res.status === 429) {
        setFeedbackState("duplicate");
      } else if (res.ok && data.success) {
        setFeedbackState("success");
        trackEvent("spotlight_feedback_submitted", { categories: selectedCategories });
      } else {
        setFeedbackState("error");
      }
    } catch (_) {
      setFeedbackState("error");
    }
  }, [feedbackState, selectedCategories, feedbackText, navigate]);

  const handleNotifySubmit = useCallback(async () => {
    if (notifyState === "loading" || notifyState === "success" || notifyState === "already") return;
    trackEvent("spotlight_notify_clicked");
    
    if (!auth.currentUser) { navigate("/login"); return; }
    
    setNotifyState("loading");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("/api/spotlight/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (res.status === 429 || res.status === 409) {
        setNotifyState("already");
      } else if (res.ok && data.success) {
        setNotifyState("success");
        trackEvent("spotlight_notify_success");
      } else {
        setNotifyState("idle");
      }
    } catch (_) {
      setNotifyState("idle");
    }
  }, [notifyState, navigate]);

  return (
    <div className="spotlight-container" ref={containerRef}>
      <SpotlightHeader />

      {/* Swipe Indicators */}
      <div className="section-counter">
        {activeSection + 1} / {sections.length}
      </div>
      
      <div className="swipe-indicator">
        {sections.map((sec, idx) => (
          <div 
            key={sec.id} 
            className={`swipe-dot ${activeSection === idx ? "active" : ""}`}
          />
        ))}
      </div>

      <SpotlightHero />
      <MysteryCreator />
      
      <CategorySelector 
        selectedCategories={selectedCategories} 
        onToggleCategory={handleToggleCategory} 
      />
      
      <FeedbackForm 
        feedbackText={feedbackText}
        onFeedbackChange={setFeedbackText}
        onSubmit={handleFeedbackSubmit}
        status={feedbackState}
      />
      
      <NotifyCTA 
        onNotifyClick={handleNotifySubmit} 
        status={notifyState} 
      />
      
      <section className="spotlight-section">
        <FinalCTA />
      </section>
    </div>
  );
}
