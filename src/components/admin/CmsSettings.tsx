import React, { useState } from 'react';
import { ServiceItem } from '../../types';
import {
  Settings,
  Save,
  Wrench,
  CheckCircle2,
  Phone,
  MapPin,
  Clock,
  Edit2
} from 'lucide-react';

interface CmsSettingsProps {
  services: ServiceItem[];
  onUpdateService: (id: string, updates: Partial<ServiceItem>) => Promise<any>;
}

export const CmsSettings: React.FC<CmsSettingsProps> = ({
  services,
  onUpdateService,
}) => {
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editDuration, setEditDuration] = useState<number>(60);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');

  const handleStartEdit = (s: ServiceItem) => {
    setEditingServiceId(s.id);
    setEditName(s.name);
    setEditDescription(s.description);
    setEditPrice(s.price);
    setEditDuration(s.durationMinutes);
  };

  const handleSaveEdit = async () => {
    if (!editingServiceId) return;
    setSaving(true);
    try {
      await onUpdateService(editingServiceId, {
        name: editName,
        description: editDescription,
        price: editPrice,
        durationMinutes: editDuration
      });
      setSuccessMsg('Service terminology and pricing saved successfully.');
      setEditingServiceId(null);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" id="cms-settings-container">
      {/* Top Banner */}
      <div className="bg-[#00101F] border border-[#132038] p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono-telemetry text-[#159EF3] uppercase tracking-widest block">
            WORKSHOP CMS & TERMINOLOGY CONFIGURATION
          </span>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white uppercase">
            SERVICE CATALOGUE & TERMINOLOGY EDITOR
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Edit the 20 canonical flyer services (such as refining "Water Stop Moval" or updating prices in TZS).
          </p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-mono-telemetry rounded flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Services List with inline editing */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl overflow-hidden shadow-xl p-5 space-y-4">
        <h3 className="font-display font-bold text-base text-white uppercase border-b border-[#132038] pb-3 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-[#159EF3]" />
          CANONICAL FLYER SERVICES (20 ITEMS)
        </h3>

        <div className="space-y-3 font-mono-telemetry">
          {services.map((service) => {
            const isEditing = editingServiceId === service.id;

            if (isEditing) {
              return (
                <div
                  key={service.id}
                  className="p-4 bg-[#000000] border-2 border-[#159EF3] rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#159EF3] text-xs">
                      EDITING SERVICE #{service.number}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingServiceId(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-[#8E9BAE] mb-1">
                      Service Title
                    </label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#00101F] border border-[#132038] rounded text-sm text-white font-display font-bold focus:border-[#159EF3] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase text-[#8E9BAE] mb-1">
                      Description
                    </label>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-[#00101F] border border-[#132038] rounded text-xs text-slate-200 focus:border-[#159EF3] focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase text-[#8E9BAE] mb-1">
                        Price (TZS)
                      </label>
                      <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-1.5 bg-[#00101F] border border-[#132038] rounded text-xs text-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase text-[#8E9BAE] mb-1">
                        Duration (Minutes)
                      </label>
                      <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(parseInt(e.target.value) || 30)}
                        className="w-full px-3 py-1.5 bg-[#00101F] border border-[#132038] rounded text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setEditingServiceId(null)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="px-4 py-1.5 bg-[#159EF3] hover:bg-[#38B2FF] text-black font-bold text-xs rounded flex items-center gap-1.5 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{saving ? 'Saving...' : 'Save Service'}</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={service.id}
                className="p-3.5 bg-[#000000] border border-[#132038] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <span className="font-bold text-xs text-[#159EF3] bg-[#00101F] px-2 py-0.5 rounded border border-[#132038]">
                    {service.number}
                  </span>
                  <div>
                    <h4 className="font-display font-bold text-sm text-white uppercase">
                      {service.name}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                      {service.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] text-[#8E9BAE] uppercase block">PRICE (TZS)</span>
                    <span className="font-bold text-xs text-white">
                      {service.price.toLocaleString()}
                    </span>
                  </div>

                  <button
                    onClick={() => handleStartEdit(service)}
                    className="p-2 bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] rounded transition-colors"
                    title="Edit Service Details"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
