import React, { useEffect } from 'react';
import {
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  useLocation,
  matchPath,
} from 'react-router-dom';
import {
  ShieldCheck,

  ChevronRight,
  Users,
  Zap,
} from 'lucide-react';
import { CustomerListPage } from './pages/CustomerListPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { FarmMonitoringPage } from './pages/FarmMonitoringPage';
import { ValveApplianceMonitoringPage } from './pages/ValveApplianceMonitoringPage';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);

  return null;
};

export const App: React.FC = () => {
  const location = useLocation();

  const customerMatch = matchPath('/customers/:customerId', location.pathname);
  const farmMatch = matchPath('/farms/:farmId', location.pathname);
  const isDashboardActive =
    location.pathname === '/' ||
    location.pathname.startsWith('/customers') ||
    location.pathname.startsWith('/farms');
  const isValvesActive = location.pathname.startsWith('/valves') || location.pathname.startsWith('/devices');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      <ScrollToTop />

      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 border-b border-slate-200/90 px-4 sm:px-8 py-3 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <Link
            to="/customers"
            className="flex items-center space-x-3 cursor-pointer group select-none"
          >
           
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-black text-slate-900 tracking-tight">
                  AGRI<span className="text-[#00665E] font-extrabold">-INVERSE</span>
                </span>
              </div>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1 sm:space-x-2">
            <NavLink
              to="/customers"
              className={() =>
                `flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isDashboardActive
                    ? 'bg-[#00665E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Users className="w-3.5 h-3.5" />
              <span>Customers</span>
            </NavLink>

            <NavLink
              to="/valves"
              className={() =>
                `flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  isValvesActive
                    ? 'bg-[#00665E] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`
              }
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Valves & Appliances</span>
            </NavLink>
          </nav>
        </div>
      </header>

      {/* Breadcrumbs Navigation */}
      <div className="bg-slate-100/70 border-b border-slate-200/80 px-4 sm:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs text-slate-500">
          <Link
            to="/customers"
            className={`flex items-center space-x-1 hover:text-[#00665E] transition-colors ${
              location.pathname === '/' || location.pathname === '/customers'
                ? 'font-bold text-slate-900'
                : ''
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#00665E]" />
            <span>Dashboard</span>
          </Link>

          {customerMatch && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-slate-900">
                Customer #{customerMatch.params.customerId}
              </span>
            </>
          )}

          {farmMatch && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-[#00665E]">
                Farm Monitoring ({farmMatch.params.farmId})
              </span>
            </>
          )}

          {isValvesActive && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-[#00665E]">
                Valve & Appliance Monitoring
              </span>
            </>
          )}
        </div>
      </div>

      {/* Main App Body with Route Switch */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
        <Routes>
          <Route path="/" element={<CustomerListPage />} />
          <Route path="/customers" element={<CustomerListPage />} />
          <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
          <Route path="/farms/:farmId" element={<FarmMonitoringPage />} />
          <Route path="/valves" element={<ValveApplianceMonitoringPage />} />
          <Route path="/devices" element={<Navigate to="/valves" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-4 sm:px-8 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
          <div className="flex items-center space-x-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>
              AgriInverse Fleet Subproject &bull; Read-Only Telemetry Layer &bull; Asia/Kolkata (IST)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
