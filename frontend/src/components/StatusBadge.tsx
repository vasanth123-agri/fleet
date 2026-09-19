import React from 'react';
import { ReadingStatus } from '../types';

interface StatusBadgeProps {
  status: ReadingStatus | string;
  showDot?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showDot = true,
  className = '',
  size = 'md',
}) => {
  const normalized = (status || 'NO_DATA').toUpperCase();

  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let dotColor = 'bg-slate-400';
  let pulse = false;
  let label = 'No Data';

  switch (normalized) {
    case 'LIVE':
      badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200 glow-live font-bold';
      dotColor = 'bg-emerald-500';
      pulse = true;
      label = 'LIVE';
      break;
    case 'RECENT':
      badgeColor = 'bg-sky-50 text-sky-700 border-sky-200 glow-recent font-bold';
      dotColor = 'bg-sky-500';
      pulse = false;
      label = 'RECENT';
      break;
    case 'DELAYED':
      badgeColor = 'bg-amber-50 text-amber-700 border-amber-200 glow-delayed font-bold';
      dotColor = 'bg-amber-500';
      pulse = false;
      label = 'DELAYED';
      break;
    case 'OFFLINE':
      badgeColor = 'bg-rose-50 text-rose-700 border-rose-200 glow-offline font-bold';
      dotColor = 'bg-rose-500';
      pulse = false;
      label = 'OFFLINE';
      break;
    case 'NO_DATA':
    default:
      badgeColor = 'bg-slate-100 text-slate-600 border-slate-200 font-semibold';
      dotColor = 'bg-slate-400';
      pulse = false;
      label = 'NO DATA';
      break;
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 space-x-1.5',
    md: 'text-xs px-2.5 py-1 space-x-2 font-medium',
    lg: 'text-sm px-3 py-1.5 space-x-2 font-semibold',
  }[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border tracking-wide uppercase transition-all duration-200 ${badgeColor} ${sizeClasses} ${className}`}
    >
      {showDot && (
        <span className="relative flex h-2 w-2">
          {pulse && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${dotColor}`}
            />
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColor}`} />
        </span>
      )}
      <span>{label}</span>
    </span>
  );
};

