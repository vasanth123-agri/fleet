import React, { useState, useEffect } from 'react';
import {
  RotateCw,
  Search,
  SlidersHorizontal,
  Activity,
  Zap,
  Power,
  Wifi,
  WifiOff,
  AlertTriangle,
  Clock,
  Radio,
  ExternalLink,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Thermometer,
  Droplets,
  BatteryCharging,
  Gauge,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Table as TableIcon,
  LayoutGrid,
  Eye,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { useGetValveApplianceStatusQuery } from '../store/fleetApi';
import { getCropEmoji } from '../utils/cropEmoji';
import {
  UserDeviceStatusDTO,
  MonitoredFarmDTO,
  MonitoredDeviceDTO,
  ValveStatusDTO,
  ApplianceStatusDTO,
} from '../types';

interface ValveApplianceMonitoringPageProps {
  onSelectCustomer: (userId: number) => void;
  onSelectFarm: (farmId: string) => void;
}

interface FlatDeviceRow {
  userId: number;
  customerName: string;
  email: string;
  mobile: string;
  place: string | null;
  role: string;
  hasValveCapability: boolean;
  hasApplianceCapability: boolean;
  farmId: string;
  farmName: string;
  crop: string | null;
  cropType: string | null;
  totalAreaAcres: number;
  device: MonitoredDeviceDTO;
}

export const ValveApplianceMonitoringPage: React.FC<ValveApplianceMonitoringPageProps> = ({
  onSelectCustomer,
  onSelectFarm,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'valve' | 'appliance'>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [expandedUsers, setExpandedUsers] = useState<Record<number, boolean>>({});
  const [selectedReadingModal, setSelectedReadingModal] = useState<any | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(15);
  const [copied, setCopied] = useState(false);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetValveApplianceStatusQuery(
    {
      search: search ? search : undefined,
      deviceCategory: selectedCategory !== 'all' ? selectedCategory : undefined,
      status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
      forceFresh: true,
    },
    {
      pollingInterval: autoRefresh ? 15000 : 0,
    }
  );

  // Auto expand all users in card view
  useEffect(() => {
    if (data?.users && Object.keys(expandedUsers).length === 0) {
      const initial: Record<number, boolean> = {};
      data.users.forEach((u: UserDeviceStatusDTO) => {
        initial[u.userId] = true;
      });
      setExpandedUsers(initial);
    }
  }, [data?.users]);

  // Countdown timer for auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 15 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  const toggleUser = (userId: number) => {
    setExpandedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    data?.users.forEach((u: UserDeviceStatusDTO) => {
      all[u.userId] = true;
    });
    setExpandedUsers(all);
  };

  const collapseAll = () => {
    setExpandedUsers({});
  };

  const summary = data?.summary || {
    totalUsers: 0,
    usersWithValves: 0,
    usersWithAppliances: 0,
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    totalValves: 0,
    openValves: 0,
    closedValves: 0,
    unknownValves: 0,
    totalAppliances: 0,
    onAppliances: 0,
    offAppliances: 0,
    unknownAppliances: 0,
  };

  // Flatten users -> farms -> devices for high efficiency table rendering
  const flatRows: FlatDeviceRow[] = [];
  if (data?.users) {
    data.users.forEach((user: UserDeviceStatusDTO) => {
      user.farms.forEach((farm: MonitoredFarmDTO) => {
        if (farm.devices.length === 0) {
          // If farm has no devices but matches filter
          flatRows.push({
            userId: user.userId,
            customerName: user.customerName,
            email: user.email,
            mobile: user.mobile,
            place: user.place,
            role: user.role,
            hasValveCapability: user.hasValveCapability,
            hasApplianceCapability: user.hasApplianceCapability,
            farmId: farm.farmId,
            farmName: farm.farmName,
            crop: farm.crop,
            cropType: farm.cropType,
            totalAreaAcres: farm.totalAreaAcres,
            device: {
              id: 0,
              deviceId: 'NO_DEVICE',
              deviceName: 'No Hardware Device Assigned',
              deviceCategory: 'none',
              cloudStatus: 'OFFLINE',
              lastHeartbeatAt: null,
              formattedHeartbeatAt: null,
              lastAckAt: null,
              formattedLastAckAt: null,
              failSafeStatus: 'NORMAL',
              failSafeReason: null,
              hasValveCapability: false,
              hasApplianceCapability: false,
              valves: [],
              appliances: [],
              lastReading: null,
            },
          });
        } else {
          farm.devices.forEach((dev: MonitoredDeviceDTO) => {
            flatRows.push({
              userId: user.userId,
              customerName: user.customerName,
              email: user.email,
              mobile: user.mobile,
              place: user.place,
              role: user.role,
              hasValveCapability: user.hasValveCapability,
              hasApplianceCapability: user.hasApplianceCapability,
              farmId: farm.farmId,
              farmName: farm.farmName,
              crop: farm.crop,
              cropType: farm.cropType,
              totalAreaAcres: farm.totalAreaAcres,
              device: dev,
            });
          });
        }
      });
    });
  }

  const handleCopyJson = async (obj: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── 1. Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#004D47] to-emerald-600 flex items-center justify-center shadow-xs">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Valve & Appliance Monitoring
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Live Status Layer
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Physical state tracking, MQTT acknowledgment verification, and environmental sensor readings.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Table / Cards View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-[#00665E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                viewMode === 'cards'
                  ? 'bg-white text-[#00665E] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Hierarchical Card View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards View</span>
            </button>
          </div>

          {/* Refresh & Live indicator */}
          <button
            onClick={() => {
              refetch();
              setCountdown(15);
            }}
            disabled={isFetching}
            className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200"
            title="Force refresh status"
          >
            <RotateCw className={`w-3.5 h-3.5 text-[#00665E] ${isFetching ? 'animate-spin' : ''}`} />
            <span>{isFetching ? 'Refreshing...' : `Refresh (${countdown}s)`}</span>
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-colors ${
              autoRefresh
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-500 animate-ping' : 'bg-slate-400'}`} />
            <span>{autoRefresh ? 'Auto 15s' : 'Paused'}</span>
          </button>
        </div>
      </div>

      {/* ── 2. Top-Level Summary Metric Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Users */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Customers</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{summary.totalUsers}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              <span className="font-semibold text-emerald-700">{summary.usersWithValves}</span> with valves &bull;{' '}
              <span className="font-semibold text-teal-700">{summary.usersWithAppliances}</span> with appliances
            </div>
          </div>
        </div>

        {/* Devices Online / Offline */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
            <span>Controllers</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-slate-900">{summary.totalDevices}</div>
            <div className="flex items-center space-x-2 text-[11px] mt-0.5">
              <span className="flex items-center text-emerald-700 font-semibold">
                <Wifi className="w-3 h-3 mr-0.5" /> {summary.onlineDevices} Online
              </span>
              <span className="flex items-center text-rose-600 font-semibold">
                <WifiOff className="w-3 h-3 mr-0.5" /> {summary.offlineDevices} Offline
              </span>
            </div>
          </div>
        </div>

        {/* Valves Summary */}
        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/40 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold">
            <span>Total Valves</span>
            <Radio className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-950">{summary.totalValves}</div>
            <div className="flex items-center space-x-2 text-[11px] mt-0.5 font-semibold">
              <span className="text-emerald-700">● {summary.openValves} Open</span>
              <span className="text-slate-600">● {summary.closedValves} Closed</span>
              {summary.unknownValves > 0 && (
                <span className="text-amber-600">● {summary.unknownValves} ?</span>
              )}
            </div>
          </div>
        </div>

        {/* Open Valves Card */}
        <div className="bg-emerald-900 text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-200 text-xs font-semibold">
            <span>OPEN Valves</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-emerald-100 flex items-center gap-1.5">
              {summary.openValves}
              {summary.openValves > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              )}
            </div>
            <div className="text-[11px] text-emerald-300 mt-0.5">
              Flow confirmed via ACK
            </div>
          </div>
        </div>

        {/* Appliances Summary */}
        <div className="bg-white p-4 rounded-xl border border-teal-200/80 bg-gradient-to-br from-white to-teal-50/40 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-800 text-xs font-semibold">
            <span>Total Appliances</span>
            <Power className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-teal-950">{summary.totalAppliances}</div>
            <div className="flex items-center space-x-2 text-[11px] mt-0.5 font-semibold">
              <span className="text-teal-700">● {summary.onAppliances} ON</span>
              <span className="text-slate-600">● {summary.offAppliances} OFF</span>
              {summary.unknownAppliances > 0 && (
                <span className="text-amber-600">● {summary.unknownAppliances} ?</span>
              )}
            </div>
          </div>
        </div>

        {/* ON Appliances Card */}
        <div className="bg-gradient-to-br from-[#004D47] to-[#00665E] text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-200 text-xs font-semibold">
            <span>ON Appliances</span>
            <Zap className="w-4 h-4 text-yellow-300" />
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black text-white flex items-center gap-1.5">
              {summary.onAppliances}
              {summary.onAppliances > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-300 animate-ping inline-block" />
              )}
            </div>
            <div className="text-[11px] text-emerald-200 mt-0.5">
              Pumps / Motors running
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. Filters & Search Bar ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, email, farm, device ID..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00665E]/20 focus:border-[#00665E] transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              &times;
            </button>
          )}
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold w-full md:w-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg transition-all ${
              selectedCategory === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Hardware
          </button>
          <button
            onClick={() => setSelectedCategory('valve')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1 ${
              selectedCategory === 'valve'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Valves Only</span>
          </button>
          <button
            onClick={() => setSelectedCategory('appliance')}
            className={`flex-1 md:flex-none px-3.5 py-1.5 rounded-lg transition-all flex items-center justify-center space-x-1 ${
              selectedCategory === 'appliance'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>Appliances Only</span>
          </button>
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center space-x-2 w-full md:w-auto">
          <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full md:w-44 py-2 px-3 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00665E]/20"
          >
            <option value="ALL">All States</option>
            <option value="OPEN">Valves: OPEN Only</option>
            <option value="CLOSED">Valves: CLOSED Only</option>
            <option value="ON">Appliances: ON Only</option>
            <option value="OFF">Appliances: OFF Only</option>
            <option value="ONLINE">Controllers: ONLINE Only</option>
            <option value="OFFLINE">Controllers: OFFLINE Only</option>
          </select>
        </div>
      </div>

      {/* ── 4. Loading & Error States ── */}
      {isLoading && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <RotateCw className="w-8 h-8 text-[#00665E] animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Loading live valve & appliance statuses...</p>
          <p className="text-xs text-slate-400">Verifying MQTT physical acknowledgments & telemetry mappings</p>
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-sm font-bold text-rose-900">Failed to load valve & appliance statuses</h3>
          <p className="text-xs text-rose-700">
            {(error as any)?.data?.error || (error as any)?.message || 'Internal connection error.'}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 px-4 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── 5. Empty State ── */}
      {!isLoading && !error && data?.users.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Radio className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No matching valves or appliances found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No devices matched your search or status filters. Try clearing your search query or selecting "All States".
          </p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedCategory('all');
              setSelectedStatus('ALL');
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* ── 6. TABLE DESIGN VIEW ── */}
      {!isLoading && !error && data && data.users.length > 0 && viewMode === 'table' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Farm & Crop</th>
                  <th className="py-3.5 px-4">Controller / Node</th>
                  <th className="py-3.5 px-4">Valves Physical State</th>
                  <th className="py-3.5 px-4">Appliances / Pumps</th>
                  <th className="py-3.5 px-4">Latest Sensor Reading</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {flatRows.map((row, idx) => {
                  const initial = row.customerName.charAt(0).toUpperCase();
                  const isOnline = row.device.cloudStatus === 'ONLINE';

                  return (
                    <tr
                      key={`${row.userId}-${row.farmId}-${row.device.deviceId}-${idx}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      {/* Customer Info */}
                      <td className="py-4 px-4 align-top">
                        <div className="flex items-start space-x-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#004D47]/10 text-[#004D47] font-bold flex items-center justify-center shrink-0 text-xs shadow-2xs">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{row.customerName}</span>
                              <span className="text-[10px] font-mono font-semibold px-1 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                #{row.userId}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                              {row.email}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {row.place || 'Location unset'} &bull; <span className="font-semibold text-slate-600">{row.role}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Farm & Crop */}
                      <td className="py-4 px-4 align-top">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1">
                            <span role="img" aria-label="crop">
                              {getCropEmoji(row.crop || row.cropType)}
                            </span>
                            <span>{row.farmName}</span>
                          </div>
                          {row.crop && (
                            <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              {row.crop}
                            </span>
                          )}
                          {row.totalAreaAcres > 0 && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {row.totalAreaAcres.toFixed(1)} Acres
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Controller / Node */}
                      <td className="py-4 px-4 align-top">
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{row.device.deviceName || row.device.deviceId}</span>
                            <span
                              className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full flex items-center gap-1 ${
                                isOnline
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isOnline ? 'bg-emerald-600 animate-pulse' : 'bg-rose-600'
                                }`}
                              />
                              {row.device.cloudStatus}
                            </span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                            ID: <span className="font-semibold text-slate-700">{row.device.deviceId}</span>
                          </div>
                          {row.device.deviceCategory && (
                            <span className="inline-block mt-1 text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {row.device.deviceCategory}
                            </span>
                          )}
                          {row.device.formattedHeartbeatAt && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Heartbeat: {row.device.formattedHeartbeatAt}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Valves Physical State */}
                      <td className="py-4 px-4 align-top">
                        {row.device.valves.length === 0 ? (
                          <span className="text-slate-400 text-[11px] italic">No valve on node</span>
                        ) : (
                          <div className="space-y-2">
                            {row.device.valves.map((v: ValveStatusDTO, vIdx: number) => {
                              const isOpen = v.status === 'OPEN';
                              const isClosed = v.status === 'CLOSED';

                              return (
                                <div
                                  key={vIdx}
                                  className={`p-2 rounded-xl border transition-all ${
                                    isOpen
                                      ? 'bg-emerald-900 text-white border-emerald-950 shadow-xs'
                                      : isClosed
                                      ? 'bg-slate-50 text-slate-800 border-slate-200'
                                      : 'bg-amber-50 text-amber-900 border-amber-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-[11px]">{v.displayName}</span>
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1 ${
                                        isOpen
                                          ? 'bg-emerald-500 text-white animate-pulse'
                                          : isClosed
                                          ? 'bg-slate-200 text-slate-700'
                                          : 'bg-amber-200 text-amber-900'
                                      }`}
                                    >
                                      {isOpen ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3 text-white" />
                                          OPEN
                                        </>
                                      ) : isClosed ? (
                                        <>
                                          <XCircle className="w-3 h-3 text-slate-500" />
                                          CLOSED
                                        </>
                                      ) : (
                                        <>
                                          <HelpCircle className="w-3 h-3 text-amber-700" />
                                          UNKNOWN
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-[10px] mt-1 ${
                                      isOpen ? 'text-emerald-200' : 'text-slate-500'
                                    }`}
                                  >
                                    Topic: <code className="font-mono">{v.statusTopic}</code>
                                    {v.formattedLastAckAt && (
                                      <span> &bull; ACK: {v.formattedLastAckAt}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Appliances / Pumps */}
                      <td className="py-4 px-4 align-top">
                        {row.device.appliances.length === 0 ? (
                          <span className="text-slate-400 text-[11px] italic">No appliance on node</span>
                        ) : (
                          <div className="space-y-2">
                            {row.device.appliances.map((a: ApplianceStatusDTO, aIdx: number) => {
                              const isOn = a.status === 'ON';
                              const isOff = a.status === 'OFF';

                              return (
                                <div
                                  key={aIdx}
                                  className={`p-2 rounded-xl border transition-all ${
                                    isOn
                                      ? 'bg-gradient-to-r from-[#004D47] to-[#00665E] text-white border-teal-900 shadow-xs'
                                      : isOff
                                      ? 'bg-slate-50 text-slate-800 border-slate-200'
                                      : 'bg-amber-50 text-amber-900 border-amber-200'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-bold text-[11px]">{a.deviceName}</span>
                                      <span
                                        className={`text-[9px] uppercase font-bold px-1 rounded ${
                                          isOn ? 'bg-teal-800 text-emerald-200' : 'bg-slate-200 text-slate-600'
                                        }`}
                                      >
                                        {a.deviceCategory}
                                      </span>
                                    </div>
                                    <span
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex items-center gap-1 ${
                                        isOn
                                          ? 'bg-emerald-400 text-emerald-950 animate-pulse'
                                          : isOff
                                          ? 'bg-slate-200 text-slate-700'
                                          : 'bg-amber-200 text-amber-900'
                                      }`}
                                    >
                                      {isOn ? (
                                        <>
                                          <Zap className="w-3 h-3 text-emerald-950 fill-emerald-950" />
                                          ON
                                        </>
                                      ) : isOff ? (
                                        <>
                                          <Power className="w-3 h-3 text-slate-500" />
                                          OFF
                                        </>
                                      ) : (
                                        <>
                                          <HelpCircle className="w-3 h-3 text-amber-700" />
                                          UNKNOWN
                                        </>
                                      )}
                                    </span>
                                  </div>
                                  <div
                                    className={`text-[10px] mt-1 ${
                                      isOn ? 'text-teal-200' : 'text-slate-500'
                                    }`}
                                  >
                                    Topic: <code className="font-mono">{a.statusTopic}</code>
                                    {a.formattedLastAckAt && (
                                      <span> &bull; ACK: {a.formattedLastAckAt}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      {/* Latest Sensor Reading */}
                      <td className="py-4 px-4 align-top">
                        {row.device.lastReading ? (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1.5 min-w-[210px]">
                            <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500">
                              <span className="flex items-center gap-1">
                                <Activity className="w-3 h-3 text-[#00665E]" />
                                {row.device.lastReading.formattedTimestamp || 'Reading'}
                              </span>
                              <button
                                onClick={() => setSelectedReadingModal(row.device.lastReading)}
                                className="text-[#00665E] hover:underline flex items-center gap-0.5"
                                title="Inspect Full Telemetry JSON"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Inspect</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                              <div className="p-1 rounded bg-orange-50/70 border border-orange-100 flex items-center space-x-1">
                                <Thermometer className="w-3 h-3 text-orange-600 shrink-0" />
                                <span>
                                  {row.device.lastReading.temperature != null
                                    ? `${row.device.lastReading.temperature}°C`
                                    : '--'}
                                </span>
                              </div>
                              <div className="p-1 rounded bg-blue-50/70 border border-blue-100 flex items-center space-x-1">
                                <Droplets className="w-3 h-3 text-blue-600 shrink-0" />
                                <span>
                                  {row.device.lastReading.humidity != null
                                    ? `${row.device.lastReading.humidity}%`
                                    : '--'}
                                </span>
                              </div>
                              <div className="p-1 rounded bg-emerald-50/70 border border-emerald-100 flex items-center space-x-1">
                                <Droplets className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>
                                  Moi: {row.device.lastReading.soilMoisture != null
                                    ? `${row.device.lastReading.soilMoisture}%`
                                    : '--'}
                                </span>
                              </div>
                              <div className="p-1 rounded bg-indigo-50/70 border border-indigo-100 flex items-center space-x-1">
                                <Gauge className="w-3 h-3 text-indigo-600 shrink-0" />
                                <span>
                                  pH: {row.device.lastReading.phMaster != null
                                    ? row.device.lastReading.phMaster
                                    : '--'}
                                </span>
                              </div>
                            </div>

                            {/* Battery */}
                            {row.device.lastReading.batteryPercentage != null && (
                              <div className="text-[10px] text-slate-600 flex items-center gap-1 pt-0.5 border-t border-slate-200/50">
                                <BatteryCharging className="w-3 h-3 text-emerald-600" />
                                <span>
                                  Battery: {row.device.lastReading.batteryPercentage}%
                                  {row.device.lastReading.batteryVoltage != null &&
                                    ` (${row.device.lastReading.batteryVoltage}V)`}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">No telemetry recorded</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right">
                        <div className="flex flex-col items-end space-y-1.5">
                          <button
                            onClick={() => onSelectCustomer(row.userId)}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 transition-colors"
                          >
                            <span>Customer</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </button>
                          {row.farmId !== 'unassigned' && (
                            <button
                              onClick={() => onSelectFarm(row.farmId)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-[#00665E] border border-emerald-200 flex items-center gap-1 transition-colors"
                            >
                              <span>Farm Charts</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 7. CARD HIERARCHY VIEW ── */}
      {!isLoading && !error && data && data.users.length > 0 && viewMode === 'cards' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-slate-500 font-semibold">
              Showing {data.users.length} Customer Hierarchies
            </span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={expandAll}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Expand All
              </button>
              <span className="text-slate-300">|</span>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>

          {data.users.map((user: UserDeviceStatusDTO) => {
            const isExpanded = expandedUsers[user.userId] ?? true;

            const allValves: ValveStatusDTO[] = [];
            const allAppliances: ApplianceStatusDTO[] = [];
            user.farms.forEach((f: MonitoredFarmDTO) => {
              f.devices.forEach((d: MonitoredDeviceDTO) => {
                allValves.push(...d.valves);
                allAppliances.push(...d.appliances);
              });
            });

            const openValvesCount = allValves.filter((v) => v.status === 'OPEN').length;
            const onAppliancesCount = allAppliances.filter((a) => a.status === 'ON').length;

            return (
              <div
                key={user.userId}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all"
              >
                {/* User Header Accordion Trigger */}
                <div
                  onClick={() => toggleUser(user.userId)}
                  className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer bg-gradient-to-r from-slate-50/80 via-white to-slate-50/50 hover:bg-slate-100/60 transition-colors select-none"
                >
                  <div className="flex items-start sm:items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#004D47]/10 border border-[#004D47]/20 flex items-center justify-center shrink-0 font-bold text-[#004D47] text-sm shadow-xs">
                      #{user.userId}
                    </div>
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <h2 className="text-base font-bold text-slate-900 tracking-tight">
                          {user.customerName}
                        </h2>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                          {user.role}
                        </span>
                        {user.place && (
                          <span className="text-xs text-slate-500 font-medium">
                            &bull; {user.place}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center flex-wrap gap-x-3 gap-y-1">
                        <span>{user.email}</span>
                        {user.mobile && <span>&bull; {user.mobile}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Summary Status Badges for User */}
                  <div className="flex items-center flex-wrap gap-2 self-start md:self-auto">
                    {allValves.length > 0 && (
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 ${
                          openValvesCount > 0
                            ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse-subtle'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Radio className="w-3.5 h-3.5" />
                        <span>{openValvesCount} / {allValves.length} Valve Open</span>
                      </span>
                    )}

                    {allAppliances.length > 0 && (
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1 ${
                          onAppliancesCount > 0
                            ? 'bg-[#004D47] text-white border-teal-800 animate-pulse-subtle'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5 text-yellow-300" />
                        <span>{onAppliancesCount} / {allAppliances.length} App. ON</span>
                      </span>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCustomer(user.userId);
                      }}
                      className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center gap-1 transition-colors"
                      title="View Customer Profile"
                    >
                      <span>Profile</span>
                      <ExternalLink className="w-3 h-3 text-slate-400" />
                    </button>

                    <div className="p-1 text-slate-400">
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5" />
                      ) : (
                        <ChevronDown className="w-5 h-5" />
                      )}
                    </div>
                  </div>
                </div>

                {/* User Content: Farms & Devices */}
                {isExpanded && (
                  <div className="p-4 sm:p-5 border-t border-slate-100 space-y-6 bg-slate-50/50">
                    {user.farms.map((farm: MonitoredFarmDTO) => (
                      <FarmBlock
                        key={farm.farmId}
                        farm={farm}
                        userId={user.userId}
                        onSelectFarm={onSelectFarm}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 8. Telemetry Detail Modal ── */}
      {selectedReadingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedReadingModal(null)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-emerald-50 text-[#00665E] border border-emerald-200 rounded-xl">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Environmental Sensor Telemetry
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Timestamp: {selectedReadingModal.formattedTimestamp || 'Live'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedReadingModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-orange-50/60 rounded-xl border border-orange-100">
                  <span className="text-[10px] text-slate-500 font-medium">Temperature</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.temperature != null ? `${selectedReadingModal.temperature} °C` : '--'}
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-slate-500 font-medium">Humidity</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.humidity != null ? `${selectedReadingModal.humidity} %` : '--'}
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-slate-500 font-medium">Soil Moisture</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.soilMoisture != null ? `${selectedReadingModal.soilMoisture} %` : '--'}
                  </div>
                </div>

                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <span className="text-[10px] text-slate-500 font-medium">Soil pH Master</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.phMaster != null ? selectedReadingModal.phMaster : '--'}
                  </div>
                </div>

                <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-100">
                  <span className="text-[10px] text-slate-500 font-medium">Soil EC</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.soilElectroConductivity != null
                      ? `${selectedReadingModal.soilElectroConductivity} mS/cm`
                      : '--'}
                  </div>
                </div>

                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                  <span className="text-[10px] text-slate-500 font-medium">Soil Nitrogen (N)</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.soilNitrogen != null ? `${selectedReadingModal.soilNitrogen} mg/kg` : '--'}
                  </div>
                </div>

                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                  <span className="text-[10px] text-slate-500 font-medium">Soil Phosphorus (P)</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.soilPhosphorus != null ? `${selectedReadingModal.soilPhosphorus} mg/kg` : '--'}
                  </div>
                </div>

                <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-100">
                  <span className="text-[10px] text-slate-500 font-medium">Soil Potassium (K)</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.soilPotassium != null ? `${selectedReadingModal.soilPotassium} mg/kg` : '--'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 font-medium">Battery Percentage</span>
                  <div className="text-base font-bold text-slate-900">
                    {selectedReadingModal.batteryPercentage != null ? `${selectedReadingModal.batteryPercentage} %` : '--'}
                    {selectedReadingModal.batteryVoltage != null && (
                      <span className="text-xs font-normal text-slate-500 ml-1">
                        ({selectedReadingModal.batteryVoltage}V)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Raw JSON viewer */}
              <div className="relative">
                <button
                  onClick={() => handleCopyJson(selectedReadingModal)}
                  className="absolute top-3 right-3 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-1 border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                </button>
                <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56">
                  {JSON.stringify(selectedReadingModal, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedReadingModal(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Farm Block Component for Card View ────────────────────────────────
interface FarmBlockProps {
  farm: MonitoredFarmDTO;
  userId: number;
  onSelectFarm: (farmId: string) => void;
}

const FarmBlock: React.FC<FarmBlockProps> = ({ farm, onSelectFarm }) => {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Farm Header */}
      <div className="p-3.5 sm:p-4 bg-slate-100/70 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5">
          <span className="text-xl shrink-0" role="img" aria-label="crop">
            {getCropEmoji(farm.crop || farm.cropType)}
          </span>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">{farm.farmName}</h3>
              {farm.crop && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {farm.crop}
                </span>
              )}
              {farm.totalAreaAcres > 0 && (
                <span className="text-xs text-slate-500 font-medium">
                  &bull; {farm.totalAreaAcres.toFixed(1)} Acres
                </span>
              )}
            </div>
            {farm.place && (
              <p className="text-[11px] text-slate-500">Location: {farm.place}</p>
            )}
          </div>
        </div>

        {farm.farmId !== 'unassigned' && (
          <button
            onClick={() => onSelectFarm(farm.farmId)}
            className="flex items-center space-x-1 text-xs font-bold text-[#00665E] hover:text-emerald-700 transition-colors self-start sm:self-auto"
          >
            <span>Telemetry Charts</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Devices in this farm */}
      <div className="p-4 space-y-4">
        {farm.devices.length === 0 ? (
          <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400 italic">
            No hardware controllers registered in this farm.
          </div>
        ) : (
          farm.devices.map((device: MonitoredDeviceDTO) => (
            <DeviceItemCard key={device.id || device.deviceId} device={device} />
          ))
        )}
      </div>
    </div>
  );
};

// ── Device Item Card Component for Card View ──────────────────────────
interface DeviceItemCardProps {
  device: MonitoredDeviceDTO;
}

const DeviceItemCard: React.FC<DeviceItemCardProps> = ({ device }) => {
  const isOnline = device.cloudStatus === 'ONLINE';

  return (
    <div className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 space-y-4">
      {/* Device Top Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 shadow-2xs">
            {device.deviceCategory?.toLowerCase() === 'valve' ? (
              <Radio className="w-4 h-4 text-emerald-600" />
            ) : (
              <Power className="w-4 h-4 text-teal-700" />
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-900">
                {device.deviceName || device.deviceId}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 font-semibold">
                {device.deviceId}
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                {device.deviceCategory}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center space-x-3">
              {device.formattedHeartbeatAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  Heartbeat: {device.formattedHeartbeatAt}
                </span>
              )}
              {device.formattedLastAckAt && (
                <span className="flex items-center gap-1 text-slate-600">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Last ACK: {device.formattedLastAckAt}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cloud Status Badge */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {device.failSafeStatus === 'FAILSAFE' && (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              FAILSAFE: {device.failSafeReason || 'LORA_ERR'}
            </span>
          )}
          <span
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border flex items-center gap-1.5 ${
              isOnline
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {isOnline ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                ONLINE
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                OFFLINE
              </>
            )}
          </span>
        </div>
      </div>

      {/* Valves Section */}
      {device.valves.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-600" />
            <span>Valves Status</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {device.valves.map((valve: ValveStatusDTO, idx: number) => (
              <ValveCard key={idx} valve={valve} />
            ))}
          </div>
        </div>
      )}

      {/* Appliances Section */}
      {device.appliances.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Power className="w-3.5 h-3.5 text-teal-700" />
            <span>Appliance & Pump Status</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {device.appliances.map((appliance: ApplianceStatusDTO, idx: number) => (
              <ApplianceCard key={idx} appliance={appliance} />
            ))}
          </div>
        </div>
      )}

      {/* Last Sensor Reading Panel */}
      {device.lastReading && (
        <div className="pt-2 border-t border-slate-200">
          <SensorReadingStrip reading={device.lastReading} />
        </div>
      )}
    </div>
  );
};

// ── Valve Card Component ──────────────────────────────────────────────
interface ValveCardProps {
  valve: ValveStatusDTO;
}

const ValveCard: React.FC<ValveCardProps> = ({ valve }) => {
  const isOpen = valve.status === 'OPEN';
  const isClosed = valve.status === 'CLOSED';

  return (
    <div
      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
        isOpen
          ? 'bg-emerald-900 text-white border-emerald-950 shadow-sm'
          : isClosed
          ? 'bg-white text-slate-800 border-slate-200 shadow-2xs'
          : 'bg-amber-50 text-amber-900 border-amber-200'
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold">{valve.displayName}</span>
          {valve.isSessionActive && (
            <span
              className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                isOpen ? 'bg-emerald-800 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              Scheduled Active ({valve.activeSessionDurationMinutes}m)
            </span>
          )}
        </div>
        <div className={`text-[11px] flex items-center flex-wrap gap-x-2 ${isOpen ? 'text-emerald-200' : 'text-slate-500'}`}>
          <span>Topic: <code className="font-mono">{valve.statusTopic}</code></span>
          {valve.formattedLastAckAt && (
            <span>&bull; Confirmed: {valve.formattedLastAckAt}</span>
          )}
        </div>
      </div>

      {/* State Badge */}
      <div className="shrink-0">
        <span
          className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-2xs ${
            isOpen
              ? 'bg-emerald-500 text-white animate-pulse'
              : isClosed
              ? 'bg-slate-200 text-slate-700'
              : 'bg-amber-200 text-amber-900'
          }`}
        >
          {isOpen ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-white" />
              OPEN
            </>
          ) : isClosed ? (
            <>
              <XCircle className="w-4 h-4 text-slate-500" />
              CLOSED
            </>
          ) : (
            <>
              <HelpCircle className="w-4 h-4 text-amber-700" />
              UNKNOWN
            </>
          )}
        </span>
      </div>
    </div>
  );
};

// ── Appliance Card Component ──────────────────────────────────────────
interface ApplianceCardProps {
  appliance: ApplianceStatusDTO;
}

const ApplianceCard: React.FC<ApplianceCardProps> = ({ appliance }) => {
  const isOn = appliance.status === 'ON';
  const isOff = appliance.status === 'OFF';

  const formatSeconds = (sec: number | null | undefined) => {
    if (sec == null) return null;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      return `${h}h ${m % 60}m`;
    }
    return `${m}m ${s}s`;
  };

  return (
    <div
      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
        isOn
          ? 'bg-gradient-to-r from-[#004D47] to-[#00665E] text-white border-teal-900 shadow-sm'
          : isOff
          ? 'bg-white text-slate-800 border-slate-200 shadow-2xs'
          : 'bg-amber-50 text-amber-900 border-amber-200'
      }`}
    >
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold">{appliance.deviceName}</span>
          <span
            className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
              isOn ? 'bg-teal-800 text-emerald-200' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {appliance.deviceCategory}
          </span>
          {appliance.currentRuntimeSeconds != null && isOn && (
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-yellow-400 text-yellow-950 flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />
              Running: {formatSeconds(appliance.currentRuntimeSeconds)}
            </span>
          )}
        </div>
        <div className={`text-[11px] flex items-center flex-wrap gap-x-2 ${isOn ? 'text-teal-200' : 'text-slate-500'}`}>
          <span>Topic: <code className="font-mono">{appliance.statusTopic}</code></span>
          {appliance.formattedLastAckAt && (
            <span>&bull; Confirmed: {appliance.formattedLastAckAt}</span>
          )}
        </div>
      </div>

      {/* State Badge */}
      <div className="shrink-0">
        <span
          className={`px-3 py-1.5 rounded-xl text-xs font-black tracking-wider uppercase flex items-center gap-1.5 shadow-2xs ${
            isOn
              ? 'bg-emerald-400 text-emerald-950 font-black animate-pulse'
              : isOff
              ? 'bg-slate-200 text-slate-700'
              : 'bg-amber-200 text-amber-900'
          }`}
        >
          {isOn ? (
            <>
              <Zap className="w-4 h-4 text-emerald-950 fill-emerald-950" />
              ON
            </>
          ) : isOff ? (
            <>
              <Power className="w-4 h-4 text-slate-500" />
              OFF
            </>
          ) : (
            <>
              <HelpCircle className="w-4 h-4 text-amber-700" />
              UNKNOWN
            </>
          )}
        </span>
      </div>
    </div>
  );
};

// ── Sensor Reading Strip Component ────────────────────────────────────
interface SensorReadingStripProps {
  reading: {
    timestamp: string | null;
    formattedTimestamp: string | null;
    temperature: number | null;
    humidity: number | null;
    soilMoisture: number | null;
    soilTemperature: number | null;
    soilElectroConductivity: number | null;
    soilNitrogen: number | null;
    soilPhosphorus: number | null;
    soilPotassium: number | null;
    phMaster: number | null;
    vpd: number | null;
    co2: number | null;
    windSpeed: number | null;
    par: number | null;
    directRadiation: number | null;
    batteryPercentage: number | null;
    batteryVoltage: number | null;
  };
}

const SensorReadingStrip: React.FC<SensorReadingStripProps> = ({ reading }) => {
  return (
    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-slate-700 flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[#00665E]" />
          Last Sensor Reading
        </span>
        {reading.formattedTimestamp && (
          <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {reading.formattedTimestamp}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
        <div className="p-2 rounded-lg bg-orange-50/70 border border-orange-100 flex items-center space-x-2">
          <Thermometer className="w-4 h-4 text-orange-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Temperature</div>
            <div className="font-bold text-slate-900">
              {reading.temperature != null ? `${reading.temperature} °C` : '--'}
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-blue-50/70 border border-blue-100 flex items-center space-x-2">
          <Droplets className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Humidity</div>
            <div className="font-bold text-slate-900">
              {reading.humidity != null ? `${reading.humidity} %` : '--'}
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-100 flex items-center space-x-2">
          <Droplets className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Soil Moisture</div>
            <div className="font-bold text-slate-900">
              {reading.soilMoisture != null ? `${reading.soilMoisture} %` : '--'}
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-indigo-50/70 border border-indigo-100 flex items-center space-x-2">
          <Gauge className="w-4 h-4 text-indigo-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Soil pH</div>
            <div className="font-bold text-slate-900">
              {reading.phMaster != null ? `${reading.phMaster}` : '--'}
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-teal-50/70 border border-teal-100 flex items-center space-x-2">
          <Activity className="w-4 h-4 text-teal-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Soil EC</div>
            <div className="font-bold text-slate-900">
              {reading.soilElectroConductivity != null
                ? `${reading.soilElectroConductivity} mS/cm`
                : '--'}
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-purple-50/70 border border-purple-100 flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Soil N-P-K</div>
            <div className="font-bold text-slate-900 text-[11px]">
              {reading.soilNitrogen != null && reading.soilPhosphorus != null && reading.soilPotassium != null
                ? `${reading.soilNitrogen}-${reading.soilPhosphorus}-${reading.soilPotassium}`
                : '--'}
            </div>
          </div>
        </div>

        <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex items-center space-x-2">
          <BatteryCharging className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <div className="text-[10px] text-slate-500 font-medium">Battery</div>
            <div className="font-bold text-slate-900">
              {reading.batteryPercentage != null ? `${reading.batteryPercentage}%` : '--'}
              {reading.batteryVoltage != null && (
                <span className="text-[10px] text-slate-500 ml-1">({reading.batteryVoltage}V)</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
