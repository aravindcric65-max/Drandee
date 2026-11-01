import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const EngagementChart = ({ data, isLoading, lightMode = false }) => {
  const textColor = lightMode ? '#111111' : '#ffffff';
  const mutedColor = lightMode ? '#8A8A8F' : '#8A8A8F';
  const gridColor = lightMode ? '#E8E8EC' : 'rgba(255,255,255,0.1)';
  const tooltipBg = lightMode ? '#ffffff' : '#111111';
  const tooltipBorder = lightMode ? '#E8E8EC' : 'rgba(255,255,255,0.1)';
  const containerClass = lightMode 
    ? "bg-white border border-[#E8E8EC] rounded-xl p-4 sm:p-6" 
    : "bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6";
  const emptyClass = lightMode
    ? "bg-white border border-[#E8E8EC] rounded-xl p-6 flex items-center justify-center h-[300px] sm:h-[400px]"
    : "bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-center h-[300px] sm:h-[400px]";

  if (isLoading) {
    return (
      <div className={containerClass}>
        <div className={`h-8 w-48 rounded mb-6 animate-pulse ${lightMode ? 'bg-gray-200' : 'bg-white/10'}`} />
        <div className={`h-[300px] sm:h-[400px] rounded animate-pulse ${lightMode ? 'bg-gray-100' : 'bg-white/10'}`} />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className={emptyClass}>
        <div className="text-center">
          <p className="text-lg" style={{ color: mutedColor }}>No data available yet</p>
          <p className="text-sm mt-2" style={{ color: mutedColor }}>Start posting to see your engagement trends</p>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClass}>
      <h3 className="text-lg font-bold mb-6" style={{ color: textColor }}>Engagement Trends</h3>
      
      <ResponsiveContainer width="100%" height={300} className="sm:h-[400px]">
        <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis 
            dataKey="date" 
            stroke={mutedColor} 
            tick={{ fill: mutedColor, fontSize: 12 }}
            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          />
          <YAxis 
            stroke={mutedColor} 
            tick={{ fill: mutedColor, fontSize: 12 }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: tooltipBg, 
              border: `1px solid ${tooltipBorder}`, 
              borderRadius: '12px',
              color: textColor
            }}
            labelFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          />
          <Legend 
            wrapperStyle={{ color: mutedColor, fontSize: '12px' }}
          />
          <Line 
            type="monotone" 
            dataKey="respects" 
            stroke="#7F77DD" 
            strokeWidth={2}
            dot={{ fill: '#7F77DD', r: 4 }}
            activeDot={{ r: 6 }}
            name="Respects"
          />
          <Line 
            type="monotone" 
            dataKey="comments" 
            stroke="#25D366" 
            strokeWidth={2}
            dot={{ fill: '#25D366', r: 4 }}
            activeDot={{ r: 6 }}
            name="Comments"
          />
          <Line 
            type="monotone" 
            dataKey="shares" 
            stroke="#FF9500" 
            strokeWidth={2}
            dot={{ fill: '#FF9500', r: 4 }}
            activeDot={{ r: 6 }}
            name="Shares"
          />
          <Line 
            type="monotone" 
            dataKey="views" 
            stroke="#007AFF" 
            strokeWidth={2}
            dot={{ fill: '#007AFF', r: 4 }}
            activeDot={{ r: 6 }}
            name="Views"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
