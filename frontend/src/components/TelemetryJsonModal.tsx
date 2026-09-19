import React, { useState } from 'react';
import { X, Copy, Check, Terminal, FileJson, Calendar, User } from 'lucide-react';
import { CustomerDashboardSummary } from '../types';

interface TelemetryJsonModalProps {
  customer: CustomerDashboardSummary | null;
  onClose: () => void;
}

export const TelemetryJsonModal: React.FC<TelemetryJsonModalProps> = ({ customer, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!customer) return null;

  // Compile full telemetry payload
  const telemetryData = customer.latestReadingRaw || {
    customerId: customer.customerId,
    customerName: customer.customerName,
    email: customer.email,
    mobile: customer.mobile,
    place: customer.place,
    role: customer.role,
    readingStatus: customer.readingStatus,
    latestReadingTime: customer.latestReadingTime,
    formattedReadingTime: customer.formattedReadingTime,
    battery: customer.battery,
    fertigation: customer.fertigation,
    farms: customer.farms?.map((f) => ({
      farmId: f.farmId,
      name: f.name,
      crop: f.crop,
      totalAreaAcres: f.totalAreaAcres,
      deviceCount: f.deviceCount,
      boundaryCount: f.boundaryCount,
      readingStatus: f.readingStatus,
    })) || [],
  };

  const jsonString = JSON.stringify(telemetryData, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-50 text-[#00665E] border border-emerald-200 rounded-xl">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <span>Latest Telemetry JSON Payload</span>
              </h3>
              <div className="flex items-center space-x-3 text-xs text-slate-500 mt-0.5 font-mono">
                <span className="flex items-center space-x-1">
                  <User className="w-3 h-3 text-slate-400" />
                  <span className="text-slate-700 font-semibold">{customer.customerName || customer.email}</span>
                </span>
                <span>&bull;</span>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{customer.formattedReadingTime || 'No timestamp'}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shadow-xs ${
                copied
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50'
              }`}
              title="Copy JSON Payload"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy</span>
                </>
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* JSON Code Viewer */}
        <div className="p-4 bg-gray-200 flex-1 overflow-y-auto">
          <pre className="font-mono text-xs text-gray-700 leading-relaxed whitespace-pre-wrap select-all">
            <code>{jsonString}</code>
          </pre>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 font-mono">
          <div className="flex items-center space-x-2">
            <Terminal className="w-3.5 h-3.5 text-slate-400" />
            <span>Format: UTF-8 JSON &bull; Read-Only Telemetry</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#00665E] hover:bg-[#004D47] text-white font-semibold rounded-lg text-xs transition-all shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
