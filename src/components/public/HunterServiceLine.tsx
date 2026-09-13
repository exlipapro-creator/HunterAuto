import React from 'react';
import { CalendarCheck, Car, Search, Wrench, CheckCircle2, ShieldCheck } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    title: 'BOOK',
    desc: 'Select service & real slot',
    icon: CalendarCheck,
  },
  {
    step: '02',
    title: 'ARRIVE',
    desc: 'Kinondoni Block 41 bay check-in',
    icon: Car,
  },
  {
    step: '03',
    title: 'INSPECT',
    desc: 'Digital multi-point scan & report',
    icon: Search,
  },
  {
    step: '04',
    title: 'SERVICE',
    desc: 'OEM precision mechanical craft',
    icon: Wrench,
  },
  {
    step: '05',
    title: 'QUALITY CHECK',
    desc: 'Master technician sign-off',
    icon: ShieldCheck,
  },
  {
    step: '06',
    title: 'DRIVE',
    desc: 'Clean collection & invoice ready',
    icon: CheckCircle2,
  },
];

export const HunterServiceLine: React.FC = () => {
  const [activeStepIndex, setActiveStepIndex] = React.useState(3); // default highlight in service

  return (
    <section className="py-12 sm:py-16 bg-[#00101F] border-b border-[#132038] relative overflow-hidden" id="service-line-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 sm:mb-12">
          <div>
            <div className="text-[11px] font-mono-telemetry uppercase tracking-widest text-[#159EF3] mb-1">
              FROM BOOKING TO COLLECTION
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight uppercase">
              THE HUNTER SERVICE LINE
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-2 sm:mt-0 font-normal">
            Every vehicle undergoes a disciplined six-stage mechanical process with real-time digital transparency for the owner.
          </p>
        </div>

        {/* Progress Timeline — Horizontal on tablet/desktop, deliberate stacked steps on 320px mobile */}
        <div className="relative">
          {/* Connecting Technical Blue Line */}
          <div className="hidden md:block absolute top-7 left-8 right-8 h-[2px] bg-[#132038]">
            <div
              className="h-full bg-gradient-to-r from-[#002958] via-[#159EF3] to-[#38B2FF] transition-all duration-500 shadow-[0_0_10px_#159EF3]"
              style={{ width: `${(activeStepIndex / (STEPS.length - 1)) * 100}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
            {STEPS.map((item, idx) => {
              const Icon = item.icon;
              const isActive = idx === activeStepIndex;
              const isPast = idx < activeStepIndex;

              return (
                <button
                  key={item.step}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`text-left p-3 sm:p-4 rounded-lg border transition-all relative group flex flex-col justify-between ${
                    isActive
                      ? 'bg-[#002958]/50 border-[#159EF3] shadow-[0_0_20px_rgba(21,158,243,0.25)]'
                      : isPast
                      ? 'bg-[#00101F] border-[#159EF3]/30 text-slate-300'
                      : 'bg-[#000000]/60 border-[#132038] text-slate-500 hover:border-slate-700'
                  }`}
                  id={`service-step-${item.step}`}
                >
                  {/* Step indicator node */}
                  <div className="flex items-center justify-between mb-3">
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-mono-telemetry font-bold transition-all ${
                        isActive
                          ? 'bg-[#159EF3] text-black ring-4 ring-[#159EF3]/20'
                          : isPast
                          ? 'bg-[#002958] text-[#159EF3] border border-[#159EF3]/50'
                          : 'bg-[#00101F] text-slate-500 border border-[#132038]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-mono-telemetry text-[11px] font-semibold text-[#8E9BAE]">
                      {item.step}
                    </span>
                  </div>

                  <div>
                    <h3 className={`font-display font-bold text-sm tracking-wide uppercase ${
                      isActive ? 'text-white' : isPast ? 'text-slate-200' : 'text-slate-400'
                    }`}>
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug line-clamp-2">
                      {item.desc}
                    </p>
                  </div>

                  {isActive && (
                    <div className="mt-2 text-[10px] font-mono-telemetry text-[#159EF3] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#159EF3] animate-ping"></span>
                      ACTIVE PHASE
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};
