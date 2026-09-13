import React, { useState } from 'react';
import { ServiceItem, ServiceCategory } from '../../types';
import { ServiceCard } from './ServiceCard';
import { Search, Wrench } from 'lucide-react';

interface ServiceCatalogueProps {
  services: ServiceItem[];
  selectedServiceIds: string[];
  onToggleServiceSelection: (id: string) => void;
  onOpenBookingWithService: (id: string) => void;
}

const CATEGORY_TABS: { id: string; label: string; cat?: ServiceCategory }[] = [
  { id: 'ALL', label: 'All 20 Services' },
  { id: 'DETAILING_WASH', label: 'Detailing & Wash', cat: 'DETAILING_WASH' },
  { id: 'MECHANICAL_MAINTENANCE', label: 'Mechanical', cat: 'MECHANICAL_MAINTENANCE' },
  { id: 'BODY_RESTORATION', label: 'Body & Restoration', cat: 'BODY_RESTORATION' },
  { id: 'DIAGNOSTICS_ELECTRICAL', label: 'Diagnostics & ECU', cat: 'DIAGNOSTICS_ELECTRICAL' },
  { id: 'TYRES_ALIGNMENT', label: 'Tyres & 3D Alignment', cat: 'TYRES_ALIGNMENT' },
  { id: 'SPECIALITY_SERVICES', label: 'Speciality Care', cat: 'SPECIALITY_SERVICES' },
];

/**
 * The full Hunter Autoworks service catalogue — the single canonical listing
 * served at /services. Card UI is shared with the homepage preview
 * (ServiceCard); detail navigation uses deep links (/services/:serviceId).
 */
export const ServiceCatalogue: React.FC<ServiceCatalogueProps> = ({
  services,
  selectedServiceIds,
  onToggleServiceSelection,
  onOpenBookingWithService,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredServices = services.filter((s) => {
    const matchesCat = activeCategory === 'ALL' || s.category === activeCategory;
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.number.includes(searchQuery) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <section className="py-12 sm:py-16 bg-[#000000]" id="service-catalogue-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Editorial Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-6 border-b border-[#132038]">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono-telemetry uppercase tracking-widest text-[#159EF3] mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#159EF3]"></span>
              ALL SERVICES & PRICING
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight uppercase">
              THE CAR LAB SERVICES
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md mt-2 md:mt-0 font-normal">
            From computerized diagnostics and 3D laser wheel alignment to precision engine wash and oven panel respraying.
          </p>
        </div>

        {/* Filter Controls — Mobile scrollable pill bar + search */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between mb-8">
          {/* Horizontal Scrollable Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs font-mono-telemetry no-scrollbar max-w-full">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-2 rounded whitespace-nowrap transition-all ${
                  activeCategory === tab.id
                    ? 'bg-[#159EF3] text-black font-bold shadow-[0_0_12px_rgba(21,158,243,0.3)]'
                    : 'bg-[#00101F] text-slate-300 hover:text-white border border-[#132038] hover:border-slate-700'
                }`}
                id={`cat-filter-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative min-w-[200px] sm:w-64 shrink-0">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#00101F] border border-[#132038] rounded text-xs text-white placeholder-slate-500 font-mono-telemetry focus:outline-none focus:border-[#159EF3]"
              id="service-search-input"
            />
          </div>
        </div>

        {/* Selected Services Counter Bar */}
        {selectedServiceIds.length > 0 && (
          <div className="mb-6 p-3 bg-[#002958]/50 border border-[#159EF3]/40 rounded-lg flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs text-slate-200 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#159EF3] animate-pulse shrink-0"></span>
              <span className="min-w-0">
                <span className="font-bold text-white">{selectedServiceIds.length}</span>
                <span> service(s) selected for booking</span>
              </span>
            </div>
            <button
              onClick={() => onOpenBookingWithService(selectedServiceIds[0])}
              className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-semibold text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-all shrink-0"
              id="selected-services-proceed-btn"
            >
              <span>Continue to Schedule</span>
            </button>
          </div>
        )}

        {/* Service Grid — shared card component */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" id="service-grid">
          {filteredServices.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              detailHref={`/services/${service.id}`}
              selected={selectedServiceIds.includes(service.id)}
              onSelect={onToggleServiceSelection}
              onBook={onOpenBookingWithService}
            />
          ))}
        </div>

        {filteredServices.length === 0 && (
          <div className="p-8 text-center bg-[#00101F] border border-[#132038] rounded-lg">
            <Wrench className="w-8 h-8 text-slate-500 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-mono-telemetry">No services found matching "{searchQuery}".</p>
          </div>
        )}

      </div>
    </section>
  );
};
