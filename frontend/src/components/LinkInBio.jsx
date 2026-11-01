import React, { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

const LinkInBio = ({ userId, isOwn }) => {
  const [links, setLinks] = useState([]);

  useEffect(() => {
    if (!userId) return;
    const fetchLinks = async () => {
      try {
        const res = await fetch(`/api/profile/links/${userId}`);
        const data = await res.json();
        if (data.success) {
          setLinks(data.links);
        }
      } catch (err) {
        console.error("Failed to fetch links", err);
      }
    };
    fetchLinks();
  }, [userId]);

  const handleLinkClick = async (link) => {
    // Open in new tab immediately for UX
    window.open(link.url, '_blank', 'noopener,noreferrer');
    
    // Track click in background
    try {
      await fetch(`/api/profile/links/${link.id}/click`, { method: 'POST' });
    } catch (e) {
      console.error("Failed to track click", e);
    }
  };

  if (links.length === 0) return null;

  return (
    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
      {links.map((link) => (
        <button
          key={link.id}
          onClick={() => handleLinkClick(link)}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '0.5px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            padding: '12px 16px',
            color: '#fff',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'background 0.2s',
            width: '100%',
          }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {link.title}
          </span>
          <ExternalLink size={16} color="rgba(255, 255, 255, 0.5)" />
        </button>
      ))}
    </div>
  );
};

export default LinkInBio;
