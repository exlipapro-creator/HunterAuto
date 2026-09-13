import React, { useCallback, useEffect, useState } from 'react';
import {
  CalendarDays,
  Wrench,
  ReceiptText,
  AlertTriangle,
  CircleDashed,
  CircleCheck,
  ClipboardCheck,
  Factory,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

/**
 * OWNER OPERATIONS DASHBOARD (Phase C).
 *
 * Answers one question: "What is happening in the workshop today?"
 * Every value is computed server-side from real persisted records
 * (GET /api/v1/reports/operations, RBAC: OWNER/MANAGER/ACCOUNTANT).
 * If a list is empty, it says so — nothing is invented.
 */

interface OpsAppointment {
  reference: string;
  time: string;
  customerName: string;
  vehicleRegistration: string;
  serviceNames: string[];
  status: string;
}

interface OpsWorkOrder {
  workOrderNumber: string;
  customerName: string;
  vehicleRegistration: string;
  status: string;
  priority: string;
  assignedBayName: string | null;
  assignedTechnicianName: string | null;
}

interface OpsInvoice {
  invoiceNumber: string;
  customerName: string;
  vehicleRegistration: string;
  total: number;
  amountPaid: number;
  balance: number;
  dueDate: string;
}

interface OpsStockItem {
  sku: string;
  name: string;
  currentStock: number;
  reorderLevel: number;
  unit: string;
}

interface OpsData {
  today: string;
  todaysAppointments: OpsAppointment[];
  activeWorkOrders: OpsWorkOrder[];
  awaitingApproval: number;
  awaitingParts: number;
  completedAwaitingPayment: { workOrderNumber: string; vehicleRegistration: string }[];
  unpaidInvoices: OpsInvoice[];
  unpaidTotal: number;
  lowStock: OpsStockItem[];
  bays: { total: number; occupied: number };
}

const WO_STATUS_LABELS: Record<string, string> = {
  CHECKED_IN: 'Checked in',
  INSPECTION: 'Inspection (DVI)',
  ESTIMATE: 'Estimate',
  AWAITING_APPROVAL: 'Awaiting approval',
  APPROVED: 'Approved',
  IN_SERVICE: 'In service',
  QUALITY_CHECK: 'Quality check',
};

const PRIORITY_STYLES: Record<string, string> = {
  URGENT: 'text-red-300 border-red-500/40 bg-red-500/10',
  HIGH: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  NORMAL: 'text-slate-300 border-slate-600/50 bg-slate-500/10',
  LOW: 'text-slate-400 border-slate-700 bg-slate-800/40',
};

function fmtTzs(v: number): string {
  return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(v);
}

function fmtDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

function fmtDue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function SectionCard({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-[#04121F] border border-[#132038] rounded-lg overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#132038] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-[#159EF3] shrink-0" />
          <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
        </div>
        {typeof count === 'number' && (
          <span className="text-xs font-mono-telemetry text-slate-400 shrink-0">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="px-4 sm:px-5 py-4 text-sm text-slate-500">{text}</p>;
}

export const OperationsDashboard: React.FC = () => {
  const [data, setData] = useState<OpsData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    try {
      const r = await apiFetch('/api/v1/reports/operations');
      if (r.ok && r.data?.success) setData(r.data.data);
      else setError(r.data?.error || 'Could not load today\u2019s operations.');
    } catch {
      setError('Could not reach the operations service.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return <div className="p-6 text-sm text-slate-400">Loading today\u2019s workshop status…</div>;
  }

  if (error && !data) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded p-4 text-sm">
          <CircleDashed className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5" id="operations-dashboard">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-white">Today</h1>
          <p className="text-sm text-slate-400 mt-0.5">{fmtDay(data.today)}</p>
        </div>
        <div className="text-xs font-mono-telemetry text-slate-400 border border-[#132038] bg-[#00101F] px-3 py-1.5 rounded">
          Bays in use: <strong className="text-white">{data.bays.occupied}/{data.bays.total}</strong>
        </div>
      </div>

      {/* ---------- Today's appointments ---------- */}
      <SectionCard icon={CalendarDays} title="Today's appointments" count={data.todaysAppointments.length}>
        {data.todaysAppointments.length === 0 && (
          <EmptyLine text="No appointments are booked for today." />
        )}
        {data.todaysAppointments.map(a => (
          <div key={a.reference} className="px-4 sm:px-5 py-3 border-b border-[#132038]/60 last:border-b-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
            <span className="font-mono-telemetry text-[#159EF3] text-sm w-14 shrink-0">{a.time}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-200 truncate">
                {a.customerName} · <span className="font-mono-telemetry text-slate-400">{a.vehicleRegistration}</span>
              </p>
              <p className="text-xs text-slate-500 truncate">{a.serviceNames.join(', ')}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] font-mono-telemetry text-slate-500">{a.reference}</span>
              <span className={`text-[10px] font-mono-telemetry uppercase px-1.5 py-0.5 rounded border ${a.status === 'CHECKED_IN' ? 'text-[#159EF3] border-[#159EF3]/40 bg-[#159EF3]/10' : 'text-slate-400 border-slate-700'}`}>
                {a.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
      </SectionCard>

      {/* ---------- Vehicles in workshop ---------- */}
      <SectionCard icon={Wrench} title="Vehicles in workshop" count={data.activeWorkOrders.length}>
        {data.activeWorkOrders.length === 0 && (
          <EmptyLine text="No vehicles are on the floor right now." />
        )}
        {data.activeWorkOrders.map(w => (
          <div key={w.workOrderNumber} className="px-4 sm:px-5 py-3 border-b border-[#132038]/60 last:border-b-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-200 truncate">
                <span className="font-mono-telemetry text-slate-400">{w.workOrderNumber}</span> · {w.customerName} · <span className="font-mono-telemetry text-slate-400">{w.vehicleRegistration}</span>
              </p>
              <p className="text-xs text-slate-500">
                {w.assignedBayName || 'No bay'} · {w.assignedTechnicianName || 'Unassigned'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] font-mono-telemetry uppercase px-1.5 py-0.5 rounded border ${PRIORITY_STYLES[w.priority] || PRIORITY_STYLES.NORMAL}`}>
                {w.priority}
              </span>
              <span className="text-[10px] font-mono-telemetry uppercase text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded">
                {WO_STATUS_LABELS[w.status] || w.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}
        {(data.awaitingApproval > 0 || data.awaitingParts > 0) && (
          <div className="px-4 sm:px-5 py-2.5 bg-[#00101F] flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
            {data.awaitingApproval > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <ClipboardCheck className="w-3.5 h-3.5 text-purple-400" />
                {data.awaitingApproval} awaiting customer approval
              </span>
            )}
            {data.awaitingParts > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                {data.awaitingParts} awaiting parts
              </span>
            )}
          </div>
        )}
      </SectionCard>

      {/* ---------- Unpaid invoices ---------- */}
      <SectionCard icon={ReceiptText} title="Unpaid invoices" count={data.unpaidInvoices.length}>
        <div className="px-4 sm:px-5 py-2.5 bg-[#00101F] border-b border-[#132038] flex items-center justify-between text-xs">
          <span className="text-slate-400 font-mono-telemetry uppercase tracking-wider">Outstanding</span>
          <strong className="text-white font-mono-telemetry">{fmtTzs(data.unpaidTotal)}</strong>
        </div>
        {data.unpaidInvoices.length === 0 && (
          <EmptyLine text="No unpaid invoices — everything is settled." />
        )}
        {data.unpaidInvoices.map(i => (
          <div key={i.invoiceNumber} className="px-4 sm:px-5 py-3 border-b border-[#132038]/60 last:border-b-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-200 truncate">
                <span className="font-mono-telemetry text-slate-400">{i.invoiceNumber}</span> · {i.customerName} · <span className="font-mono-telemetry text-slate-400">{i.vehicleRegistration}</span>
              </p>
              <p className="text-xs text-slate-500">Due {fmtDue(i.dueDate)} · Paid {fmtTzs(i.amountPaid)} of {fmtTzs(i.total)}</p>
            </div>
            <strong className="text-sm font-mono-telemetry text-amber-300 shrink-0">{fmtTzs(i.balance)}</strong>
          </div>
        ))}
      </SectionCard>

      {/* ---------- Completed, awaiting payment ---------- */}
      {data.completedAwaitingPayment.length > 0 && (
        <SectionCard icon={CircleCheck} title="Completed work awaiting payment" count={data.completedAwaitingPayment.length}>
          {data.completedAwaitingPayment.map(w => (
            <div key={w.workOrderNumber} className="px-4 sm:px-5 py-3 border-b border-[#132038]/60 last:border-b-0 text-sm text-slate-200">
              <span className="font-mono-telemetry text-slate-400">{w.workOrderNumber}</span> · <span className="font-mono-telemetry text-slate-400">{w.vehicleRegistration}</span>
            </div>
          ))}
        </SectionCard>
      )}

      {/* ---------- Stock alerts ---------- */}
      <SectionCard icon={AlertTriangle} title="Stock alerts" count={data.lowStock.length}>
        {data.lowStock.length === 0 && (
          <EmptyLine text="No stock items are at or below their reorder level." />
        )}
        {data.lowStock.map(p => (
          <div key={p.sku} className="px-4 sm:px-5 py-3 border-b border-[#132038]/60 last:border-b-0 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-slate-200 truncate">{p.name}</p>
              <p className="text-xs font-mono-telemetry text-slate-500">{p.sku}</p>
            </div>
            <span className={`text-sm font-mono-telemetry shrink-0 ${p.currentStock === 0 ? 'text-red-300' : 'text-amber-300'}`}>
              {p.currentStock} / {p.reorderLevel} {p.unit}
            </span>
          </div>
        ))}
      </SectionCard>

      <p className="text-[11px] text-slate-600 flex items-center gap-1.5">
        <Factory className="w-3 h-3" />
        Live data from the workshop database. Refreshes on page load.
      </p>
    </div>
  );
};
