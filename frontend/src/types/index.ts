export type ReadingStatus = 'LIVE' | 'RECENT' | 'DELAYED' | 'OFFLINE' | 'NO_DATA';

export interface BatterySummary {
  percentage: number | null;
  voltage: number | null;
  current: number | null;
  isCharging: boolean | null;
  status: 'EXCELLENT' | 'GOOD' | 'LOW' | 'CRITICAL' | 'UNKNOWN';
}

export interface SensorValidityItem {
  id: string;
  sensor: 'ph' | 'ec';
  sensorName: string;
  type: 'indoor' | 'outdoor';
  deviceId: string | null;
  farmId: string | null;
  farmName: string | null;
  boundaryId: string | null;
  boundaryName: string | null;
  calibratedLocation: string;
  validityStartDate: string | null;
  formattedStartDate: string | null;
  validityEndDate: string | null;
  formattedEndDate: string | null;
  validityDaysTotal: number;
  daysRemaining: number;
  validityStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_CALIBRATED';
  status: string;
  lastCalibrationTitle?: string | null;
  lastCalibrationMessage?: string | null;
  slope?: number | null;
  offset?: number | null;
}

export interface FertigationCalibrationSummary {
  lastCalibratedAt: string | null;
  formattedLastCalibratedAt: string | null;
  lastCalibratedLocation: string | null;
  daysRemaining: number | null;
  validityStatus: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NOT_CALIBRATED';
  sensors: SensorValidityItem[];
  recentCalibrationLogs: Array<{
    id: string;
    timestamp: string;
    formattedTimestamp: string;
    sensor: string;
    title: string;
    message: string;
    deviceId: string | null;
    location: string | null;
    status: string;
    slope?: number | null;
    offset?: number | null;
  }>;
}

export interface FertigationTargetSettings {
  targetEc: number | null;
  targetPh: number | null;
  totalNutrientTarget: number | null;
  nitrogenRatio: number | null;
  phosphorusRatio: number | null;
  potassiumRatio: number | null;
  updatedAt: string | null;
  formattedUpdatedAt: string | null;
}

export interface FertigationSummary {
  lastReadingTime: string | null;
  formattedLastReadingTime: string | null;
  cloudOnline: boolean;
  systemStatus: 'READY' | 'ACTIVE' | 'ALERT' | 'FAILSAFE' | 'ESTOP' | 'UNKNOWN';
  ph: number | null;
  ec: number | null;
  m1_ph?: number | null;
  m2_ph?: number | null;
  m1_ec?: number | null;
  m2_ec?: number | null;
  temperature?: number | null;
  waterLevel: number | null;
  tanks: Array<{
    tankKey: string;
    name: string;
    nutrient: string;
    levelPercentage: number | null;
    levelCm: number | null;
  }>;
  targetSettings?: FertigationTargetSettings | null;
  calibration?: FertigationCalibrationSummary | null;
}

export interface CustomerDashboardSummary {
  customerId: number;
  customerName: string | null;
  email: string;
  mobile: string;
  place: string | null;
  status: string | null;
  role: string;
  createdAt: string | null;
  formattedCreatedAt: string | null;
  farmCount: number;
  crops: string[];
  deviceCount: number;
  deviceCategories: string[];
  latestReadingTime: string | null;
  formattedReadingTime: string | null;
  readingStatus: ReadingStatus;
  battery: BatterySummary | null;
  fertigation: FertigationSummary | null;
  farms?: FarmSummary[];
  latestReadingRaw?: any;
}

export interface FarmSummary {
  farmId: string;
  name: string;
  crop: string | null;
  cropType: string | null;
  totalArea: number;
  totalAreaAcres: number;
  location: { latitude?: number; longitude?: number } | null;
  boundaryCount: number;
  deviceCount: number;
  latestReadingTime: string | null;
  formattedReadingTime: string | null;
  readingStatus: ReadingStatus;
  battery?: BatterySummary | null;
  latestTelemetry?: any;
  latestReadingRaw?: any;
}

export interface FarmDetailResponse extends FarmSummary {
  userId: number;
  userName: string | null;
  email: string;
  mobileNumber: string;
  boundaries: Array<{
    id: string;
    name: string;
    area: number;
    areaAcres: number;
    cropType: string | null;
    plantId: number | null;
    color: string | null;
    coordinates: any;
  }>;
  devices: Array<{
    id: number;
    deviceId: string;
    deviceName: string;
    deviceCategory: string;
    cloudStatus: string;
    lastHeartbeatAt: string | null;
    formattedHeartbeatAt: string | null;
    failSafeStatus: string;
    lastAckAt?: string | null;
  }>;
}

export interface LatestReadingDTO {
  id: string;
  timestamp: string;
  formattedTimestamp: string;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  directRadiation: number | null;
  par: number | null;
  vpd: number | null;
  evapotranspiration: number | null;
  gdd: number | null;
  co2: number | null;
  soilTemperature: number | null;
  soilMoisture: number | null;
  soilElectroConductivity: number | null;
  soilNitrogen: number | null;
  soilPhosphorus: number | null;
  soilPotassium: number | null;
  phMaster: number | null;
  phSlave: number | null;
  tdsv: number | null;
  soilv: number | null;
  batteryPercentage: number | null;
  batteryVoltage: number | null;
  batteryCurrent: number | null;
  batteryChargingStatus: number | null;
  isCharging: boolean | null;
  readingStatus: ReadingStatus;
}

export interface BatteryHistoryPoint {
  timestamp: string;
  formattedTime: string;
  batteryPercentage: number | null;
  batteryVoltage: number | null;
  batteryCurrent: number | null;
  isCharging: boolean | null;
}

export interface EnvironmentalHistoryPoint {
  timestamp: string;
  formattedTime: string;
  temperature: number | null;
  humidity: number | null;
  co2: number | null;
  vpd: number | null;
  soilMoisture: number | null;
  soilTemperature: number | null;
  soilElectroConductivity: number | null;
  soilNitrogen: number | null;
  soilPhosphorus: number | null;
  soilPotassium: number | null;
  phMaster: number | null;
  par: number | null;
  directRadiation: number | null;
  nir: number | null;
  batteryPercentage: number | null;
  batteryVoltage: number | null;
  batteryCurrent: number | null;
  isCharging: boolean | null;
}

export interface FertigationHistoryPoint {
  timestamp: string;
  formattedTime: string;
  m1_ec: number | null;
  m2_ec: number | null;
  m1_ph: number | null;
  m2_ph: number | null;
  waterLevel: number | null;
  n1_pct: number | null;
  n2_pct: number | null;
  ph_up_pct: number | null;
  ph_dn_pct: number | null;
  t5_pct: number | null;
  cloud_online: boolean | null;
  ready: boolean | null;
  alert: number | null;
}

export interface DashboardOverviewMetrics {
  totalCustomers: number;
  totalFarms: number;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  statusBreakdown: {
    live: number;
    recent: number;
    delayed: number;
    offline: number;
    noData: number;
  };
  cropBreakdown: Array<{ crop: string; count: number }>;
}

export interface DeviceSummaryDTO {
  id: number;
  deviceId: string;
  deviceName: string;
  deviceCategory: string;
  selectedValve?: string | null;
  physicalState?: 'OPEN' | 'CLOSED' | 'ON' | 'OFF' | 'UNKNOWN';
  cloudStatus: string;
  lastHeartbeatAt: string | null;
  formattedHeartbeatAt: string | null;
  lastAckAt?: string | null;
  failSafeStatus: string;
  failSafeReason?: string | null;
  boundaryName?: string | null;
  cropType?: string | null;
}

export type ValvePhysicalState = 'OPEN' | 'CLOSED' | 'UNKNOWN';
export type AppliancePhysicalState = 'ON' | 'OFF' | 'UNKNOWN';

export interface ValveStatusDTO {
  valve: string;
  displayName: string;
  status: ValvePhysicalState;
  rawStatus?: string | number | null;
  lastStatusUpdate: string | null;
  formattedLastStatusUpdate: string | null;
  lastAckAt: string | null;
  formattedLastAckAt: string | null;
  statusTopic: string;
  isSessionActive?: boolean;
  activeSessionDurationMinutes?: number | null;
}

export interface ApplianceStatusDTO {
  deviceId: string;
  deviceName: string;
  deviceCategory: string;
  status: AppliancePhysicalState;
  rawStatus?: string | number | null;
  lastStatusUpdate: string | null;
  formattedLastStatusUpdate: string | null;
  lastAckAt: string | null;
  formattedLastAckAt: string | null;
  statusTopic: string;
  isRunning?: boolean;
  currentRuntimeSeconds?: number | null;
  lastRuntimeSeconds?: number | null;
  isSessionActive?: boolean;
  activeSessionDurationMinutes?: number | null;
}

export interface MonitoredDeviceDTO {
  id: number;
  deviceId: string;
  deviceName: string;
  deviceCategory: string;
  cloudStatus: 'ONLINE' | 'OFFLINE';
  lastHeartbeatAt: string | null;
  formattedHeartbeatAt: string | null;
  lastAckAt: string | null;
  formattedLastAckAt: string | null;
  failSafeStatus: string;
  failSafeReason: string | null;
  hasValveCapability: boolean;
  hasApplianceCapability: boolean;
  valves: ValveStatusDTO[];
  appliances: ApplianceStatusDTO[];
  lastReading: {
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
    evapotranspiration: number | null;
    gdd: number | null;
    batteryPercentage: number | null;
    batteryVoltage: number | null;
  } | null;
}

export interface MonitoredFarmDTO {
  farmId: string;
  farmName: string;
  place: string | null;
  crop: string | null;
  cropType: string | null;
  totalAreaAcres: number;
  devices: MonitoredDeviceDTO[];
}

export interface UserDeviceStatusDTO {
  userId: number;
  customerName: string;
  email: string;
  mobile: string;
  place: string | null;
  role: string;
  hasValveCapability: boolean;
  hasApplianceCapability: boolean;
  farms: MonitoredFarmDTO[];
}

export interface ValveApplianceSummaryMetrics {
  totalUsers: number;
  usersWithValves: number;
  usersWithAppliances: number;
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  totalValves: number;
  openValves: number;
  closedValves: number;
  unknownValves: number;
  totalAppliances: number;
  onAppliances: number;
  offAppliances: number;
  unknownAppliances: number;
}

