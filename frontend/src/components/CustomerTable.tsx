import React from 'react';
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
} from 'lucide-react';
import { CustomerDashboardSummary } from '../types';
import { getCropEmoji } from '../utils/cropEmoji';

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

          return (
            <div
              key={c.customerId}
              onClick={() => onSelectCustomer(c.customerId)}
              className="glass-card glass-card-hover rounded-2xl p-4 bg-white border border-slate-200 shadow-xs space-y-3 active:scale-[0.99] transition-transform cursor-pointer"
            >
              {/* User Header */}
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
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-[#00665E] border border-emerald-200">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Place */}
              <div className="flex items-center space-x-1.5 text-xs text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="font-medium truncate">{c.place || 'Location unset'}</span>
              </div>

              {/* Device Types */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Device Types
                </div>
                {c.deviceCategories && c.deviceCategories.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {c.deviceCategories.map((cat) => renderDeviceTypeBadge(cat))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">No devices</span>
                )}
              </div>

              {/* Crops & Farm Count Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                {/* Crops */}
                <div className="flex items-center space-x-1 min-w-0">
                  {c.crops && c.crops.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {c.crops.slice(0, 2).map((crop) => (
                        <span
                          key={crop}
                          className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-[#00665E] border border-emerald-200"
                        >
                          <span>{getCropEmoji(crop)}</span>
                          <span>{crop}</span>
                        </span>
                      ))}
                      {c.crops.length > 2 && (
                        <span className="text-[10px] text-slate-500 font-medium self-center">
                          +{c.crops.length - 2}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">No crops</span>
                  )}
                </div>

                {/* Farm Count */}
                <div className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-800 shrink-0">
                  <Sprout className="w-3.5 h-3.5 text-[#00665E]" />
                  <span>{c.farmCount} {c.farmCount === 1 ? 'Farm' : 'Farms'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (>= sm screens) */}
      <div className="hidden sm:block glass-card rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-800 border-collapse">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-4 px-5">User</th>
                <th className="py-4 px-5">Place</th>
                <th className="py-4 px-5">Device Type</th>
                <th className="py-4 px-5">Crop</th>
                <th className="py-4 px-5 text-center">Farm Count</th>
                <th className="py-4 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => {
                const initial = (c.customerName || c.email).charAt(0).toUpperCase();

                return (
                  <tr
                    key={c.customerId}
                    onClick={() => onSelectCustomer(c.customerId)}
                    className="hover:bg-emerald-50/40 cursor-pointer transition-colors group"
                  >
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
                            {renderSubStatusBadge(c.role, c.status)}
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

                    {/* 3. Device Type Column (what are the type of devices this user has) */}
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

                    {/* 5. Farm Count Column */}
                    <td className="py-4 px-5 align-middle text-center">
                      <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-slate-100 border border-slate-200 text-slate-800 shadow-2xs group-hover:bg-emerald-50 group-hover:border-emerald-200 group-hover:text-[#00665E] transition-all">
                        <Sprout className="w-3.5 h-3.5 text-[#00665E]" />
                        <span>{c.farmCount} {c.farmCount === 1 ? 'Farm' : 'Farms'}</span>
                      </div>
                    </td>

                    {/* 6. Action Column: Right Arrow Icon (Navigates to Next Page) */}
                    <td className="py-4 px-5 align-middle text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCustomer(c.customerId);
                        }}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-[#004D47] text-slate-500 hover:text-white border border-slate-200 hover:border-[#004D47] shadow-2xs transition-all duration-200 group-hover:scale-105"
                        title="View Customer Fleet Details"
                      >
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </td>
                  </tr>
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
    </div>
  );
};
