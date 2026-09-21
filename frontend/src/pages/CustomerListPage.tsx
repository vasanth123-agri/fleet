import React, { useState, useEffect } from 'react';
import {
  Users,
  Sprout,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useGetOverviewStatsQuery, useGetCustomersQuery } from '../store/fleetApi';
import { CustomerTable } from '../components/CustomerTable';
import { DashboardFilters } from '../components/DashboardFilters';

interface CustomerListPageProps {
  onSelectCustomer: (customerId: number) => void;
}

export const CustomerListPage: React.FC<CustomerListPageProps> = ({
  onSelectCustomer,
}) => {
  // Filter & Pagination State
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [crop, setCrop] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [deviceCategory, setDeviceCategory] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // RTK Query hooks
  const {
    data: overview,
    refetch: refetchOverview,
    isFetching: isOverviewFetching,
  } = useGetOverviewStatsQuery();

  const {
    data: customerResponse,
    isLoading: isCustomersLoading,
    isFetching: isCustomersFetching,
    error: customerError,
    refetch: refetchCustomers,
  } = useGetCustomersQuery({
    page,
    limit: 10,
    search: debouncedSearch,
    crop,
    status,
    deviceCategory,
  });

  const handleRefreshAll = () => {
    refetchOverview();
    refetchCustomers();
  };

  const handleResetFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setCrop('');
    setStatus('');
    setDeviceCategory('');
    setPage(1);
  };

  const isRefreshing = isOverviewFetching || isCustomersFetching;
  const customers = customerResponse?.data || [];
  const totalPages = customerResponse?.pagination.totalPages || 1;
  const availableCrops = overview?.cropBreakdown.map((c) => c.crop) || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2.5">
            <span>Customer Fleet Monitoring</span>
           
          </h1>
        
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#00665E]' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-2 gap-3.5">
          {/* Total Customers */}
          <div className="glass-card rounded-2xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Total Customers</span>
              <div className="p-1.5 bg-emerald-50 text-[#00665E] border border-emerald-100 rounded-lg">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{overview.totalCustomers}</div>
            <div className="text-[11px] text-slate-500">Registered AgriInverse accounts</div>
          </div>

          {/* Total Farms */}
          <div className="glass-card rounded-2xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Total Farms</span>
              <div className="p-1.5 bg-teal-50 text-teal-700 border border-teal-100 rounded-lg">
                <Sprout className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900">{overview.totalFarms}</div>
            <div className="text-[11px] text-slate-500">Active cultivation plots</div>
          </div>

          {/* IoT Devices Online */}
          {/* <div className="glass-card rounded-2xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Hardware Nodes</span>
              <div className="p-1.5 bg-sky-50 text-sky-700 border border-sky-100 rounded-lg">
                <Cpu className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 flex items-baseline space-x-1.5">
              <span>{overview.onlineDevices}</span>
              <span className="text-xs font-normal text-slate-500">/ {overview.totalDevices} online</span>
            </div>
            <div className="text-[11px] text-emerald-700 font-medium">
              {overview.totalDevices > 0
                ? `${Math.round((overview.onlineDevices / overview.totalDevices) * 100)}% online connectivity`
                : 'No hardware registered'}
            </div>
          </div> */}

          {/* Live Telemetry Rate */}
          {/* <div className="glass-card rounded-2xl p-4 space-y-1">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Telemetry Status</span>
              <div className="p-1.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-bold text-emerald-700">
                {overview.statusBreakdown.live}
              </span>
              <span className="text-xs text-slate-500">Live transmitting</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
              <span className="text-amber-600 font-semibold">{overview.statusBreakdown.delayed} delayed</span>
              <span>•</span>
              <span className="text-rose-600 font-semibold">{overview.statusBreakdown.offline} offline</span>
            </div>
          </div> */}
        </div>
      )}

      {/* Filter Bar */}
      <DashboardFilters
        search={search}
        onSearchChange={setSearch}
        crop={crop}
        onCropChange={(c) => {
          setCrop(c);
          setPage(1);
        }}
        status={status}
        onStatusChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
        deviceCategory={deviceCategory}
        onDeviceCategoryChange={(d) => {
          setDeviceCategory(d);
          setPage(1);
        }}
        availableCrops={availableCrops}
        onReset={handleResetFilters}
      />

      {/* Error state */}
      {customerError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4" />
          <span>Failed to sync customer telemetry records. Please try again.</span>
        </div>
      )}

      {/* Main Customers Table */}
      <CustomerTable
        customers={customers}
        loading={isCustomersLoading}
        onSelectCustomer={onSelectCustomer}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
};
