import React, { useState } from 'react';
import { InventoryItem, InventoryMovement } from '../../types';
import {
  Search,
  Package,
  AlertTriangle,
  Plus,
  ArrowUpRight,
  ArrowDownLeft,
  Filter,
  CheckCircle2
} from 'lucide-react';

interface InventoryViewProps {
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  onAdjustStock: (itemId: string, delta: number, reason: string) => Promise<any>;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  movements,
  onAdjustStock,
}) => {
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [adjustModalItem, setAdjustModalItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(1);
  const [adjustReason, setAdjustReason] = useState<string>('NEW_STOCK_DELIVERY');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  const filteredItems = inventory.filter((item) => {
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.partNumber?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const lowStockItems = inventory.filter((i) => i.currentStock <= i.reorderLevel);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModalItem) return;
    setSubmitting(true);
    try {
      await onAdjustStock(
        adjustModalItem.id,
        adjustQuantity,
        `${adjustReason}: ${adjustNotes || 'Manual stock adjustment'}`
      );
      setAdjustModalItem(null);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" id="inventory-view-container">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#00101F] border border-[#132038] p-4 rounded-xl">
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase">TOTAL SKUS</span>
          <div className="font-display font-bold text-xl text-white mt-1">{inventory.length} Active</div>
        </div>

        <div className="bg-[#00101F] border border-[#132038] p-4 rounded-xl">
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase">LOW STOCK ALERTS</span>
          <div className="font-display font-bold text-xl text-amber-400 mt-1 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>{lowStockItems.length} Items</span>
          </div>
        </div>

        <div className="bg-[#00101F] border border-[#132038] p-4 rounded-xl">
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase">STOCK VALUATION (COST)</span>
          <div className="font-display font-bold text-base sm:text-lg text-white mt-1">
            {formatCurrency(inventory.reduce((acc, i) => acc + (i.costPrice * i.currentStock), 0))}
          </div>
        </div>

        <div className="bg-[#00101F] border border-[#132038] p-4 rounded-xl">
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase">RETAIL VALUE</span>
          <div className="font-display font-bold text-base sm:text-lg text-[#159EF3] mt-1">
            {formatCurrency(inventory.reduce((acc, i) => acc + (i.sellingPrice * i.currentStock), 0))}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search part name, SKU, part #..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white placeholder-slate-500 font-mono-telemetry focus:outline-none focus:border-[#159EF3]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono-telemetry">
          <span className="text-[#8E9BAE]">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#000000] text-slate-200 border border-[#132038] px-2.5 py-1.5 rounded focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="OIL_LUBRICANTS">Oils & Lubricants</option>
            <option value="FILTERS">Filters</option>
            <option value="BRAKES">Brakes</option>
            <option value="TYRES">Tyres</option>
            <option value="DETAILING_SUPPLIES">Detailing Supplies</option>
          </select>
        </div>
      </div>

      {/* Inventory Table (Responsive) */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-telemetry text-xs">
            <thead className="bg-[#000000] border-b border-[#132038] text-[#8E9BAE] uppercase text-[10px]">
              <tr>
                <th className="p-3.5">SKU / Item</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Bin Location</th>
                <th className="p-3.5">Stock Level</th>
                <th className="p-3.5">Cost Price</th>
                <th className="p-3.5">Selling Price</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#132038]">
              {filteredItems.map((item) => {
                const isLow = item.currentStock <= item.reorderLevel;

                return (
                  <tr key={item.id} className="hover:bg-[#001830] transition-colors">
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs">{item.name}</div>
                      <div className="text-[10px] text-[#159EF3]">{item.sku}</div>
                    </td>
                    <td className="p-3.5 text-slate-300">
                      {item.category.replace(/_/g, ' ')}
                    </td>
                    <td className="p-3.5 text-slate-400">
                      {item.binLocation || 'Warehouse Main'}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        isLow ? 'bg-red-950/60 text-red-400 border border-red-500/40' : 'bg-[#002958]/50 text-emerald-400'
                      }`}>
                        {item.currentStock} {item.unit}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">
                      {formatCurrency(item.costPrice)}
                    </td>
                    <td className="p-3.5 font-bold text-white">
                      {formatCurrency(item.sellingPrice)}
                    </td>
                    <td className="p-3.5 text-right">
                      <button
                        onClick={() => setAdjustModalItem(item)}
                        className="px-2.5 py-1 bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] rounded text-[11px] font-semibold transition-colors"
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      {adjustModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={handleAdjustSubmit}
            className="bg-[#00101F] border border-[#132038] w-full max-w-md rounded-xl p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#132038] pb-3">
              <div>
                <span className="text-[10px] font-mono-telemetry text-[#159EF3] uppercase">
                  AUDITED STOCK ADJUSTMENT
                </span>
                <h3 className="font-display font-bold text-base text-white uppercase">
                  {adjustModalItem.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdjustModalItem(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-[#000000] border border-[#132038] rounded text-xs font-mono-telemetry flex justify-between">
              <span className="text-slate-400">Current Stock:</span>
              <strong className="text-white">{adjustModalItem.currentStock} {adjustModalItem.unit}</strong>
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                Quantity Change (+ to add, - to subtract)
              </label>
              <input
                type="number"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                Adjustment Reason
              </label>
              <select
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white font-mono-telemetry focus:outline-none"
              >
                <option value="NEW_STOCK_DELIVERY">New Stock Delivery (Supplier Receipt)</option>
                <option value="PHYSICAL_AUDIT_CORRECTION">Physical Stock Count Correction</option>
                <option value="DAMAGED_OR_EXPIRED">Damaged / Expired / Written Off</option>
                <option value="RETURNED_BY_CUSTOMER">Returned Item</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">
                Audit Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Delivery from Total Lubricants Dar"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-[#132038] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAdjustModalItem(null)}
                className="py-2 px-4 rounded text-xs font-mono-telemetry text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-xs px-5 py-2.5 rounded shadow-[0_0_15px_rgba(21,158,243,0.3)] transition-all"
              >
                {submitting ? 'RECORDING...' : 'COMMIT ADJUSTMENT'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
