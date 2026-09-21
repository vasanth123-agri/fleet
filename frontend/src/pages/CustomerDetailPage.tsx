import React, { useState } from 'react';
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Sprout,
  Cpu,
  ChevronRight,
  RefreshCw,
  Clock,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { useGetCustomerDetailQuery } from '../store/fleetApi';
import { StatusBadge } from '../components/StatusBadge';
import { BatteryGauge } from '../components/BatteryGauge';
import { FertigationCard } from '../components/FertigationCard';
import { DeviceStatusList } from '../components/DeviceStatusList';
import { TelemetryJsonModal } from '../components/TelemetryJsonModal';
import { getCropEmoji } from '../utils/cropEmoji';

interface CustomerDetailPageProps {
  userId: number;
  onBack: () => void;
  onSelectFarm: (farmId: string) => void;
}

export const CustomerDetailPage: React.FC<CustomerDetailPageProps> = ({
  userId,
  onBack,
  onSelectFarm,
}) => {
  const [modalPayloadCustomer, setModalPayloadCustomer] = useState<any | null>(null);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetCustomerDetailQuery(userId);

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-12 sm:p-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
        <div className="w-10 h-10 border-2 border-[#00665E] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs sm:text-sm font-medium">Fetching customer telemetry profile...</span>
      </div>
    );
  }

  if (error || !data || !data.customer) {
    return (
      <div className="glass-card rounded-2xl p-8 sm:p-12 text-center space-y-4">
        <div className="flex justify-center">
          <AlertCircle className="w-8 h-8 text-rose-500" />
        </div>
        <p className="text-slate-700 font-medium text-sm">Customer record not found or error loading telemetry.</p>
        <button
          onClick={onBack}
          className="px-4 py-2.5 bg-[#00665E] text-white rounded-xl hover:bg-[#004D47] text-xs font-semibold shadow-xs"
        >
          Return to Customer List
        </button>
      </div>
    );
  }

  const { customer, farms = [], devices = [] } = data;
  const hasCustomerBattery = customer.battery && (customer.battery.percentage !== null || customer.battery.voltage !== null);

  return (
    <div className="space-y-5 sm:space-y-6 pb-12">
      {/* Back Button & Actions (Mobile Touch Friendly) */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onBack}
          className="flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-[#00665E] bg-white border border-slate-200 px-3 sm:px-3.5 py-2.5 rounded-xl transition-all shadow-xs hover:bg-slate-50 active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Fleet Overview</span>
        </button>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center space-x-2 px-3 sm:px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-xs active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-[#00665E]' : 'text-slate-500'}`} />
          <span>{isFetching ? 'Syncing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Customer Header Card (Clean & Mobile Focused) */}
      <div className="glass-card rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200/90 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5 sm:space-x-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#004D47] via-[#00665E] to-teal-600 text-white font-bold text-xl sm:text-2xl flex items-center justify-center shadow-md shrink-0">
              {(customer.customerName || customer.email).charAt(0).toUpperCase()}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                  {customer.customerName || 'Customer #' + customer.customerId}
                </h1>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-mono">
                  ID: #{customer.customerId}
                </span>
                
              </div>

              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-slate-500 pt-0.5">
                <span className="flex items-center space-x-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{customer.email}</span>
                </span>
                <span className="flex items-center space-x-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="font-mono">{customer.mobile}</span>
                </span>
                {customer.place && (
                  <span className="flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{customer.place}</span>
                  </span>
                )}
                <span className="flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Joined {customer.formattedCreatedAt || 'N/A'}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Customer Top Battery Badge - Only if customer has battery */}
          {hasCustomerBattery && (
            <div className="flex items-center sm:justify-end">
              <BatteryGauge battery={customer.battery} variant="icon" />
            </div>
          )}
        </div>
      </div>

      {/* Customer Farms Section - Mobile Responsive Detailed Cards */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Sprout className="w-5 h-5 text-[#00665E]" />
              <span>Customer Farms ({farms.length} {farms.length === 1 ? 'Farm' : 'Total Farms'})</span>
            </h2>
           
          </div>
        </div>

        {farms.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center text-slate-500 text-xs italic border border-dashed border-slate-200">
            No farms assigned to this customer account.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {farms.map((farm: any) => {
              const hasFarmBattery = farm.battery && (farm.battery.percentage !== null || farm.battery.voltage !== null);
              const cropName = farm.crop || farm.cropType || 'Crop set';
              const cropEmoji = getCropEmoji(cropName);

              return (
                <div
                  key={farm.farmId || farm.id}
                  onClick={() => onSelectFarm(farm.farmId || farm.id)}
                  className="glass-card glass-card-hover rounded-2xl p-4 sm:p-5 cursor-pointer space-y-3.5 group bg-white border border-slate-200 shadow-xs flex flex-col justify-between transition-all"
                >
                  <div className="space-y-3">
                    {/* Farm Header: Name, Crop Emoji Badge, Icon Battery, Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-base font-bold text-slate-900 group-hover:text-[#00665E] transition-colors truncate">
                            {farm.name}
                          </h3>
                          {/* Eye icon for farm-specific JSON inspection */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalPayloadCustomer({
                                ...customer,
                                customerName: `${customer.customerName || customer.email} (${farm.name})`,
                                latestReadingRaw: farm.latestReadingRaw || customer.latestReadingRaw,
                                formattedReadingTime: farm.formattedReadingTime || customer.formattedReadingTime,
                              });
                            }}
                            className="p-1 rounded text-slate-400 hover:text-[#00665E] hover:bg-emerald-50 border border-transparent hover:border-emerald-200 transition-all shrink-0"
                            title="View Farm Telemetry in JSON format"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Crop Badge with Emoji (Requested by user) */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-[#00665E] border border-emerald-200/80 shadow-2xs">
                            <span className="text-sm">{cropEmoji}</span>
                            <span>{cropName}</span>
                          </span>

                          {/* Battery Capacity in Icon Type (Requested by user) */}
                          {hasFarmBattery && (
                            <BatteryGauge battery={farm.battery} variant="icon" />
                          )}
                        </div>
                      </div>

                      <StatusBadge status={farm.readingStatus || customer.readingStatus} size="sm" />
                    </div>

                    {/* Data Origin & Transmitter Strip */}
                    {/* <div className="bg-slate-50 border border-slate-200/80 px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-1.5 truncate">
                        <Radio className="w-3.5 h-3.5 text-[#00665E] shrink-0 animate-pulse-subtle" />
                        <span className="text-slate-500 font-normal">Data Origin:</span>
                        <span className="font-semibold text-slate-800 truncate">{sourceOrigin}</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {farm.formattedReadingTime || 'No timestamp'}
                      </span>
                    </div> */}

                    {/* Farm Physical Properties (Compact Mobile Friendly) */}
                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">Total Area</span>
                        <span className="font-bold text-slate-800">
                          {farm.totalAreaAcres ? `${farm.totalAreaAcres.toFixed(2)} Acres` : `${farm.totalArea?.toFixed(1) || 0} m²`}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">Boundaries</span>
                        <span className="font-bold text-slate-800">{farm.boundaryCount || 0} plots</span>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] uppercase font-semibold block">IoT Devices</span>
                        <span className="font-bold text-teal-700">{farm.deviceCount || 0} nodes</span>
                      </div>
                    </div>

                  
                  </div>

                  {/* Footer with Sync Time & Monitor Action */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <span className="text-[11px] font-mono flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{farm.formattedReadingTime || 'No sync records'}</span>
                    </span>
                    <span className="flex items-center space-x-1 text-[#00665E] font-semibold group-hover:translate-x-0.5 transition-transform">
                      <span>Monitor Farm</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Fertigation Section - Only render if customer has fertigation hardware */}
      {customer.fertigation &&
        devices.some(
          (d: any) =>
            d.hasOutdoorFertigation ||
            d.hasIndoorFertigation ||
            d.deviceCategory?.toLowerCase().includes('fert')
        ) &&
        (customer.fertigation.lastReadingTime ||
          (customer.fertigation.tanks && customer.fertigation.tanks.length > 0) ||
          customer.fertigation.calibration) && (
          <div className="space-y-3.5">
            <h2 className="text-base font-bold text-slate-900">Fertigation Unit Oversight</h2>
            <FertigationCard fertigation={customer.fertigation} />
          </div>
        )}

      {/* Hardware Devices Inventory - Only render if customer has registered devices */}
      {devices && devices.length > 0 && (
        <div className="space-y-3.5">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-teal-700" />
            <span>Registered IoT Hardware Nodes & Actuators ({devices.length})</span>
          </h2>
          <DeviceStatusList devices={devices} />
        </div>
      )}

      {/* Telemetry Raw JSON Modal Popup */}
      <TelemetryJsonModal
        customer={modalPayloadCustomer}
        onClose={() => setModalPayloadCustomer(null)}
      />
    </div>
  );
};
