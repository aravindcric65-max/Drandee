import React from 'react';

export const MetricCard = ({ title, value, icon: Icon, isLoading, suffix = '' }) => {
  return (
    <div className="bg-[#111111] border border-white/10 rounded-xl p-5 flex flex-col items-start gap-4 hover:border-white/20 transition-colors">
      <div className="flex items-center justify-between w-full">
        <span className="text-[#8A8A8F] text-sm font-medium">{title}</span>
        {Icon && <Icon className="w-5 h-5 text-[#7F77DD]" />}
      </div>
      
      {isLoading ? (
        <div className="h-8 w-24 bg-white/10 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">
            {value != null ? value.toLocaleString() : '-'}
          </span>
          {suffix && <span className="text-[#8A8A8F] font-medium">{suffix}</span>}
        </div>
      )}
    </div>
  );
};
