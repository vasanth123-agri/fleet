import React from 'react';
import {
  Wifi,
  WifiOff,
  Zap,
  Power,
  Droplets,
  Radio,
  Sparkles,
  BatteryCharging,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { DeviceSummaryDTO } from '../types';

interface DeviceStatusListProps {
  devices: DeviceSummaryDTO[];
}

export const DeviceStatusList: React.FC<DeviceStatusListProps> = ({ devices }) => {
  if (!devices || devices.length === 0) {
    return null;
  }

  const getCategoryMeta = (cat?: string) => {
    const lower = (cat || '').toLowerCase();
    if (lower.includes('outdoor')) {
      return {
        label: '🧪 Outdoor Fertigation',
        icon: Sparkles,
        iconClass: 'bg-purple-50 text-purple-700 border-purple-200',
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
        isValve: false,
        isAppliance: false,
      };
    }
    if (lower.includes('indoor')) {
      return {
        label: '🌿 Indoor Fertigation',
        icon: Sparkles,
        iconClass: 'bg-teal-50 text-teal-700 border-teal-200',
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
        isValve: false,
        isAppliance: false,
      };
    }
    if (lower.includes('battery') || lower.includes('bcs')) {
      return {
        label: '🔋 Battery Sensor (BCS)',
        icon: BatteryCharging,
        iconClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        isValve: false,
        isAppliance: false,
      };
    }
    if (lower.includes('valve')) {
      return {
        label: '🚰 Solenoid Valve',
        icon: Droplets,
        iconClass: 'bg-blue-50 text-blue-700 border-blue-200',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
        isValve: true,
        isAppliance: false,
      };
    }
    if (lower.includes('ac') || lower.includes('appliance')) {
      return {
        label: '⚡ Appliance Relay',
        icon: Zap,
        iconClass: 'bg-amber-50 text-amber-800 border-amber-200',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        isValve: false,
        isAppliance: true,
      };
    }
    if (lower.includes('pump')) {
      return {
        label: '💧 Irrigation Pump',
        icon: Power,
        iconClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        isValve: false,
        isAppliance: true,
      };
    }
    if (lower.includes('fan') || lower.includes('socket')) {
      return {
        label: '⚡ Relay Switch',
        icon: Zap,
        iconClass: 'bg-amber-50 text-amber-800 border-amber-200',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        isValve: false,
        isAppliance: true,
      };
    }
    return {
      label: `📡 ${cat || 'IoT Device'}`,
      icon: Radio,
      iconClass: 'bg-slate-100 text-slate-600 border-slate-200',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      isValve: false,
      isAppliance: false,
    };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {devices.map((device) => {
        const isOnline = (device.cloudStatus || '').toUpperCase() === 'ONLINE';
        const meta = getCategoryMeta(device.deviceCategory);
        const DeviceIcon = meta.icon;

        // Resolve ON / OFF or OPEN / CLOSE
        const isValve = meta.isValve;
        const isAppliance = meta.isAppliance;
        const rawState = (device.physicalState || 'UNKNOWN').toUpperCase();

        const isOpen = rawState === 'OPEN' || rawState === 'ON';
        const isClosed = rawState === 'CLOSED' || rawState === 'OFF';

        return (
          <div
            key={device.id || device.deviceId}
            className={`rounded-2xl p-4 transition-all border ${
              isValve && isOpen
                ? 'bg-gradient-to-br from-emerald-50/90 to-emerald-100/60 border-emerald-300 shadow-xs'
                : isAppliance && isOpen
                ? 'bg-gradient-to-br from-teal-50/90 to-emerald-50/60 border-teal-300 shadow-xs'
                : 'bg-white border-slate-200/90 shadow-2xs'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              {/* Left: Device Icon & Name */}
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`p-2.5 rounded-xl border shrink-0 ${meta.iconClass}`}>
                  <DeviceIcon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {device.deviceName || device.deviceId}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-mono font-semibold text-slate-500">
                      {device.deviceId}
                    </span>
                    <span className="text-[10px] text-slate-300">&bull;</span>
                    <span className="text-[10px] font-semibold text-slate-600">
                      {meta.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: State Pill (OPEN / CLOSED / ON / OFF) */}
              <div className="shrink-0 flex items-center gap-2">
                {isValve ? (
                  <span
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${
                      isOpen
                        ? 'bg-emerald-600 text-white animate-pulse-subtle'
                        : isClosed
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isOpen ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        OPEN
                      </>
                    ) : isClosed ? (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-slate-500" />
                        CLOSED
                      </>
                    ) : (
                      <>
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                        UNKNOWN
                      </>
                    )}
                  </span>
                ) : isAppliance ? (
                  <span
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-2xs ${
                      isOpen
                        ? 'bg-[#00665E] text-white animate-pulse-subtle'
                        : isClosed
                        ? 'bg-slate-100 text-slate-700 border border-slate-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isOpen ? (
                      <>
                        <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                        ON
                      </>
                    ) : isClosed ? (
                      <>
                        <Power className="w-3.5 h-3.5 text-slate-500" />
                        OFF
                      </>
                    ) : (
                      <>
                        <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                        UNKNOWN
                      </>
                    )}
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-xs font-semibold border ${
                      isOnline
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}
                  >
                    {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    <span>{device.cloudStatus || 'ONLINE'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
