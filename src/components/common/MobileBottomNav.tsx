import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Wrench, Calendar, Activity, Menu, Search } from 'lucide-react';

interface MobileBottomNavProps {
  onOpenBooking: () => void;
  onOpenStaff: () => void;
}

/**
 * Customer mobile bottom navigation — real routes, URL-active states.
 * "More" opens the Staff sign-in gate (no public admin console).
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenBooking,
  onOpenStaff,
}) => {
  const location = useLocation();

  const items = [
    { path: '/', label: 'Home', icon: Home },
    { path: '/services', label: 'Services', icon: Wrench },
    { path: '/status', label: 'Status', icon: Activity },
    { path: '/vehicle', label: 'Passport', icon: Search },
  ];

  const renderNavItem = (item: (typeof items)[number]) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex flex-col items-center justify-center py-1 rounded transition-colors ${
          isActive ? 'text-[#159EF3]' : 'text-slate-400 hover:text-slate-200'
        }`}
        id={`mobile-nav-${item.path === '/' ? 'home' : item.path.slice(1)}`}
      >
        <Icon className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] font-medium leading-none">{item.label}</span>
      </Link>
    );
  };

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#00101F]/95 backdrop-blur-lg border-t border-[#132038] px-2 py-1.5 safe-area-pb"
      id="mobile-bottom-nav"
    >
      <div className="grid grid-cols-5 items-center max-w-md mx-auto">
        {renderNavItem(items[0])}
        {renderNavItem(items[1])}

        {/* Book (Accent button in center) */}
        <button
          onClick={onOpenBooking}
          className="flex flex-col items-center justify-center -mt-3 py-1 group"
          id="mobile-nav-book"
        >
          <div className="w-11 h-11 rounded-full bg-[#159EF3] text-black flex items-center justify-center shadow-[0_0_15px_rgba(21,158,243,0.5)] active:scale-95 transition-transform">
            <Calendar className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-semibold text-[#159EF3] mt-0.5 leading-none">
            Book
          </span>
        </button>

        {renderNavItem(items[2])}
        {renderNavItem(items[3])}
      </div>
    </div>
  );
};
