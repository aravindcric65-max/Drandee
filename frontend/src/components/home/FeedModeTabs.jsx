import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

const FeedModeTabs = ({ mode, setMode }) => {
  const tabs = useMemo(() => [
    { id: 'for_you', label: 'For You' },
    { id: 'following', label: 'Following' },
    { id: 'local', label: 'Local' }
  ], []);

  const handleTabChange = useCallback((tabId) => {
    if (setMode) {
      setMode(tabId);
    }
  }, [setMode]);

  const handleKeyDown = useCallback((e, tabId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTabChange(tabId);
    }
  }, [handleTabChange]);

  return (
    <nav 
      className="px-3 sm:px-4 md:px-5" 
      aria-label="Feed navigation"
      role="navigation"
    >
      <div 
        className="flex min-h-[52px] items-center gap-0.5 sm:gap-1 border-t border-[#E8E8EC] pt-1" 
        role="tablist"
        aria-label="Feed tabs"
      >
        {tabs.map((tab, index) => {
          const isSelected = mode === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={`relative flex-1 min-h-[44px] rounded-t-lg px-2 sm:px-2.5 pb-2 pt-1.5 text-[12px] sm:text-[13px] md:text-[14px] tracking-[-0.01em] transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/30 focus:ring-inset ${
                isSelected
                  ? 'text-[#111111] font-semibold bg-[#7F77DD]/5'
                  : 'text-[#8A8A8F] font-medium hover:text-[#333333]'
              }`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`feed-panel-${tab.id}`}
              id={`feed-tab-${tab.id}`}
              tabIndex={isSelected ? 0 : -1}
            >
              {tab.label}
              
              {/* Active Indicator */}
              {isSelected && (
                <motion.span 
                  layoutId="activeFeedTab"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[60%] sm:w-[65%] h-[2.5px] sm:h-[3px] rounded-t-full bg-gradient-to-r from-[#4ECDC4] to-[#7F77DD]"
                  aria-hidden="true"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default FeedModeTabs;