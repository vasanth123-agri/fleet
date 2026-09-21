import {
  CustomerDashboardSummary,
  DashboardOverviewMetrics,
  FarmDetailResponse,
  FarmSummary,
  LatestReadingDTO,
  BatteryHistoryPoint,
  EnvironmentalHistoryPoint,
  FertigationSummary,
  FertigationHistoryPoint,
  DeviceSummaryDTO,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function fetchOverview(): Promise<DashboardOverviewMetrics> {
  const res = await fetch(`${API_BASE}/dashboard/overview`);
  if (!res.ok) throw new Error('Failed to fetch dashboard overview');
  const json = await res.json();
  return json.data;
}

export interface FetchCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  crop?: string;
  status?: string;
  deviceCategory?: string;
}

export async function fetchCustomers(params: FetchCustomersParams = {}): Promise<{
  customers: CustomerDashboardSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.search) query.set('search', params.search);
  if (params.crop) query.set('crop', params.crop);
  if (params.status) query.set('status', params.status);
  if (params.deviceCategory) query.set('deviceCategory', params.deviceCategory);

  const res = await fetch(`${API_BASE}/customers?${query.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch customers');
  const json = await res.json();
  return {
    customers: json.data,
    pagination: json.pagination,
  };
}

export async function fetchCustomerDetails(userId: number): Promise<{
  user: any;
  farms: FarmSummary[];
  devices: DeviceSummaryDTO[];
  fertigation: any;
  latestEnvironmentalReading: LatestReadingDTO | null;
  latestOutdoorReading: any | null;
}> {
  const res = await fetch(`${API_BASE}/customers/${userId}`);
  if (!res.ok) throw new Error(`Failed to fetch customer #${userId}`);
  const json = await res.json();
  return json.data;
}

export async function fetchFarmDetails(farmId: string): Promise<FarmDetailResponse> {
  const res = await fetch(`${API_BASE}/farms/${farmId}`);
  if (!res.ok) throw new Error(`Failed to fetch farm #${farmId}`);
  const json = await res.json();
  return json.data;
}

export async function fetchLatestReading(farmId: string): Promise<LatestReadingDTO | null> {
  const res = await fetch(`${API_BASE}/farms/${farmId}/latest-reading`);
  if (!res.ok) throw new Error(`Failed to fetch latest reading for farm #${farmId}`);
  const json = await res.json();
  return json.data;
}

export async function fetchEnvironmentalHistory(
  farmId: string,
  range: string = '24h',
  from?: string,
  to?: string
): Promise<EnvironmentalHistoryPoint[]> {
  const query = new URLSearchParams({ range });
  if (from) query.set('from', from);
  if (to) query.set('to', to);

  const res = await fetch(`${API_BASE}/farms/${farmId}/environmental-history?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch environmental history for farm #${farmId}`);
  const json = await res.json();
  return json.data;
}

export async function fetchBatteryHistory(
  farmId: string,
  range: string = '24h',
  from?: string,
  to?: string
): Promise<BatteryHistoryPoint[]> {
  const query = new URLSearchParams({ range });
  if (from) query.set('from', from);
  if (to) query.set('to', to);

  const res = await fetch(`${API_BASE}/farms/${farmId}/battery-history?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch battery history for farm #${farmId}`);
  const json = await res.json();
  return json.data;
}

export async function fetchFarmDevices(farmId: string): Promise<DeviceSummaryDTO[]> {
  const res = await fetch(`${API_BASE}/farms/${farmId}/devices`);
  if (!res.ok) throw new Error(`Failed to fetch devices for farm #${farmId}`);
  const json = await res.json();
  return json.data;
}

export async function fetchLatestFertigation(farmId: string): Promise<FertigationSummary | null> {
  const res = await fetch(`${API_BASE}/farms/${farmId}/fertigation/latest`);
  if (!res.ok) throw new Error(`Failed to fetch latest fertigation for farm #${farmId}`);
  const json = await res.json();
  return json.data;
}

export async function fetchFertigationHistory(
  farmId: string,
  range: string = '24h',
  from?: string,
  to?: string
): Promise<FertigationHistoryPoint[]> {
  const query = new URLSearchParams({ range });
  if (from) query.set('from', from);
  if (to) query.set('to', to);

  const res = await fetch(`${API_BASE}/farms/${farmId}/fertigation/history?${query.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch fertigation history for farm #${farmId}`);
  const json = await res.json();
  return json.data;
}
