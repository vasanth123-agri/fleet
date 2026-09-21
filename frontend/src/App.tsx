import React, { useState } from 'react';
import {
  ShieldCheck,
  Radio,
  ChevronRight,
  Users,
} from 'lucide-react';
import { CustomerListPage } from './pages/CustomerListPage';
import { CustomerDetailPage } from './pages/CustomerDetailPage';
import { FarmMonitoringPage } from './pages/FarmMonitoringPage';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'list' | 'customer' | 'farm'>('list');
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

 

  const handleSelectCustomer = (customerId: number) => {
    setSelectedCustomerId(customerId);
    setCurrentView('customer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectFarm = (farmId: string) => {
    setSelectedFarmId(farmId);
    setCurrentView('farm');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGoHome = () => {
    setCurrentView('list');
    setSelectedCustomerId(null);
    setSelectedFarmId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 border-b border-slate-200/90 px-4 sm:px-8 py-3.5 backdrop-blur-md shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo & Title */}
          <div
            onClick={handleGoHome}
            className="flex items-center space-x-3 cursor-pointer group select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#004D47] via-[#00665E] to-emerald-500 p-0.5 shadow-md group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center">
                <Radio className="w-5 h-5 text-[#00665E] animate-pulse-subtle" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-black text-slate-900 tracking-tight">
                  AGRI<span className="text-[#00665E] font-extrabold">-INVERSE</span>
                </span>
              
              </div>
              
            </div>
          </div>

         
        
        </div>
      </header>

      {/* Breadcrumbs Navigation */}
      <div className="bg-slate-100/70 border-b border-slate-200/80 px-4 sm:px-8 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center space-x-2 text-xs text-slate-500">
          <button
            onClick={handleGoHome}
            className={`flex items-center space-x-1 hover:text-[#00665E] transition-colors ${
              currentView === 'list' ? 'font-bold text-slate-900' : ''
            }`}
          >
            <Users className="w-3.5 h-3.5 text-[#00665E]" />
            <span>Dashboard</span>
          </button>

          {(currentView === 'customer' || currentView === 'farm') && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                onClick={() => {
                  if (selectedCustomerId) {
                    setCurrentView('customer');
                  } else {
                    handleGoHome();
                  }
                }}
                className={`hover:text-[#00665E] transition-colors ${
                  currentView === 'customer' ? 'font-bold text-slate-900' : ''
                }`}
              >
                Customer #{selectedCustomerId}
              </button>
            </>
          )}

          {currentView === 'farm' && selectedFarmId && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-bold text-[#00665E]">Farm Monitoring</span>
            </>
          )}
        </div>
      </div>

      {/* Main App Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6">
        {currentView === 'list' && (
          <CustomerListPage onSelectCustomer={handleSelectCustomer} />
        )}

        {currentView === 'customer' && selectedCustomerId && (
          <CustomerDetailPage
            userId={selectedCustomerId}
            onBack={handleGoHome}
            onSelectFarm={handleSelectFarm}
          />
        )}

        {currentView === 'farm' && selectedFarmId && (
          <FarmMonitoringPage
            farmId={selectedFarmId}
            onBack={() => {
              if (selectedCustomerId) setCurrentView('customer');
              else handleGoHome();
            }}
            onSelectCustomer={handleSelectCustomer}
          />
        )}
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


