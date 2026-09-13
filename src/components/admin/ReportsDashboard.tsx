import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  DollarSign,
  Car,
  CheckCircle2,
  Clock,
  Package,
  Calendar
} from 'lucide-react';

export const ReportsDashboard: React.FC = () => {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/v1/reports/summary')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setReport(json.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  if (loading || !report) {
    return (
      <div className="p-12 text-center text-slate-400 font-mono-telemetry">
        Calculating financial & workshop telemetry...
      </div>
    );
  }

  return (
    <div className="space-y-6" id="reports-dashboard-container">
      {/* Top Banner */}
      <div className="bg-[#00101F] border border-[#132038] p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono-telemetry text-[#159EF3] uppercase tracking-widest block">
            FINANCIAL INTELLIGENCE
          </span>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white uppercase">
            OPERATIONAL OVERVIEW & TELEMETRY
          </h2>
        </div>
        <div className="text-xs font-mono-telemetry text-slate-400 bg-[#000000] px-3 py-1.5 rounded border border-[#132038]">
          Period: <strong className="text-white">Active Financial Month</strong>
        </div>
      </div>

      {/* 4 Core Financial Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#00101F] border border-[#132038] p-5 rounded-xl">
          <div className="flex items-center justify-between text-[#8E9BAE] text-xs font-mono-telemetry mb-2">
            <span>PAID WORKSHOP REVENUE</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="font-display font-bold text-2xl text-emerald-400">
            {formatCurrency(report.totalRevenue)}
          </div>
          <div className="text-[10px] font-mono-telemetry text-slate-400 mt-2">
            Settled via M-Pesa, Cash, Bank & POS
          </div>
        </div>

        <div className="bg-[#00101F] border border-[#132038] p-5 rounded-xl">
          <div className="flex items-center justify-between text-[#8E9BAE] text-xs font-mono-telemetry mb-2">
            <span>COMPLETED LAB JOBS</span>
            <CheckCircle2 className="w-4 h-4 text-[#159EF3]" />
          </div>
          <div className="font-display font-bold text-2xl text-white">
            {report.completedJobs} Vehicles
          </div>
          <div className="text-[10px] font-mono-telemetry text-slate-400 mt-2">
            Master tech sign-off complete
          </div>
        </div>

        <div className="bg-[#00101F] border border-[#132038] p-5 rounded-xl">
          <div className="flex items-center justify-between text-[#8E9BAE] text-xs font-mono-telemetry mb-2">
            <span>ACTIVE JOBS ON FLOOR</span>
            <Car className="w-4 h-4 text-amber-400" />
          </div>
          <div className="font-display font-bold text-2xl text-amber-400">
            {report.inProgressJobs} In Bay
          </div>
          <div className="text-[10px] font-mono-telemetry text-slate-400 mt-2">
            Active service & diagnostics
          </div>
        </div>

        <div className="bg-[#00101F] border border-[#132038] p-5 rounded-xl">
          <div className="flex items-center justify-between text-[#8E9BAE] text-xs font-mono-telemetry mb-2">
            <span>INVENTORY ASSET VALUE</span>
            <Package className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="font-display font-bold text-xl text-white">
            {formatCurrency(report.inventoryValuation)}
          </div>
          <div className="text-[10px] font-mono-telemetry text-indigo-400 mt-2">
            Retail: {formatCurrency(report.retailValuation)}
          </div>
        </div>
      </div>

      {/* Workshop Efficiency Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#00101F] border border-[#132038] rounded-xl p-5 space-y-4">
          <h3 className="font-display font-bold text-base text-white uppercase border-b border-[#132038] pb-3">
            BAY OCCUPANCY & UTILIZATION
          </h3>

          <div className="space-y-3 font-mono-telemetry text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay 01 — Quick Service & Wash</span>
                <span className="text-emerald-400 font-bold">85% Capacity</span>
              </div>
              <div className="w-full bg-[#000000] h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-400 h-full w-[85%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay 02 — 3D Wheel Alignment & Tyres</span>
                <span className="text-[#159EF3] font-bold">70% Capacity</span>
              </div>
              <div className="w-full bg-[#000000] h-2 rounded-full overflow-hidden">
                <div className="bg-[#159EF3] h-full w-[70%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay 03 — Mechanical & Engine Diagnostics</span>
                <span className="text-amber-400 font-bold">90% Capacity</span>
              </div>
              <div className="w-full bg-[#000000] h-2 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full w-[90%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay 04 — Executive Detailing & Steam Wash</span>
                <span className="text-purple-400 font-bold">60% Capacity</span>
              </div>
              <div className="w-full bg-[#000000] h-2 rounded-full overflow-hidden">
                <div className="bg-purple-400 h-full w-[60%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Bay 05 — Panel Beating & Oven Respray</span>
                <span className="text-indigo-400 font-bold">75% Capacity</span>
              </div>
              <div className="w-full bg-[#000000] h-2 rounded-full overflow-hidden">
                <div className="bg-indigo-400 h-full w-[75%]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Channel Breakdown */}
        <div className="bg-[#00101F] border border-[#132038] rounded-xl p-5 space-y-4">
          <h3 className="font-display font-bold text-base text-white uppercase border-b border-[#132038] pb-3">
            REVENUE STREAM DISTRIBUTION
          </h3>

          <div className="space-y-4 font-mono-telemetry text-xs">
            <div className="p-3 bg-[#000000] border border-[#132038] rounded flex items-center justify-between">
              <div>
                <strong className="text-white block">Labour & Mechanical Craft</strong>
                <span className="text-[11px] text-slate-400">Diagnostic, alignment, service procedures</span>
              </div>
              <span className="font-bold text-[#159EF3]">58% of Total</span>
            </div>

            <div className="p-3 bg-[#000000] border border-[#132038] rounded flex items-center justify-between">
              <div>
                <strong className="text-white block">OEM Spare Parts & Lubricants</strong>
                <span className="text-[11px] text-slate-400">Synthetic oils, filters, brake pads</span>
              </div>
              <span className="font-bold text-emerald-400">32% of Total</span>
            </div>

            <div className="p-3 bg-[#000000] border border-[#132038] rounded flex items-center justify-between">
              <div>
                <strong className="text-white block">Over-the-Counter POS Retail</strong>
                <span className="text-[11px] text-slate-400">Fluids, car care, wipers, mats</span>
              </div>
              <span className="font-bold text-amber-400">10% of Total</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
