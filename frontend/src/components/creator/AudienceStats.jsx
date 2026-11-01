import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, MapPin, Clock, User2 } from 'lucide-react';

export const AudienceStats = ({ audience, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="h-6 w-40 bg-white/10 rounded mb-4 animate-pulse" />
          <div className="h-[200px] bg-white/10 rounded animate-pulse" />
        </div>
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="h-6 w-40 bg-white/10 rounded mb-4 animate-pulse" />
          <div className="h-[200px] bg-white/10 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!audience || Object.keys(audience).length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col items-center justify-center h-[300px]">
        <Users className="w-12 h-12 text-[#8A8A8F] mb-4" />
        <p className="text-[#8A8A8F] text-lg">No audience data yet</p>
        <p className="text-[#8A8A8F] text-sm mt-2">Grow your following to see audience insights</p>
      </div>
    );
  }

  const { topLocations = [], activeTimes = [], genderSplit = [], ageSplit = [] } = audience;

  // Chart colors
  const COLORS = ['#7F77DD', '#9B4DCA', '#C43BAD', '#E91E63', '#FF9500'];

  return (
    <div className="space-y-6">
      {/* Top Locations */}
      {topLocations.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-[#7F77DD]" />
            <h3 className="text-white text-lg font-bold">Top Locations</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topLocations} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" stroke="#8A8A8F" tick={{ fill: '#8A8A8F', fontSize: 12 }} />
              <YAxis 
                type="category" 
                dataKey="location" 
                stroke="#8A8A8F" 
                tick={{ fill: '#8A8A8F', fontSize: 11 }}
                width={100}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#111111', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '12px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="count" name="Followers">
                {topLocations.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Active Times */}
      {activeTimes.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[#7F77DD]" />
            <h3 className="text-white text-lg font-bold">Peak Activity Hours</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={activeTimes} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis 
                dataKey="hour" 
                stroke="#8A8A8F" 
                tick={{ fill: '#8A8A8F', fontSize: 12 }}
                tickFormatter={(hour) => `${hour}:00`}
              />
              <YAxis stroke="#8A8A8F" tick={{ fill: '#8A8A8F', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#111111', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  borderRadius: '12px',
                  color: '#fff'
                }}
                labelFormatter={(hour) => `${hour}:00`}
              />
              <Bar dataKey="count" fill="#7F77DD" name="Interactions" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gender & Age Split - Side by Side on Desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Gender Split */}
        {genderSplit.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <User2 className="w-5 h-5 text-[#7F77DD]" />
              <h3 className="text-white text-lg font-bold">Gender Split</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={genderSplit} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="gender" 
                  stroke="#8A8A8F" 
                  tick={{ fill: '#8A8A8F', fontSize: 12 }}
                  tickFormatter={(gender) => gender.charAt(0).toUpperCase() + gender.slice(1)}
                />
                <YAxis stroke="#8A8A8F" tick={{ fill: '#8A8A8F', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#111111', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="count" name="Followers">
                  {genderSplit.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Age Split */}
        {ageSplit.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-[#7F77DD]" />
              <h3 className="text-white text-lg font-bold">Age Groups</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ageSplit} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis 
                  dataKey="ageGroup" 
                  stroke="#8A8A8F" 
                  tick={{ fill: '#8A8A8F', fontSize: 12 }}
                />
                <YAxis stroke="#8A8A8F" tick={{ fill: '#8A8A8F', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#111111', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                />
                <Bar dataKey="count" name="Followers">
                  {ageSplit.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
