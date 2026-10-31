import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Sprout,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useGetOverviewStatsQuery, useGetCustomersQuery, usePrefetch } from '../store/fleetApi';
import { CustomerTable } from '../components/CustomerTable';
import { DashboardFilters } from '../components/DashboardFilters';

interface CustomerListPageProps {
  onSelectCustomer?: (customerId: number) => void;
}

export const CustomerListPage: React.FC<CustomerListPageProps> = ({
  onSelectCustomer,
}) => {
  const navigate = useNavigate();
  const handleSelectCustomer = onSelectCustomer ?? ((customerId: number) => {
    navigate(`/customers/${customerId}`);
  });

  // Filter & Pagination State
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [crop, setCrop] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [deviceCategory, setDeviceCategory] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [manualRefresh, setManualRefresh] = useState<boolean>(false);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  // RTK Query hooks with 30s fresh cache retention to prevent redundant network hits on tab navigation
  const prefetchCustomers = usePrefetch('getCustomers');

  const {
    data: overview,
    refetch: refetchOverview,
    isFetching: isOverviewFetching,
  } = useGetOverviewStatsQuery(manualRefresh, { refetchOnMountOrArgChange: 30 });

  const {
    data: customerResponse,
    isLoading: isCustomersLoading,
    isFetching: isCustomersFetching,
    error: customerError,
    refetch: refetchCustomers,
  } = useGetCustomersQuery(
    {
      page,
      limit: 10,
      search: debouncedSearch,
      crop,
      status,
      deviceCategory,
      fresh: manualRefresh || undefined,
    },
    { refetchOnMountOrArgChange: 30 }
  );

  const totalPages = customerResponse?.pagination.totalPages || 1;

  // Background Prefetching: proactively prefetch next and previous pages for instantaneous 0ms pagination
  useEffect(() => {
    if (page < totalPages) {
      prefetchCustomers({
        page: page + 1,
        limit: 10,
        search: debouncedSearch,
        crop,
        status,
        deviceCategory,
      });
    }
    if (page > 1) {
      prefetchCustomers({
        page: page - 1,
        limit: 10,
        search: debouncedSearch,
        crop,
        status,
        deviceCategory,
      });
    }
  }, [page, totalPages, debouncedSearch, crop, status, deviceCategory, prefetchCustomers]);

  const handleRefreshAll = async () => {
    setManualRefresh(true);
    await Promise.all([refetchOverview(), refetchCustomers()]);
    setTimeout(() => setManualRefresh(false), 2000);
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
            className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-xs active:scale-95"
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
        onSelectCustomer={handleSelectCustomer}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </div>
  );
};
