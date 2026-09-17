import React from 'react';
import { Phone, MessageSquare, MapPin, Clock, Navigation } from 'lucide-react';
import { HowToReachUs } from './HowToReachUs';

export const ContactSection: React.FC = () => {
  return (
    <section className="py-12 sm:py-16 bg-[#00101F] border-t border-[#132038]" id="contact-location-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Information Column */}
          <div className="lg:col-span-6 space-y-6">
            <div>
              <span className="text-[11px] font-mono-telemetry uppercase tracking-widest text-[#159EF3]">
                VISIT THE WORKSHOP
              </span>
              <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white uppercase tracking-tight mt-1">
                HUNTER AUTOWORKS
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                Situated in Kinondoni Morocco, Block 41, Dar es Salaam. Our facility features 5 specialized bays equipped for computerized diagnosis, 3D laser wheel alignment, executive detailing, and high-pressure steam decontamination.
              </p>
            </div>

            {/* Direct Telemetry Cards */}
            <div className="space-y-3 font-mono-telemetry text-xs">
              <div className="p-4 bg-[#000000] border border-[#132038] rounded-lg flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#159EF3] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white uppercase block text-sm font-display">Workshop Address</strong>
                  <span className="text-slate-300 block mt-0.5">Kinondoni Morocco, Block 41</span>
                  <span className="text-slate-400 text-[11px]">Dar es Salaam, Tanzania</span>
                </div>
              </div>

              <div className="p-4 bg-[#000000] border border-[#132038] rounded-lg flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#159EF3] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white uppercase block text-sm font-display">Operating Hours</strong>
                  <div className="text-slate-300 mt-0.5 space-y-0.5">
                    <div>Monday – Saturday: <span className="text-white font-semibold">08:00 – 18:30</span></div>
                    <div>Sunday: <span className="text-[#159EF3] font-semibold">09:30 – 15:00</span></div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#000000] border border-[#132038] rounded-lg flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#159EF3] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="text-white uppercase block text-sm font-display">Direct Workshop Lines</strong>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <a
                      href="tel:0654686962"
                      className="px-3 py-1.5 bg-[#00101F] text-white hover:text-[#159EF3] border border-[#132038] rounded hover:border-[#159EF3] transition-colors"
                      id="contact-phone-primary"
                    >
                      0654 686 962
                    </a>
                    <a
                      href="tel:0627629345"
                      className="px-3 py-1.5 bg-[#00101F] text-white hover:text-[#159EF3] border border-[#132038] rounded hover:border-[#159EF3] transition-colors"
                      id="contact-phone-secondary"
                    >
                      0627 629 345
                    </a>
                  </div>
                </div>
              </div>
            </div>

            {/* Direct WhatsApp Call to Action */}
            <div className="p-4 bg-[#002958]/30 border border-[#159EF3]/30 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-400" />
                <span className="text-xs text-slate-200">
                  Prefer instant messaging? Connect with our service advisor.
                </span>
              </div>
              <a
                href="https://wa.me/255654686962?text=Hello%20Hunter%20Autoworks%20The%20Car%20Lab,%20I%20would%20like%20to%20inquire%20about%20vehicle%20service."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs px-4 py-2 rounded flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all whitespace-nowrap"
                id="contact-wa-direct-btn"
              >
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Right Visual Map / Facility Card */}
          <div className="lg:col-span-6 bg-[#000000] border border-[#132038] rounded-xl overflow-hidden p-5 sm:p-6 shadow-xl relative">
            <div className="flex items-center justify-between border-b border-[#132038] pb-3 mb-4">
              <span className="text-xs font-mono-telemetry uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Navigation className="w-4 h-4 text-[#159EF3]" />
                FIND US ON THE MAP
              </span>
              <span className="text-[10px] font-mono-telemetry text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
                OPEN DAILY
              </span>
            </div>

            {/* HOW TO REACH US — the definitive location experience: verified
                access corridors on a real OSM map plus the single Google Maps
                navigation handoff. Map code is a lazy chunk that loads only
                when this block approaches the viewport. */}
            <HowToReachUs />

            {/* Facilities Telemetry */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-[#132038] text-center font-mono-telemetry text-xs">
              <div>
                <span className="text-[10px] text-[#8E9BAE] uppercase block">BAYS</span>
                <span className="text-white font-bold">5 Lifts</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8E9BAE] uppercase block">EQUIPMENT</span>
                <span className="text-[#159EF3] font-bold">3D Laser Align</span>
              </div>
              <div>
                <span className="text-[10px] text-[#8E9BAE] uppercase block">WARRANTY</span>
                <span className="text-emerald-400 font-bold">Guaranteed</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
