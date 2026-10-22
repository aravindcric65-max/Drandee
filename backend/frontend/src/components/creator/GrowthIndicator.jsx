import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export const GrowthIndicator = ({ value, label }) => {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  return (
    <div className="flex flex-col gap-1">
      <div className={`flex items-center gap-1.5 text-sm font-medium ${
        isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-[#8A8A8F]'
      }`}>
        {isPositive && <TrendingUp className="w-4 h-4" />}
        {isNegative && <TrendingDown className="w-4 h-4" />}
        {isNeutral && <Minus className="w-4 h-4" />}
        
        <span>
          {isPositive ? '+' : ''}{value}%
        </span>
      </div>
      {label && <span className="text-xs text-[#8A8A8F]">{label}</span>}
    </div>
  );
};
