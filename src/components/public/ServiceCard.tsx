import React from 'react';
import { Link } from 'react-router-dom';
import { ServiceItem } from '../../types';
import { Clock, ArrowRight, Check } from 'lucide-react';

interface ServiceCardProps {
  service: ServiceItem;
  selected?: boolean;
  detailHref?: string;
  onSelect?: (id: string) => void;
  onBook?: (id: string) => void;
  showBookAction?: boolean;
}

/**
 * Shared public service card — single source of card UI for the homepage
 * preview and the full catalogue. Detail is a deep link (/services/:serviceId)
 * rather than an ad-hoc modal, so every service has an addressable URL.
 */
export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  selected = false,
  detailHref,
  onSelect,
  onBook,
  showBookAction = true,
}) => {
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  const body = (
    <>
      {/* Top bar with Service Number & Category */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono-telemetry font-bold text-xs text-[#159EF3] bg-[#002958]/60 px-2 py-0.5 rounded border border-[#159EF3]/30 shrink-0">
            {service.number}
          </span>
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase tracking-wider truncate">
            {service.category.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1 text-[11px] font-mono-telemetry text-slate-400 shrink-0">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>{service.durationMinutes}m</span>
        </div>
      </div>

      {/* Service Name & Description */}
      <div className="my-2">
        <h3 className="font-display font-bold text-base sm:text-lg text-white uppercase tracking-tight group-hover:text-[#159EF3] transition-colors">
          {service.name}
        </h3>
        <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed">
          {service.description}
        </p>
      </div>

      {/* Bottom Row: Price & Actions */}
      <div className="pt-3 border-t border-[#132038]/60 flex items-center justify-between mt-2 gap-2">
        <div className="min-w-0">
          <span className="text-[9px] font-mono-telemetry text-[#8E9BAE] uppercase block">
            PRICE
          </span>
          <span className="font-display font-bold text-sm sm:text-base text-white whitespace-nowrap">
            {service.priceType === 'QUOTE_REQUIRED'
              ? 'Quote on Inspection'
              : `${service.priceType === 'STARTING_FROM' ? 'From ' : ''}${formatCurrency(service.price)}`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
          {onSelect && (
            <button
              onClick={() => onSelect(service.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono-telemetry font-medium flex items-center gap-1 transition-all ${
                selected
                  ? 'bg-[#159EF3] text-black font-bold'
                  : 'bg-[#000000] text-slate-300 border border-[#132038] hover:border-[#159EF3]/50'
              }`}
              id={`select-service-${service.number}`}
            >
              {selected ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Selected</span>
                </>
              ) : (
                <span>+ Add</span>
              )}
            </button>
          )}

          {showBookAction && onBook && (
            <button
              onClick={() => onBook(service.id)}
              className="px-3 py-1.5 bg-[#002958] hover:bg-[#159EF3] hover:text-black text-[#159EF3] rounded text-xs font-mono-telemetry font-medium transition-colors hidden sm:flex items-center gap-1"
              id={`book-service-${service.number}`}
            >
              <span>Book</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </>
  );

  const baseClasses = `cursor-pointer rounded-lg p-4 sm:p-5 border transition-all duration-200 relative group flex flex-col justify-between ${
    selected
      ? 'bg-[#002958]/40 border-[#159EF3] shadow-[0_0_15px_rgba(21,158,243,0.2)]'
      : 'bg-[#00101F] border-[#132038] hover:border-[#159EF3]/50 hover:bg-[#001830]'
  }`;

  if (detailHref) {
    return (
      <Link to={detailHref} className={baseClasses} id={`service-card-${service.number}`}>
        {body}
      </Link>
    );
  }

  return (
    <div className={baseClasses} id={`service-card-${service.number}`}>
      {body}
    </div>
  );
};
