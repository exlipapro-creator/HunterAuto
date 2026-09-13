import React, { useState } from 'react';
import { ServiceItem, InventoryItem, PosSale, PaymentMethod } from '../../types';
import {
  Search,
  ShoppingCart,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Printer,
  CheckCircle2,
  X,
  User,
  Car
} from 'lucide-react';

interface PosTerminalProps {
  services: ServiceItem[];
  inventory: InventoryItem[];
  cashierName?: string;
  onCompleteSale: (saleData: any) => Promise<any>;
}

export const PosTerminal: React.FC<PosTerminalProps> = ({
  services,
  inventory,
  cashierName = 'Said Juma',
  onCompleteSale,
}) => {
  const [activeTab, setActiveTab] = useState<'SERVICES' | 'PARTS'>('SERVICES');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<{
    id: string;
    name: string;
    type: 'SERVICE' | 'INVENTORY_ITEM';
    unitPrice: number;
    quantity: number;
  }[]>([]);

  // Customer info
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [vehicleReg, setVehicleReg] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('M_PESA');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // State after sale completion
  const [completedSale, setCompletedSale] = useState<PosSale | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  const addToCart = (item: { id: string; name: string; type: 'SERVICE' | 'INVENTORY_ITEM'; price: number }) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
    } else {
      setCart([...cart, { id: item.id, name: item.name, type: item.type, unitPrice: item.price, quantity: 1 }]);
    }
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.id === id) {
        const newQ = c.quantity + delta;
        return newQ > 0 ? { ...c, quantity: newQ } : null;
      }
      return c;
    }).filter(Boolean) as any);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(c => c.id !== id));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  const total = Math.max(0, subtotal - discountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const salePayload = {
        cashierName,
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || 'Counter',
        vehicleRegistration: vehicleReg || 'N/A',
        items: cart.map(c => ({
          itemId: c.id,
          itemType: c.type,
          name: c.name,
          quantity: c.quantity,
          unitPrice: c.unitPrice,
          totalPrice: c.unitPrice * c.quantity
        })),
        subtotal,
        discount: discountAmount,
        total,
        paymentMethod
      };

      const res = await onCompleteSale(salePayload);
      if (res && res.sale) {
        setCompletedSale(res.sale);
        setCart([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="pos-terminal-container">
      {/* Catalog & Quick Lookup Area (7 Cols) */}
      <div className="lg:col-span-7 space-y-4">
        {/* Header & Category Switch */}
        <div className="bg-[#00101F] border border-[#132038] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('SERVICES')}
              className={`px-4 py-2 rounded font-display font-bold text-xs uppercase transition-all ${
                activeTab === 'SERVICES'
                  ? 'bg-[#159EF3] text-black shadow-[0_0_10px_rgba(21,158,243,0.3)]'
                  : 'bg-[#000000] text-slate-300 border border-[#132038]'
              }`}
            >
              Services ({services.length})
            </button>
            <button
              onClick={() => setActiveTab('PARTS')}
              className={`px-4 py-2 rounded font-display font-bold text-xs uppercase transition-all ${
                activeTab === 'PARTS'
                  ? 'bg-[#159EF3] text-black shadow-[0_0_10px_rgba(21,158,243,0.3)]'
                  : 'bg-[#000000] text-slate-300 border border-[#132038]'
              }`}
            >
              Inventory / Parts ({inventory.length})
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search catalogue..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-[#000000] border border-[#132038] rounded text-xs text-white placeholder-slate-500 font-mono-telemetry focus:outline-none focus:border-[#159EF3]"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
          {activeTab === 'SERVICES'
            ? services
                .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.number.includes(searchQuery))
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => addToCart({ id: s.id, name: s.name, type: 'SERVICE', price: s.price })}
                    className="p-3 bg-[#00101F] hover:bg-[#002958]/40 border border-[#132038] hover:border-[#159EF3]/50 rounded-lg text-left transition-all flex flex-col justify-between group active:scale-95"
                  >
                    <div>
                      <span className="font-mono-telemetry text-[10px] text-[#159EF3]">
                        #{s.number}
                      </span>
                      <h4 className="font-display font-bold text-xs text-white uppercase mt-0.5 line-clamp-2 group-hover:text-[#159EF3]">
                        {s.name}
                      </h4>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#132038] font-mono-telemetry text-xs font-bold text-white">
                      {formatCurrency(s.price)}
                    </div>
                  </button>
                ))
            : inventory
                .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.sku.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((i) => (
                  <button
                    key={i.id}
                    onClick={() => addToCart({ id: i.id, name: i.name, type: 'INVENTORY_ITEM', price: i.sellingPrice })}
                    className="p-3 bg-[#00101F] hover:bg-[#002958]/40 border border-[#132038] hover:border-[#159EF3]/50 rounded-lg text-left transition-all flex flex-col justify-between group active:scale-95"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-mono-telemetry text-[9px] text-[#8E9BAE]">
                          {i.sku}
                        </span>
                        <span className="text-[9px] font-mono-telemetry text-emerald-400">
                          {i.currentStock} in stock
                        </span>
                      </div>
                      <h4 className="font-display font-bold text-xs text-white uppercase mt-0.5 line-clamp-2 group-hover:text-[#159EF3]">
                        {i.name}
                      </h4>
                    </div>
                    <div className="mt-3 pt-2 border-t border-[#132038] font-mono-telemetry text-xs font-bold text-white">
                      {formatCurrency(i.sellingPrice)}
                    </div>
                  </button>
                ))}
        </div>
      </div>

      {/* Counter Cart & Checkout Area (5 Cols) */}
      <div className="lg:col-span-5 bg-[#00101F] border border-[#132038] rounded-xl p-4 sm:p-5 flex flex-col justify-between shadow-xl">
        <div>
          <div className="flex items-center justify-between border-b border-[#132038] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#159EF3]" />
              <h3 className="font-display font-bold text-base text-white uppercase">
                COUNTER REGISTER
              </h3>
            </div>
            <span className="text-xs font-mono-telemetry text-slate-400">
              Cashier: <strong className="text-slate-200">{cashierName}</strong>
            </span>
          </div>

          {/* Customer / Vehicle Attachment */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <input
              type="text"
              placeholder="Plate: T 123 ABC"
              value={vehicleReg}
              onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
              className="px-2.5 py-1.5 bg-[#000000] border border-[#132038] rounded text-xs text-white font-mono-telemetry uppercase placeholder-slate-600 focus:outline-none focus:border-[#159EF3]"
            />
            <input
              type="text"
              placeholder="Customer Phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="px-2.5 py-1.5 bg-[#000000] border border-[#132038] rounded text-xs text-white font-mono-telemetry placeholder-slate-600 focus:outline-none focus:border-[#159EF3]"
            />
          </div>

          {/* Cart Items List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {cart.length === 0 ? (
              <div className="p-8 text-center text-xs font-mono-telemetry text-slate-500 border border-dashed border-[#132038] rounded-lg">
                Register empty. Tap services or items on the left.
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-[#000000] border border-[#132038] rounded-lg flex items-center justify-between font-mono-telemetry text-xs"
                >
                  <div className="flex-1 pr-2">
                    <span className="text-white font-semibold block truncate">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-[#8E9BAE]">
                      {formatCurrency(item.unitPrice)} each
                    </span>
                  </div>

                  {/* Quantity Controller */}
                  <div className="flex items-center gap-1.5 mr-3">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-5 h-5 rounded bg-[#00101F] border border-[#132038] text-slate-300 flex items-center justify-center hover:bg-slate-800"
                    >
                      -
                    </button>
                    <span className="w-5 text-center font-bold text-white text-xs">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-5 h-5 rounded bg-[#00101F] border border-[#132038] text-slate-300 flex items-center justify-center hover:bg-slate-800"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-bold text-white min-w-[70px] text-right">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </span>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 ml-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Cart Totals & Payment Selector */}
        <div className="pt-4 border-t border-[#132038] mt-4 space-y-3">
          {/* Payment Method Selector */}
          <div>
            <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase block mb-1">
              PAYMENT METHOD
            </span>
            <div className="grid grid-cols-3 gap-1.5 font-mono-telemetry text-xs">
              {(['M_PESA', 'CASH', 'TIGO_PESA', 'AIRTEL_MONEY', 'CARD', 'BANK_TRANSFER'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`py-1.5 px-2 rounded border text-[10px] font-bold uppercase transition-all ${
                    paymentMethod === method
                      ? 'bg-[#159EF3] text-black border-[#159EF3]'
                      : 'bg-[#000000] text-slate-400 border-[#132038]'
                  }`}
                >
                  {method.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Discount Field */}
          <div className="flex items-center justify-between text-xs font-mono-telemetry">
            <span className="text-slate-400">Discount (TZS):</span>
            <input
              type="number"
              value={discountAmount || ''}
              placeholder="0"
              onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              className="w-24 px-2 py-1 bg-[#000000] border border-[#132038] rounded text-right text-white font-mono-telemetry text-xs focus:outline-none"
            />
          </div>

          {/* Totals Breakdown */}
          <div className="space-y-1 font-mono-telemetry text-xs pt-2 border-t border-[#132038]">
            <div className="flex justify-between text-slate-400">
              <span>Subtotal:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-amber-400">
                <span>Discount:</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-white pt-1">
              <span>Grand Total:</span>
              <span className="text-[#159EF3]">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || submitting}
            className="w-full py-3 bg-[#159EF3] hover:bg-[#38B2FF] disabled:opacity-40 text-black font-display font-bold text-sm rounded flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(21,158,243,0.35)] transition-all active:scale-[0.98]"
            id="pos-checkout-btn"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'PROCESSING SALE...' : `CHARGE ${formatCurrency(total)}`}</span>
          </button>
        </div>
      </div>

      {/* Completed Sale Thermal Receipt Modal */}
      {completedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-white text-black p-6 rounded-lg w-full max-w-sm font-mono-telemetry text-xs space-y-3 shadow-2xl">
            <div className="text-center border-b border-black pb-3">
              <h3 className="font-bold text-base uppercase">HUNTER AUTOWORKS</h3>
              <p className="text-[10px]">THE CAR LAB • DAR ES SALAAM</p>
              <p className="text-[10px]">Kinondoni Morocco, Block 41</p>
              <p className="text-[10px]">Tel: 0654686962 / 0627629345</p>
            </div>

            <div className="space-y-1 text-[11px]">
              <div>Receipt: <strong>{completedSale.receiptNumber}</strong></div>
              <div>Date: {new Date(completedSale.createdAt).toLocaleString()}</div>
              <div>Cashier: {completedSale.cashierName}</div>
              <div>Payment: {completedSale.paymentMethod}</div>
              {completedSale.vehicleRegistration && (
                <div>Vehicle: {completedSale.vehicleRegistration}</div>
              )}
            </div>

            <div className="border-t border-b border-black py-2 space-y-1">
              {completedSale.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{it.quantity}x {it.name}</span>
                  <span>{formatCurrency(it.totalPrice)}</span>
                </div>
              ))}
            </div>

            <div className="text-right space-y-0.5 pt-1">
              <div className="text-sm font-bold">TOTAL: {formatCurrency(completedSale.total)}</div>
            </div>

            <div className="text-center text-[9px] pt-3 border-t border-dashed border-slate-400">
              Thank you for trusting Hunter Autoworks.<br />
              Precision engineering guaranteed.
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-slate-900 text-white rounded flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={() => setCompletedSale(null)}
                className="flex-1 py-2 border border-slate-400 rounded text-center"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
