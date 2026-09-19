import React from 'react';
import { Search, Filter, X, RotateCcw } from 'lucide-react';
import { getCropEmoji } from '../utils/cropEmoji';

interface DashboardFiltersProps {
  search: string;
  onSearchChange: (val: string) => void;
  crop: string;
  onCropChange: (val: string) => void;
  status: string;
  onStatusChange: (val: string) => void;
  deviceCategory: string;
  onDeviceCategoryChange: (val: string) => void;
  availableCrops: string[];
  onReset: () => void;
}

export const DashboardFilters: React.FC<DashboardFiltersProps> = ({
  search,
  onSearchChange,
  crop,
  onCropChange,
  status,
  onStatusChange,
  deviceCategory,
  onDeviceCategoryChange,
  availableCrops,
  onReset,
}) => {
  const statusOptions = [
    { key: '', label: 'All Statuses' },
    { key: 'LIVE', label: 'LIVE' },
    { key: 'RECENT', label: 'RECENT' },
    { key: 'DELAYED', label: 'DELAYED' },
    { key: 'OFFLINE', label: 'OFFLINE' },
    { key: 'NO_DATA', label: 'NO DATA' },
  ];

  const hasFilters = Boolean(search || crop || status || deviceCategory);

  return (
    <div className="glass-card rounded-2xl p-4 space-y-3.5 shadow-sm border border-slate-200/90">
      <div className="flex flex-col md:flex-row items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search customer name, email, phone, or location..."
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#00665E] focus:bg-white focus:ring-2 focus:ring-[#00665E]/10 transition-all"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Crop Filter */}
        <div className="w-full md:w-52">
          <select
            value={crop}
            onChange={(e) => onCropChange(e.target.value)}
            className="w-full py-2.5 px-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#00665E] focus:bg-white transition-all font-medium"
          >
            <option value="">🌱 All Crops</option>
            {availableCrops.map((c) => (
              <option key={c} value={c}>
                {getCropEmoji(c)} {c}
              </option>
            ))}
          </select>
        </div>

        {/* Device Category Filter */}
        <div className="w-full md:w-52">
          <div className="relative">
            <select
              value={deviceCategory}
              onChange={(e) => onDeviceCategoryChange(e.target.value)}
              className="w-full py-2.5 px-3 bg-slate-50/80 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-[#00665E] focus:bg-white transition-all font-medium"
            >
              <option value="">⚙️ All Devices & Hardware</option>
              <option value="valve">🚰 Valves</option>
              <option value="appliance">⚡ Appliances / Relays</option>
              <option value="outdoor fertigation">🧪 Outdoor Fertigation</option>
              <option value="indoor fertigation">🌿 Indoor Fertigation</option>
              <option value="battery sensor">🔋 Battery Sensor</option>
            </select>
          </div>
        </div>

        {/* Reset Filters */}
        {hasFilters && (
          <button
            onClick={onReset}
            className="flex items-center space-x-1.5 px-3.5 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all w-full md:w-auto justify-center"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Status Pills */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
        <div className="flex items-center space-x-1 text-xs font-semibold text-slate-500 mr-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span>Status:</span>
        </div>
        {statusOptions.map((opt) => {
          const isActive = status.toUpperCase() === opt.key.toUpperCase();
          return (
            <button
              key={opt.key}
              onClick={() => onStatusChange(opt.key)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                isActive
                  ? 'bg-[#00665E] text-white font-bold border-[#004D47] shadow-xs'
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

