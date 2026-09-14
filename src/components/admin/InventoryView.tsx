import React, { useState } from 'react';
import { InventoryItem, InventoryMovement, Supplier } from '../../types';
import {
  Search,
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Pencil,
  Archive,
  History,
  Trash2,
  ArchiveRestore,
  X,
  PackagePlus
} from 'lucide-react';

interface InventoryViewProps {
  inventory: InventoryItem[];
  movements: InventoryMovement[];
  canWrite: boolean;
  canDelete: boolean;
  suppliers: Supplier[];
  onCreateProduct: (p: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  onUpdateProduct: (id: string, p: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
  onSetProductActive: (id: string, active: boolean) => Promise<{ success: boolean; error?: string }>;
  onDeleteProduct: (id: string) => Promise<{ success: boolean; error?: string }>;
  onStockMovement: (id: string, delta: number, kind: 'PURCHASE' | 'ADJUSTMENT' | 'RETURN', reason: string) => Promise<{ success: boolean; error?: string }>;
  onAdjustStock: (itemId: string, delta: number, reason: string) => Promise<any>;
  onRefresh: () => Promise<void>;
}

const CATEGORY_OPTIONS = [
  { value: 'OILS_FLUIDS', label: 'Oils & Fluids' },
  { value: 'FILTERS', label: 'Filters' },
  { value: 'BRAKES', label: 'Brakes' },
  { value: 'SUSPENSION', label: 'Suspension' },
  { value: 'TYRES', label: 'Tyres' },
  { value: 'ELECTRICAL', label: 'Electrical' },
  { value: 'ACCESSORIES', label: 'Accessories' },
  { value: 'CAR_CARE', label: 'Car Care' },
];

const ADD_REASONS = [
  { value: 'PURCHASE_RECEIVED', label: 'Purchase received (supplier delivery)' },
  { value: 'OPENING_STOCK', label: 'Opening stock (new product)' },
  { value: 'CUSTOMER_RETURN', label: 'Customer return' },
  { value: 'STOCK_CORRECTION', label: 'Stock correction (count found extra)' },
];

const REMOVE_REASONS = [
  { value: 'WORKSHOP_USAGE', label: 'Workshop usage (non-billable)' },
  { value: 'DAMAGED', label: 'Damaged / written off' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'SUPPLIER_RETURN', label: 'Returned to supplier' },
  { value: 'STOCK_CORRECTION', label: 'Stock correction (count found shortage)' },
];

type StockModalState =
  | { kind: 'none' }
  | { kind: 'add'; item: InventoryItem }
  | { kind: 'remove'; item: InventoryItem };

export const InventoryView: React.FC<InventoryViewProps> = ({
  inventory,
  movements,
  canWrite,
  canDelete,
  suppliers,
  onCreateProduct,
  onUpdateProduct,
  onSetProductActive,
  onDeleteProduct,
  onStockMovement,
  onRefresh,
}) => {
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ACTIVE');
  const [busy, setBusy] = useState<boolean>(false);
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [stockModal, setStockModal] = useState<StockModalState>({ kind: 'none' });
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);

  // Shared form fields
  const [fName, setFName] = useState('');
  const [fSku, setFSku] = useState('');
  const [fCategory, setFCategory] = useState('OILS_FLUIDS');
  const [fSupplier, setFSupplier] = useState('');
  const [fCost, setFCost] = useState('');
  const [fRetail, setFRetail] = useState('');
  const [fReorder, setFReorder] = useState('0');
  const [fUnit, setFUnit] = useState('Piece');
  const [fBin, setFBin] = useState('');
  const [fPartNo, setFPartNo] = useState('');
  const [fInitialStock, setFInitialStock] = useState('0');
  const [fStockQty, setFStockQty] = useState('1');
  const [fStockReason, setFStockReason] = useState(ADD_REASONS[0].value);
  const [fStockNote, setFStockNote] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  const resetForm = () => {
    setFName(''); setFSku(''); setFCategory('OILS_FLUIDS'); setFSupplier('');
    setFCost(''); setFRetail(''); setFReorder('0'); setFUnit('Piece');
    setFBin(''); setFPartNo(''); setFInitialStock('0'); setFStockQty('1');
    setFStockReason(ADD_REASONS[0].value); setFStockNote('');
  };

  const filteredItems = inventory.filter((item) => {
    const matchesCat = categoryFilter === 'ALL' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'ALL'
      ? true
      : statusFilter === 'ACTIVE' ? item.active !== false : item.active === false;
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase()) ||
      item.partNumber?.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesStatus && matchesSearch;
  });

  const activeItems = inventory.filter((i) => i.active !== false);
  const lowStockItems = activeItems.filter((i) => i.currentStock <= i.reorderLevel);

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, okText: string) => {
    setBusy(true);
    setBanner(null);
    try {
      const res = await fn();
      if (res.success) {
        await onRefresh();
        setBanner({ kind: 'ok', text: okText });
        return true;
      }
      setBanner({ kind: 'err', text: res.error || 'Operation failed' });
      return false;
    } catch (err) {
      setBanner({ kind: 'err', text: 'Unexpected error — please retry' });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openCreate = () => { resetForm(); setCreateOpen(true); };
  const openEdit = (item: InventoryItem) => {
    resetForm();
    setFName(item.name); setFSku(item.sku); setFCategory(item.category);
    setFSupplier(item.supplierId ?? '');
    setFCost(String(item.costPrice)); setFRetail(String(item.sellingPrice));
    setFReorder(String(item.reorderLevel)); setFUnit(item.unit);
    setFBin(item.binLocation ?? ''); setFPartNo(item.partNumber ?? '');
    setEditItem(item);
  };

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await run(() => onCreateProduct({
      name: fName,
      sku: fSku,
      category: fCategory,
      supplierId: fSupplier || undefined,
      costPrice: parseInt(fCost, 10) || 0,
      sellingPrice: parseInt(fRetail, 10) || 0,
      reorderLevel: parseInt(fReorder, 10) || 0,
      unit: fUnit || 'Piece',
      binLocation: fBin || undefined,
      partNumber: fPartNo || undefined,
      initialStock: parseInt(fInitialStock, 10) || 0,
    }), `${fName} created${parseInt(fInitialStock, 10) > 0 ? ' with opening stock' : ''}`);
    if (ok) setCreateOpen(false);
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    const ok = await run(() => onUpdateProduct(editItem.id, {
      name: fName,
      sku: fSku,
      category: fCategory,
      supplierId: fSupplier || null,
      costPrice: parseInt(fCost, 10) || 0,
      sellingPrice: parseInt(fRetail, 10) || 0,
      reorderLevel: parseInt(fReorder, 10) || 0,
      unit: fUnit,
      binLocation: fBin || null,
      partNumber: fPartNo || null,
    }), `${fName} updated`);
    if (ok) setEditItem(null);
  };

  const submitStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (stockModal.kind === 'none') return;
    const qty = parseInt(fStockQty, 10);
    const item = stockModal.item;
    const delta = stockModal.kind === 'add' ? qty : -qty;
    const reason = `${fStockReason}${fStockNote ? `: ${fStockNote}` : ''}`;
    const ok = await run(
      () => onStockMovement(item.id, delta, stockModal.kind === 'add' ? 'PURCHASE' : 'ADJUSTMENT', reason),
      `${item.name}: ${delta > 0 ? '+' : ''}${delta} ${item.unit} recorded`
    );
    if (ok) setStockModal({ kind: 'none' });
  };

  const submitDelete = async () => {
    if (!confirmDelete) return;
    const ok = await run(() => onDeleteProduct(confirmDelete.id), `${confirmDelete.name} permanently deleted`);
    if (ok) setConfirmDelete(null);
  };

  const itemMovements = historyItem
    ? movements.filter((m) => m.inventoryItemId === historyItem.id || m.sku === historyItem.sku)
    : [];

  return (
    <div className="space-y-6" id="inventory-view-container">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#00101F] border border-[#132038] p-4 rounded-xl">
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase">ACTIVE SKUS</span>
          <div className="font-display font-bold text-xl text-white mt-1">{activeItems.length}</div>
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
            {formatCurrency(activeItems.reduce((acc, i) => acc + (i.costPrice * i.currentStock), 0))}
          </div>
        </div>

        <div className="bg-[#00101F] border border-[#132038] p-4 rounded-xl">
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase">RETAIL VALUE</span>
          <div className="font-display font-bold text-base sm:text-lg text-[#159EF3] mt-1">
            {formatCurrency(activeItems.reduce((acc, i) => acc + (i.sellingPrice * i.currentStock), 0))}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
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

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono-telemetry">
          <span className="text-[#8E9BAE]">Category:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-[#000000] text-slate-200 border border-[#132038] px-2.5 py-1.5 rounded focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#000000] text-slate-200 border border-[#132038] px-2.5 py-1.5 rounded focus:outline-none"
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Archived</option>
            <option value="ALL">All Statuses</option>
          </select>

          {canWrite && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold rounded shadow-[0_0_15px_rgba(21,158,243,0.3)] transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          )}
        </div>
      </div>

      {banner && (
        <div
          className={`p-3 rounded border text-xs font-mono-telemetry ${banner.kind === 'ok'
            ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-300'
            : 'bg-red-950/40 border-red-500/40 text-red-300'}`}
          role="status"
        >
          {banner.text}
        </div>
      )}

      {/* Inventory Table (Responsive) */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-telemetry text-xs">
            <thead className="bg-[#000000] border-b border-[#132038] text-[#8E9BAE] uppercase text-[10px]">
              <tr>
                <th className="p-3.5">SKU / Item</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Bin</th>
                <th className="p-3.5">Stock Level</th>
                <th className="p-3.5">Cost</th>
                <th className="p-3.5">Retail</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#132038]">
              {filteredItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    <Package className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    No products match the current filters.
                  </td>
                </tr>
              )}
              {filteredItems.map((item) => {
                const isLow = item.active !== false && item.currentStock <= item.reorderLevel;
                const inactive = item.active === false;

                return (
                  <tr key={item.id} className={`hover:bg-[#001830] transition-colors ${inactive ? 'opacity-50' : ''}`}>
                    <td className="p-3.5">
                      <div className="font-bold text-white text-xs flex items-center gap-2">
                        {item.name}
                        {inactive && <span className="text-[9px] uppercase text-slate-500 border border-slate-700 rounded px-1">Archived</span>}
                      </div>
                      <div className="text-[10px] text-[#159EF3]">{item.sku}</div>
                    </td>
                    <td className="p-3.5 text-slate-300">{item.category.replace(/_/g, ' ')}</td>
                    <td className="p-3.5 text-slate-400">{item.binLocation || '—'}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded font-bold ${isLow ? 'bg-red-950/60 text-red-400 border border-red-500/40' : 'bg-[#002958]/50 text-emerald-400'}`}>
                        {item.currentStock} {item.unit}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-400">{formatCurrency(item.costPrice)}</td>
                    <td className="p-3.5 font-bold text-white">{formatCurrency(item.sellingPrice)}</td>
                    <td className="p-3.5 text-right">
                      {canWrite && !inactive && (
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <button
                            onClick={() => setStockModal({ kind: 'add', item })}
                            title="Add stock (journaled)"
                            className="px-2 py-1 bg-[#002958] hover:bg-emerald-500 hover:text-black text-emerald-400 rounded text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Add Stock
                          </button>
                          <button
                            onClick={() => setStockModal({ kind: 'remove', item })}
                            title="Remove stock (journaled)"
                            className="px-2 py-1 bg-[#002958] hover:bg-amber-500 hover:text-black text-amber-400 rounded text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            <Minus className="w-3 h-3" /> Remove
                          </button>
                          <button
                            onClick={() => openEdit(item)}
                            title="Edit product details"
                            className="p-1.5 bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] rounded transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setHistoryItem(item)}
                            title="Movement history"
                            className="p-1.5 bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] rounded transition-colors"
                          >
                            <History className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => run(() => onSetProductActive(item.id, false), `${item.name} archived`)}
                            title="Deactivate (archives; history preserved)"
                            className="p-1.5 bg-[#002958] hover:bg-slate-400 hover:text-black text-slate-300 rounded transition-colors"
                          >
                            <Archive className="w-3 h-3" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setConfirmDelete(item)}
                              title="Delete permanently (only if no history)"
                              className="p-1.5 bg-[#002958] hover:bg-red-500 hover:text-black text-red-400 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {canWrite && inactive && (
                        <button
                          onClick={() => run(() => onSetProductActive(item.id, true), `${item.name} reactivated`)}
                          className="px-2 py-1 bg-[#002958] hover:bg-emerald-500 hover:text-black text-emerald-400 rounded text-[11px] font-semibold transition-colors inline-flex items-center gap-1"
                        >
                          <ArchiveRestore className="w-3 h-3" /> Reactivate
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Create / Edit Product Modal ---------- */}
      {(createOpen || editItem) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form
            onSubmit={createOpen ? submitCreate : submitEdit}
            className="bg-[#00101F] border border-[#132038] w-full max-w-lg rounded-xl p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-[#132038] pb-3">
              <div className="flex items-center gap-2">
                <PackagePlus className="w-4 h-4 text-[#159EF3]" />
                <span className="text-[10px] font-mono-telemetry text-[#159EF3] uppercase">
                  {createOpen ? 'NEW INVENTORY PRODUCT' : 'EDIT PRODUCT'}
                </span>
              </div>
              <button type="button" onClick={() => { setCreateOpen(false); setEditItem(null); }} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Product name *</label>
                <input required minLength={2} maxLength={120} value={fName} onChange={(e) => setFName(e.target.value)}
                  placeholder="e.g. Engine Oil 5W-30 Full Synthetic"
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white focus:border-[#159EF3] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">SKU *</label>
                <input required value={fSku} onChange={(e) => setFSku(e.target.value.toUpperCase())}
                  placeholder="e.g. OIL-5W30-FS"
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Part #</label>
                <input value={fPartNo} onChange={(e) => setFPartNo(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white focus:border-[#159EF3] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Category *</label>
                <select value={fCategory} onChange={(e) => setFCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white focus:outline-none">
                  {CATEGORY_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Supplier</label>
                <select value={fSupplier} onChange={(e) => setFSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white focus:outline-none">
                  <option value="">— None —</option>
                  {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Cost price (TZS) *</label>
                <input required type="number" min="0" step="1" value={fCost} onChange={(e) => setFCost(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Retail price (TZS) *</label>
                <input required type="number" min="0" step="1" value={fRetail} onChange={(e) => setFRetail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Reorder level *</label>
                <input required type="number" min="0" step="1" value={fReorder} onChange={(e) => setFReorder(e.target.value)}
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Unit</label>
                <input value={fUnit} onChange={(e) => setFUnit(e.target.value)} placeholder="Piece / Litre / Set"
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white focus:border-[#159EF3] focus:outline-none" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Bin location</label>
                <input value={fBin} onChange={(e) => setFBin(e.target.value)} placeholder="e.g. Shelf A-3"
                  className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white focus:border-[#159EF3] focus:outline-none" />
              </div>
              {createOpen && (
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Opening stock (journaled)</label>
                  <input type="number" min="0" step="1" value={fInitialStock} onChange={(e) => setFInitialStock(e.target.value)}
                    className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none" />
                  <p className="text-[10px] text-slate-500 mt-1">Opening stock is recorded as a PURCHASE movement — never a silent write.</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-[#132038] flex items-center justify-between">
              <button type="button" onClick={() => { setCreateOpen(false); setEditItem(null); }}
                className="py-2 px-4 rounded text-xs font-mono-telemetry text-slate-400 hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={busy}
                className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-xs px-5 py-2.5 rounded shadow-[0_0_15px_rgba(21,158,243,0.3)] transition-all disabled:opacity-50">
                {busy ? 'SAVING...' : createOpen ? 'CREATE PRODUCT' : 'SAVE CHANGES'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Add / Remove Stock Modal ---------- */}
      {stockModal.kind !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <form onSubmit={submitStock} className="bg-[#00101F] border border-[#132038] w-full max-w-md rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#132038] pb-3">
              <div>
                <span className={`text-[10px] font-mono-telemetry uppercase ${stockModal.kind === 'add' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {stockModal.kind === 'add' ? 'ADD STOCK (RECEIVE)' : 'REMOVE STOCK (REDUCE)'}
                </span>
                <h3 className="font-display font-bold text-base text-white uppercase">{stockModal.item.name}</h3>
              </div>
              <button type="button" onClick={() => setStockModal({ kind: 'none' })} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#000000] border border-[#132038] rounded text-xs font-mono-telemetry flex justify-between">
              <span className="text-slate-400">Current Stock:</span>
              <strong className="text-white">{stockModal.item.currentStock} {stockModal.item.unit}</strong>
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Quantity</label>
              <input required type="number" min="1" step="1" value={fStockQty} onChange={(e) => setFStockQty(e.target.value)}
                className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white font-mono-telemetry focus:border-[#159EF3] focus:outline-none" autoFocus />
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Reason</label>
              <select value={fStockReason} onChange={(e) => setFStockReason(e.target.value)}
                className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white focus:outline-none">
                {(stockModal.kind === 'add' ? ADD_REASONS : REMOVE_REASONS).map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono-telemetry text-[#8E9BAE] uppercase mb-1">Audit note / reference</label>
              <input value={fStockNote} onChange={(e) => setFStockNote(e.target.value)} placeholder="e.g. Delivery note #4471 from Total"
                className="w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-xs text-white placeholder-slate-600 focus:outline-none" />
            </div>

            <p className="text-[10px] text-slate-500 font-mono-telemetry">
              Every stock change writes a movement entry: date, type, quantity, previous → resulting stock, reason and your identity.
            </p>

            <div className="pt-3 border-t border-[#132038] flex items-center justify-between">
              <button type="button" onClick={() => setStockModal({ kind: 'none' })}
                className="py-2 px-4 rounded text-xs font-mono-telemetry text-slate-400 hover:text-white">
                Cancel
              </button>
              <button type="submit" disabled={busy}
                className={`font-display font-bold text-xs px-5 py-2.5 rounded transition-all disabled:opacity-50 ${stockModal.kind === 'add' ? 'bg-emerald-500 hover:bg-emerald-400 text-black' : 'bg-amber-500 hover:bg-amber-400 text-black'}`}>
                {busy ? 'RECORDING...' : stockModal.kind === 'add' ? 'RECORD ADDITION' : 'RECORD REMOVAL'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Movement History Modal ---------- */}
      {historyItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#00101F] border border-[#132038] w-full max-w-2xl rounded-xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#132038] p-4">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#159EF3]" />
                <div>
                  <span className="text-[10px] font-mono-telemetry text-[#159EF3] uppercase">MOVEMENT HISTORY</span>
                  <h3 className="font-display font-bold text-sm text-white">{historyItem.name} · {historyItem.sku}</h3>
                </div>
              </div>
              <button onClick={() => setHistoryItem(null)} className="p-1 rounded text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {itemMovements.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No stock movements recorded for this product yet.</p>
              ) : (
                <table className="w-full text-left font-mono-telemetry text-[11px]">
                  <thead className="text-[#8E9BAE] uppercase text-[9px] border-b border-[#132038]">
                    <tr>
                      <th className="p-2">Date</th>
                      <th className="p-2">Type</th>
                      <th className="p-2 text-right">Change</th>
                      <th className="p-2 text-right">Stock</th>
                      <th className="p-2">Reason</th>
                      <th className="p-2">By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#132038]">
                    {itemMovements.map((m) => (
                      <tr key={m.id}>
                        <td className="p-2 text-slate-400 whitespace-nowrap">{new Date(m.timestamp).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="p-2 text-[#159EF3]">{m.type}</td>
                        <td className={`p-2 text-right font-bold ${m.quantityChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {m.quantityChange > 0 ? '+' : ''}{m.quantityChange}
                        </td>
                        <td className="p-2 text-right text-slate-300">{m.previousStock} → {m.resultingStock}</td>
                        <td className="p-2 text-slate-400">{m.reason}</td>
                        <td className="p-2 text-slate-400">{m.actor || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Permanent Delete Confirmation ---------- */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-[#00101F] border border-red-800 w-full max-w-md rounded-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-[#132038] pb-3">
              <Trash2 className="w-4 h-4 text-red-400" />
              <span className="text-[10px] font-mono-telemetry text-red-400 uppercase">DELETE PERMANENTLY</span>
            </div>
            <p className="text-xs text-slate-300">
              Permanently delete <strong className="text-white">{confirmDelete.name}</strong> ({confirmDelete.sku})?
            </p>
            <p className="text-[11px] text-slate-400 font-mono-telemetry">
              Only possible when the product has <strong className="text-white">no stock movements, work-order usage or POS history</strong>.
              Anything with history is rejected by the database — archive it instead to preserve the audit trail.
            </p>
            <div className="pt-3 border-t border-[#132038] flex items-center justify-end gap-3">
              <button onClick={() => setConfirmDelete(null)} className="py-2 px-4 rounded text-xs font-mono-telemetry text-slate-400 hover:text-white">
                Cancel
              </button>
              <button onClick={submitDelete} disabled={busy}
                className="bg-red-600 hover:bg-red-500 text-white font-display font-bold text-xs px-5 py-2.5 rounded transition-all disabled:opacity-50">
                {busy ? 'DELETING...' : 'DELETE PERMANENTLY'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
