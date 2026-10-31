import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sprout,
  MapPin,
  ArrowRight,
  User,
  Mail,
  Phone,
  Crown,
  Clock,
  Shield,
  CheckCircle,
  ChevronDown,
  Eye,
  Activity,
  Layers,
  Calendar,
  ExternalLink,
} from 'lucide-react';
import { CustomerDashboardSummary, FarmSummary } from '../types';
import { usePrefetch } from '../store/fleetApi';
import { getCropEmoji } from '../utils/cropEmoji';
import { StatusBadge } from './StatusBadge';
import { TelemetryJsonModal } from './TelemetryJsonModal';

interface CustomerTableProps {
  customers: CustomerDashboardSummary[];
  loading?: boolean;
  onSelectCustomer: (customerId: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
}

// Helper to render device type badge
const renderDeviceTypeBadge = (cat: string) => {
  const lower = cat.toLowerCase();
  if (lower.includes('outdoor')) {
    return (
      <span
        key={cat}
        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-50 text-purple-800 border border-purple-200"
      >
        <span>🧪</span>
        <span>Outdoor Fertigation</span>
      </span>
    );
  }
  if (lower.includes('indoor')) {
    return (
      <span
        key={cat}
        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-200"
      >
        <span>🌿</span>
        <span>Indoor Fertigation</span>
      </span>
    );
  }
  if (lower.includes('battery') || lower.includes('bcs')) {
    return (
      <span
        key={cat}
        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
      >
        <span>🔋</span>
        <span>Battery Sensor</span>
      </span>
    );
  }
  if (lower.includes('valve')) {
    return (
      <span
        key={cat}
        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"
      >
        <span>🚰</span>
        <span>Valve</span>
      </span>
    );
  }
  if (lower.includes('appliance') || lower.includes('ac')) {
    return (
      <span
        key={cat}
        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200"
      >
        <span>⚡</span>
        <span>Appliance</span>
      </span>
    );
  }
  if (lower.includes('pump')) {
    return (
      <span
        key={cat}
        className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-cyan-50 text-cyan-800 border border-cyan-200"
      >
        <span>💧</span>
        <span>Pump</span>
      </span>
    );
  }
  return (
    <span
      key={cat}
      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200"
    >
      <span>📡</span>
      <span>{cat}</span>
    </span>
  );
};

// Helper to render subscription & account status badge
const renderSubStatusBadge = (role?: string, status?: string | null) => {
  const upperRole = (role || '').toUpperCase();
  const upperStatus = (status || '').toUpperCase();

  if (upperRole === 'VIP') {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
        <Crown className="w-3 h-3 text-purple-600" />
        <span>VIP</span>
      </span>
    );
  }

  if (upperRole === 'TRIAL') {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Trial</span>
      </span>
    );
  }

  if (upperRole === 'ADMIN') {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 shadow-2xs">
        <Shield className="w-3 h-3 text-sky-600" />
        <span>Admin</span>
      </span>
    );
  }

  if (upperStatus === 'ACTIVE') {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
        <CheckCircle className="w-3 h-3 text-emerald-600" />
        <span>Active</span>
      </span>
    );
  }

  if (upperStatus === 'PENDING') {
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
        <Clock className="w-3 h-3 text-amber-600" />
        <span>Pending</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
      <span>{upperRole || upperStatus || 'Standard'}</span>
    </span>
  );
};

export const CustomerTable: React.FC<CustomerTableProps> = ({
  customers,
  loading = false,
  onSelectCustomer,
  page,
  totalPages,
  onPageChange,
}) => {
  const navigate = useNavigate();

  // Instant Prefetch hooks for hover navigation
  const prefetchCustomerDetail = usePrefetch('getCustomerDetail');
  const prefetchFarmDetail = usePrefetch('getFarmDetail');

  // Accordion state: map of customerId -> boolean (expanded)
  const [expandedCustomers, setExpandedCustomers] = useState<Record<number, boolean>>({});

  // Telemetry JSON modal state
  const [modalCustomer, setModalCustomer] = useState<any | null>(null);

  const toggleAccordion = (customerId: number) => {
    setExpandedCustomers((prev) => ({
      ...prev,
      [customerId]: !prev[customerId],
    }));
  };

  const handleOpenFarmJson = (
    e: React.MouseEvent,
    customer: CustomerDashboardSummary,
    farm: FarmSummary
  ) => {
    e.stopPropagation();
    setModalCustomer({
      customerName: `${customer.customerName || customer.email} • ${farm.name}`,
      formattedReadingTime: farm.formattedReadingTime || 'No sync records',
      latestReadingRaw: farm.latestReadingRaw || {
        farm_id: farm.farmId,
        farm_name: farm.name,
        boundary_name: farm.boundaryName || 'Main Plot',
        crop: farm.crop,
        latest_reading_time: farm.formattedReadingTime,
        day_start_time: farm.formattedDayStartTime,
        reading_count_today: farm.readingCountToday ?? 0,
        reading_status: farm.readingStatus,
      },
    });
  };

  const handleOpenCustomerJson = (
    e: React.MouseEvent,
    customer: CustomerDashboardSummary
  ) => {
    e.stopPropagation();
    setModalCustomer({
      customerName: customer.customerName || customer.email,
      formattedReadingTime: customer.formattedReadingTime || 'No sync records',
      latestReadingRaw: customer.latestReadingRaw || customer,
    });
  };

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center space-y-3 text-slate-500">
        <div className="w-10 h-10 border-2 border-[#00665E] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Loading customer fleet data...</span>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-3 text-slate-500 border border-dashed border-slate-200">
        <User className="w-12 h-12 text-slate-400" />
        <h3 className="text-base font-bold text-slate-800">No customers found</h3>
        <p className="text-xs text-slate-500 max-w-sm">
          No records matched your search query or filter criteria. Try resetting the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mobile Card List View (< sm screens) */}
      <div className="grid grid-cols-1 gap-3 sm:hidden">
        {customers.map((c) => {
          const initial = (c.customerName || c.email).charAt(0).toUpperCase();
          const isExpanded = Boolean(expandedCustomers[c.customerId]);
          const userFarms = c.farms || [];

          return (
            <div
              key={c.customerId}
              className={`glass-card rounded-2xl bg-white border transition-all ${
                isExpanded ? 'border-emerald-300 ring-2 ring-emerald-500/10 shadow-sm' : 'border-slate-200 shadow-xs'
              }`}
            >
              {/* Customer Card Header (Click to toggle accordion) */}
              <div
                onClick={() => toggleAccordion(c.customerId)}
                className="p-4 space-y-3 cursor-pointer select-none"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-[#00665E] flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 truncate">
                          {c.customerName || 'Customer'}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          #{c.customerId}
                        </span>
                      </div>

                      {/* Mail */}
                      <div className="flex items-center space-x-1.5 text-xs text-slate-600 truncate mt-0.5">
                        <Mail className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="font-mono truncate">{c.email}</span>
                      </div>

                      {/* Phone */}
                      <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{c.mobile || 'No mobile'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {renderSubStatusBadge(c.role, c.status)}
                    <div
                      className={`p-1.5 rounded-lg bg-emerald-50 text-[#00665E] border border-emerald-200 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 bg-emerald-100' : ''
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                {/* Place */}
                <div className="flex items-center space-x-1.5 text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-medium truncate">{c.place || 'Location unset'}</span>
                </div>

                {/* Footer with Farm Count and Customer JSON button */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-800">
                    <Sprout className="w-3.5 h-3.5 text-[#00665E]" />
                    <span>
                      {c.farmCount} {c.farmCount === 1 ? 'Farm' : 'Farms'} (Tap to expand)
                    </span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={(e) => handleOpenCustomerJson(e, c)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-[#00665E] border border-slate-200 transition-colors"
                      title="View Customer JSON"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCustomer(c.customerId);
                      }}
                      className="p-1.5 rounded-lg bg-[#00665E] text-white hover:bg-[#004D47] transition-colors"
                      title="View Customer Fleet Details"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Accordion Expanded Body */}
              {isExpanded && (
                <div className="p-3 bg-slate-50/90 border-t border-slate-200/80 space-y-3 rounded-b-2xl">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                      <Sprout className="w-4 h-4 text-[#00665E]" />
                      <span>Assigned Farms ({userFarms.length})</span>
                    </span>
                    <button
                      onClick={() => onSelectCustomer(c.customerId)}
                      className="text-[11px] font-semibold text-[#00665E] hover:underline flex items-center space-x-1"
                    >
                      <span>Full Profile</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  {userFarms.length === 0 ? (
                    <div className="p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 italic">
                      No farms registered for this customer.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {userFarms.map((f) => {
                        const cropEmoji = getCropEmoji(f.crop);
                        return (
                          <div
                            key={f.farmId}
                            className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2.5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h4
                                  onClick={() => navigate(`/farms/${f.farmId}`)}
                                  className="text-xs font-bold text-slate-900 hover:text-[#00665E] cursor-pointer transition-colors truncate"
                                >
                                  {f.name}
                                </h4>
                                <div className="flex items-center space-x-1.5 text-[11px] text-slate-500 mt-0.5">
                                  <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{f.boundaryName || 'Main Plot'}</span>
                                </div>
                              </div>

                              <div className="flex items-center space-x-1 shrink-0">
                                <StatusBadge status={f.readingStatus} size="sm" />
                                <button
                                  onClick={(e) => handleOpenFarmJson(e, c, f)}
                                  className="p-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-[#00665E] border border-slate-200 transition-colors"
                                  title="View Last Reading JSON"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Crop & Reading Details */}
                            <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100">
                              <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Crop</span>
                                <span className="inline-flex items-center space-x-1 font-semibold text-emerald-800">
                                  <span>{cropEmoji}</span>
                                  <span>{f.crop || 'Crop set'}</span>
                                </span>
                              </div>

                              <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Readings Today</span>
                                <span className="font-bold text-slate-800">
                                  ⚡ {f.readingCountToday ?? 0} count
                                </span>
                              </div>

                              <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Last Reading</span>
                                <span className="font-mono text-slate-700">
                                  {f.formattedReadingTime || 'No records'}
                                </span>
                              </div>

                              <div className="space-y-0.5">
                                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Day Start Time</span>
                                <span className="font-mono text-slate-700">
                                  {f.formattedDayStartTime || '—'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (>= sm screens) with Accordion */}
      <div className="hidden sm:block glass-card rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-800 border-collapse">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-4 px-4 w-10 text-center"></th>
                <th className="py-4 px-5">User</th>
                <th className="py-4 px-5">Place</th>
                <th className="py-4 px-5">Device Type</th>
                <th className="py-4 px-5">Crop</th>
                <th className="py-4 px-5 text-center">Farm Count</th>
                <th className="py-4 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => {
                const initial = (c.customerName || c.email).charAt(0).toUpperCase();
                const isExpanded = Boolean(expandedCustomers[c.customerId]);
                const userFarms = c.farms || [];

                return (
                  <React.Fragment key={c.customerId}>
                    {/* Primary Customer Row (Click row to toggle accordion) */}
                    <tr
                      onClick={() => toggleAccordion(c.customerId)}
                      onMouseEnter={() => prefetchCustomerDetail(c.customerId)}
                      className={`cursor-pointer transition-colors group select-none ${
                        isExpanded ? 'bg-emerald-50/50 hover:bg-emerald-50/70' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Accordion Chevron Trigger Column */}
                      <td className="py-4 pl-4 pr-1 align-middle text-center">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                            isExpanded
                              ? 'bg-[#00665E] text-white rotate-180 shadow-xs'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-emerald-100 group-hover:text-[#00665E]'
                          }`}
                        >
                          <ChevronDown className="w-4 h-4 transition-transform duration-200" />
                        </div>
                      </td>

                      {/* 1. User Column: Mail ID, Phone No, User ID, and Sub Status */}
                      <td className="py-4 px-5 align-middle">
                        <div className="flex items-start space-x-3.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#004D47]/10 to-emerald-100 border border-emerald-200 text-[#004D47] flex items-center justify-center font-bold text-sm shadow-xs shrink-0 mt-0.5">
                            {initial}
                          </div>

                          <div className="space-y-1">
                            {/* Name + User ID + Sub Status Badge */}
                            <div className="flex items-center flex-wrap gap-2">
                              <span className="font-bold text-slate-900 group-hover:text-[#00665E] transition-colors text-sm">
                                {c.customerName || 'Customer'}
                              </span>
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                ID: #{c.customerId}
                              </span>
                              {/* {renderSubStatusBadge(c.role, c.status)} */}
                            </div>

                            {/* Mail ID */}
                            <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-slate-700">{c.email}</span>
                            </div>

                            {/* Phone No */}
                            <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-mono">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{c.mobile || 'No phone recorded'}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Place Column */}
                      <td className="py-4 px-5 align-middle">
                        {c.place ? (
                          <div className="flex items-center space-x-1.5 text-xs font-medium text-slate-700">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{c.place}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">Not specified</span>
                        )}
                      </td>

                      {/* 3. Device Type Column */}
                      <td className="py-4 px-5 align-middle">
                        {c.deviceCategories && c.deviceCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {c.deviceCategories.map((cat) => renderDeviceTypeBadge(cat))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">No devices</span>
                        )}
                      </td>

                      {/* 4. Crop Column */}
                      <td className="py-4 px-5 align-middle">
                        {c.crops && c.crops.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {c.crops.slice(0, 3).map((crop) => (
                              <span
                                key={crop}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-[#00665E] border border-emerald-200/90 shadow-2xs"
                              >
                                <span>{getCropEmoji(crop)}</span>
                                <span>{crop}</span>
                              </span>
                            ))}
                            {c.crops.length > 3 && (
                              <span className="text-[11px] text-slate-500 font-semibold self-center px-1.5 py-0.5 rounded bg-slate-100">
                                +{c.crops.length - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs italic">—</span>
                        )}
                      </td>

                      {/* 5. Farm Count Column with Accordion Indicator */}
                      <td className="py-4 px-5 align-middle text-center">
                        <div
                          className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold border shadow-2xs transition-all ${
                            isExpanded
                              ? 'bg-[#00665E] border-[#00665E] text-white'
                              : 'bg-slate-100 border-slate-200 text-slate-800 group-hover:bg-emerald-50 group-hover:border-emerald-200 group-hover:text-[#00665E]'
                          }`}
                        >
                          <Sprout className={`w-3.5 h-3.5 ${isExpanded ? 'text-white' : 'text-[#00665E]'}`} />
                          <span>
                            {c.farmCount} {c.farmCount === 1 ? 'Farm' : 'Farms'}
                          </span>
                        </div>
                      </td>

                      {/* 6. Action Column: Eye for JSON & Right Arrow for Details */}
                      <td className="py-4 px-5 align-middle text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {/* Eye icon to view Customer JSON */}
                          <button
                            onClick={(e) => handleOpenCustomerJson(e, c)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-[#00665E] border border-slate-200 hover:border-emerald-300 shadow-2xs transition-all"
                            title="View Customer Raw Telemetry in JSON"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Arrow to navigate to Customer Profile */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCustomer(c.customerId);
                            }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-[#004D47] text-slate-500 hover:text-white border border-slate-200 hover:border-[#004D47] shadow-2xs transition-all group-hover:scale-105"
                            title="Go to Customer Details Page"
                          >
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Accordion Expanded Row: Shows All Farms for this Customer */}
                    {isExpanded && (
                      <tr className="bg-slate-50/70 border-y border-emerald-200/80 animate-fade-in">
                        <td colSpan={7} className="p-4 sm:p-6">
                          <div className="space-y-3.5 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
                            {/* Accordion Sub-Header */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                              <div className="flex items-center space-x-2.5">
                                <div className="p-1.5 rounded-lg bg-emerald-50 text-[#00665E] border border-emerald-200">
                                  <Sprout className="w-4 h-4" />
                                </div>
                                <div>
                                  <h3 className="text-sm font-bold text-slate-900">
                                    Farms for {c.customerName || c.email} ({userFarms.length}{' '}
                                    {userFarms.length === 1 ? 'Farm' : 'Farms'})
                                  </h3>
                                  <p className="text-[11px] text-slate-500">
                                    Click any farm name or action to open its dedicated monitoring dashboard
                                  </p>
                                </div>
                              </div>

                              <button
                                onClick={() => onSelectCustomer(c.customerId)}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#00665E] text-slate-700 hover:text-white border border-slate-200 hover:border-[#00665E] text-xs font-semibold transition-all self-start sm:self-auto"
                              >
                                <span>Customer Profile</span>
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Farms Sub-Table */}
                            {userFarms.length === 0 ? (
                              <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-400 italic">
                                No farms registered under this customer account.
                              </div>
                            ) : (
                              <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                                    <tr>
                                      <th className="py-3 px-4">Farm Name</th>
                                      <th className="py-3 px-4">Boundary Name</th>
                                      <th className="py-3 px-4">Crop</th>
                                      <th className="py-3 px-4">Last Reading Time</th>
                                      <th className="py-3 px-4">Day Start Time</th>
                                      <th className="py-3 px-4 text-center">Reading Count</th>
                                      <th className="py-3 px-4 text-center">JSON</th>
                                      <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 bg-white">
                                    {userFarms.map((f) => {
                                      const cropEmoji = getCropEmoji(f.crop);
                                      return (
                                        <tr
                                          key={f.farmId}
                                          onMouseEnter={() => prefetchFarmDetail({ farmId: f.farmId, range: '24h' })}
                                          className="hover:bg-slate-50/80 transition-colors group/farm"
                                        >
                                          {/* 1. Farm Name */}
                                          <td className="py-3 px-4 font-bold text-slate-900">
                                            <div
                                              onClick={() => navigate(`/farms/${f.farmId}`)}
                                              className="flex items-center space-x-2 cursor-pointer hover:text-[#00665E] transition-colors"
                                            >
                                              <Sprout className="w-3.5 h-3.5 text-[#00665E] shrink-0" />
                                              <span className="truncate max-w-[180px]">{f.name}</span>
                                            </div>
                                          </td>

                                          {/* 2. Boundary Name */}
                                          <td className="py-3 px-4 text-slate-700">
                                            <div className="flex items-center space-x-1.5">
                                              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                              <span className="truncate max-w-[160px] font-medium">
                                                {f.boundaryName || 'Main Plot'}
                                              </span>
                                            </div>
                                          </td>

                                          {/* 3. Crop */}
                                          <td className="py-3 px-4">
                                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-emerald-50 text-[#00665E] border border-emerald-200 font-semibold text-[11px]">
                                              <span>{cropEmoji}</span>
                                              <span>{f.crop || 'Crop set'}</span>
                                            </span>
                                          </td>

                                          {/* 4. Last Reading Come Time */}
                                          <td className="py-3 px-4">
                                            <div className="space-y-1">
                                              <div className="font-mono text-slate-800 flex items-center space-x-1.5 text-xs font-semibold">
                                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span>{f.formattedReadingTime || 'No readings'}</span>
                                              </div>
                                              <StatusBadge status={f.readingStatus || 'NO_DATA'} size="sm" />
                                            </div>
                                          </td>

                                          {/* 5. That Day Come Start Time */}
                                          <td className="py-3 px-4">
                                            <div className="font-mono text-slate-700 flex items-center space-x-1.5 text-xs">
                                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                              <span>{f.formattedDayStartTime || '—'}</span>
                                            </div>
                                          </td>

                                          {/* 6. How Many Reading Come Count */}
                                          <td className="py-3 px-4 text-center">
                                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200 shadow-2xs">
                                              <Activity className="w-3 h-3 text-teal-600" />
                                              <span>{f.readingCountToday ?? 0}</span>
                                            </span>
                                          </td>

                                          {/* 7. Eye Icon (Click to view last reading in JSON format) */}
                                          <td className="py-3 px-4 text-center">
                                            <button
                                              onClick={(e) => handleOpenFarmJson(e, c, f)}
                                              className="p-1.5 rounded-xl bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-[#00665E] border border-slate-200 hover:border-emerald-300 transition-all shadow-2xs"
                                              title="View Last Reading in JSON Format"
                                            >
                                              <Eye className="w-4 h-4" />
                                            </button>
                                          </td>

                                          {/* 8. Action (Monitor Farm) */}
                                          <td className="py-3 px-4 text-right">
                                            <button
                                              onClick={() => navigate(`/farms/${f.farmId}`)}
                                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-[#00665E] text-slate-700 hover:text-white border border-slate-200 hover:border-[#00665E] font-semibold text-[11px] transition-all"
                                              title="Open Farm Monitoring Page"
                                            >
                                              <span>Monitor</span>
                                              <ArrowRight className="w-3 h-3" />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-2 text-xs text-slate-500">
          <div>
            Showing Page <span className="font-bold text-slate-800">{page}</span> of{' '}
            <span className="font-bold text-slate-800">{totalPages}</span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs active:scale-95 font-semibold"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs active:scale-95 font-semibold"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Telemetry JSON Modal Popup */}
      <TelemetryJsonModal
        customer={modalCustomer}
        onClose={() => setModalCustomer(null)}
      />
    </div>
  );
};
