import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number | string | null | undefined;
  unit?: string;
  icon: LucideIcon;
  color?: 'emerald' | 'blue' | 'amber' | 'purple' | 'cyan' | 'rose' | 'slate';
  subtitle?: string;
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon: Icon,
  color = 'emerald',
  subtitle,
  highlight = false,
}) => {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-50 text-[#00665E] border-emerald-200',
      accent: 'text-[#00665E]',
    },
    blue: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      accent: 'text-blue-700',
    },
    amber: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      accent: 'text-amber-700',
    },
    purple: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      accent: 'text-purple-700',
    },
    cyan: {
      bg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      accent: 'text-cyan-700',
    },
    rose: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      accent: 'text-rose-700',
    },
    slate: {
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      accent: 'text-slate-700',
    },
  }[color];

  const hasValue = value !== null && value !== undefined && value !== '';

  return (
    <div
      className={`glass-card glass-card-hover rounded-xl p-4 flex flex-col justify-between relative overflow-hidden bg-white border ${
        highlight ? 'border-[#00665E]/40 shadow-xs' : 'border-slate-200/90 shadow-xs'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2 rounded-lg border ${colorMap.bg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline space-x-1.5 my-1">
        {hasValue ? (
          <>
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {typeof value === 'number' ? Number(value.toFixed(2)).toString() : value}
            </span>
            {unit && <span className="text-xs font-semibold text-slate-500">{unit}</span>}
          </>
        ) : (
          <span className="text-sm font-medium text-slate-400 italic">Unavailable</span>
        )}
      </div>

      {subtitle && <p className="text-xs text-slate-400 truncate mt-1">{subtitle}</p>}
    </div>
  );
};

