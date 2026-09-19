import React from 'react';
import { Battery, Zap } from 'lucide-react';
import { BatterySummary } from '../types';

export interface VerticalBatterySvgProps {
  percentage: number | null | undefined;
  isCharging?: boolean | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VerticalBatterySvg: React.FC<VerticalBatterySvgProps> = ({
  percentage,
  isCharging = false,
  size = 'md',
  className = '',
}) => {
  const pct =
    percentage !== null && percentage !== undefined
      ? Math.max(0, Math.min(100, Math.round(percentage)))
      : null;

  // Dimensions configuration
  const dimensions = {
    sm: {
      width: 14,
      height: 22,
      capW: 6,
      capH: 2,
      capY: 0.5,
      bodyW: 12,
      bodyH: 18,
      bodyY: 3,
      innerX: 2.2,
      innerW: 9.6,
      innerMaxH: 15,
      innerBaseY: 19.5,
    },
    md: {
      width: 18,
      height: 28,
      capW: 8,
      capH: 2.5,
      capY: 0.5,
      bodyW: 16,
      bodyH: 23.5,
      bodyY: 3.5,
      innerX: 2.5,
      innerW: 13,
      innerMaxH: 19.5,
      innerBaseY: 25.5,
    },
    lg: {
      width: 28,
      height: 48,
      capW: 12,
      capH: 4,
      capY: 1,
      bodyW: 26,
      bodyH: 41,
      bodyY: 5.5,
      innerX: 3.5,
      innerW: 21,
      innerMaxH: 35,
      innerBaseY: 44,
    },
  }[size];

  // Dynamic colors based on percentage
  let strokeColor = '#059669'; // emerald-600
  let gradientFrom = '#34D399';
  let gradientTo = '#059669';

  if (pct === null) {
    strokeColor = '#94A3B8';
    gradientFrom = '#CBD5E1';
    gradientTo = '#94A3B8';
  } else if (pct < 20) {
    strokeColor = '#DC2626'; // rose-600
    gradientFrom = '#F87171';
    gradientTo = '#DC2626';
  } else if (pct < 50) {
    strokeColor = '#D97706'; // amber-600
    gradientFrom = '#FBBF24';
    gradientTo = '#D97706';
  }

  const fillHeight = pct !== null ? Math.max(pct > 0 ? 2 : 0, (pct / 100) * dimensions.innerMaxH) : 0;
  const fillY = dimensions.innerBaseY - fillHeight;
  const gradientId = `vert-battery-grad-${size}-${pct ?? 'null'}-${isCharging ? 'chg' : 'std'}`;

  return (
    <svg
      width={dimensions.width}
      height={dimensions.height}
      viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
      className={`shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={gradientTo} />
          <stop offset="100%" stopColor={gradientFrom} />
        </linearGradient>
      </defs>

      {/* Battery Positive Terminal Cap (Top Nub) */}
      <rect
        x={(dimensions.width - dimensions.capW) / 2}
        y={dimensions.capY}
        width={dimensions.capW}
        height={dimensions.capH}
        rx={size === 'lg' ? 1.5 : 1}
        fill={strokeColor}
      />

      {/* Battery Outer Body Frame */}
      <rect
        x={(dimensions.width - dimensions.bodyW) / 2}
        y={dimensions.bodyY}
        width={dimensions.bodyW}
        height={dimensions.bodyH}
        rx={size === 'lg' ? 3.5 : 2.5}
        stroke={strokeColor}
        strokeWidth={size === 'lg' ? 1.8 : 1.4}
        fill="rgba(241, 245, 249, 0.75)"
      />

      {/* Inner Fill Level (drawn vertically from bottom to top) */}
      {pct !== null && pct > 0 && (
        <rect
          x={dimensions.innerX}
          y={fillY}
          width={dimensions.innerW}
          height={fillHeight}
          rx={size === 'lg' ? 2 : 1.2}
          fill={`url(#${gradientId})`}
        />
      )}

      {/* Charging Lightning Bolt Icon */}
      {isCharging && (
        <path
          d={
            size === 'lg'
              ? 'M15 13L11 25H15.5L13 36L21 22H16L18.5 13H15Z'
              : size === 'md'
              ? 'M10 8L7 16H10.5L9 22L14 14H11L12.5 8H10Z'
              : 'M8 6L5.5 12H8L7 17L11 11H9L10 6H8Z'
          }
          fill="#FEF08A"
          stroke="#B45309"
          strokeWidth={0.8}
          className="drop-shadow-xs"
        />
      )}
    </svg>
  );
};

interface BatteryGaugeProps {
  battery: BatterySummary | null | undefined;
  compact?: boolean;
  variant?: 'icon' | 'compact' | 'full';
}

export const BatteryGauge: React.FC<BatteryGaugeProps> = ({
  battery,
  compact = false,
  variant = compact ? 'compact' : 'full',
}) => {
  if (!battery || (battery.percentage === null && battery.voltage === null)) {
    return (
      <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-400 text-xs italic border border-slate-200">
        <Battery className="w-3.5 h-3.5 text-slate-400" />
        <span>No battery</span>
      </div>
    );
  }

  const pct = battery.percentage;
  const isCharging = battery.isCharging;
  const voltage = battery.voltage;
  const current = battery.current;

  let badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
  let statusText = 'Optimal Power';

  if (pct !== null) {
    if (pct < 20) {
      badgeColor = 'bg-rose-50 text-rose-800 border-rose-200';
      statusText = 'Low Battery Warning';
    } else if (pct < 50) {
      badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
      statusText = 'Moderate Capacity';
    }
  }

  if (isCharging) {
    statusText = 'Solar / DC Charging Active';
  }

  // 1. Icon Pill Variant (used in Customer Header and Farm Cards)
  if (variant === 'icon') {
    return (
      <div
        className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-xl border font-mono text-xs font-semibold ${badgeColor} shadow-2xs`}
        title={`Battery Capacity: ${pct ?? '--'}% | Voltage: ${voltage ?? '--'}V | Current: ${current ?? '--'}A`}
      >
        <VerticalBatterySvg percentage={pct} isCharging={isCharging} size="sm" />
        <span className="font-bold">{pct !== null ? `${pct}%` : ''}</span>
        {voltage !== null && (
          <span className="text-[10px] font-normal opacity-75">
            {pct !== null ? `(${voltage}V)` : `${voltage}V`}
          </span>
        )}
      </div>
    );
  }

  // 2. Compact Variant
  if (variant === 'compact') {
    return (
      <div className="flex items-center space-x-2">
        <VerticalBatterySvg percentage={pct} isCharging={isCharging} size="sm" />
        <div className="flex flex-col">
          <span className="text-xs font-bold text-slate-800 font-mono">
            {pct !== null ? `${pct}%` : `${battery.voltage}V`}
          </span>
          {voltage !== null && (
            <span className="text-[10px] text-slate-400 font-mono">{voltage}V</span>
          )}
        </div>
      </div>
    );
  }

  // 3. Full Rich Vertical Battery Card Variant (used in Farm Overview & Detail)
  return (
    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between gap-4">
      {/* Left: Vertical Battery SVG with Percentage Fill */}
      <div className="flex items-center space-x-3.5">
        <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center">
          <VerticalBatterySvg percentage={pct} isCharging={isCharging} size="lg" />
        </div>

        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold text-slate-900 font-mono">
              {pct !== null ? `${pct}%` : '--'}
            </span>
            {isCharging && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                <Zap className="w-3 h-3 text-emerald-600 fill-emerald-600 animate-pulse" />
                <span>Charging</span>
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-600">{statusText}</p>
          <div className="flex items-center space-x-3 text-[11px] font-mono text-slate-500 pt-0.5">
            {voltage !== null && <span>Voltage: <strong>{voltage} V</strong></span>}
            {current !== null && <span>Current: <strong>{current} A</strong></span>}
          </div>
        </div>
      </div>

      {/* Right: Status Pill */}
      <div className="text-right hidden sm:block">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${badgeColor}`}>
          {pct !== null && pct >= 50 ? 'Healthy' : pct !== null && pct >= 20 ? 'Moderate' : 'Critical'}
        </span>
      </div>
    </div>
  );
};

