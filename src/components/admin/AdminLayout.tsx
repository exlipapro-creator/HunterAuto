import React from 'react';
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
  ArrowLeft
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

      {/* Sub Navigation Tabs Bar (Scrollable for mobile/tablet) */}
      <div className="bg-[#000000] border-b border-[#132038] px-4 sm:px-6 overflow-x-auto scrollbar-none">
        <nav className="flex items-center gap-1.5 py-2 min-w-max" aria-label="Staff sections">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setCurrentTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded text-xs font-mono-telemetry uppercase transition-all ${
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

      {/* Main Content Surface */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};
