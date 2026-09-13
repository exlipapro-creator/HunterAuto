import React, { useState, useEffect } from 'react';
import { Vehicle, WorkOrder, InspectionReport } from '../../types';
import { Search, Car, Calendar, Gauge, Wrench, ShieldCheck, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface VehiclePassportViewProps {
  initialPlate?: string;
  onBookForThisVehicle: (reg: string) => void;
  onViewInvoice?: (invoiceNumber: string) => void;
}

export const VehiclePassportView: React.FC<VehiclePassportViewProps> = ({
  initialPlate = '',
  onBookForThisVehicle,
  onViewInvoice,
}) => {
  const [searchPlate, setSearchPlate] = useState<string>(initialPlate);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [passportData, setPassportData] = useState<{
    vehicle: Vehicle;
    history: WorkOrder[];
    inspections: InspectionReport[];
  } | null>(null);

  const fetchPassport = async (plate: string) => {
    if (!plate.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/vehicles/${encodeURIComponent(plate.trim())}/passport`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'No vehicle passport found for this registration plate.');
      }
      setPassportData(json.data);
    } catch (err: any) {
      setError(err.message);
      setPassportData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPlate) {
      fetchPassport(initialPlate);
    }
  }, [initialPlate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPassport(searchPlate);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12" id="vehicle-passport-container">
      {/* Plate Search Bar */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl p-4 sm:p-6 mb-8">
        <div className="text-center max-w-xl mx-auto mb-4">
          <span className="text-[11px] font-mono-telemetry uppercase tracking-widest text-[#159EF3]">
            YOUR SERVICE HISTORY
          </span>
          <h2 className="text-xl sm:text-3xl font-display font-bold text-white uppercase mt-1">
            Vehicle Passport
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Your vehicle's complete service record with Hunter Autoworks — inspections, work completed, and recommendations.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="e.g. T 123 ABC"
              value={searchPlate}
              onChange={(e) => setSearchPlate(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry uppercase focus:outline-none focus:border-[#159EF3]"
              id="passport-plate-input"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-xs sm:text-sm px-5 py-2.5 rounded transition-all"
            id="passport-plate-submit"
          >
            {loading ? 'FETCHING...' : 'OPEN PASSPORT'}
          </button>
        </form>

        {error && (
          <p className="text-xs text-red-400 text-center font-mono-telemetry mt-3">{error}</p>
        )}
      </div>

      {/* Main Passport Surface */}
      {passportData && (
        <div className="space-y-6 animate-in fade-in" id="passport-content">
          {/* Identity Card */}
          <div className="bg-[#00101F] border border-[#132038] rounded-xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#159EF3]/5 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#132038] pb-5">
              <div>
                <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase block">
                  PASSPORT SPECIMEN IDENTITY
                </span>
                <div className="flex flex-wrap items-baseline gap-3 mt-1">
                  <h3 className="text-2xl sm:text-3xl font-display font-extrabold text-white uppercase">
                    {passportData.vehicle.make} {passportData.vehicle.model}
                  </h3>
                  <span className="font-mono-telemetry font-bold text-base text-[#159EF3] bg-[#000000] px-3 py-1 rounded border border-[#159EF3]/40">
                    {passportData.vehicle.registrationNumber}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onBookForThisVehicle(passportData.vehicle.registrationNumber)}
                className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-xs sm:text-sm px-4 py-2.5 rounded flex items-center gap-2 self-start sm:self-auto shadow-[0_0_15px_rgba(21,158,243,0.3)] transition-all"
                id="passport-book-btn"
              >
                <Calendar className="w-4 h-4" />
                <span>BOOK SERVICE</span>
              </button>
            </div>

            {/* Key Telemetry Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 text-xs font-mono-telemetry">
              <div className="p-3 bg-[#000000] border border-[#132038] rounded">
                <span className="text-[#8E9BAE] text-[10px] uppercase block">Current Mileage</span>
                <span className="font-display font-bold text-base text-white mt-0.5 block">
                  {passportData.vehicle.mileageKm != null
                    ? `${passportData.vehicle.mileageKm.toLocaleString()} KM`
                    : '—'}
                </span>
              </div>

              <div className="p-3 bg-[#000000] border border-[#132038] rounded">
                <span className="text-[#8E9BAE] text-[10px] uppercase block">Manufacture Year</span>
                <span className="font-display font-bold text-base text-white mt-0.5 block">
                  {passportData.vehicle.year || '—'}
                </span>
              </div>

              <div className="p-3 bg-[#000000] border border-[#132038] rounded">
                <span className="text-[#8E9BAE] text-[10px] uppercase block">Last Service</span>
                <span className="font-display font-bold text-base text-[#159EF3] mt-0.5 block">
                  {passportData.vehicle.lastServiceDate || 'Recent'}
                </span>
              </div>

              <div className="p-3 bg-[#000000] border border-[#132038] rounded">
                <span className="text-[#8E9BAE] text-[10px] uppercase block">Next Recommended</span>
                <span className="font-display font-bold text-base text-emerald-400 mt-0.5 block">
                  +10,000 KM
                </span>
              </div>
            </div>
          </div>

          {/* Latest Multi-Point Inspection Snapshot */}
          {passportData.inspections.length > 0 && (
            <div className="bg-[#00101F] border border-[#132038] rounded-xl p-5 sm:p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4 border-b border-[#132038] pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#159EF3]" />
                  <h4 className="font-display font-bold text-base sm:text-lg text-white uppercase">
                    Latest Vehicle Inspection
                  </h4>
                </div>
                <span className="text-xs font-mono-telemetry text-slate-400">
                  {(passportData.inspections[0].inspectedAt || passportData.inspections[0].createdAt).split('T')[0]}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-mono-telemetry">
                {passportData.inspections[0].items.map((item, idx) => (
                  <div key={idx} className="p-3 bg-[#000000] border border-[#132038] rounded flex items-center justify-between">
                    <div>
                      <span className="text-white font-semibold block">{item.name}</span>
                      <span className="text-[10px] text-slate-400">{item.notes || 'Inspected'}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      item.status === 'GOOD'
                        ? 'text-emerald-400 bg-emerald-950/40'
                        : item.status === 'ATTENTION'
                        ? 'text-amber-400 bg-amber-950/40'
                        : 'text-red-400 bg-red-950/40'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>

              {passportData.inspections[0].recommendations && passportData.inspections[0].recommendations.length > 0 && (
                <div className="mt-4 p-3 bg-[#002958]/30 border border-[#159EF3]/20 rounded text-xs text-slate-300">
                  <strong className="text-[#159EF3] uppercase block mb-1 font-mono-telemetry">
                    Technician Recommendations:
                  </strong>
                  <ul className="list-disc pl-4 space-y-1">
                    {passportData.inspections[0].recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Historical Service Log / Work Orders */}
          <div className="bg-[#00101F] border border-[#132038] rounded-xl p-5 sm:p-6 shadow-xl">
            <h4 className="font-display font-bold text-base sm:text-lg text-white uppercase mb-4 border-b border-[#132038] pb-3 flex items-center gap-2">
              <Wrench className="w-5 h-5 text-[#159EF3]" />
              Service History ({passportData.history.length})
            </h4>

            {passportData.history.length === 0 ? (
              <p className="text-xs text-slate-400 font-mono-telemetry">No past work orders recorded yet.</p>
            ) : (
              <div className="space-y-3 font-mono-telemetry">
                {passportData.history.map((wo) => (
                  <div
                    key={wo.id}
                    className="p-4 bg-[#000000] border border-[#132038] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#159EF3] font-bold">{wo.workOrderNumber}</span>
                        <span className="text-[10px] text-slate-400">
                          {wo.createdAt.split('T')[0]}
                        </span>
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                          {wo.status}
                        </span>
                      </div>
                      <div className="text-xs text-white font-medium mt-1">
                        {wo.services.map(s => s.serviceName).join(' • ')}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Bay: {wo.assignedBayName || 'Main Lab'}{wo.assignedTechnicianName ? ` | Technician: ${wo.assignedTechnicianName}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-[#8E9BAE] uppercase block">Total</span>
                        <span className="font-bold text-sm text-white">
                          {formatCurrency(wo.totalCost)}
                        </span>
                      </div>

                      {wo.invoiceNumber && onViewInvoice && (
                        <button
                          onClick={() => onViewInvoice(wo.invoiceNumber!)}
                          className="p-2 rounded bg-[#002958] text-[#159EF3] hover:bg-[#159EF3] hover:text-black transition-colors"
                          title="View Official Hunter Invoice"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
