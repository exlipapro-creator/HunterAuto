import React, { useState } from 'react';
import { Invoice } from '../../types';
import {
  Printer,
  FileText,
  CheckCircle2,
  AlertCircle,
  Download,
  Share2,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { HunterLogo } from '../brand/HunterLogo';

interface InvoicingViewProps {
  invoices: Invoice[];
  initialInvoiceNumber?: string;
}

export const InvoicingView: React.FC<InvoicingViewProps> = ({
  invoices,
  initialInvoiceNumber,
}) => {
  const [selectedNumber, setSelectedNumber] = useState<string>(
    initialInvoiceNumber || invoices[0]?.invoiceNumber || 'HA-2026-000184'
  );

  const selectedInvoice = invoices.find(i => i.invoiceNumber === selectedNumber) || invoices[0];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6" id="invoicing-view-container">
      {/* Selector and Actions Bar */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileText className="w-5 h-5 text-[#159EF3]" />
          <div>
            <h3 className="font-display font-bold text-base text-white uppercase">
              HUNTER OFFICIAL INVOICE ENGINE
            </h3>
            <span className="text-xs font-mono-telemetry text-slate-400">
              Tax Compliant • Cryptographic Verification Token
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedInvoice?.invoiceNumber || ''}
            onChange={(e) => setSelectedNumber(e.target.value)}
            className="bg-[#000000] border border-[#132038] text-white font-mono-telemetry text-xs px-3 py-2 rounded focus:outline-none focus:border-[#159EF3]"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.invoiceNumber}>
                {inv.invoiceNumber} — {inv.vehicleRegistration} ({inv.paymentStatus})
              </option>
            ))}
          </select>

          <button
            onClick={() => window.print()}
            className="bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] border border-[#159EF3]/40 px-3 py-2 rounded text-xs font-mono-telemetry font-bold flex items-center gap-1.5 transition-colors"
            id="invoice-print-btn"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print A4</span>
          </button>
        </div>
      </div>

      {/* Printable / Viewable Official Invoice Card */}
      {selectedInvoice && (
        <div
          className="bg-white text-slate-900 rounded-xl p-6 sm:p-10 shadow-2xl max-w-4xl mx-auto font-mono-telemetry print:shadow-none print:p-0"
          id="official-hunter-invoice"
        >
          {/* Top Invoice Header */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-slate-900 pb-6 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded bg-[#00101F] text-[#159EF3] flex items-center justify-center font-bold">
                  H
                </div>
                <div>
                  <h1 className="font-display font-extrabold text-xl tracking-wider text-black uppercase leading-none">
                    HUNTER AUTOWORKS
                  </h1>
                  <span className="text-[10px] tracking-widest uppercase font-bold text-slate-600 block mt-0.5">
                    THE CAR LAB • DAR ES SALAAM
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600">
                Kinondoni Morocco, Block 41, Dar es Salaam, Tanzania<br />
                Hotlines: 0654 686 962 / 0627 629 345<br />
                TIN: 104-892-340 | VRN: 40-029481
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-xs uppercase font-bold text-slate-500 block">TAX INVOICE</span>
              <span className="text-2xl font-bold text-black block tracking-tight">
                {selectedInvoice.invoiceNumber}
              </span>
              <div className="text-xs text-slate-600 mt-1 space-y-0.5">
                <div>Date Issued: <strong>{selectedInvoice.createdAt.split('T')[0]}</strong></div>
                <div>Status: <span className="font-bold text-emerald-700 uppercase bg-emerald-100 px-2 py-0.5 rounded">{selectedInvoice.paymentStatus}</span></div>
              </div>
            </div>
          </div>

          {/* Bill To & Vehicle Metadata Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-slate-300 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                BILLED TO CUSTOMER:
              </span>
              <strong className="text-sm text-black block">{selectedInvoice.customerName}</strong>
              <div className="text-slate-600 mt-0.5">
                Phone: {selectedInvoice.customerPhone || 'N/A'}<br />
                Location: Dar es Salaam, Tanzania
              </div>
            </div>

            <div className="sm:text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                VEHICLE LAB RECORD:
              </span>
              <strong className="text-sm text-black block">
                {selectedInvoice.vehicleRegistration}
              </strong>
              <div className="text-slate-600 mt-0.5">
                Model: {selectedInvoice.vehicleMakeModel}<br />
                Work Order: {selectedInvoice.workOrderNumber}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="py-6">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b-2 border-slate-900 text-[10px] uppercase text-slate-600">
                  <th className="py-2">Item / Service Description</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Unit Price</th>
                  <th className="py-2 text-right">Total (TZS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedInvoice.items.map((it, idx) => (
                  <tr key={idx} className="py-2.5">
                    <td className="py-2.5 pr-2">
                      <strong className="text-black block">{it.description}</strong>
                      <span className="text-[10px] text-slate-500 uppercase">{it.type}</span>
                    </td>
                    <td className="py-2.5 text-center text-slate-700">{it.quantity}</td>
                    <td className="py-2.5 text-right text-slate-700">{formatCurrency(it.unitPrice)}</td>
                    <td className="py-2.5 text-right font-bold text-black">{formatCurrency(it.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Tax Calculation */}
          <div className="border-t-2 border-slate-900 pt-4 flex flex-col sm:flex-row justify-between items-start gap-6 text-xs">
            {/* Payment Instructions & Bank Details */}
            <div className="max-w-xs space-y-1.5 text-[11px] text-slate-600">
              <strong className="text-black uppercase block text-xs">PAYMENT METHODS:</strong>
              <div>• <strong>M-Pesa Lipa Namba (Till):</strong> 5892011 (Hunter Autoworks)</div>
              <div>• <strong>CRDB Bank:</strong> 0150829104800 (Hunter Autoworks Ltd)</div>
              <div>• <strong>NMB Bank:</strong> 20810092834 (Hunter Autoworks Ltd)</div>
              <div className="pt-2 text-[10px] text-slate-500">
                Work completed under Hunter Craft Warranty terms.
              </div>
            </div>

            {/* Calculations Box */}
            <div className="w-full sm:w-64 space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-semibold">{formatCurrency(selectedInvoice.subtotal)}</span>
              </div>
              {selectedInvoice.discount > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>Discount:</span>
                  <span>-{formatCurrency(selectedInvoice.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>VAT (18% Included):</span>
                <span>{formatCurrency(selectedInvoice.tax)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-black border-t-2 border-slate-900 pt-2">
                <span>Total Due:</span>
                <span>{formatCurrency(selectedInvoice.total)}</span>
              </div>
            </div>
          </div>

          {/* Bottom Security Verification QR & Digital Signature */}
          <div className="mt-8 pt-4 border-t border-slate-300 flex items-center justify-between text-[10px] text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded border border-slate-300 flex items-center justify-center bg-slate-50">
                <QrCode className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <span className="font-bold text-slate-700 uppercase block">CRYPTOGRAPHIC TOKEN:</span>
                <span>{selectedInvoice.verificationHash}</span>
              </div>
            </div>

            <div className="text-right">
              <span>Authorized Signature:</span>
              <strong className="block text-slate-800">Hunter Workshop Management</strong>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
