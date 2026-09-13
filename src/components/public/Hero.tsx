import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ArrowRight } from 'lucide-react';
import cutaway1920 from '../../assets/hero/cutaway-1920.webp';
import cutaway1280 from '../../assets/hero/cutaway-1280.webp';
import cutaway860 from '../../assets/hero/cutaway-860.webp';
import cutaway860Jpg from '../../assets/hero/cutaway-860.jpg';
import cutawayMobile1200 from '../../assets/hero/cutaway-mobile-1200.webp';
import cutawayMobile800 from '../../assets/hero/cutaway-mobile-800.webp';
import cutawayMobile480 from '../../assets/hero/cutaway-mobile-480.webp';
import cutawayMobile480Jpg from '../../assets/hero/cutaway-mobile-480.jpg';

interface HeroProps {
  onOpenBooking: () => void;
}

const cutawayAlt =
  'A professionally maintained SUV in the Hunter Autoworks workshop at night, its engine, suspension, drivetrain and cabin revealed in a cinematic cutaway view';

const CutawayPicture: React.FC<{ className?: string; style?: React.CSSProperties; imgId?: string }> = ({
  className,
  style,
  imgId = 'hero-cutaway-img',
}) => (
  <picture>
    <source
      type="image/webp"
      srcSet={`${cutaway860} 860w, ${cutaway1280} 1280w, ${cutaway1920} 1920w`}
      sizes="(min-width: 1280px) 74vw, (min-width: 1024px) 72vw, 100vw"
    />
    <img
      src={cutaway860Jpg}
      alt={cutawayAlt}
      width={1774}
      height={887}
      loading="eager"
      decoding="async"
      fetchPriority="high"
      draggable={false}
      className={className}
      style={style}
      id={imgId}
    />
  </picture>
);

/**
 * THE HUNTER HERO — one continuous cinematic workshop scene.
 *
 * Layer 1  hero background (page black, grid, ambient glows)
 * Layer 2  the workshop artwork, bleeding off the right viewport edge (no image
 *          boundary exists); the master's own baked-in left negative space
 *          carries the headline zone
 * Layer 3  page-coloured edge blends so the scene dissolves into the page —
 *          the vehicle itself stays crisp
 * Layer 4  content: headline, copy, CTAs, quiet status link
 *
 * The vehicle is visual storytelling only: static, non-interactive, no labels.
 */
export const Hero: React.FC<HeroProps> = ({ onOpenBooking }) => {
  return (
    <section
      className="relative bg-[#000000] border-b border-[#132038] overflow-hidden"
      id="hunter-hero-section"
      aria-label="Hunter Autoworks vehicle care"
    >
      {/* LAYER 1 — hero background */}
      <div className="absolute inset-0 tech-grid-bg" aria-hidden="true" />
      <div className="absolute top-0 right-0 w-[36rem] h-[36rem] bg-[#159EF3]/8 rounded-full blur-3xl pointer-events-none -mr-32 -mt-32" aria-hidden="true" />
      <div className="absolute bottom-0 left-0 w-[28rem] h-[28rem] bg-[#002958]/30 rounded-full blur-3xl pointer-events-none -ml-24 -mb-24" aria-hidden="true" />

      {/* LAYER 2+3 — the workshop scene (desktop/tablet: absolute scene on the
          right, bleeding off-screen; the master is 2:1 with negative space on
          the left, so the box is aspect-matched and the full car stays in
          frame). */}
      <div
        className="hidden sm:block absolute top-1/2 -translate-y-1/2 right-0 w-[72vw] max-w-none"
        style={{ aspectRatio: '1.85 / 1' }}
        aria-hidden="true"
      >
        <CutawayPicture
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'right center' }}
        />
        {/* LAYER 3 — page-coloured edge blends (the vehicle is never touched;
            the master's left side is already dark, so only a gentle ramp is
            needed to guarantee headline contrast). */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: [
              'linear-gradient(90deg, #000 0%, rgba(0,0,0,0.8) 6%, rgba(0,0,0,0.25) 11%, transparent 16%)',
              'linear-gradient(180deg, rgba(0,0,0,0.92) 0%, transparent 22%)',
              'linear-gradient(0deg, #000 0%, rgba(0,0,0,0.85) 5%, transparent 28%)',
            ].join(', '),
          }}
        />
        {/* gentle photographic vignette shared with the page treatment */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(105% 90% at 62% 52%, transparent 58%, rgba(0,0,0,0.5) 100%)' }}
        />
      </div>

      {/* contrast scrim behind the copy where the scene slides underneath */}
      <div
        className="hidden sm:block absolute inset-y-0 left-0 w-[46%] pointer-events-none"
        style={{ background: 'linear-gradient(90deg, #000 52%, transparent 100%)' }}
        aria-hidden="true"
      />

      {/* LAYER 4 — content */}
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12 sm:py-16 lg:py-20 lg:min-h-[min(88vh,860px)] flex items-center">
          <div className="w-full max-w-xl flex flex-col gap-5 relative z-10">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold text-white tracking-tight uppercase leading-[1.04]">
              Your vehicle.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#38B2FF] via-[#159EF3] to-[#0E7FC0]">
                Properly
                <br className="hidden lg:block" /> cared for.
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-md leading-relaxed">
              From routine maintenance to specialist care, Hunter Autoworks keeps
              your car ready for the road — inspected properly, serviced
              properly, ready to drive.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                onClick={onOpenBooking}
                className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-display font-bold text-sm sm:text-base px-6 py-3.5 rounded flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(21,158,243,0.3)] transition-all active:scale-[0.98]"
                id="hero-book-now-btn"
              >
                <Calendar className="w-4 h-4" />
                <span>BOOK A SERVICE</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <Link
                to="/services"
                className="bg-[#00101F] hover:bg-[#002958] text-slate-200 hover:text-white border border-[#132038] hover:border-[#159EF3]/50 font-display font-semibold text-sm sm:text-base px-5 py-3.5 rounded flex items-center justify-center gap-2 transition-all"
                id="hero-explore-services-btn"
              >
                <span>EXPLORE SERVICES</span>
              </Link>
            </div>

            {/* Quiet secondary path — never competing with booking */}
            <p className="text-xs text-slate-400">
              <span className="text-slate-500">Already visited us? </span>
              <Link
                to="/status"
                className="text-slate-300 hover:text-[#38B2FF] underline-offset-4 hover:underline transition-colors inline-flex items-center gap-1"
                id="hero-status-link"
              >
                Check your service status
                <ArrowRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Mobile / <sm: the scene becomes an in-flow full-bleed band beneath the
          content — recomposed, not scaled: headline → copy → CTAs → vehicle.
          The band serves the DEDICATED vehicle-crop asset (car fills ~97% of
          the crop), band aspect matched to the crop so nothing is cropped. */}
      <div className="sm:hidden relative -mx-4 mt-2">
        <div className="relative w-full" style={{ aspectRatio: '1.95 / 1' }}>
          <picture>
            <source
              type="image/webp"
              srcSet={`${cutawayMobile480} 480w, ${cutawayMobile800} 800w, ${cutawayMobile1200} 1200w`}
              sizes="100vw"
            />
            <img
              src={cutawayMobile480Jpg}
              alt={cutawayAlt}
              width={1300}
              height={667}
              loading="eager"
              decoding="async"
              fetchPriority="high"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: '50% 60%' }}
              id="hero-cutaway-img-mobile"
            />
          </picture>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: [
                'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, transparent 16%)',
                'linear-gradient(0deg, #000 0%, rgba(0,0,0,0.55) 4%, transparent 14%)',
                'linear-gradient(90deg, rgba(0,0,0,0.75) 0%, transparent 10%)',
                'linear-gradient(270deg, rgba(0,0,0,0.75) 0%, transparent 10%)',
              ].join(', '),
            }}
            aria-hidden="true"
          />
        </div>
      </div>
    </section>
  );
};
