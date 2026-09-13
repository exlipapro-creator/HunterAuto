import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ServiceItem } from '../../types';
import { ServiceCard } from './ServiceCard';
import { ArrowRight } from 'lucide-react';

interface ServicePreviewProps {
  services: ServiceItem[];
  selectedServiceIds: string[];
  onToggleServiceSelection: (id: string) => void;
  onOpenBookingWithService: (id: string) => void;
}

/** Number of preview services shown on the homepage. */
export const HOME_PREVIEW_COUNT = 4;

/**
 * Homepage service preview — an editorial selection of four services drawn
 * from the canonical catalogue (featured flag first, then catalogue order).
 * No second service list exists here; the full catalogue lives on /services.
 */
export const ServicePreview: React.FC<ServicePreviewProps> = ({
  services,
  selectedServiceIds,
  onToggleServiceSelection,
  onOpenBookingWithService,
}) => {
  const navigate = useNavigate();

  const active = services.filter((s) => s.active);
  const featured = active.filter((s) => s.featured);
  const preview = (featured.length >= HOME_PREVIEW_COUNT ? featured : [...featured, ...active.filter((s) => !s.featured)])
    .slice(0, HOME_PREVIEW_COUNT);

  const handleExploreAll = () => {
    navigate('/services');
  };

  return (
    <section className="py-12 sm:py-16 bg-[#000000] border-t border-[#132038]" id="service-preview-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Editorial Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-6 border-b border-[#132038] gap-3">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-mono-telemetry uppercase tracking-widest text-[#159EF3] mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#159EF3]"></span>
              WHAT WE DO
            </div>
            <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-white tracking-tight uppercase">
              Services at Hunter
            </h2>
          </div>

          <p className="text-xs sm:text-sm text-slate-400 max-w-md font-normal">
            From computerized diagnostics and 3D laser wheel alignment to executive detailing and full mechanical work.
          </p>
        </div>

        {/* Four-service editorial selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4" id="service-preview-grid">
          {preview.map((service) => (
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

        {/* Path to the complete catalogue */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 p-5 bg-[#00101F] border border-[#132038] rounded-lg">
          <div>
            <div className="font-display font-bold text-base sm:text-lg text-white uppercase tracking-tight">
              {active.length} services in total
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Washes, servicing, alignment, diagnostics, bodywork and more — with clear pricing.
            </p>
          </div>
          <button
            onClick={handleExploreAll}
            className="w-full sm:w-auto shrink-0 bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-sm px-6 py-3 rounded flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            id="explore-all-services-btn"
          >
            <span>Explore All Services</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </section>
  );
};
