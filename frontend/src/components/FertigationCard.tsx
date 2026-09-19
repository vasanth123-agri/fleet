import React, { useState } from 'react';
import {
  Activity,
  Beaker,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Wifi,
  Droplets,
  MapPin,
  Calendar,
  Clock,
  Gauge,
  Sliders,
  ChevronDown,
  ChevronUp,
  History,
  Check,
  AlertCircle,
  Thermometer
} from 'lucide-react';
import { FertigationSummary } from '../types';

interface FertigationCardProps {
  fertigation: FertigationSummary | null | undefined;
}

export const FertigationCard: React.FC<FertigationCardProps> = ({ fertigation }) => {
  const [showLogs, setShowLogs] = useState(false);
  const [showAllProbes, setShowAllProbes] = useState(false);

  if (!fertigation || (!fertigation.lastReadingTime && fertigation.tanks.length === 0 && !fertigation.calibration)) {
    return (
      <div className="glass-card rounded-2xl p-6 flex flex-col items-center justify-center text-center space-y-2 text-slate-500 min-h-48 border border-dashed border-slate-200">
        <Beaker className="w-8 h-8 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">No Fertigation Unit Configured</span>
        <span className="text-xs text-slate-400">This customer/farm has not registered automated dosing hardware</span>
      </div>
    );
  }

  const getSystemBadge = (status: string) => {
    switch (status) {
      case 'READY':
        return {
          icon: CheckCircle2,
          text: 'READY',
          classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'ACTIVE':
        return {
          icon: Activity,
          text: 'ACTIVE DOSING',
          classes: 'bg-sky-50 text-sky-700 border-sky-200',
        };
      case 'ALERT':
        return {
          icon: AlertTriangle,
          text: 'ALERT',
          classes: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'FAILSAFE':
      case 'ESTOP':
        return {
          icon: ShieldAlert,
          text: status,
          classes: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      default:
        return {
          icon: Activity,
          text: status || 'ACTIVE',
          classes: 'bg-slate-100 text-slate-700 border-slate-200',
        };
    }
  };

  const getValidityBadge = (status: string, daysRemaining: number | null) => {
    if (status === 'VALID' || (daysRemaining !== null && daysRemaining > 7)) {
      return {
        icon: Check,
        text: `${daysRemaining !== null ? `${daysRemaining} Days Remaining` : 'Valid'}`,
        statusLabel: 'Active & Valid',
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        barColor: 'bg-emerald-500',
      };
    }
    if (status === 'EXPIRING_SOON' || (daysRemaining !== null && daysRemaining > 0 && daysRemaining <= 7)) {
      return {
        icon: AlertCircle,
        text: `${daysRemaining} Days Left`,
        statusLabel: 'Expiring Soon',
        classes: 'bg-amber-50 text-amber-700 border-amber-200',
        barColor: 'bg-amber-500',
      };
    }
    return {
      icon: AlertTriangle,
      text: 'Expired',
      statusLabel: 'Recalibration Required',
      classes: 'bg-rose-50 text-rose-700 border-rose-200',
      barColor: 'bg-rose-500',
    };
  };

  const badge = getSystemBadge(fertigation.systemStatus);
  const StatusIcon = badge.icon;
  const calibration = fertigation.calibration;
  const targetSettings = fertigation.targetSettings;
  const sensors = calibration?.sensors || [];
  const recentLogs = calibration?.recentCalibrationLogs || [];

  const displayedSensors = showAllProbes ? sensors : sensors.slice(0, 4);

  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6 space-y-6 shadow-sm border border-slate-200/90 bg-white">
      {/* 1. Header with System Connectivity and Overall Validity */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-[#00665E] border border-emerald-200 rounded-xl shadow-2xs">
            <Beaker className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                Fertigation & Automated Dosing Hub
              </h3>
            </div>
            <p className="text-xs text-slate-500 flex items-center space-x-1.5 mt-0.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {fertigation.formattedLastReadingTime
                  ? `Last telemetry sync: ${fertigation.formattedLastReadingTime}`
                  : 'Telemetry in standby mode'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sensor Validity Overall Pill */}
          {calibration && (
            <span
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                getValidityBadge(calibration.validityStatus, calibration.daysRemaining).classes
              }`}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>
                {calibration.daysRemaining !== null
                  ? `${calibration.daysRemaining} Days Validity Remaining`
                  : 'Calibrated'}
              </span>
            </span>
          )}

          {/* Cloud Connectivity */}
          <span
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
              fertigation.cloudOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
          >
            <Wifi className="w-3 h-3" />
            <span>{fertigation.cloudOnline ? 'CLOUD ONLINE' : 'OFFLINE'}</span>
          </span>

          {/* System State */}
          <span
            className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold border tracking-wider ${badge.classes}`}
          >
            <StatusIcon className="w-3.5 h-3.5" />
            <span>{badge.text}</span>
          </span>
        </div>
      </div>

      {/* 2. Primary Telemetry Values (Live EC, Live pH, Water Level, Temp) */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
            <Activity className="w-4 h-4 text-[#00665E]" />
            <span>Live Fertigation Telemetry & Nutrient Readings</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* EC Reading */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nutrient EC</span>
              {targetSettings?.targetEc !== null && targetSettings?.targetEc !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-100/70 text-[#00665E] font-medium">
                  Set: {targetSettings.targetEc}
                </span>
              )}
            </div>
            <div className="mt-1">
              <div className="text-2xl font-bold text-[#00665E] font-mono">
                {fertigation.ec !== null ? `${fertigation.ec}` : <span className="text-slate-400 text-lg font-normal">--</span>}
                <span className="text-xs font-sans font-normal text-slate-500 ml-1">mS/cm</span>
              </div>
              {(fertigation.m1_ec !== null || fertigation.m2_ec !== null) && (
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  M1: {fertigation.m1_ec ?? '--'} | M2: {fertigation.m2_ec ?? '--'}
                </div>
              )}
            </div>
          </div>

          {/* pH Reading */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Nutrient pH</span>
              {targetSettings?.targetPh !== null && targetSettings?.targetPh !== undefined && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 font-medium">
                  Set: {targetSettings.targetPh}
                </span>
              )}
            </div>
            <div className="mt-1">
              <div className="text-2xl font-bold text-sky-700 font-mono">
                {fertigation.ph !== null ? `${fertigation.ph}` : <span className="text-slate-400 text-lg font-normal">--</span>}
              </div>
              {(fertigation.m1_ph !== null || fertigation.m2_ph !== null) && (
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  M1: {fertigation.m1_ph ?? '--'} | M2: {fertigation.m2_ph ?? '--'}
                </div>
              )}
            </div>
          </div>

          {/* Mixing Water Level */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mixing Water Level</span>
            <div className="mt-1">
              <div className="text-2xl font-bold text-blue-600 font-mono flex items-center space-x-1">
                <Droplets className="w-5 h-5 text-blue-500 shrink-0" />
                <span>{fertigation.waterLevel !== null ? `${fertigation.waterLevel}` : '--'}</span>
                <span className="text-xs font-sans font-normal text-slate-500">
                  {fertigation.waterLevel !== null && fertigation.waterLevel <= 10 ? 'm' : '%'}
                </span>
              </div>
            </div>
          </div>

          {/* Temperature */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Solution Temp</span>
            <div className="mt-1">
              <div className="text-2xl font-bold text-amber-700 font-mono flex items-center space-x-1">
                <Thermometer className="w-5 h-5 text-amber-500 shrink-0" />
                <span>{fertigation.temperature !== null && fertigation.temperature !== undefined ? `${fertigation.temperature}` : '25.0'}</span>
                <span className="text-xs font-sans font-normal text-slate-500">°C</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Target Setpoints Recipe Strip */}
      {targetSettings && (
        <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <Sliders className="w-4 h-4 text-[#00665E]" />
            <span className="font-bold text-slate-800">Target Dosing Recipe:</span>
            <span className="text-slate-600">
              EC: <strong className="text-[#00665E] font-mono">{targetSettings.targetEc ?? '--'} mS/cm</strong> | pH: <strong className="text-sky-700 font-mono">{targetSettings.targetPh ?? '--'}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-slate-600">
            {targetSettings.totalNutrientTarget && (
              <span>Target Vol: <strong className="font-mono text-slate-800">{targetSettings.totalNutrientTarget} mL</strong></span>
            )}
            {(targetSettings.nitrogenRatio || targetSettings.phosphorusRatio || targetSettings.potassiumRatio) && (
              <span className="bg-white px-2 py-0.5 rounded-md border border-emerald-200 font-mono font-semibold text-[#00665E]">
                N:P:K = {targetSettings.nitrogenRatio ?? 1}:{targetSettings.phosphorusRatio ?? 1}:{targetSettings.potassiumRatio ?? 1}
              </span>
            )}
            {targetSettings.formattedUpdatedAt && (
              <span className="text-[11px] text-slate-400 font-mono">
                Updated: {targetSettings.formattedUpdatedAt}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. Nutrient Tank Fill Level Gauges */}
      {fertigation.tanks.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Nutrient Tank Capacities & Fill Levels ({fertigation.tanks.length} Tanks)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {fertigation.tanks.map((tank) => {
              const pct = tank.levelPercentage;
              let barColor = 'bg-[#00665E]';
              let statusText = 'Normal';
              if (pct !== null && pct < 20) {
                barColor = 'bg-rose-500';
                statusText = 'Low Level';
              } else if (pct !== null && pct < 40) {
                barColor = 'bg-amber-500';
                statusText = 'Moderate';
              }

              return (
                <div
                  key={tank.tankKey}
                  className="bg-slate-50 border border-slate-200/90 rounded-xl p-3 space-y-2 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800 truncate">{tank.name}</span>
                    <span className="text-slate-500 font-mono text-[11px] px-1.5 py-0.2 rounded bg-slate-200/60">
                      {tank.nutrient}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">Fill Level:</span>
                    <span className="font-bold text-slate-900 font-mono text-sm">
                      {pct !== null ? `${pct}%` : 'Standby'}
                    </span>
                  </div>

                  {pct !== null ? (
                    <div className="space-y-1">
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(100, Math.max(4, pct))}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{statusText}</span>
                        {tank.levelCm !== null && <span>{tank.levelCm} cm</span>}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full bg-slate-200/60 rounded-full h-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Calibration Location, Sensor Validity & Remaining Days Section */}
      {calibration && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Gauge className="w-4 h-4 text-[#00665E]" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Sensor Calibration Hub & Validity Lifespan
              </h4>
            </div>

            {calibration.daysRemaining !== null && (
              <span className="text-xs text-slate-500 font-medium">
                Cycle: <strong className="text-slate-800">{calibration.daysRemaining} days remaining</strong> before next probe calibration
              </span>
            )}
          </div>

          {/* Location & Last Calibration Summary Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Where Last Calibrated */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 md:col-span-2">
              <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <MapPin className="w-3.5 h-3.5 text-[#00665E]" />
                <span>Last Calibration Location</span>
              </div>
              <p className="text-sm font-bold text-slate-800">
                {calibration.lastCalibratedLocation || 'Primary Farm Fertigation Node'}
              </p>
              <p className="text-[11px] text-slate-500">
                Physical sensor probe rig configured and calibrated at this farm plot
              </p>
            </div>

            {/* When Last Calibrated & Days Remaining */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center space-x-1.5 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                  <Calendar className="w-3.5 h-3.5 text-[#00665E]" />
                  <span>Last Calibration Date</span>
                </div>
                <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">
                  {calibration.formattedLastCalibratedAt || 'Date not recorded'}
                </p>
              </div>

              <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 text-[11px]">Validity Status:</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] border ${
                    getValidityBadge(calibration.validityStatus, calibration.daysRemaining).classes
                  }`}
                >
                  {getValidityBadge(calibration.validityStatus, calibration.daysRemaining).statusLabel}
                </span>
              </div>
            </div>
          </div>

          {/* Individual Probes Breakdown (pH probe, EC probe, Indoor/Outdoor) */}
          {sensors.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider">
                  Active Probes Validity Lifespan ({sensors.length} Probes)
                </span>
                {sensors.length > 4 && (
                  <button
                    onClick={() => setShowAllProbes(!showAllProbes)}
                    className="text-[#00665E] font-semibold hover:underline flex items-center space-x-1"
                  >
                    <span>{showAllProbes ? 'Show Less' : `View All (${sensors.length})`}</span>
                    {showAllProbes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayedSensors.map((sensor) => {
                  const badgeInfo = getValidityBadge(sensor.validityStatus, sensor.daysRemaining);
                  const progressPct = sensor.validityDaysTotal
                    ? Math.max(0, Math.min(100, Math.round((sensor.daysRemaining / sensor.validityDaysTotal) * 100)))
                    : 100;

                  return (
                    <div
                      key={sensor.id}
                      className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 text-xs">{sensor.sensorName}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 uppercase">
                              {sensor.type}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-xs">{sensor.calibratedLocation}</p>
                        </div>

                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${badgeInfo.classes}`}>
                          {badgeInfo.text}
                        </span>
                      </div>

                      {/* Progress Bar of Remaining Days */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                          <span>{sensor.daysRemaining} days remaining</span>
                          <span>Cycle: {sensor.validityDaysTotal}d</span>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${badgeInfo.barColor}`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex justify-between text-[10px] text-slate-400 border-t border-slate-200/60 pt-1.5">
                        <span>Calibrated: {sensor.formattedStartDate ? sensor.formattedStartDate.split(',')[0] : 'N/A'}</span>
                        <span>Expires: {sensor.formattedEndDate ? sensor.formattedEndDate.split(',')[0] : 'N/A'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 6. Recent Calibration Audit Events Log (Collapsible) */}
          {recentLogs.length > 0 && (
            <div className="space-y-2 pt-2">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl border border-slate-200 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <History className="w-3.5 h-3.5 text-[#00665E]" />
                  <span>Recent Calibration & Parity Verification History ({recentLogs.length} Events)</span>
                </div>
                <div className="flex items-center space-x-1 text-[#00665E]">
                  <span>{showLogs ? 'Hide Details' : 'View Audit History'}</span>
                  {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </button>

              {showLogs && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden text-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider">
                          <th className="py-2 px-3 font-semibold">Sensor / Event</th>
                          <th className="py-2 px-3 font-semibold">Location / Node</th>
                          <th className="py-2 px-3 font-semibold">Date & Time (IST)</th>
                          <th className="py-2 px-3 font-semibold">Slope / Offset</th>
                          <th className="py-2 px-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                        {recentLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-100/60">
                            <td className="py-2 px-3 font-sans font-semibold text-slate-800">
                              <div>{log.title}</div>
                              <div className="text-[10px] text-slate-400 font-normal">{log.message}</div>
                            </td>
                            <td className="py-2 px-3 font-sans text-slate-600">
                              {log.location}
                              {log.deviceId && <span className="text-slate-400 block text-[10px]">Node: {log.deviceId}</span>}
                            </td>
                            <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                              {log.formattedTimestamp}
                            </td>
                            <td className="py-2 px-3 text-slate-600">
                              {log.slope !== null && log.slope !== undefined ? (
                                <div>
                                  <span>Slope: {log.slope}</span>
                                  {log.offset !== null && log.offset !== undefined && (
                                    <span className="block text-slate-400 text-[10px]">Offset: {log.offset}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400">Captured OK</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {log.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
