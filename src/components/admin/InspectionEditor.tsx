import React, { useState } from 'react';
import { WorkOrder, InspectionReport, InspectionItem, InspectionStatus } from '../../types';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Save,
  Wrench,
  Gauge
} from 'lucide-react';

interface InspectionEditorProps {
  workOrder: WorkOrder;
  existingInspection?: InspectionReport | null;
  onClose: () => void;
  onSaveInspection: (report: Partial<InspectionReport>) => void;
}

const DEFAULT_INSPECTION_POINTS = [
  { category: 'Tyres', name: 'Front Left Tyre (Tread & PSI)', status: 'GOOD' as InspectionStatus, notes: '6.2mm, 32 PSI' },
  { category: 'Tyres', name: 'Front Right Tyre (Tread & PSI)', status: 'GOOD' as InspectionStatus, notes: '6.1mm, 32 PSI' },
  { category: 'Tyres', name: 'Rear Left Tyre (Tread & PSI)', status: 'ATTENTION' as InspectionStatus, notes: '3.8mm, slightly worn inner shoulder' },
  { category: 'Tyres', name: 'Rear Right Tyre (Tread & PSI)', status: 'ATTENTION' as InspectionStatus, notes: '3.9mm, 31 PSI' },
  { category: 'Brakes', name: 'Front Brake Pads & Discs', status: 'GOOD' as InspectionStatus, notes: '70% pad material remaining' },
  { category: 'Brakes', name: 'Rear Brake Pads & Drums', status: 'GOOD' as InspectionStatus, notes: 'Good condition' },
  { category: 'Fluids', name: 'Engine Synthetic Oil Level & Color', status: 'GOOD' as InspectionStatus, notes: 'Fresh 5W-30 synthetic' },
  { category: 'Fluids', name: 'Brake Fluid Moisture Level', status: 'GOOD' as InspectionStatus, notes: '< 1% moisture, clean' },
  { category: 'Fluids', name: 'Radiator Coolant Specific Gravity', status: 'GOOD' as InspectionStatus, notes: 'Optimal -25°C freeze / 108°C boil point' },
  { category: 'Battery', name: '12V Battery Voltage & Cranking Amps', status: 'GOOD' as InspectionStatus, notes: '12.6V resting, 580 CCA measured' },
  { category: 'Suspension', name: 'Front Struts & Bushings', status: 'GOOD' as InspectionStatus, notes: 'No leaks or excessive play' },
  { category: 'Electrical', name: 'Headlamps, Indicators, Brake Lights', status: 'GOOD' as InspectionStatus, notes: 'All operational' },
];

export const InspectionEditor: React.FC<InspectionEditorProps> = ({
  workOrder,
  existingInspection,
  onClose,
  onSaveInspection,
}) => {
  const [items, setItems] = useState<InspectionItem[]>(
    existingInspection?.items || DEFAULT_INSPECTION_POINTS
  );
  const [recommendations, setRecommendations] = useState<string[]>(
    existingInspection?.recommendations || ['Rotate tyres at next 5,000 KM service', 'Replace wiper blades before heavy rains']
  );
  const [newRec, setNewRec] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  const updateItemStatus = (idx: number, status: InspectionStatus) => {
    const next = [...items];
    next[idx].status = status;
    setItems(next);
  };

  const updateItemNotes = (idx: number, notes: string) => {
    const next = [...items];
    next[idx].notes = notes;
    setItems(next);
  };

  const handleAddRecommendation = () => {
    if (newRec.trim()) {
      setRecommendations([...recommendations, newRec.trim()]);
      setNewRec('');
    }
  };

  const handleSave = () => {
    setSaving(true);
    const payload: Partial<InspectionReport> = {
      workOrderId: workOrder.id,
      vehicleRegistration: workOrder.vehicleRegistration,
      inspectorName: workOrder.assignedTechnicianName || 'Technician',
      items,
      recommendations,
      overallCondition: items.some(i => i.status === 'CRITICAL')
        ? 'CRITICAL'
        : items.some(i => i.status === 'ATTENTION')
        ? 'ATTENTION'
        : 'GOOD'
    };
    onSaveInspection(payload);
    setTimeout(() => {
      setSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md"
      id="dvi-modal-overlay"
      onClick={onClose}
    >
      <div
        className="bg-[#00101F] border border-[#132038] w-full max-w-2xl rounded-t-2xl sm:rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in slide-in-from-bottom-6 duration-200"
        onClick={(e) => e.stopPropagation()}
        id="dvi-editor-sheet"
      >
        {/* Header */}
        <div className="bg-[#000000] p-4 sm:p-5 border-b border-[#132038] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-[#159EF3]/20 border border-[#159EF3] text-[#159EF3] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono-telemetry font-bold text-[#159EF3] uppercase tracking-widest block">
                DIGITAL MULTI-POINT SCAN
              </span>
              <h2 className="text-base sm:text-lg font-display font-bold text-white uppercase">
                INSPECTION REPORT: {workOrder.vehicleRegistration}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Points */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          <div className="text-xs text-slate-300 font-mono-telemetry">
            Rate each mechanical check point as <strong className="text-emerald-400">GOOD</strong>, <strong className="text-amber-400">ATTENTION</strong>, or <strong className="text-red-400">CRITICAL</strong>.
          </div>

          <div className="space-y-3 font-mono-telemetry">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-[#000000] border border-[#132038] rounded-lg space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs text-white font-semibold">{item.name}</span>

                  <div className="flex items-center gap-1.5 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => updateItemStatus(idx, 'GOOD')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                        item.status === 'GOOD'
                          ? 'bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                          : 'bg-[#00101F] text-slate-400 border border-[#132038]'
                      }`}
                    >
                      GOOD
                    </button>
                    <button
                      type="button"
                      onClick={() => updateItemStatus(idx, 'ATTENTION')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                        item.status === 'ATTENTION'
                          ? 'bg-amber-500 text-black shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                          : 'bg-[#00101F] text-slate-400 border border-[#132038]'
                      }`}
                    >
                      ATTN
                    </button>
                    <button
                      type="button"
                      onClick={() => updateItemStatus(idx, 'CRITICAL')}
                      className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                        item.status === 'CRITICAL'
                          ? 'bg-red-500 text-white shadow-[0_0_8px_rgba(239,68,68,0.4)]'
                          : 'bg-[#00101F] text-slate-400 border border-[#132038]'
                      }`}
                    >
                      CRIT
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Technician observation/measurement (e.g. 6.2mm, 32 PSI)..."
                  value={item.notes || ''}
                  onChange={(e) => updateItemNotes(idx, e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-[#00101F] border border-[#132038] rounded text-xs text-slate-200 placeholder-slate-600 focus:border-[#159EF3] focus:outline-none"
                />
              </div>
            ))}
          </div>

          {/* Recommendations Area */}
          <div className="pt-4 border-t border-[#132038] space-y-3">
            <h4 className="font-display font-bold text-xs uppercase text-slate-200">
              TECHNICIAN RECOMMENDATIONS
            </h4>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add recommendation (e.g. replace front brake pads in 3,000 KM)..."
                value={newRec}
                onChange={(e) => setNewRec(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white placeholder-slate-600 focus:border-[#159EF3] focus:outline-none font-mono-telemetry"
              />
              <button
                type="button"
                onClick={handleAddRecommendation}
                className="bg-[#002958] text-[#159EF3] hover:bg-[#159EF3] hover:text-black px-3 py-2 rounded text-xs font-mono-telemetry font-bold transition-colors"
              >
                + Add
              </button>
            </div>

            <ul className="space-y-1.5 text-xs text-slate-300 font-mono-telemetry pl-4 list-disc">
              {recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#132038] bg-[#000000] flex items-center justify-between">
          <button
            onClick={onClose}
            className="py-2 px-4 rounded text-xs font-mono-telemetry text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-xs sm:text-sm px-6 py-2.5 rounded flex items-center gap-2 shadow-[0_0_15px_rgba(21,158,243,0.3)] transition-all"
            id="save-dvi-report-btn"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'SAVING...' : 'SAVE & SIGN REPORT'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
