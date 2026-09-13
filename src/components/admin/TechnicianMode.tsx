import React, { useState } from 'react';
import { WorkOrder, WorkOrderStatus, InspectionReport } from '../../types';
import {
  Wrench,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  Plus,
  ArrowRight
} from 'lucide-react';

interface TechnicianModeProps {
  workOrders: WorkOrder[];
  onUpdateStatus: (id: string, status: WorkOrderStatus) => void;
  onOpenDVI: (wo: WorkOrder) => void;
}

export const TechnicianMode: React.FC<TechnicianModeProps> = ({
  workOrders,
  onUpdateStatus,
  onOpenDVI,
}) => {
  const activeOrders = workOrders.filter((wo) => wo.status !== 'COMPLETED');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(activeOrders[0]?.id || '');

  const currentOrder = activeOrders.find((wo) => wo.id === selectedOrderId) || activeOrders[0];

  return (
    <div className="max-w-4xl mx-auto space-y-4" id="technician-mode-container">
      {/* Technician High-Contrast Header */}
      <div className="bg-[#000000] border-2 border-[#159EF3] p-4 rounded-xl flex items-center justify-between shadow-[0_0_20px_rgba(21,158,243,0.2)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-[#159EF3] text-black flex items-center justify-center font-bold">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono-telemetry font-bold text-[#159EF3] uppercase tracking-widest block">
              WORKSHOP FLOOR TERMINAL
            </span>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white uppercase">
              TECHNICIAN MODE
            </h2>
          </div>
        </div>

        <div className="text-right font-mono-telemetry text-xs">
          <span className="text-slate-400 block">ACTIVE BAY:</span>
          <span className="text-emerald-400 font-bold text-sm">
            {currentOrder?.assignedBayName || 'BAY 01'}
          </span>
        </div>
      </div>

      {/* Quick Vehicle Switcher Bar for Mechanics */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {activeOrders.map((wo) => {
          const isCurrent = wo.id === currentOrder?.id;
          return (
            <button
              key={wo.id}
              onClick={() => setSelectedOrderId(wo.id)}
              className={`px-4 py-2.5 rounded-lg border font-mono-telemetry text-xs whitespace-nowrap transition-all ${
                isCurrent
                  ? 'bg-[#159EF3] text-black font-bold border-[#159EF3] shadow-[0_0_12px_rgba(21,158,243,0.3)]'
                  : 'bg-[#00101F] text-slate-300 border-[#132038]'
              }`}
            >
              {wo.vehicleRegistration} • {wo.vehicleMakeModel}
            </button>
          );
        })}
      </div>

      {/* Active Big Job Card */}
      {currentOrder ? (
        <div className="bg-[#00101F] border border-[#132038] rounded-xl p-5 sm:p-6 space-y-6 shadow-2xl">
          {/* Main Vehicle Specimen Details */}
          <div className="bg-[#000000] border border-[#132038] rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono-telemetry text-[#8E9BAE] uppercase">
                SPECIMEN IDENTIFIER
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <h3 className="text-2xl sm:text-3xl font-display font-bold text-white uppercase">
                  {currentOrder.vehicleMakeModel}
                </h3>
                <span className="font-mono-telemetry font-extrabold text-base text-[#159EF3] bg-[#00101F] px-3 py-1 rounded border border-[#159EF3]/40">
                  {currentOrder.vehicleRegistration}
                </span>
              </div>
              <div className="text-xs font-mono-telemetry text-slate-400 mt-1">
                WO Ref: <strong className="text-white">{currentOrder.workOrderNumber}</strong> • Owner: {currentOrder.customerName}
              </div>
            </div>

            <div className="flex flex-col sm:items-end">
              <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase">
                CURRENT STATUS
              </span>
              <span className="font-display font-extrabold text-base sm:text-lg text-emerald-400 uppercase">
                {currentOrder.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          {/* Giant Workshop State Buttons (Touch-friendly 56px height) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => onUpdateStatus(currentOrder.id, 'INSPECTION')}
              className={`h-14 sm:h-16 rounded-xl font-display font-bold text-xs sm:text-sm uppercase flex items-center justify-center gap-2 border transition-all ${
                currentOrder.status === 'INSPECTION'
                  ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-[#000000] text-amber-300 border-amber-500/40 hover:bg-amber-950/30'
              }`}
              id="tech-btn-inspect"
            >
              <ShieldCheck className="w-5 h-5" />
              <span>1. INSPECT</span>
            </button>

            <button
              onClick={() => onUpdateStatus(currentOrder.id, 'IN_SERVICE')}
              className={`h-14 sm:h-16 rounded-xl font-display font-bold text-xs sm:text-sm uppercase flex items-center justify-center gap-2 border transition-all ${
                currentOrder.status === 'IN_SERVICE'
                  ? 'bg-[#159EF3] text-black border-[#159EF3] shadow-[0_0_15px_rgba(21,158,243,0.4)]'
                  : 'bg-[#000000] text-[#159EF3] border-[#159EF3]/40 hover:bg-[#002958]/40'
              }`}
              id="tech-btn-start"
            >
              <Play className="w-5 h-5" />
              <span>2. START WORK</span>
            </button>

            <button
              onClick={() => onUpdateStatus(currentOrder.id, 'QUALITY_CHECK')}
              className={`h-14 sm:h-16 rounded-xl font-display font-bold text-xs sm:text-sm uppercase flex items-center justify-center gap-2 border transition-all ${
                currentOrder.status === 'QUALITY_CHECK'
                  ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]'
                  : 'bg-[#000000] text-indigo-300 border-indigo-500/40 hover:bg-indigo-950/30'
              }`}
              id="tech-btn-qc"
            >
              <Clock className="w-5 h-5" />
              <span>3. QC TEST</span>
            </button>

            <button
              onClick={() => onUpdateStatus(currentOrder.id, 'READY')}
              className={`h-14 sm:h-16 rounded-xl font-display font-bold text-xs sm:text-sm uppercase flex items-center justify-center gap-2 border transition-all ${
                currentOrder.status === 'READY'
                  ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : 'bg-[#000000] text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/30'
              }`}
              id="tech-btn-ready"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>4. READY</span>
            </button>
          </div>

          {/* Service Items Checklist */}
          <div className="bg-[#000000] border border-[#132038] rounded-xl p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#132038]">
              <h4 className="font-display font-bold text-sm sm:text-base text-white uppercase flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#159EF3]" />
                PROCEDURE TASKS ({currentOrder.services.length})
              </h4>
              <button
                onClick={() => onOpenDVI(currentOrder)}
                className="bg-[#002958] text-[#159EF3] hover:bg-[#159EF3] hover:text-black border border-[#159EF3]/40 text-xs font-mono-telemetry font-bold px-3 py-1.5 rounded transition-colors"
                id="tech-open-dvi-btn"
              >
                OPEN DIGITAL INSPECTION (DVI)
              </button>
            </div>

            <div className="space-y-2">
              {currentOrder.services.map((srv, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-lg bg-[#00101F] border border-[#132038] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono-telemetry text-xs text-[#8E9BAE]">
                      #{index + 1}
                    </span>
                    <span className="font-display font-semibold text-sm text-white uppercase">
                      {srv.serviceName}
                    </span>
                  </div>

                  <span className={`font-mono-telemetry text-xs px-2.5 py-1 rounded font-bold uppercase ${
                    srv.status === 'DONE'
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/40'
                      : srv.status === 'IN_PROGRESS'
                      ? 'bg-[#002958] text-[#159EF3] border border-[#159EF3]/40'
                      : 'bg-slate-900 text-slate-400 border border-slate-700'
                  }`}>
                    {srv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-[#00101F] border border-[#132038] rounded-xl text-slate-400 font-mono-telemetry">
          No active work orders assigned to workshop floor.
        </div>
      )}
    </div>
  );
};
