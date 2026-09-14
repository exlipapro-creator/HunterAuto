import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Gauge,
  Wrench,
  Smartphone,
  ShoppingCart,
  Package,
  FileText,
  BarChart3,
  Settings,
  ShieldAlert,
  Users,
  UserCog,
  LogOut,
  ArrowLeft,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { HunterLogo } from '../brand/HunterLogo';
import type { StaffAuthUser } from '../../lib/supabase';

interface AdminLayoutProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  staffUser: StaffAuthUser;
  onSignOut: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; allowedRoles: string[] }[] = [
  { id: 'operations', label: 'Today', icon: Gauge, allowedRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
  { id: 'board', label: 'Workshop Board', icon: LayoutDashboard, allowedRoles: ['OWNER', 'MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN'] },
  { id: 'technician', label: 'Technician Mode', icon: Smartphone, allowedRoles: ['OWNER', 'MANAGER', 'TECHNICIAN'] },
  { id: 'pos', label: 'Point of Sale (POS)', icon: ShoppingCart, allowedRoles: ['OWNER', 'MANAGER', 'CASHIER'] },
  { id: 'inventory', label: 'Inventory & Stock', icon: Package, allowedRoles: ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'] },
  { id: 'invoices', label: 'Invoices & Billing', icon: FileText, allowedRoles: ['OWNER', 'MANAGER', 'CASHIER', 'ACCOUNTANT'] },
  { id: 'reports', label: 'Reports & Revenue', icon: BarChart3, allowedRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
  { id: 'cms', label: 'Services & Pricing', icon: Settings, allowedRoles: ['OWNER', 'MANAGER'] },
  { id: 'audit', label: 'Audit Log', icon: ShieldAlert, allowedRoles: ['OWNER', 'MANAGER', 'ACCOUNTANT'] },
  { id: 'users', label: 'Team', icon: Users, allowedRoles: ['OWNER'] },
  { id: 'account', label: 'Account', icon: UserCog, allowedRoles: ['OWNER', 'MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'CASHIER', 'INVENTORY_MANAGER', 'ACCOUNTANT'] },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Workshop Manager',
  SERVICE_ADVISOR: 'Service Advisor',
  TECHNICIAN: 'Technician',
  CASHIER: 'Cashier',
  INVENTORY_MANAGER: 'Inventory Manager',
  ACCOUNTANT: 'Accountant',
};

/**
 * Staff console shell. The role is the server-verified role of the signed-in
 * staff member — there is NO role switcher. Changing roles requires signing in
 * with a different staff account.
 */
export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  setCurrentTab,
  staffUser,
  onSignOut,
  children,
}) => {
  const visibleNav = NAV_ITEMS.filter((item) => item.allowedRoles.includes(staffUser.role));

  // Desktop navigation overflow support: when the tab row exceeds the
  // viewport, chevron controls appear (mobile/touch scrolling is unchanged)
  // and the active tab auto-scrolls itself into view.
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScroll - 4);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = navScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  // Active route auto-scrolls into view. Browser-authoritative approach:
  // the click's native focus-reveal honors scroll-margin on the tabs (see
  // className below); this effect only backfills for programmatic tab
  // changes after the reveal has settled, using scrollIntoView so the
  // BROWSER — not component math — computes the alignment.
  useEffect(() => {
    // Runs after Chromium's post-click focus-reveal (which fires in a later
    // task than rAF and only guarantees left-edge visibility); this corrects
    // any remaining clip with a spec-compliant full-visibility scroll.
    const t = setTimeout(() => {
      const el = navScrollRef.current;
      if (!el) return;
      const btn = el.querySelector<HTMLElement>(`#control-tab-${CSS.escape(currentTab)}`);
      if (!btn) return;
      const elRect = el.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      const clipped = bRect.left < elRect.left || bRect.right > elRect.right;
      if (clipped) btn.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'auto' });
    }, 60);
    return () => { clearTimeout(t); };
  }, [currentTab, visibleNav.length]);

  const scrollNav = (dir: -1 | 1) => {
    const el = navScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, Math.round(el.clientWidth * 0.7)), behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#000000] text-slate-100 flex flex-col" id="hunter-control-root">
      {/* Top Staff Navigation Header */}
      <header className="sticky top-0 z-40 bg-[#00101F] border-b border-[#132038] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onSignOut}
            className="text-xs font-mono-telemetry text-slate-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#000000] border border-[#132038] transition-colors shrink-0"
            id="admin-exit-btn"
            title="Sign out and return to the customer portal"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>

          <HunterLogo variant="full" className="hidden sm:flex" />
          <span className="sm:hidden text-xs font-display font-bold text-white uppercase tracking-wider">
            Hunter
          </span>
        </div>

        {/* Authenticated staff identity (server-verified) */}
        <div className="flex items-center gap-2 sm:gap-3 text-xs font-mono-telemetry shrink-0">
          <div className="text-right hidden md:block">
            <div className="text-white font-medium">{staffUser.name}</div>
            <div className="text-[#8E9BAE] text-[10px] uppercase tracking-wider">
              {ROLE_LABELS[staffUser.role] || staffUser.role}
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#002958] border border-[#159EF3]/40 flex items-center justify-center text-[#159EF3] font-bold text-xs">
            {staffUser.name.split(' ').map(p => p[0]).slice(0, 2).join('')}
          </div>
          <button
            onClick={onSignOut}
            className="p-2 text-slate-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            title="Sign out"
            aria-label="Sign out"
            id="staff-signout-btn"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Sub Navigation Tabs Bar — horizontally scrollable; desktop chevrons
          appear only while the tab set overflows, and the active tab always
          scrolls itself into view. Mobile touch scrolling is unchanged. */}
      <div className="bg-[#000000] border-b border-[#132038] px-2 sm:px-4">
        <div className="flex items-center">
          {canScrollLeft && (
            <button
              onClick={() => scrollNav(-1)}
              className="shrink-0 my-1.5 mr-1 p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-900 border border-[#132038] transition-colors"
              aria-label="Scroll staff navigation left"
              title="Scroll navigation left"
              id="nav-scroll-left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div id="nav-tab-scroll" ref={navScrollRef} className="overflow-x-auto scrollbar-none flex-1 min-w-0">
            <nav className="flex items-center gap-1.5 py-2 min-w-max" aria-label="Staff sections">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-mono-telemetry uppercase transition-all [scroll-margin-left:8px] [scroll-margin-right:8px] ${
                  isActive
                    ? 'bg-[#159EF3] text-black font-bold shadow-[0_0_12px_rgba(21,158,243,0.3)]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900 border border-transparent'
                }`}
                id={`control-tab-${item.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
            </nav>
          </div>
          {canScrollRight && (
            <button
              onClick={() => scrollNav(1)}
              className="shrink-0 my-1.5 ml-1 p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-900 border border-[#132038] transition-colors"
              aria-label="Scroll staff navigation right"
              title="Scroll navigation right"
              id="nav-scroll-right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Surface */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};
