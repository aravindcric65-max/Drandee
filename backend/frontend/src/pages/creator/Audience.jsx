import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import { AudienceStats } from '../../components/creator/AudienceStats';
import { GrowthIndicator } from '../../components/creator/GrowthIndicator';

export default function Audience() {
  const navigate = useNavigate();
  const [audience, setAudience] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAudience();
  }, []);

  const fetchAudience = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/creator/audience', {
        method: 'GET'});

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch audience data');
      }

      setAudience(data.audience);
    } catch (err) {
      console.error('Audience fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#000', 
      color: '#fff',
      paddingBottom: 'max(env(safe-area-inset-bottom), 80px)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px 24px',
        background: 'rgba(0,0,0,0.9)',
        backdropFilter: 'blur(12px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            padding: 8,
            cursor: 'pointer',
            display: 'flex',
            color: '#fff'
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: '700', marginLeft: 16 }}>Audience</h1>
      </div>

      {/* Content */}
      <div style={{ padding: '24px' }}>
        {error && (
          <div style={{
            background: 'rgba(254, 44, 85, 0.1)',
            border: '1px solid rgba(254, 44, 85, 0.2)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            color: '#FE2C55'
          }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Error loading audience data</p>
            <p style={{ fontSize: 14, opacity: 0.8 }}>{error}</p>
            <button 
              onClick={fetchAudience}
              style={{
                background: '#FE2C55',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                marginTop: 12,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 600
              }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Follower Overview */}
        {!error && (
          <>
            <div style={{
              background: '#111111',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: 24,
              marginBottom: 24
            }}>
              {isLoading ? (
                <>
                  <div style={{
                    height: 24,
                    width: 120,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    marginBottom: 16,
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                  <div style={{
                    height: 48,
                    width: 200,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    marginBottom: 16,
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                  <div style={{
                    height: 20,
                    width: 150,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                  }} />
                </>
              ) : (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 16
                  }}>
                    <Users className="w-5 h-5 text-[#7F77DD]" />
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: '#8A8A8F' }}>Total Followers</h2>
                  </div>
                  <div style={{ fontSize: 40, fontWeight: 700, marginBottom: 16 }}>
                    {audience?.followerCount?.toLocaleString() || 0}
                  </div>
                  <GrowthIndicator 
                    value={audience?.followerGrowth || 0} 
                    label="growth in last 30 days"
                  />
                </>
              )}
            </div>

            {/* Demographics */}
            <AudienceStats audience={audience} isLoading={isLoading} />
          </>
        )}

        {/* Empty State */}
        {!isLoading && !error && audience && audience.followerCount === 0 && (
          <div style={{
            background: '#111111',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 48,
            textAlign: 'center',
            marginTop: 24
          }}>
            <Users style={{ width: 48, height: 48, color: '#8A8A8F', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No followers yet</h3>
            <p style={{ color: '#8A8A8F', fontSize: 14 }}>
              Share your content and grow your audience to see insights
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
