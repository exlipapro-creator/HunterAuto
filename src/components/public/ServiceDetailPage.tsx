import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ServiceItem } from '../../types';
import { ArrowLeft, Clock, CheckCircle, Calendar, Wrench } from 'lucide-react';

interface ServiceDetailPageProps {
  services: ServiceItem[];
  onOpenBookingWithService: (id: string) => void;
}

/**
 * Deep-linkable service detail page (/services/:serviceId).
 * Customer-facing copy only — the previous modal exposed internal terms
 * ("LAB PROCEDURE", "Allocated Bay Capability").
 */
export const ServiceDetailPage: React.FC<ServiceDetailPageProps> = ({
  services,
  onOpenBookingWithService,
}) => {
  const { serviceId } = useParams<{ serviceId: string }>();
  const navigate = useNavigate();

  const service = services.find(
    (s) => s.id === serviceId || s.number === serviceId || String(s.number) === String(serviceId)
  );

  if (!service) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center" id="service-detail-notfound">
        <Wrench className="w-10 h-10 text-slate-600 mx-auto mb-4" />
        <h2 className="text-xl font-display font-bold text-white uppercase">Service not found</h2>
        <p className="text-sm text-slate-400 mt-2 mb-6">
          The service you're looking for isn't available. Browse the full list instead.
        </p>
        <Link
          to="/services"
          className="inline-block bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-sm px-5 py-2.5 rounded transition-colors"
          id="service-detail-back-to-catalogue"
        >
          View all services
        </Link>
      </div>
    );
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12" id="service-detail-page">
      {/* Back to full catalogue */}
      <button
        onClick={() => navigate('/services')}
        className="flex items-center gap-1.5 text-xs font-mono-telemetry text-slate-400 hover:text-white mb-6 transition-colors"
        id="service-detail-back"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        All services
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-6 border-b border-[#132038]">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono-telemetry font-bold text-sm text-black bg-[#159EF3] px-2 py-0.5 rounded">
              {service.number}
            </span>
            <span className="font-mono-telemetry text-xs text-slate-400 uppercase tracking-widest">
              {service.category.replace(/_/g, ' ')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-display font-extrabold text-white uppercase tracking-tight">
            {service.name}
          </h1>
        </div>
      </div>

      {/* Key facts */}
      <div className="grid grid-cols-2 gap-3 my-6">
        <div className="p-4 bg-[#00101F] border border-[#132038] rounded-lg">
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase block">Pricing</span>
          <div className="font-display font-bold text-lg sm:text-xl text-[#159EF3] mt-1">
            {service.priceType === 'QUOTE_REQUIRED'
              ? 'Quote on Inspection'
              : `${service.priceType === 'STARTING_FROM' ? 'From ' : ''}${formatCurrency(service.price)}`}
          </div>
        </div>
        <div className="p-4 bg-[#00101F] border border-[#132038] rounded-lg">
          <span className="text-[10px] font-mono-telemetry text-[#8E9BAE] uppercase block">Typical duration</span>
          <div className="font-display font-bold text-lg sm:text-xl text-white mt-1 flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span>{service.durationMinutes} minutes</span>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-6">
        {service.description}
      </p>

      {/* What's included */}
      {service.includes && service.includes.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-mono-telemetry uppercase tracking-wider text-slate-300 mb-3">
            What's included
          </h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {service.includes.map((inc, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-[#159EF3] shrink-0 mt-0.5" />
                <span>{inc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Booking CTA */}
      <div className="p-5 bg-[#00101F] border border-[#132038] rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs sm:text-sm text-slate-300 text-center sm:text-left">
          Ready to book? Choose your date and time — no account needed.
        </p>
        <button
          onClick={() => onOpenBookingWithService(service.id)}
          className="w-full sm:w-auto shrink-0 bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-sm px-6 py-3 rounded flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          id="service-detail-book-btn"
        >
          <Calendar className="w-4 h-4" />
          <span>Book This Service</span>
        </button>
      </div>
    </div>
  );
};
