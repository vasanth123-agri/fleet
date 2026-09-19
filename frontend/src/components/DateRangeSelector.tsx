import React from 'react';
import { Calendar } from 'lucide-react';

interface DateRangeSelectorProps {
  selectedRange: string;
  onChangeRange: (range: string) => void;
  className?: string;
}

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  selectedRange,
  onChangeRange,
  className = '',
}) => {
  const ranges = [
    { key: '24h', label: 'Last 24 Hours' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
  ];

  return (
    <div className={`flex items-center space-x-1.5 p-1 bg-white border border-slate-200 shadow-sm rounded-xl ${className}`}>
      <Calendar className="w-4 h-4 text-slate-400 ml-2 mr-1" />
      {ranges.map((r) => {
        const isActive = selectedRange === r.key;
        return (
          <button
            key={r.key}
            onClick={() => onChangeRange(r.key)}
            className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
              isActive
                ? 'bg-[#00665E] text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
};

