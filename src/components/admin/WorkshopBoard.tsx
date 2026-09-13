import React, { useState } from 'react';
import { WorkOrder, WorkOrderStatus, WorkshopBay, StaffMember } from '../../types';
import {
  Clock,
  Car,
  User,
  Wrench,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Flame,
  ArrowRight
} from 'lucide-react';

interface WorkshopBoardProps {
  workOrders: WorkOrder[];
  bays: WorkshopBay[];
  staff: StaffMember[];
  onUpdateStatus: (workOrderId: string, status: WorkOrderStatus) => void;
  onAssignBayTech: (workOrderId: string, bayId: string, techId: string) => void;
  onSelectWorkOrder: (wo: WorkOrder) => void;
  onOpenDVI: (wo: WorkOrder) => void;
}

const COLUMNS: { id: WorkOrderStatus; label: string; accent: string }[] = [
  { id: 'CHECKED_IN', label: 'CHECK-IN', accent: 'border-slate-500' },
  { id: 'INSPECTION', label: 'INSPECTION (DVI)', accent: 'border-amber-500' },
  { id: 'AWAITING_APPROVAL', label: 'AWAITING APPROVAL', accent: 'border-purple-500' },
  { id: 'IN_SERVICE', label: 'IN SERVICE', accent: 'border-[#159EF3]' },
  { id: 'QUALITY_CHECK', label: 'QUALITY CHECK', accent: 'border-indigo-500' },
  { id: 'READY', label: 'READY FOR DISPATCH', accent: 'border-emerald-500' },
];

export const WorkshopBoard: React.FC<WorkshopBoardProps> = ({
  workOrders,
  bays,
  staff,
  onUpdateStatus,
  onAssignBayTech,
  onSelectWorkOrder,
  onOpenDVI,
}) => {
  const [selectedBayFilter, setSelectedBayFilter] = useState<string>('ALL');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('ALL');

  const filteredOrders = workOrders.filter((wo) => {
    const matchesBay = selectedBayFilter === 'ALL' || wo.assignedBayId === selectedBayFilter;
    const matchesPriority = selectedPriorityFilter === 'ALL' || wo.priority === selectedPriorityFilter;
    return matchesBay && matchesPriority && wo.status !== 'COMPLETED';
  });

  const technicians = staff.filter((s) => s.role === 'TECHNICIAN' || s.role === 'SERVICE_ADVISOR');

  return (
    <div className="space-y-6" id="workshop-board-container">
      {/* Top Filter & Telemetry Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#00101F] border border-[#132038] p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></div>
          <div>
            <h2 className="font-display font-bold text-lg text-white uppercase tracking-tight">
              LIVE WORKSHOP BOARD
            </h2>
            <span className="text-xs font-mono-telemetry text-slate-400">
              5 Specialized Bays • {filteredOrders.length} Active Vehicles on Floor
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-telemetry">
          <div className="flex items-center gap-1 bg-[#000000] border border-[#132038] px-2.5 py-1.5 rounded">
            <span className="text-[#8E9BAE]">Bay:</span>
            <select
              value={selectedBayFilter}
              onChange={(e) => setSelectedBayFilter(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
              id="board-filter-bay"
            >
              <option value="ALL">All Bays</option>
              {bays.map((b) => (
                <option key={b.id} value={b.id} className="bg-slate-900">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1 bg-[#000000] border border-[#132038] px-2.5 py-1.5 rounded">
            <span className="text-[#8E9BAE]">Priority:</span>
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="bg-transparent text-white focus:outline-none cursor-pointer"
              id="board-filter-priority"
            >
              <option value="ALL">All</option>
              <option value="URGENT" className="bg-slate-900 text-red-400">URGENT</option>
              <option value="NORMAL" className="bg-slate-900 text-slate-200">Normal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Horizontal Kanban Board (Scrollable on mobile/tablet) */}
      <div className="overflow-x-auto pb-4" id="kanban-columns-scroll-area">
        <div className="flex gap-4 min-w-[1280px]">
          {COLUMNS.map((col) => {
            const columnOrders = filteredOrders.filter((wo) => {
              if (col.id === 'INSPECTION') {
                return wo.status === 'INSPECTION' || wo.status === 'ESTIMATE';
              }
              return wo.status === col.id;
            });

            return (
              <div
                key={col.id}
                className="w-72 shrink-0 bg-[#00101F]/80 border border-[#132038] rounded-xl flex flex-col max-h-[75vh]"
                id={`kanban-col-${col.id}`}
              >
                {/* Column Header */}
                <div className={`p-3.5 border-b border-[#132038] bg-[#000000] border-t-2 ${col.accent} rounded-t-xl flex items-center justify-between`}>
                  <span className="font-mono-telemetry font-bold text-xs text-white uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="font-mono-telemetry text-xs font-bold text-[#159EF3] bg-[#00101F] px-2 py-0.5 rounded border border-[#132038]">
                    {columnOrders.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="p-2.5 overflow-y-auto space-y-3 flex-1">
                  {columnOrders.length === 0 ? (
                    <div className="p-6 text-center text-xs font-mono-telemetry text-slate-600 border border-dashed border-[#132038] rounded-lg">
                      No vehicles in this phase
                    </div>
                  ) : (
                    columnOrders.map((wo) => {
                      const isUrgent = wo.priority === 'URGENT';

                      return (
                        <div
                          key={wo.id}
                          className="bg-[#000000] border border-[#132038] hover:border-[#159EF3]/60 rounded-lg p-3.5 transition-all shadow-md group flex flex-col justify-between"
                          id={`wo-card-${wo.workOrderNumber}`}
                        >
                          {/* Card Header */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-mono-telemetry font-bold text-xs text-[#159EF3]">
                                {wo.workOrderNumber}
                              </span>
                              {isUrgent ? (
                                <span className="flex items-center gap-1 text-[10px] font-mono-telemetry font-bold text-red-400 bg-red-950/60 px-1.5 py-0.5 rounded border border-red-500/40">
                                  <Flame className="w-3 h-3" />
                                  URGENT
                                </span>
                              ) : (
                                <span className="text-[10px] font-mono-telemetry text-slate-400">
                                  {wo.createdAt.split('T')[1]?.slice(0, 5) || 'Today'}
                                </span>
                              )}
                            </div>

                            {/* Vehicle Plate Badge */}
                            <div className="flex items-baseline justify-between mb-1.5">
                              <span className="font-display font-bold text-sm text-white uppercase">
                                {wo.vehicleMakeModel}
                              </span>
                              <span className="font-mono-telemetry font-bold text-xs text-white bg-[#00101F] px-2 py-0.5 rounded border border-[#159EF3]/30">
                                {wo.vehicleRegistration}
                              </span>
                            </div>

                            {/* Services requested */}
                            <div className="text-[11px] text-slate-300 font-mono-telemetry line-clamp-2 mb-2.5">
                              {wo.services.map((s) => s.serviceName).join(', ')}
                            </div>
                          </div>

                          {/* Bay & Tech Assignments */}
                          <div className="pt-2.5 border-t border-[#132038] space-y-1.5 text-[11px] font-mono-telemetry">
                            <div className="flex items-center justify-between text-slate-400">
                              <span className="text-[#8E9BAE]">Bay:</span>
                              <select
                                value={wo.assignedBayId || ''}
                                onChange={(e) =>
                                  onAssignBayTech(wo.id, e.target.value, wo.assignedTechnicianId || '')
                                }
                                className="bg-[#00101F] text-slate-200 border border-[#132038] rounded px-1.5 py-0.5 text-[11px] focus:outline-none"
                              >
                                <option value="">Unassigned</option>
                                {bays.map((b) => (
                                  <option key={b.id} value={b.id}>
                                    {b.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="flex items-center justify-between text-slate-400">
                              <span className="text-[#8E9BAE]">Tech:</span>
                              <select
                                value={wo.assignedTechnicianId || ''}
                                onChange={(e) =>
                                  onAssignBayTech(wo.id, wo.assignedBayId || '', e.target.value)
                                }
                                className="bg-[#00101F] text-slate-200 border border-[#132038] rounded px-1.5 py-0.5 text-[11px] focus:outline-none"
                              >
                                <option value="">Unassigned</option>
                                {technicians.map((t) => (
                                  <option key={t.id} value={t.id}>
                                    {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Action Buttons: Status Advance & DVI */}
                          <div className="mt-3 pt-2.5 border-t border-[#132038] flex items-center justify-between gap-2">
                            <button
                              onClick={() => onOpenDVI(wo)}
                              className="text-[10px] font-mono-telemetry text-[#159EF3] hover:underline"
                              id={`open-dvi-${wo.workOrderNumber}`}
                            >
                              DVI Report
                            </button>

                            {/* Fast Next Stage Advance */}
                            {col.id === 'CHECKED_IN' && (
                              <button
                                onClick={() => onUpdateStatus(wo.id, 'INSPECTION')}
                                className="px-2 py-1 bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] rounded text-[10px] font-mono-telemetry font-bold transition-colors flex items-center gap-1"
                              >
                                <span>Inspect</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}

                            {col.id === 'INSPECTION' && (
                              <button
                                onClick={() => onUpdateStatus(wo.id, 'AWAITING_APPROVAL')}
                                className="px-2 py-1 bg-purple-950/60 hover:bg-purple-600 hover:text-white text-purple-300 rounded text-[10px] font-mono-telemetry font-bold transition-colors flex items-center gap-1"
                              >
                                <span>Approve</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}

                            {col.id === 'AWAITING_APPROVAL' && (
                              <button
                                onClick={() => onUpdateStatus(wo.id, 'IN_SERVICE')}
                                className="px-2 py-1 bg-[#159EF3] hover:bg-[#38B2FF] text-black rounded text-[10px] font-mono-telemetry font-bold transition-colors flex items-center gap-1"
                              >
                                <span>Start Bay</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}

                            {col.id === 'IN_SERVICE' && (
                              <button
                                onClick={() => onUpdateStatus(wo.id, 'QUALITY_CHECK')}
                                className="px-2 py-1 bg-indigo-950/60 hover:bg-indigo-600 hover:text-white text-indigo-300 rounded text-[10px] font-mono-telemetry font-bold transition-colors flex items-center gap-1"
                              >
                                <span>QC Check</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}

                            {col.id === 'QUALITY_CHECK' && (
                              <button
                                onClick={() => onUpdateStatus(wo.id, 'READY')}
                                className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-black rounded text-[10px] font-mono-telemetry font-bold transition-colors flex items-center gap-1"
                              >
                                <span>Ready</span>
                                <ArrowRight className="w-2.5 h-2.5" />
                              </button>
                            )}

                            {col.id === 'READY' && (
                              <button
                                onClick={() => onUpdateStatus(wo.id, 'COMPLETED')}
                                className="px-2 py-1 bg-slate-800 hover:bg-white hover:text-black text-slate-300 rounded text-[10px] font-mono-telemetry font-bold transition-colors"
                              >
                                Close Job
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
