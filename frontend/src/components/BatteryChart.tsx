import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Battery, Zap } from 'lucide-react';
import { BatteryHistoryPoint } from '../types';

interface BatteryChartProps {
  data: BatteryHistoryPoint[];
  loading?: boolean;
}

export const BatteryChart: React.FC<BatteryChartProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
        <div className="w-8 h-8 border-2 border-[#00665E] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Loading battery telemetry...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-xl">
        <Battery className="w-8 h-8 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">No battery telemetry available in this timeframe</span>
        <span className="text-xs text-slate-400">Ensure IoT nodes are transmitting power statistics</span>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload as BatteryHistoryPoint;
      return (
        <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-lg backdrop-blur-md text-xs space-y-1 text-slate-800">
          <p className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-1">
            {p.formattedTime}
          </p>
          <div className="flex items-center justify-between space-x-4">
            <span className="text-[#00665E] font-semibold">Battery Level:</span>
            <span className="font-bold text-slate-900">
              {p.batteryPercentage !== null ? `${p.batteryPercentage}%` : 'N/A'}
            </span>
          </div>
          {p.batteryVoltage !== null && (
            <div className="flex items-center justify-between space-x-4">
              <span className="text-sky-700 font-semibold">Voltage:</span>
              <span className="font-medium text-slate-700">{p.batteryVoltage} V</span>
            </div>
          )}
          {p.batteryCurrent !== null && (
            <div className="flex items-center justify-between space-x-4">
              <span className="text-amber-700 font-semibold">Current:</span>
              <span className="font-medium text-slate-700">{p.batteryCurrent} A</span>
            </div>
          )}
          {p.isCharging !== null && (
            <div className="flex items-center space-x-1.5 pt-1 text-emerald-700 font-medium">
              <Zap className="w-3.5 h-3.5 text-emerald-600" />
              <span>{p.isCharging ? 'Solar / Grid Charging' : 'Discharging'}</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="batteryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00665E" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#00665E" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="voltageGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0284c7" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="formattedTime"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            dy={8}
          />
          <YAxis
            yAxisId="left"
            domain={[0, 100]}
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            unit="%"
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            unit="V"
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="batteryPercentage"
            name="Battery %"
            stroke="#00665E"
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#batteryGradient)"
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="batteryVoltage"
            name="Voltage (V)"
            stroke="#0284c7"
            strokeWidth={1.5}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

