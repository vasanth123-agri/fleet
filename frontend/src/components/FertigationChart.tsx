import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Beaker } from 'lucide-react';
import { FertigationHistoryPoint } from '../types';

interface FertigationChartProps {
  data: FertigationHistoryPoint[];
  loading?: boolean;
}

export const FertigationChart: React.FC<FertigationChartProps> = ({ data, loading = false }) => {
  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2">
        <div className="w-8 h-8 border-2 border-[#00665E] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs">Loading fertigation telemetry...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-xl">
        <Beaker className="w-8 h-8 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">No fertigation history available in this timeframe</span>
        <span className="text-xs text-slate-400">Ensure outdoor dosing controller is actively connected</span>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload as FertigationHistoryPoint;
      return (
        <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-lg backdrop-blur-md text-xs space-y-1.5 min-w-44">
          <p className="font-semibold text-slate-800 border-b border-slate-100 pb-1 mb-1">
            {p.formattedTime}
          </p>
          {p.m2_ec !== null && (
            <div className="flex justify-between">
              <span className="text-[#00665E] font-medium">EC (Probe 2):</span>
              <span className="font-bold text-slate-900 font-mono">{p.m2_ec} mS/cm</span>
            </div>
          )}
          {p.m2_ph !== null && (
            <div className="flex justify-between">
              <span className="text-sky-700 font-medium">pH (Probe 2):</span>
              <span className="font-bold text-slate-900 font-mono">{p.m2_ph}</span>
            </div>
          )}
          {p.waterLevel !== null && (
            <div className="flex justify-between">
              <span className="text-blue-600 font-medium">Water Level:</span>
              <span className="font-bold text-slate-900 font-mono">{p.waterLevel}%</span>
            </div>
          )}
          {p.n1_pct !== null && (
            <div className="flex justify-between">
              <span className="text-amber-600 font-medium">Tank 1:</span>
              <span className="font-bold text-slate-900 font-mono">{p.n1_pct}%</span>
            </div>
          )}
          {p.n2_pct !== null && (
            <div className="flex justify-between">
              <span className="text-purple-600 font-medium">Tank 2:</span>
              <span className="font-bold text-slate-900 font-mono">{p.n2_pct}%</span>
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
        <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="formattedTime"
            stroke="#94a3b8"
            fontSize={11}
            tickLine={false}
            dy={8}
          />
          <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            wrapperStyle={{ paddingBottom: '10px', fontSize: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="m2_ec"
            name="EC (mS/cm)"
            stroke="#00665E"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="m2_ph"
            name="pH"
            stroke="#0284c7"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="waterLevel"
            name="Water Level %"
            stroke="#2563eb"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="n1_pct"
            name="Tank 1 %"
            stroke="#d97706"
            strokeWidth={1.5}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="n2_pct"
            name="Tank 2 %"
            stroke="#9333ea"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
