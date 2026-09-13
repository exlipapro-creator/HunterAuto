import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { HunterLogo } from '../brand/HunterLogo';
import { Phone, MessageSquare, Calendar, ArrowRight, Lock } from 'lucide-react';

interface HeaderProps {
  onOpenBooking: () => void;
  onOpenStaff: () => void;
}

/**
 * Public customer header. The previous "Hunter Control" admin toggle is GONE —
 * staff access goes exclusively through Staff Sign-In (real authentication).
 */
export const Header: React.FC<HeaderProps> = ({
  onOpenBooking,
  onOpenStaff,
}) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;
  return (
    <header className="sticky top-0 z-40 bg-[#00101F]/90 backdrop-blur-md border-b border-[#132038]" id="main-header">
      {/* Top microbar for phone & WhatsApp */}
      <div className="hidden sm:flex items-center justify-between px-4 sm:px-6 lg:px-8 py-1 bg-[#000000] border-b border-[#132038]/60 text-xs font-mono-telemetry text-[#8E9BAE]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Kinondoni Morocco, Block 41, Dar es Salaam
          </span>
          <span className="text-[#132038]">|</span>
          <span className="text-slate-400">Mon-Sat: 08:00–18:30 | Sun: 09:30–15:00</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="tel:0654686962"
            className="flex items-center gap-1 text-slate-300 hover:text-[#159EF3] transition-colors"
            id="topbar-tel-link"
          >
            <Phone className="w-3 h-3 text-[#159EF3]" />
            0654 686 962
          </a>
          <a
            href="https://wa.me/255654686962?text=Hello%20Hunter%20Autoworks%20The%20Car%20Lab,%20I%20would%20like%20to%20inquire%20about%20vehicle%20service."
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 transition-colors"
            id="topbar-wa-link"
          >
            <MessageSquare className="w-3 h-3" />
            WhatsApp
          </a>
        </div>
      </div>

      {/* Main Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        <Link
          to="/"
          className="flex items-center text-left focus:outline-none shrink-0 min-w-0"
          id="brand-header-btn"
        >
          <HunterLogo />
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1" id="desktop-nav">
          {[
            { path: '/', label: 'Home' },
            { path: '/services', label: 'Services' },
            { path: '/vehicle', label: 'Vehicle Passport' },
            { path: '/status', label: 'Service Status' },
            { path: '/contact', label: 'Contact & Location' },
          ].map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                isActive(item.path)
                  ? 'text-[#159EF3] bg-[#159EF3]/10 border border-[#159EF3]/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/40'
              }`}
              id={`nav-${item.path === '/' ? 'home' : item.path.slice(1)}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Staff sign-in — replaces the removed public admin toggle */}
          <button
            onClick={onOpenStaff}
            className="p-2 text-slate-400 hover:text-[#159EF3] hover:bg-slate-800/40 rounded transition-colors"
            title="Staff sign in"
            aria-label="Staff sign in"
            id="staff-signin-btn"
          >
            <Lock className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenBooking}
            className="bg-[#159EF3] hover:bg-[#38B2FF] text-black font-semibold text-xs sm:text-sm px-3 sm:px-4 py-2 rounded flex items-center gap-1.5 shadow-[0_0_15px_rgba(21,158,243,0.35)] transition-all active:scale-95"
            id="header-book-cta"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Book Service</span>
            <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
          </button>
        </div>
      </div>
    </header>
  );
};
