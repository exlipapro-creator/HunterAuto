import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, CheckCircle2, Clock, AlertCircle, Wrench, ShieldCheck, ArrowRight, MessageSquare } from 'lucide-react';

interface ServiceStatusTrackerProps {
  initialReference?: string;
  onOpenPassport: (reg: string) => void;
}

const STAGES = [
  { id: 'BOOKED', label: 'BOOKED', desc: 'Appointment confirmed & scheduled' },
  { id: 'CHECKED_IN', label: 'CHECKED IN', desc: 'Vehicle arrived at Kinondoni bay' },
  { id: 'INSPECTION', label: 'INSPECTED', desc: 'Diagnostic scan & physical check' },
  { id: 'IN_SERVICE', label: 'IN SERVICE', desc: 'Active mechanical & craft execution' },
  { id: 'QUALITY CHECK', label: 'QUALITY CHECK', desc: 'Master tech inspection & road test' },
  { id: 'READY', label: 'READY', desc: 'Cleaned and ready for collection' }
];

export const ServiceStatusTracker: React.FC<ServiceStatusTrackerProps> = ({
  initialReference = '',
  onOpenPassport,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlReference = searchParams.get('ref') ?? '';
  const [query, setQuery] = useState<string>(initialReference || urlReference);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [statusData, setStatusData] = useState<any>(null);

  const fetchStatus = async (ref: string) => {
    if (!ref.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/service-status/${encodeURIComponent(ref.trim())}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No active service found for this plate or reference number.');
      }
      setStatusData(json.data);
    } catch (err: any) {
      setError(err.message);
      setStatusData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ref = initialReference || urlReference;
    if (ref) {
      fetchStatus(ref);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialReference, urlReference]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Reflect the lookup in the URL so results are shareable/bookmarkable.
    setSearchParams(query.trim() ? { ref: query.trim() } : {});
    fetchStatus(query);
  };

  // Determine stage active index
  const getStageIndex = (currentStatus: string) => {
    switch (currentStatus) {
      case 'BOOKED': return 0;
      case 'CHECKED_IN': return 1;
      case 'INSPECTION':
      case 'ESTIMATE':
      case 'AWAITING_APPROVAL':
      case 'APPROVED': return 2;
      case 'IN_SERVICE': return 3;
      case 'QUALITY_CHECK': return 4;
      case 'READY':
      case 'COMPLETED': return 5;
      default: return 0;
    }
  };

  const currentStageIdx = statusData ? getStageIndex(statusData.status) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12" id="service-status-tracker-container">
      {/* Search Bar */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl p-4 sm:p-6 mb-8 shadow-xl">
        <div className="text-center max-w-xl mx-auto mb-5">
          <span className="text-[11px] font-mono-telemetry uppercase tracking-widest text-[#159EF3]">
            SERVICE UPDATES
          </span>
          <h2 className="text-xl sm:text-3xl font-display font-bold text-white uppercase mt-1">
            Check your service status
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Enter your vehicle registration or the reference number from your booking confirmation.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Vehicle registration or booking reference"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-3 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry uppercase focus:outline-none focus:border-[#159EF3]"
              id="status-search-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-xs sm:text-sm px-6 py-3 rounded transition-all active:scale-95 disabled:opacity-50"
            id="status-search-submit-btn"
          >
            {loading ? 'Checking…' : 'Check status'}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-3 bg-red-950/50 border border-red-500/50 rounded flex items-center justify-center gap-2 text-xs text-red-200 font-mono-telemetry max-w-lg mx-auto">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Real-time Status Card */}
      {statusData && (
        <div className="bg-[#00101F] border border-[#132038] rounded-xl overflow-hidden shadow-2xl animate-in fade-in" id="status-result-card">
          {/* Top Plate Banner */}
          <div className="p-4 sm:p-6 bg-[#000000] border-b border-[#132038] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase">
                Your vehicle
              </span>
              <div className="flex items-baseline gap-3 mt-0.5">
                <h3 className="text-xl sm:text-2xl font-display font-extrabold text-white uppercase">
                  {statusData.vehicleMakeModel}
                </h3>
                <span className="font-mono-telemetry font-bold text-sm sm:text-base text-[#159EF3] bg-[#00101F] px-2.5 py-0.5 rounded border border-[#159EF3]/40">
                  {statusData.vehicleRegistration}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-telemetry text-slate-400">Order:</span>
              <span className="text-xs font-mono-telemetry text-white font-bold bg-[#132038] px-2 py-1 rounded">
                {statusData.workOrderNumber}
              </span>
              <button
                onClick={() => onOpenPassport(statusData.vehicleRegistration)}
                className="ml-2 text-xs font-mono-telemetry text-[#159EF3] hover:underline flex items-center gap-1"
                id="view-full-passport-link"
              >
                <span>Full Passport</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Current Live State Highlight */}
          <div className="p-4 sm:p-6 border-b border-[#132038] bg-[#002958]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase block">
                CURRENT STATUS
              </span>
              <div className="text-lg sm:text-xl font-display font-extrabold text-white uppercase flex items-center gap-2 mt-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>{statusData.status.replace(/_/g, ' ')}</span>
              </div>
            </div>

            {statusData.assignedBay && (
              <div className="text-xs font-mono-telemetry text-slate-300 bg-[#00101F] px-3 py-1.5 rounded border border-[#132038]">
                Bay: <strong className="text-[#159EF3]">{statusData.assignedBay}</strong>
              </div>
            )}
          </div>

          {/* The 6 Chronological Stages */}
          <div className="p-4 sm:p-6">
            <h4 className="text-xs font-mono-telemetry uppercase tracking-wider text-[#8E9BAE] mb-4">
              Your service progress:
            </h4>

            <div className="space-y-3 font-mono-telemetry">
              {STAGES.map((stg, index) => {
                const isCompleted = index < currentStageIdx;
                const isCurrent = index === currentStageIdx;

                return (
                  <div
                    key={stg.id}
                    className={`p-3 rounded border flex items-center justify-between transition-all ${
                      isCurrent
                        ? 'bg-[#002958]/60 border-[#159EF3] text-white shadow-[0_0_15px_rgba(21,158,243,0.25)]'
                        : isCompleted
                        ? 'bg-[#000000]/60 border-[#159EF3]/20 text-slate-300'
                        : 'bg-[#000000]/30 border-[#132038] text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isCompleted
                            ? 'bg-[#159EF3] text-black'
                            : isCurrent
                            ? 'bg-white text-black ring-2 ring-[#159EF3]'
                            : 'border border-slate-700 text-slate-600'
                        }`}
                      >
                        {isCompleted ? '✓' : isCurrent ? '●' : '○'}
                      </div>
                      <div>
                        <div className="font-display font-bold text-xs sm:text-sm uppercase">
                          {stg.label}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {stg.desc}
                        </div>
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="text-[10px] uppercase font-bold text-[#159EF3] bg-[#00101F] px-2 py-0.5 rounded border border-[#159EF3]/40">
                        ACTIVE
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Requested Services in this Job */}
            {statusData.services && (
              <div className="mt-6 pt-6 border-t border-[#132038]">
                <h5 className="text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-2">
                  SERVICES IN WORK ORDER:
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono-telemetry">
                  {statusData.services.map((srv: any, i: number) => (
                    <div key={i} className="p-2.5 rounded bg-[#000000] border border-[#132038] flex items-center justify-between">
                      <span className="text-slate-200">{srv.name}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        srv.status === 'DONE' ? 'text-emerald-400 bg-emerald-950/40' : 'text-[#159EF3] bg-[#002958]/40'
                      }`}>
                        {srv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* WhatsApp Contact Action */}
            <div className="mt-6 pt-4 border-t border-[#132038] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">
                Questions about your active service? Contact our service advisor:
              </span>
              <a
                href={`https://wa.me/255654686962?text=${encodeURIComponent(
                  `Hello Hunter Autoworks, inquiring about service status for ${statusData.workOrderNumber} (${statusData.vehicleRegistration}).`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-2 rounded flex items-center gap-1.5 transition-colors"
                id="status-advisor-wa-btn"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp Advisor</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
