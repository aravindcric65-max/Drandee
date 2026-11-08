import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import CreateChoice from "./studio/CreateChoice";
import VideoUploadStudio from "./studio/VideoUploadStudio";
import TextPostStudio from "./studio/TextPostStudio";
import "../pages/Reels.css";

import {
  HomeNavIcon,
  ReelNavIcon,
  SpotlightNavIcon,
  UserNavIcon,
  PlusIcon,
} from "./reels/ReelsIcons";

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [showCreateChoice, setShowCreateChoice] = useState(false);
  const [studioInitialStep, setStudioInitialStep] = useState(null);

  React.useEffect(() => {
    const handleOpenUpload = () => setShowCreateChoice(true);
    window.addEventListener('open-upload-studio', handleOpenUpload);
    return () => window.removeEventListener('open-upload-studio', handleOpenUpload);
  }, []);

  const isActive = (path) => {
    if (path === "/feed") {
      return location.pathname === "/feed" || location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const navItems = [
    { path: "/feed",      icon: <HomeNavIcon />,      label: "Home" },
    { path: "/reels",     icon: <ReelNavIcon />,      label: "Reels" },
    { path: "/upload",    icon: null,                  label: "Upload", isUpload: true },
    { path: "/spotlight", icon: <SpotlightNavIcon />, label: "Spotlight" },
    { path: "/profile",   icon: <UserNavIcon />,      label: "Profile" },
  ];

  return (
    <>
      <nav className="reels-nav" onClick={(e) => e.stopPropagation()} style={{ zIndex: 40 }}>
        {navItems.map((item) => {
          const activeState = isActive(item.path);

          if (item.isUpload) {
            return (
              <div
                key="upload"
                className="reels-nav-item"
                onClick={() => setShowCreateChoice(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowCreateChoice(true); } }}
                aria-label="Create post"
              >
                <div className="reels-upload-btn"><PlusIcon /></div>
              </div>
            );
          }

          return (
            <div
              key={item.path}
              className="reels-nav-item"
              onClick={() => navigate(item.path)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(item.path); } }}
              aria-label={item.label}
              aria-current={activeState ? 'page' : undefined}
            >
              <div className="reels-nav-icon" style={{ opacity: activeState ? 1 : 0.85 }}>
                {React.cloneElement(item.icon, { active: activeState })}
              </div>
              <span className="reels-nav-label" style={{ color: activeState ? 'var(--primary)' : 'rgba(255,255,255,0.55)', fontWeight: activeState ? 600 : 500 }}>
                {item.label}
              </span>
              {activeState && <div className="reels-nav-dot" />}
            </div>
          );
        })}
      </nav>
      
      <CreateChoice 
        isOpen={showCreateChoice}
        onClose={() => setShowCreateChoice(false)}
        onSelectType={(type) => {
          setShowCreateChoice(false);
          setStudioInitialStep(type);
        }}
      />

      {(studioInitialStep === 'video' || studioInitialStep === 'image') && (
        <VideoUploadStudio 
          initialStep="gallery"
          postType={studioInitialStep}
          onClose={() => setStudioInitialStep(null)}
        />
      )}
      
      {studioInitialStep === 'text' && (
        <TextPostStudio 
          onClose={() => setStudioInitialStep(null)}
        />
      )}
    </>
  );
};

export default Navbar;
