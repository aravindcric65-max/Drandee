import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { EngagementChart } from '../../components/creator/EngagementChart';

export default function Analytics() {
  const navigate = useNavigate();
  const [range, setRange] = useState('30d');
  const [analytics, setAnalytics] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/creator/analytics?range=${range}`, {
        method: 'GET'});

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch analytics');
      }

      setAnalytics(data.analytics || []);
    } catch (err) {
      console.error('Analytics fetch error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

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
        <h1 style={{ fontSize: 20, fontWeight: '700', marginLeft: 16 }}>Analytics</h1>
      </div>

      {/* Range Selector */}
      <div style={{ padding: '16px 24px' }}>
        <div style={{ 
          display: 'flex', 
          gap: 12, 
          overflowX: 'auto',
          paddingBottom: 8
        }}>
          {['7d', '30d', '90d'].map(r => (
            <button 
              key={r}
              onClick={() => setRange(r)}
              style={{
                background: range === r ? '#7F77DD' : '#111111',
                color: '#fff',
                border: `1px solid ${range === r ? '#7F77DD' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 20,
                padding: '8px 20px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {r === '7d' ? 'Last 7 days' : r === '30d' ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '0 24px 24px' }}>
        {error && (
          <div style={{
            background: 'rgba(254, 44, 85, 0.1)',
            border: '1px solid rgba(254, 44, 85, 0.2)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 24,
            color: '#FE2C55'
          }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>Error loading analytics</p>
            <p style={{ fontSize: 14, opacity: 0.8 }}>{error}</p>
            <button 
              onClick={fetchAnalytics}
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

        {!error && <EngagementChart data={analytics} isLoading={isLoading} />}

        {/* Empty State */}
        {!isLoading && !error && analytics.length === 0 && (
          <div style={{
            background: '#111111',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 48,
            textAlign: 'center',
            marginTop: 24
          }}>
            <TrendingUp style={{ width: 48, height: 48, color: '#8A8A8F', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>No analytics data yet</h3>
            <p style={{ color: '#8A8A8F', fontSize: 14 }}>
              Start posting and engaging to see your trends
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
