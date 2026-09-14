import React, { useState } from 'react';
import { Invoice, InvoiceItem } from '../../types';
import { Printer, FileText, ShieldCheck } from 'lucide-react';
import { HunterLogo } from '../brand/HunterLogo';

interface InvoicingViewProps {
  invoices: Invoice[];
  initialInvoiceNumber?: string;
}

/**
 * Presentational money formatter — fail-closed.
 * Financial truth stays on the server: values arrive as integers mapped
 * straight from Supabase's exact bigint representation. This formatter only
 * renders them (thousands separators); it never calculates, rounds, or
 * divides. Anything that is not a finite number renders as an em dash
 * instead of "NaN"/"undefined" ever reaching a customer document.
 */
const formatTzs = (value: unknown): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `TZS ${Math.trunc(value).toLocaleString('en-US')}`;
};

/** Fail-closed date presentation for the issued date. */
const formatIssuedDate = (iso: string | undefined): string => {
  if (!iso || typeof iso !== 'string') return '—';
  return iso.split('T')[0] || '—';
};

/** Restrained per-status chip treatment — always derived from real payment state. */
const STATUS_CHIP: Record<string, string> = {
  PAID: 'text-emerald-700 bg-emerald-50 border-emerald-600/30',
  PARTIAL: 'text-amber-700 bg-amber-50 border-amber-600/30',
  PENDING: 'text-slate-700 bg-slate-100 border-slate-400/40',
  REFUNDED: 'text-slate-700 bg-slate-100 border-slate-400/40',
  VOID: 'text-red-700 bg-red-50 border-red-600/30',
};
const chipFor = (status: string): string =>
  STATUS_CHIP[status] ?? 'text-slate-700 bg-slate-100 border-slate-400/40';

/** Line total for display: prefers the totalPrice display alias, falls back to the canonical total. */
const lineTotal = (it: InvoiceItem): number => (typeof it.totalPrice === 'number' ? it.totalPrice : it.total);

export const InvoicingView: React.FC<InvoicingViewProps> = ({
  invoices,
  initialInvoiceNumber,
}) => {
  const [selectedNumber, setSelectedNumber] = useState<string>(
    initialInvoiceNumber || invoices[0]?.invoiceNumber || ''
  );

  const selectedInvoice = invoices.find(i => i.invoiceNumber === selectedNumber) || invoices[0];

  /** Print only the invoice document: the shell is neutralized by CSS while
   *  body.printing-invoice is set; class is always removed afterwards. */
  const handlePrint = () => {
    document.body.classList.add('printing-invoice');
    const done = () => document.body.classList.remove('printing-invoice');
    window.addEventListener('afterprint', done, { once: true });
    setTimeout(done, 2000); // safety net for browsers that never fire afterprint
    window.print();
  };

  return (
    <div className="space-y-6" id="invoicing-view-container">
      {/* Selector and Actions Bar — dark staff shell, unchanged identity */}
      <div className="bg-[#00101F] border border-[#132038] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0 max-w-full overflow-hidden">
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

        <div className="flex items-center gap-2 min-w-0 max-w-full">
          <select
            value={selectedInvoice?.invoiceNumber || ''}
            onChange={(e) => setSelectedNumber(e.target.value)}
            aria-label="Select invoice"
            className="bg-[#000000] border border-[#132038] text-white font-mono-telemetry text-xs px-3 py-2 rounded focus:outline-none focus:border-[#159EF3] min-w-0 flex-1 max-w-full w-full sm:w-auto truncate"
          >
            {invoices.map((inv) => (
              <option key={inv.id} value={inv.invoiceNumber}>
                {inv.invoiceNumber} — {inv.vehicleRegistration} ({inv.paymentStatus})
              </option>
            ))}
          </select>

          <button
            onClick={handlePrint}
            className="bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] border border-[#159EF3]/40 px-3 py-2 rounded text-xs font-mono-telemetry font-bold flex items-center gap-1.5 transition-colors"
            id="invoice-print-btn"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print A4</span>
          </button>
        </div>
      </div>

      {/* Official invoice document — white business document inside the dark staff shell */}
      {selectedInvoice && (
        <div
          id="official-hunter-invoice"
          className="invoice-document bg-white text-slate-900 max-w-4xl mx-auto border border-slate-200 shadow-sm sm:shadow-xl"
        >
          <div className="p-5 sm:p-10 print:p-8">
            {/* 1 — Brand header: real logo, business identity, invoice identity */}
            <header className="flex flex-col sm:flex-row justify-between gap-6 pb-6 border-b-2 border-[#0A1E33]">
              <div className="flex items-start gap-4 min-w-0">
                <HunterLogo variant="document" className="shrink-0" />
                <div className="min-w-0">
                  <h1 className="font-display font-extrabold text-2xl text-[#0A1E33] uppercase leading-none tracking-wide">
                    Hunter Autoworks
                  </h1>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#159EF3] mt-1.5">
                    The Car Lab • Dar es Salaam
                  </p>
                  <p className="text-[11px] text-slate-600 leading-relaxed mt-3">
                    Kinondoni Morocco, Block 41, Dar es Salaam, Tanzania<br />
                    Hotlines: 0654 686 962 / 0627 629 345<br />
                    TIN: 104-892-340&ensp;•&ensp;VRN: 40-029481
                  </p>
                </div>
              </div>

              <div className="sm:text-right shrink-0">
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500">
                  Tax Invoice
                </p>
                <p className="font-mono-telemetry text-xl sm:text-2xl font-bold text-[#0A1E33] mt-1 break-all">
                  {selectedInvoice.invoiceNumber}
                </p>
                <div className="text-xs text-slate-600 mt-3 space-y-1.5 sm:ml-auto sm:w-max">
                  <div className="flex sm:justify-between gap-4">
                    <span>Date issued</span>
                    <span className="font-semibold text-slate-800">
                      {formatIssuedDate(selectedInvoice.createdAt)}
                    </span>
                  </div>
                  <div className="flex sm:justify-between gap-4 items-center">
                    <span>Status</span>
                    <span
                      className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${chipFor(selectedInvoice.paymentStatus)}`}
                    >
                      {selectedInvoice.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
            </header>

            {/* 2 — Customer / vehicle, compact two-column record */}
            <section className="grid grid-cols-1 sm:grid-cols-2 mt-6 border border-slate-200 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 print:break-inside-avoid page-break-inside-avoid">
              <div className="bg-[#F6F9FC] p-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                  Billed to customer
                </h2>
                <p className="text-sm font-bold text-slate-900 break-words">{selectedInvoice.customerName}</p>
                <p className="text-xs text-slate-600 mt-1">
                  Phone: {selectedInvoice.customerPhone || '—'}<br />
                  Location: Dar es Salaam, Tanzania
                </p>
              </div>
              <div className="bg-[#F6F9FC] p-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                  Vehicle
                </h2>
                <p className="text-sm font-bold text-slate-900 break-words">{selectedInvoice.vehicleRegistration}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {selectedInvoice.vehicleMakeModel || '—'}<br />
                  Work order: {selectedInvoice.workOrderNumber || '—'}
                </p>
              </div>
            </section>

            {/* 3 — Line items: real rows only, no reordering, no duplication.
                Narrow screens: the table scrolls INTERNALLY — the page itself
                must never overflow horizontally (§15). */}
            <div className="overflow-x-auto mt-6 print:overflow-visible">
            <table className="w-full text-xs border-collapse print:break-inside-avoid page-break-inside-avoid">
              <thead>
                <tr className="bg-[#0A1E33] text-white">
                  <th scope="col" className="py-2 pl-3 pr-2 text-left text-[10px] font-bold uppercase tracking-wider w-8 print-row-head">#</th>
                  <th scope="col" className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider print-row-head">Item / service description</th>
                  <th scope="col" className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wider w-12 print-row-head">Qty</th>
                  <th scope="col" className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider w-28 print-row-head">Unit price (TZS)</th>
                  <th scope="col" className="py-2 pl-2 pr-3 text-right text-[10px] font-bold uppercase tracking-wider w-28 print-row-head">Total (TZS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedInvoice.items.map((it, idx) => (
                  <tr key={idx} className="align-top break-inside-avoid page-break-inside-avoid">
                    <td className="py-2.5 pl-3 pr-2 text-slate-400 font-mono-telemetry text-[11px]">{idx + 1}</td>
                    <td className="px-2 py-2.5">
                      <span className="font-semibold text-slate-900 break-words">{it.description}</span>
                      <span className="block text-[10px] uppercase tracking-wider text-slate-500 mt-0.5">{it.type}</span>
                    </td>
                    <td className="px-2 py-2.5 text-center text-slate-700">{it.quantity}</td>
                    <td className="px-2 py-2.5 text-right text-slate-700 whitespace-nowrap">{formatTzs(it.unitPrice)}</td>
                    <td className="py-2.5 pl-2 pr-3 text-right font-bold text-slate-900 whitespace-nowrap">{formatTzs(lineTotal(it))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            {/* 4 — Payment methods + financial summary (backend totals only) */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6 print:break-inside-avoid page-break-inside-avoid">
              <div className="text-xs">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">
                  Payment methods
                </h3>
                <ul className="space-y-1.5 text-slate-700">
                  <li><strong>M-Pesa / Lipa Namba (Till):</strong> 5892011 — Hunter Autoworks</li>
                  <li><strong>CRDB Bank:</strong> 0150829104800 — Hunter Autoworks Ltd</li>
                  <li><strong>NMB Bank:</strong> 20810092834 — Hunter Autoworks Ltd</li>
                </ul>
                <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
                  Work completed under the Hunter Craft Warranty terms.
                </p>
              </div>

              <div className="text-xs sm:pl-6 self-start">
                <div className="space-y-1.5">
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Subtotal</span>
                    <span className="font-semibold text-slate-900">{formatTzs(selectedInvoice.subtotal)}</span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between gap-4">
                      <span className="text-slate-600">Discount</span>
                      <span className="font-semibold text-amber-700">−{formatTzs(selectedInvoice.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">VAT (18% included)</span>
                    <span className="font-semibold text-slate-900">{formatTzs(selectedInvoice.tax)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center gap-4 mt-3 pt-3 border-t-2 border-[#0A1E33]">
                  <span className="font-display text-sm font-extrabold uppercase tracking-wide text-[#0A1E33]">
                    Total due
                  </span>
                  <span className="font-display text-xl font-extrabold text-[#0A1E33] whitespace-nowrap">
                    {formatTzs(selectedInvoice.total)}
                  </span>
                </div>
              </div>
            </div>

            {/* 5 — Verification footer: existing cryptographic token, professional presentation */}
            <footer className="mt-8 pt-4 border-t border-slate-300 flex flex-col sm:flex-row justify-between gap-4 print:break-inside-avoid page-break-inside-avoid">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 shrink-0 rounded-sm border border-slate-300 bg-slate-50 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-[#0A1E33]" aria-hidden="true" />
                </div>
                <div className="min-w-0 text-[10px] text-slate-500">
                  <p className="font-bold text-slate-700 uppercase tracking-wider">Invoice verification</p>
                  <p className="break-all font-mono-telemetry">Token: {selectedInvoice.verificationHash}</p>
                  <p className="mt-0.5">Cryptographically verifiable via the token-gated verification endpoint.</p>
                </div>
              </div>
              <div className="text-[10px] text-slate-500 sm:text-right shrink-0">
                <p>Authorized signature:</p>
                <p className="font-bold text-slate-800 text-xs uppercase tracking-wide">Hunter Workshop Management</p>
              </div>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
