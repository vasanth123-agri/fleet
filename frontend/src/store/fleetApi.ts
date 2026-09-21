import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  CustomerDashboardSummary,
  FarmSummary,
  FarmDetailResponse,
  LatestReadingDTO,
  EnvironmentalHistoryPoint,
  BatteryHistoryPoint,
  FertigationSummary,
  FertigationHistoryPoint,
  DashboardOverviewMetrics,
  DeviceSummaryDTO,
  UserDeviceStatusDTO,
  ValveApplianceSummaryMetrics,
} from '../types';

export interface CustomerQueryParams {
  search?: string;
  status?: string;
  crop?: string;
  deviceCategory?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  fresh?: boolean;
}

export interface CustomerListResponse {
  data: CustomerDashboardSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CustomerDetailResponse {
  customer: CustomerDashboardSummary;
  farms: FarmSummary[];
  devices: DeviceSummaryDTO[];
}

export interface FarmDetailApiResponse {
  farm: FarmDetailResponse;
  latestReading: LatestReadingDTO | null;
  latestReadingRaw?: any;
  environmentalHistory: EnvironmentalHistoryPoint[];
  batteryHistory: BatteryHistoryPoint[];
  fertigation: FertigationSummary | null;
  fertigationHistory: FertigationHistoryPoint[];
  devices: DeviceSummaryDTO[];
}

export interface FarmTelemetryParams {
  farmId: string;
  range?: string;
  from?: string;
  to?: string;
  fresh?: boolean;
}

export interface ValveApplianceQueryParams {
  userId?: number;
  farmId?: string;
  deviceId?: string;
  deviceCategory?: string;
  status?: string;
  search?: string;
  forceFresh?: boolean;
}

export interface ValveApplianceStatusResponse {
  users: UserDeviceStatusDTO[];
  summary: ValveApplianceSummaryMetrics;
}

export const fleetApi = createApi({
  reducerPath: 'fleetApi',
  baseQuery: fetchBaseQuery({ baseUrl: import.meta.env.VITE_API_BASE_URL || '/api' }),
  keepUnusedDataFor: 300, // 5 minutes cache retention for fast navigation
  tagTypes: ['Customers', 'CustomerDetail', 'FarmTelemetry', 'Overview', 'ValvesAppliances'],
  endpoints: (builder) => ({
    getValveApplianceStatus: builder.query<ValveApplianceStatusResponse, ValveApplianceQueryParams | void>({
      query: (params) => {
        const p = params || {};
        const queryParams = new URLSearchParams();
        if (p.userId) queryParams.append('userId', p.userId.toString());
        if (p.farmId) queryParams.append('farmId', p.farmId);
        if (p.deviceId) queryParams.append('deviceId', p.deviceId);
        if (p.deviceCategory) queryParams.append('deviceCategory', p.deviceCategory);
        if (p.status) queryParams.append('status', p.status);
        if (p.search) queryParams.append('search', p.search);
        if (p.forceFresh) queryParams.append('forceFresh', 'true');

        const qs = queryParams.toString();
        return `/valves-appliances/status${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (response: { success: boolean; data: ValveApplianceStatusResponse }) =>
        response.data || { users: [], summary: {} as any },
      providesTags: ['ValvesAppliances'],
      keepUnusedDataFor: 60,
    }),

    getValveApplianceSummary: builder.query<ValveApplianceSummaryMetrics, boolean | void>({
      query: (forceFresh) => `/valves-appliances/summary${forceFresh ? '?forceFresh=true' : ''}`,
      transformResponse: (response: { success: boolean; data: ValveApplianceSummaryMetrics }) => response.data,
      providesTags: ['ValvesAppliances'],
      keepUnusedDataFor: 60,
    }),

    getCustomers: builder.query<CustomerListResponse, CustomerQueryParams | void>({
      query: (params) => {
        const p = params || {};
        const queryParams = new URLSearchParams();
        if (p.search) queryParams.append('search', p.search);
        if (p.status) queryParams.append('status', p.status);
        if (p.crop) queryParams.append('crop', p.crop);
        if (p.deviceCategory) queryParams.append('deviceCategory', p.deviceCategory);
        if (p.page) queryParams.append('page', p.page.toString());
        if (p.limit) queryParams.append('limit', p.limit.toString());
        if (p.sortBy) queryParams.append('sortBy', p.sortBy);
        if (p.sortOrder) queryParams.append('sortOrder', p.sortOrder);
        if (p.fresh) queryParams.append('fresh', 'true');

        const qs = queryParams.toString();
        return `/customers${qs ? `?${qs}` : ''}`;
      },
      transformResponse: (response: any) => ({
        data: response.data || [],
        pagination: response.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ customerId }) => ({ type: 'Customers' as const, id: customerId })),
              { type: 'Customers', id: 'LIST' },
            ]
          : [{ type: 'Customers', id: 'LIST' }],
      keepUnusedDataFor: 300,
    }),

    getOverviewStats: builder.query<DashboardOverviewMetrics, boolean | void>({
      query: (fresh) => `/customers/overview/metrics${fresh ? '?fresh=true' : ''}`,
      transformResponse: (response: { success: boolean; data: DashboardOverviewMetrics }) => response.data,
      providesTags: ['Overview'],
      keepUnusedDataFor: 300,
    }),

    getCustomerDetail: builder.query<CustomerDetailResponse, number | string | { customerId: number | string; fresh?: boolean }>({
      query: (arg) => {
        const id = typeof arg === 'object' ? arg.customerId : arg;
        const fresh = typeof arg === 'object' ? arg.fresh : false;
        return `/customers/${id}${fresh ? '?fresh=true' : ''}`;
      },
      transformResponse: (response: any): CustomerDetailResponse => {
        const raw = response.data;
        const u = raw.user || {};

        const devList = raw.devices || [];
        const hasFertigationCapability = devList.some(
          (d: any) =>
            d.hasOutdoorFertigation ||
            d.hasIndoorFertigation ||
            (d.deviceCategory && d.deviceCategory.toLowerCase().includes('fert'))
        );

        let fertigation: FertigationSummary | null = null;
        if (hasFertigationCapability && (raw.latestOutdoorReading || (raw.fertigation && raw.fertigation.tanks))) {
          const outdoor = raw.latestOutdoorReading;
          const tanksConfig = raw.fertigation?.tanks || [];

          fertigation = {
            lastReadingTime: outdoor?.timestamp || null,
            formattedLastReadingTime: outdoor?.formattedTimestamp || null,
            cloudOnline: outdoor?.cloud_online ?? false,
            systemStatus: outdoor?.ready ? 'READY' : (outdoor?.alert ? 'ALERT' : 'ACTIVE'),
            ph: outdoor?.m2_ph ?? outdoor?.m1_ph ?? null,
            ec: outdoor?.m2_ec ?? outdoor?.m1_ec ?? null,
            waterLevel: outdoor?.waterLevel ?? null,
            tanks: tanksConfig.map((t: any) => ({
              tankKey: t.tankKey,
              name: t.name || t.nutrient || t.tankKey,
              nutrient: t.nutrient || 'General',
              levelPercentage:
                t.tankKey === 'tank-1' || t.tankKey === 'n1'
                  ? outdoor?.n1_pct ?? null
                  : t.tankKey === 'tank-2' || t.tankKey === 'n2'
                  ? outdoor?.n2_pct ?? null
                  : t.tankKey === 'ph_up'
                  ? outdoor?.ph_up_pct ?? null
                  : t.tankKey === 'ph_dn'
                  ? outdoor?.ph_dn_pct ?? null
                  : t.tankKey === 'tank-5' || t.tankKey === 't5'
                  ? outdoor?.t5_pct ?? null
                  : null,
              levelCm: null,
            })),
          };
        }

        const customer: CustomerDashboardSummary = {
          customerId: u.id,
          customerName: u.userName || (u.email ? u.email.split('@')[0] : 'Customer #' + u.id),
          email: u.email || '',
          mobile: u.mobileNumber || '',
          place: u.area || null,
          status: u.status || 'ACTIVE',
          role: String(u.role || 'TRIAL'),
          createdAt: u.createdAt || null,
          formattedCreatedAt: u.formattedCreatedAt || null,
          farmCount: raw.farms?.length || u.farmCount || 0,
          crops: raw.farms?.map((f: any) => f.plantName || f.crop).filter(Boolean) || [],
          deviceCount: raw.devices?.length || u.deviceCount || 0,
          deviceCategories: Array.from(new Set((raw.devices || []).map((d: any) => d.deviceCategory).filter(Boolean))) as string[],
          latestReadingTime: u.latestReadingTime || null,
          formattedReadingTime: u.formattedReadingTime || null,
          readingStatus: u.readingStatus || 'NO_DATA',
          battery: u.battery || null,
          fertigation,
          latestReadingRaw: raw.latestEnvironmentalReading || raw.latestOutdoorReading || null,
        };

        const farms: FarmSummary[] = (raw.farms || []).map((f: any) => ({
          farmId: f.id,
          name: f.name,
          crop: f.crop || f.plantName || null,
          cropType: f.cropType || f.plantName || null,
          totalArea: f.totalArea || 0,
          totalAreaAcres: f.totalAreaAcres || 0,
          location: f.location || null,
          boundaryCount: f.boundaryCount || (f.boundaries?.length || 0),
          deviceCount: f.deviceCount || (f.devices?.length || 0),
          latestReadingTime: f.latestReadingTime || null,
          formattedReadingTime: f.formattedReadingTime || null,
          readingStatus: f.readingStatus || 'LIVE',
          battery: f.battery || null,
          latestTelemetry: f.latestTelemetry || null,
          latestReadingRaw: f.latestReadingRaw || null,
        }));

        const devices: DeviceSummaryDTO[] = (raw.devices || []).map((d: any) => ({
          id: d.id,
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          deviceCategory: d.deviceCategory,
          cloudStatus: d.cloudStatus || 'ONLINE',
          lastHeartbeatAt: d.lastHeartbeatAt,
          formattedHeartbeatAt: d.formattedHeartbeatAt,
          lastAckAt: d.lastAckAt,
          failSafeStatus: d.failSafeStatus || 'NORMAL',
          failSafeReason: d.failSafeReason,
          farmId: d.farmId,
          boundaryId: d.boundaryId,
        }));

        return { customer, farms, devices };
      },
      providesTags: (_result, _error, arg) => {
        const id = typeof arg === 'object' ? arg.customerId : arg;
        return [{ type: 'CustomerDetail', id }];
      },
      keepUnusedDataFor: 300,
    }),

    getFarmDetail: builder.query<FarmDetailApiResponse, FarmTelemetryParams>({
      query: ({ farmId, range = '24h', from, to, fresh }) => {
        const queryParams = new URLSearchParams();
        if (range) queryParams.append('range', range);
        if (from) queryParams.append('from', from);
        if (to) queryParams.append('to', to);
        if (fresh) queryParams.append('fresh', 'true');
        const qStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
        return `/farms/${farmId}/full-telemetry${qStr}`;
      },
      transformResponse: (response: any): FarmDetailApiResponse => {
        const data = response.data || {};
        return {
          farm: data.farm,
          latestReading: data.latestReading || null,
          latestReadingRaw: data.latestReadingRaw || null,
          environmentalHistory: data.environmentalHistory || [],
          batteryHistory: data.batteryHistory || [],
          fertigation: data.fertigation || null,
          fertigationHistory: data.fertigationHistory || [],
          devices: data.devices || [],
        };
      },
      providesTags: (_result, _error, { farmId }) => [{ type: 'FarmTelemetry', id: farmId }],
      keepUnusedDataFor: 300,
    }),
  }),
});

export const {
  useGetValveApplianceStatusQuery,
  useGetValveApplianceSummaryQuery,
  useGetCustomersQuery,
  useGetOverviewStatsQuery,
  useGetCustomerDetailQuery,
  useGetFarmDetailQuery,
  useLazyGetCustomersQuery,
  useLazyGetFarmDetailQuery,
  useLazyGetValveApplianceStatusQuery,
} = fleetApi;