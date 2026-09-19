import React, { useState } from 'react';
import {
  ArrowLeft,
  Sprout,
  Thermometer,
  Droplets,
  Wind,
  Sun,
  Activity,
  Zap,
  Globe,
  RefreshCw,
  Clock,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useGetFarmDetailQuery } from '../store/fleetApi';
import { StatusBadge } from '../components/StatusBadge';
import { MetricCard } from '../components/MetricCard';
import { BatteryGauge } from '../components/BatteryGauge';
import { BatteryChart } from '../components/BatteryChart';
import { EnvironmentalChart } from '../components/EnvironmentalChart';
import { FertigationCard } from '../components/FertigationCard';
import { FertigationChart } from '../components/FertigationChart';
import { DateRangeSelector } from '../components/DateRangeSelector';
import { DeviceStatusList } from '../components/DeviceStatusList';
import { getCropEmoji } from '../utils/cropEmoji';

interface FarmMonitoringPageProps {
  farmId: string;
  onBack: () => void;
  onSelectCustomer: (userId: number) => void;
}

export const FarmMonitoringPage: React.FC<FarmMonitoringPageProps> = ({
  farmId,
  onBack,
  onSelectCustomer,
}) => {
  const [range, setRange] = useState<string>('24h');

  // RTK Query query hook
  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetFarmDetailQuery({ farmId, range });

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-16 flex flex-col items-center justify-center space-y-3 text-slate-500">
        <div className="w-10 h-10 border-2 border-[#00665E] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Acquiring farm sensor telemetry via RTK Query...</span>
      </div>
    );
  }

  if (error || !data || !data.farm) {
    return (
      <div className="glass-card rounded-2xl p-12 text-center space-y-4">
        <div className="flex justify-center">
          <AlertCircle className="w-8 h-8 text-rose-500" />
        </div>
        <p className="text-slate-700 font-medium">Farm telemetry profile not found or failed to load.</p>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-[#00665E] text-white rounded-xl hover:bg-[#004D47] text-xs font-semibold"
        >
          Return to Customer
        </button>
      </div>
    );
  }

  const {
    farm,
    latestReading,
    environmentalHistory = [],
    batteryHistory = [],
    fertigation,
    fertigationHistory = [],
    devices = [],
  } = data;

  const hasBattery =
    (batteryHistory &&
      batteryHistory.length > 0 &&
      batteryHistory.some((b) => b.batteryPercentage !== null || b.batteryVoltage !== null)) ||
    Boolean(
      latestReading &&
        (latestReading.batteryPercentage !== null || latestReading.batteryVoltage !== null)
    );

  const hasFertigation = Boolean(
    fertigation &&
      (fertigation.lastReadingTime ||
        (fertigation.tanks && fertigation.tanks.length > 0) ||
        fertigation.calibration)
  );

  const hasDevices = Boolean(devices && devices.length > 0);

  return (
    <div className="space-y-6 pb-16">
      {/* Back Button & Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-[#00665E] bg-white border border-slate-200 px-3.5 py-2 rounded-xl transition-all shadow-xs hover:bg-slate-50"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <button
            onClick={() => onSelectCustomer(farm.userId)}
            className="text-xs font-semibold text-slate-700 hover:text-[#00665E] bg-white border border-slate-200 px-3 py-2 rounded-xl transition-all shadow-xs flex items-center space-x-1.5"
          >
            <span className="text-slate-500">Customer:</span>
            <span className="text-[#00665E] font-bold">{farm.userName || farm.email}</span>
          </button>
        </div>

        <div className="flex items-center space-x-3">
          <DateRangeSelector selectedRange={range} onChangeRange={setRange} />

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 transition-all shadow-xs"
            title="Refresh Farm Readings"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-[#00665E]' : 'text-slate-500'}`} />
          </button>
        </div>
      </div>

      {/* Farm Profile Header Card */}
      <div className="glass-card rounded-2xl p-6 shadow-sm border border-slate-200/90">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
                <Sprout className="w-6 h-6 text-[#00665E]" />
                <span>{farm.name}</span>
              </h1>
              <StatusBadge status={farm.readingStatus} size="md" />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="flex items-center space-x-1.5 text-[#00665E] font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                <span className="text-sm">{getCropEmoji(farm.crop || farm.cropType)}</span>
                <span>Crop: {farm.crop || farm.cropType || 'Not specified'}</span>
              </span>

              <span className="flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  Area: {farm.totalAreaAcres ? `${farm.totalAreaAcres.toFixed(2)} Acres` : `${farm.totalArea?.toFixed(1) || 0} m²`}
                </span>
              </span>

              <span className="flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  {farm.location?.latitude && farm.location?.longitude
                    ? `${farm.location.latitude.toFixed(4)}° N, ${farm.location.longitude.toFixed(4)}° E`
                    : 'Location Coordinates Set'}
                </span>
              </span>

              <span className="flex items-center space-x-1.5 font-mono text-slate-600">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Sync: {farm.formattedReadingTime || 'No sync record'}</span>
              </span>
            </div>
          </div>

          {/* Farm Battery Quick Badge (Only if battery sensor present) */}
          {latestReading && (latestReading.batteryPercentage !== null || latestReading.batteryVoltage !== null) && (
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center justify-between gap-3 shrink-0">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                  Sensor Battery
                </span>
                <span className="text-[11px] font-mono font-medium text-slate-600">
                  {latestReading.formattedTimestamp}
                </span>
              </div>
              <BatteryGauge
                battery={{
                  percentage: latestReading.batteryPercentage,
                  voltage: latestReading.batteryVoltage,
                  current: latestReading.batteryCurrent,
                  isCharging: latestReading.isCharging,
                  status: 'GOOD',
                }}
                variant="icon"
              />
            </div>
          )}
        </div>
      </div>

      {/* Real-Time Environmental Sensor Telemetry Grid */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Activity className="w-4 h-4 text-[#00665E]" />
            <span>Latest IoT Environmental & Soil Telemetry</span>
          </h2>
          {latestReading && (
            <span className="text-xs font-mono text-slate-500">
              Timestamp: {latestReading.formattedTimestamp}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
          <MetricCard
            title="Air Temperature"
            value={latestReading?.temperature}
            unit="°C"
            icon={Thermometer}
            color="amber"
            subtitle="Ambient air sensor"
          />

          <MetricCard
            title="Relative Humidity"
            value={latestReading?.humidity}
            unit="%"
            icon={Droplets}
            color="cyan"
            subtitle="Air moisture saturation"
          />

          <MetricCard
            title="Carbon Dioxide"
            value={latestReading?.co2}
            unit="ppm"
            icon={Activity}
            color="emerald"
            subtitle="Canopy CO2 density"
          />

          <MetricCard
            title="Vapor Pressure Deficit"
            value={latestReading?.vpd}
            unit="kPa"
            icon={Activity}
            color="purple"
            subtitle="Transpiration driver"
          />

          <MetricCard
            title="Wind Speed"
            value={latestReading?.windSpeed}
            unit="m/s"
            icon={Wind}
            color="blue"
            subtitle="Anemometer reading"
          />

          <MetricCard
            title="Solar Radiation"
            value={latestReading?.directRadiation}
            unit="W/m²"
            icon={Sun}
            color="amber"
            subtitle="Solar pyranometer"
          />

          <MetricCard
            title="Soil Moisture"
            value={latestReading?.soilMoisture}
            unit="%"
            icon={Droplets}
            color="blue"
            subtitle="Root volumetric water"
            highlight={true}
          />

          <MetricCard
            title="Soil Temperature"
            value={latestReading?.soilTemperature}
            unit="°C"
            icon={Thermometer}
            color="amber"
            subtitle="Sub-surface soil temp"
          />

          <MetricCard
            title="Soil EC"
            value={latestReading?.soilElectroConductivity}
            unit="mS/cm"
            icon={Zap}
            color="emerald"
            subtitle="Pore water salinity"
            highlight={true}
          />

          <MetricCard
            title="Soil pH Master"
            value={latestReading?.phMaster}
            unit=""
            icon={Activity}
            color="purple"
            subtitle="Primary soil acidity"
          />

          <MetricCard
            title="Soil Nitrogen (N)"
            value={latestReading?.soilNitrogen}
            unit="mg/kg"
            icon={Sprout}
            color="emerald"
            subtitle="Nitrogen nutrient"
          />

          <MetricCard
            title="Soil Phosphorus (P)"
            value={latestReading?.soilPhosphorus}
            unit="mg/kg"
            icon={Sprout}
            color="cyan"
            subtitle="Phosphorus nutrient"
          />
        </div>
      </div>

      {/* Historical Environmental, Soil, Light & Battery Trends Tabs */}
      <div className="glass-card rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Environmental & Soil Trends ({range.toUpperCase()})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-sensor telemetry time-series: Plant & Soil, Microclimate, and Light
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {environmentalHistory.length} data points
          </span>
        </div>
        <EnvironmentalChart data={environmentalHistory} loading={isFetching} />
      </div>

      {/* Battery Monitoring Section - Only render if farm has battery data */}
      {hasBattery && (
        <div className="glass-card rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-[#00665E]" />
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Battery & Power Monitoring ({range.toUpperCase()})
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Node battery percentage and operating voltage
            </span>
          </div>

          {/* Real-time Vertical Battery Gauge Card */}
          {latestReading && (latestReading.batteryPercentage !== null || latestReading.batteryVoltage !== null) && (
            <BatteryGauge
              battery={{
                percentage: latestReading.batteryPercentage,
                voltage: latestReading.batteryVoltage,
                current: latestReading.batteryCurrent,
                isCharging: latestReading.isCharging,
                status: 'GOOD',
              }}
              variant="full"
            />
          )}

          <BatteryChart data={batteryHistory} loading={isFetching} />
        </div>
      )}

      {/* Fertigation Section - Only render if farm has active or history fertigation */}
      {hasFertigation && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">Fertigation & Hydroponic Oversight</h2>
          <FertigationCard fertigation={fertigation} />

          {fertigationHistory.length > 0 && (
            <div className="glass-card rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Fertigation Dosing Trends ({range.toUpperCase()})
                </h3>
                <span className="text-xs text-slate-500">
                  pH, EC, and tank level fluctuation
                </span>
              </div>
              <FertigationChart data={fertigationHistory} loading={isFetching} />
            </div>
          )}
        </div>
      )}

      {/* Connected IoT Devices - Only render if farm has devices */}
      {hasDevices && (
        <div className="space-y-3.5">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <span>Connected Hardware Nodes & Actuators ({devices.length})</span>
          </h2>
          <DeviceStatusList devices={devices} />
        </div>
      )}
    </div>
  );
};
