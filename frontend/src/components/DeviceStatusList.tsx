import React from 'react';
import {
  Wifi,
  WifiOff,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Zap,
  Droplets,
  Radio,
  Sparkles,
  BatteryCharging,
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
        badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
        iconClass: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    }
    if (lower.includes('indoor')) {
      return {
        label: '🌿 Indoor Fertigation',
        icon: Sparkles,
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200',
        iconClass: 'bg-teal-50 text-teal-700 border-teal-200',
      };
    }
    if (lower.includes('battery') || lower.includes('bcs')) {
      return {
        label: '🔋 Battery Sensor (BCS)',
        icon: BatteryCharging,
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        iconClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    }
    if (lower.includes('valve')) {
      return {
        label: '🚰 Valve Actuator',
        icon: Droplets,
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
        iconClass: 'bg-blue-50 text-blue-600 border-blue-200',
      };
    }
    if (lower.includes('ac') || lower.includes('appliance')) {
      return {
        label: '⚡ Appliance / Relay',
        icon: Zap,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        iconClass: 'bg-amber-50 text-amber-700 border-amber-200',
      };
    }
    if (lower.includes('pump')) {
      return {
        label: '💧 Irrigation Pump',
        icon: Droplets,
        badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        iconClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      };
    }
    return {
      label: `📡 ${cat || 'IoT Device'}`,
      icon: Radio,
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      iconClass: 'bg-slate-100 text-slate-600 border-slate-200',
    };
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {devices.map((device) => {
        const isOnline = (device.cloudStatus || '').toUpperCase() === 'ONLINE';
        const meta = getCategoryMeta(device.deviceCategory);
        const DeviceIcon = meta.icon;

        return (
          <div
            key={device.id || device.deviceId}
            className="glass-card glass-card-hover rounded-xl p-4 space-y-3 bg-white border border-slate-200 shadow-2xs"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`p-2.5 rounded-xl border ${meta.iconClass}`}>
                  <DeviceIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{device.deviceName || device.deviceId}</h4>
                  <p className="text-[11px] font-mono text-slate-500">ID: {device.deviceId}</p>
                </div>
              </div>

              <span
                className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isOnline
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                <span>{device.cloudStatus || 'ONLINE'}</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Primary Function</span>
                <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${meta.badgeClass}`}>
                  {meta.label}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">FailSafe State</span>
                <span className="font-medium text-slate-700 flex items-center space-x-1 mt-0.5">
                  {device.failSafeStatus === 'NORMAL' || !device.failSafeStatus ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>{device.failSafeStatus || 'NORMAL'}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-50">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Last Activity:</span>
              </span>
              <span className="font-mono font-medium text-slate-700">
                {device.formattedHeartbeatAt || 'Active'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
