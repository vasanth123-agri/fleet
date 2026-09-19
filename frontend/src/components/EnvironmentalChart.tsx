import React, { useState } from 'react';
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
import { CloudSun, Sprout, Sun, BatteryCharging } from 'lucide-react';
import { EnvironmentalHistoryPoint } from '../types';

interface EnvironmentalChartProps {
  data: EnvironmentalHistoryPoint[];
  loading?: boolean;
}

type TabKey = 'plant' | 'environment' | 'light' | 'battery';

export const EnvironmentalChart: React.FC<EnvironmentalChartProps> = ({ data, loading = false }) => {
  const [tab, setTab] = useState<TabKey>('plant');

  if (loading) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-slate-500 space-y-2">
        <div className="w-8 h-8 border-2 border-[#00665E] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-medium">Loading telemetry series...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-slate-500 space-y-2 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
        <CloudSun className="w-8 h-8 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">No telemetry recorded in this timeframe</span>
        <span className="text-xs text-slate-400">Select a different date range or check hardware connection</span>
      </div>
    );
  }

  const latest = data[data.length - 1];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const p = payload[0].payload as EnvironmentalHistoryPoint;
      return (
        <div className="bg-white/95 border border-slate-200 rounded-xl p-3 shadow-lg backdrop-blur-md text-xs space-y-1.5 min-w-48 text-slate-800">
          <p className="font-bold text-slate-900 border-b border-slate-100 pb-1 mb-1">
            {p.formattedTime}
          </p>
          {tab === 'plant' && (
            <>
              {p.soilMoisture !== null && (
                <div className="flex justify-between">
                  <span className="text-blue-700 font-medium">Soil Moisture:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.soilMoisture} %</span>
                </div>
              )}
              {p.soilTemperature !== null && (
                <div className="flex justify-between">
                  <span className="text-amber-700 font-medium">Soil Temp:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.soilTemperature} °C</span>
                </div>
              )}
              {p.soilElectroConductivity !== null && (
                <div className="flex justify-between">
                  <span className="text-[#00665E] font-medium">Soil EC:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.soilElectroConductivity} mS/cm</span>
                </div>
              )}
              {p.phMaster !== null && (
                <div className="flex justify-between">
                  <span className="text-pink-700 font-medium">Soil pH:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.phMaster}</span>
                </div>
              )}
              {p.soilNitrogen !== null && (
                <div className="flex justify-between">
                  <span className="text-emerald-700 font-medium">Nitrogen (N):</span>
                  <span className="font-bold text-slate-900 font-mono">{p.soilNitrogen} mg/kg</span>
                </div>
              )}
            </>
          )}

          {tab === 'environment' && (
            <>
              {p.temperature !== null && (
                <div className="flex justify-between">
                  <span className="text-orange-600 font-medium">Air Temp:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.temperature} °C</span>
                </div>
              )}
              {p.humidity !== null && (
                <div className="flex justify-between">
                  <span className="text-sky-600 font-medium">Humidity:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.humidity} %</span>
                </div>
              )}
              {p.vpd !== null && (
                <div className="flex justify-between">
                  <span className="text-purple-600 font-medium">VPD:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.vpd} kPa</span>
                </div>
              )}
              {p.co2 !== null && (
                <div className="flex justify-between">
                  <span className="text-emerald-600 font-medium">CO₂:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.co2} ppm</span>
                </div>
              )}
            </>
          )}

          {tab === 'light' && (
            <>
              {p.par !== null && (
                <div className="flex justify-between">
                  <span className="text-amber-600 font-medium">PAR:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.par} µmol/m²/s</span>
                </div>
              )}
              {p.directRadiation !== null && (
                <div className="flex justify-between">
                  <span className="text-yellow-600 font-medium">Direct Radiation:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.directRadiation} W/m²</span>
                </div>
              )}
              {p.nir !== null && (
                <div className="flex justify-between">
                  <span className="text-indigo-600 font-medium">NIR Spectral:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.nir}</span>
                </div>
              )}
            </>
          )}

          {tab === 'battery' && (
            <>
              {p.batteryPercentage !== null && (
                <div className="flex justify-between">
                  <span className="text-emerald-600 font-medium">Battery Level:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.batteryPercentage} %</span>
                </div>
              )}
              {p.batteryVoltage !== null && (
                <div className="flex justify-between">
                  <span className="text-teal-600 font-medium">Pack Voltage:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.batteryVoltage} V</span>
                </div>
              )}
              {p.batteryCurrent !== null && (
                <div className="flex justify-between">
                  <span className="text-cyan-600 font-medium">Current Draw:</span>
                  <span className="font-bold text-slate-900 font-mono">{p.batteryCurrent} mA</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Charging State:</span>
                <span className="font-bold text-slate-800">{p.isCharging ? '⚡ Solar Charging' : 'Discharging'}</span>
              </div>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  const hasBatteryData = data.some(
    (p) => p.batteryPercentage !== null || p.batteryVoltage !== null
  );

  const activeTab = tab === 'battery' && !hasBatteryData ? 'plant' : tab;

  return (
    <div className="space-y-4">
      {/* Dedicated Section Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setTab('plant')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'plant'
                ? 'bg-white text-[#00665E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sprout className="w-3.5 h-3.5" />
            <span>Plant & Soil</span>
          </button>

          <button
            onClick={() => setTab('environment')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'environment'
                ? 'bg-white text-[#00665E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CloudSun className="w-3.5 h-3.5" />
            <span>Environment</span>
          </button>

          <button
            onClick={() => setTab('light')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'light'
                ? 'bg-white text-[#00665E] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>Light & Radiation</span>
          </button>

          {hasBatteryData && (
            <button
              onClick={() => setTab('battery')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'battery'
                  ? 'bg-white text-[#00665E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BatteryCharging className="w-3.5 h-3.5" />
              <span>Battery & Power</span>
            </button>
          )}
        </div>

        {/* Real-time mini summary pill */}
        <div className="text-xs text-slate-500 font-mono bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg">
          {activeTab === 'plant' && (
            <span>
              Moisture: <strong className="text-blue-600">{latest?.soilMoisture ?? '--'}%</strong> | Temp:{' '}
              <strong className="text-amber-600">{latest?.soilTemperature ?? '--'}°C</strong>
            </span>
          )}
          {tab === 'environment' && (
            <span>
              Air: <strong className="text-orange-600">{latest?.temperature ?? '--'}°C</strong> | RH:{' '}
              <strong className="text-sky-600">{latest?.humidity ?? '--'}%</strong>
            </span>
          )}
          {tab === 'light' && (
            <span>
              PAR: <strong className="text-amber-600">{latest?.par ?? '--'} µmol</strong> | Rad:{' '}
              <strong className="text-yellow-600">{latest?.directRadiation ?? '--'} W/m²</strong>
            </span>
          )}
          {tab === 'battery' && (
            <span>
              Battery: <strong className="text-emerald-600">{latest?.batteryPercentage ?? '--'}%</strong> | Voltage:{' '}
              <strong className="text-teal-600">{latest?.batteryVoltage ?? '--'}V</strong>
            </span>
          )}
        </div>
      </div>

      {/* Recharts Canvas */}
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

            {/* TAB: PLANT & SOIL */}
            {tab === 'plant' && (
              <>
                <Line
                  type="monotone"
                  dataKey="soilMoisture"
                  name="Moisture (%)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="soilTemperature"
                  name="Soil Temp (°C)"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="soilElectroConductivity"
                  name="Soil EC (mS/cm)"
                  stroke="#00665E"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="phMaster"
                  name="pH Master"
                  stroke="#db2777"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="soilNitrogen"
                  name="Nitrogen N (mg/kg)"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  dot={false}
                />
              </>
            )}

            {/* TAB: ENVIRONMENT */}
            {tab === 'environment' && (
              <>
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="Air Temp (°C)"
                  stroke="#ea580c"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity (%)"
                  stroke="#0284c7"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="vpd"
                  name="VPD (kPa)"
                  stroke="#7c3aed"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="co2"
                  name="CO₂ (ppm)"
                  stroke="#059669"
                  strokeWidth={1.5}
                  dot={false}
                />
              </>
            )}

            {/* TAB: LIGHT */}
            {tab === 'light' && (
              <>
                <Line
                  type="monotone"
                  dataKey="par"
                  name="PAR (µmol/m²/s)"
                  stroke="#d97706"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="directRadiation"
                  name="Direct Radiation (W/m²)"
                  stroke="#ca8a04"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="nir"
                  name="NIR Spectral"
                  stroke="#6366f1"
                  strokeWidth={1.5}
                  dot={false}
                />
              </>
            )}

            {/* TAB: BATTERY & POWER */}
            {tab === 'battery' && (
              <>
                <Line
                  type="monotone"
                  dataKey="batteryPercentage"
                  name="Battery (%)"
                  stroke="#00665E"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="batteryVoltage"
                  name="Voltage (V)"
                  stroke="#0891b2"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="batteryCurrent"
                  name="Current (mA)"
                  stroke="#0284c7"
                  strokeWidth={1.5}
                  dot={false}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
