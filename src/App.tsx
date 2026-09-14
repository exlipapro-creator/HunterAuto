import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import {
  ServiceItem,
  WorkOrder,
  WorkshopBay,
  StaffMember,
  InventoryItem,
  InventoryMovement,
  Invoice,
  Supplier
} from './types';
import { getSupabaseBrowser, fetchStaffIdentity, type StaffAuthUser } from './lib/supabase';
import { apiFetch } from './lib/api';

// Common components
import { Header } from './components/common/Header';
import { MobileBottomNav } from './components/common/MobileBottomNav';
import { StaffLogin } from './components/staff/StaffLogin';

// Public components
import { Hero } from './components/public/Hero';
import { HunterServiceLine } from './components/public/HunterServiceLine';
import { ServicePreview } from './components/public/ServicePreview';
import { ServiceCatalogue } from './components/public/ServiceCatalogue';
import { ServiceDetailPage } from './components/public/ServiceDetailPage';
import { BookingWorkflow } from './components/public/BookingWorkflow';
import { ServiceStatusTracker } from './components/public/ServiceStatusTracker';
import { VehiclePassportView } from './components/public/VehiclePassportView';
import { ContactSection } from './components/public/ContactSection';

// Staff components (reachable ONLY with an authenticated staff session)
import { AdminLayout } from './components/admin/AdminLayout';
import { WorkshopBoard } from './components/admin/WorkshopBoard';
import { TechnicianMode } from './components/admin/TechnicianMode';
import { InspectionEditor } from './components/admin/InspectionEditor';
import { PosTerminal } from './components/admin/PosTerminal';
import { InventoryView } from './components/admin/InventoryView';
import { InvoicingView } from './components/admin/InvoicingView';
import { ReportsDashboard } from './components/admin/ReportsDashboard';
import { CmsSettings } from './components/admin/CmsSettings';
import { AuditLogsView } from './components/admin/AuditLogsView';
import { UsersView } from './components/admin/UsersView';
import { AccountView } from './components/admin/AccountView';
import { OperationsDashboard } from './components/admin/OperationsDashboard';

function AppShell() {
  const navigateTo = useNavigate();
  // ---- Authentication (real — Supabase Auth; no public admin toggle) ----
  const [staffUser, setStaffUser] = useState<StaffAuthUser | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [staffLoginOpen, setStaffLoginOpen] = useState<boolean>(false);

  // Restore session on load
  useEffect(() => {
    const restore = async () => {
      const sb = getSupabaseBrowser();
      if (sb) {
        try {
          const { data } = await sb.auth.getSession();
          if (data.session?.access_token) {
            const me = await fetchStaffIdentity(data.session.access_token);
            if (me) {
              setStaffUser(me);
            } else {
              await sb.auth.signOut();
            }
          }
        } catch {
          // not signed in
        }
      }
      setAuthReady(true);
    };
    restore();
  }, []);

  const handleStaffAuthenticated = (user: StaffAuthUser) => {
    setStaffUser(user);
    setStaffLoginOpen(false);
  };

  const handleStaffLogout = async () => {
    const sb = getSupabaseBrowser();
    if (sb) {
      try { await sb.auth.signOut(); } catch { /* ignore */ }
    }
    setStaffUser(null);
    setAdminTab('board');
  };

  // ---- Public navigation is URL-based (React Router); staff tabs stay internal state ----
  const [adminTab, setAdminTab] = useState<string>('operations');

  // Booking Modal
  const [isBookingOpen, setIsBookingOpen] = useState<boolean>(false);
  const [bookingPreselectedServiceId, setBookingPreselectedServiceId] = useState<string | undefined>();

  // DVI Editor Modal
  const [activeDVIWorkOrder, setActiveDVIWorkOrder] = useState<WorkOrder | null>(null);

  // Status & Passport search query memory (starts empty — customer provides their own reference)
  const [statusTrackQuery, setStatusTrackQuery] = useState<string>('');
  const [passportPlateQuery, setPassportPlateQuery] = useState<string>('');

  // ---- PUBLIC data: services only. No internal data on the public path. ----
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [publicLoading, setPublicLoading] = useState<boolean>(true);

  // In-flight guard: concurrent mounts/effects share a single request.
  const loadPublicServices = useCallback(() => {
    const g = globalThis as any;
    if (g.__hunterServicesPromise) return g.__hunterServicesPromise as Promise<void>;
    const p = fetch('/api/v1/services')
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setServices(json.data);
      })
      .catch((err) => {
        console.error('Failed to load services:', err);
      })
      .finally(() => {
        setPublicLoading(false);
        g.__hunterServicesPromise = null;
      });
    g.__hunterServicesPromise = p;
    return p;
  }, []);

  useEffect(() => {
    loadPublicServices();
  }, [loadPublicServices]);

  // ---- STAFF data: loaded ONLY after real authentication ----
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bays, setBays] = useState<WorkshopBay[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  // Server-side RBAC is the boundary; this only hides buttons the server would 403 anyway.
  const canWriteInventory = ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'].includes(staffUser?.role ?? '');

  const loadStaffData = useCallback(async () => {
    // Every call carries the Bearer token; server enforces RBAC per family.
    const [wo, inv, mov, inc, baysRes, staffRes] = await Promise.all([
      apiFetch<{ success: boolean; data: WorkOrder[] }>('/api/v1/work-orders'),
      apiFetch<{ success: boolean; data: InventoryItem[] }>('/api/v1/inventory'),
      apiFetch<{ success: boolean; data: InventoryMovement[] }>('/api/v1/inventory/movements'),
      apiFetch<{ success: boolean; data: Invoice[] }>('/api/v1/invoices'),
      apiFetch<{ success: boolean; data: WorkshopBay[] }>('/api/v1/bays'),
      apiFetch<{ success: boolean; data: StaffMember[] }>('/api/v1/staff'),
    ]);
    if (wo.data?.success) setWorkOrders(wo.data.data);
    if (inv.data?.success) setInventory(inv.data.data);
    if (mov.data?.success) setMovements(mov.data.data);
    if (inc.data?.success) setInvoices(inc.data.data);
    if (baysRes.data?.success) setBays(baysRes.data.data);
    if (staffRes.data?.success) setStaff(staffRes.data.data);
  }, []);

  useEffect(() => {
    if (staffUser) {
      loadStaffData();
      apiFetch<{ success: boolean; data: Supplier[] }>('/api/v1/inventory/suppliers')
        .then(({ data }) => { if (data?.success) setSuppliers(data.data); })
        .catch(() => { /* supplier list is non-critical; form shows — None — */ });
    } else {
      // Purge internal data from memory when signed out
      setWorkOrders([]); setInventory([]); setMovements([]);
      setInvoices([]); setBays([]); setStaff([]); setSuppliers([]);
    }
  }, [staffUser, loadStaffData]);

  // ---- Staff handlers (actor identity is server-derived now) ----
  const handleUpdateWorkOrderStatus = async (workOrderId: string, status: WorkOrder['status']) => {
    const { data } = await apiFetch(`/api/v1/work-orders/${workOrderId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (data?.success) {
      setWorkOrders(prev => prev.map(wo => wo.id === workOrderId ? data.data : wo));
    }
  };

  const handleAssignBayAndTech = async (workOrderId: string, bayId: string, technicianId: string) => {
    const { data } = await apiFetch(`/api/v1/work-orders/${workOrderId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ bayId, technicianId }),
    });
    if (data?.success) {
      setWorkOrders(prev => prev.map(wo => wo.id === workOrderId ? data.data : wo));
    }
  };

  const handleSaveInspection = async (report: unknown) => {
    const { data } = await apiFetch('/api/v1/inspections', {
      method: 'POST',
      body: JSON.stringify(report),
    });
    if (data?.success && activeDVIWorkOrder) {
      handleUpdateWorkOrderStatus(activeDVIWorkOrder.id, 'IN_SERVICE');
    }
  };

  const handleAdjustStock = async (itemId: string, delta: number, reason: string) => {
    const { data } = await apiFetch('/api/v1/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify({ itemId, quantityChange: delta, reason }),
    });
    if (data?.success) {
      setInventory(prev => prev.map(i => i.id === itemId ? data.data : i));
    }
    return data;
  };

  // ---- Inventory product management (server enforces Owner/write boundaries) ----
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const handleCreateProduct = async (p: Record<string, unknown>) => {
    const { data } = await apiFetch<{ success: boolean; error?: string }>('/api/v1/inventory/products', {
      method: 'POST',
      body: JSON.stringify(p),
    });
    return { success: Boolean(data?.success), error: data?.error };
  };

  const handleUpdateProduct = async (id: string, p: Record<string, unknown>) => {
    const { data } = await apiFetch<{ success: boolean; error?: string }>(`/api/v1/inventory/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(p),
    });
    return { success: Boolean(data?.success), error: data?.error };
  };

  const handleSetProductActive = async (id: string, active: boolean) => {
    const { data } = await apiFetch<{ success: boolean; error?: string }>(`/api/v1/inventory/products/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    });
    return { success: Boolean(data?.success), error: data?.error };
  };

  const handleDeleteProduct = async (id: string) => {
    const { data } = await apiFetch<{ success: boolean; error?: string }>(`/api/v1/inventory/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return { success: Boolean(data?.success), error: data?.error };
  };

  const handleStockMovement = async (id: string, delta: number, kind: 'PURCHASE' | 'ADJUSTMENT' | 'RETURN', reason: string) => {
    const { data } = await apiFetch<{ success: boolean; error?: string }>('/api/v1/inventory/movement', {
      method: 'POST',
      body: JSON.stringify({ itemId: id, delta, kind, reason }),
    });
    return { success: Boolean(data?.success), error: data?.error };
  };

  const handlePosCheckout = async (saleData: unknown) => {
    const { data } = await apiFetch('/api/v1/pos/checkout', {
      method: 'POST',
      body: JSON.stringify(saleData),
    });
    if (data?.success) {
      loadStaffData();
    }
    return data?.data;
  };

  const handleUpdateService = async (id: string, updates: Partial<ServiceItem>) => {
    const { data } = await apiFetch(`/api/v1/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (data?.success) {
      setServices(prev => prev.map(s => s.id === id ? data.data : s));
    }
    return data;
  };

  const toggleServiceSelection = (id: string) => {
    setSelectedServiceIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenBookingWithService = (serviceId?: string) => {
    setBookingPreselectedServiceId(serviceId);
    setIsBookingOpen(true);
  };

  // Status lookups route to /status; the tracker reads `?ref=` from the URL.

  const handleOpenPassport = (reg: string) => {
    setPassportPlateQuery(reg);
    navigateTo('/vehicle');
  };

  // Customer invoice view is a Phase 6 deliverable (token-based public invoice page);
  // until then customers are directed to contact the workshop.
  const handleViewInvoice = (_invoiceNumber: string) => {
    navigateTo('/contact');
  };

  // ---- Render ----
  if (staffUser) {
    return (
      <AdminLayout
        currentTab={adminTab}
        setCurrentTab={setAdminTab}
        staffUser={staffUser}
        onSignOut={handleStaffLogout}
      >
        {adminTab === 'operations' && <OperationsDashboard />}

        {adminTab === 'board' && (
          <WorkshopBoard
            workOrders={workOrders}
            bays={bays}
            staff={staff}
            onUpdateStatus={handleUpdateWorkOrderStatus}
            onAssignBayTech={handleAssignBayAndTech}
            onSelectWorkOrder={(wo) => setActiveDVIWorkOrder(wo)}
            onOpenDVI={(wo) => setActiveDVIWorkOrder(wo)}
          />
        )}

        {adminTab === 'technician' && (
          <TechnicianMode
            workOrders={workOrders}
            onUpdateStatus={handleUpdateWorkOrderStatus}
            onOpenDVI={(wo) => setActiveDVIWorkOrder(wo)}
          />
        )}

        {adminTab === 'pos' && (
          <PosTerminal
            services={services}
            inventory={inventory}
            cashierName={staffUser.name}
            onCompleteSale={handlePosCheckout}
          />
        )}

        {adminTab === 'inventory' && (
          <InventoryView
            inventory={inventory}
            movements={movements}
            canWrite={canWriteInventory}
            canDelete={staffUser?.role === 'OWNER'}
            suppliers={suppliers}
            onCreateProduct={handleCreateProduct}
            onUpdateProduct={handleUpdateProduct}
            onSetProductActive={handleSetProductActive}
            onDeleteProduct={handleDeleteProduct}
            onStockMovement={handleStockMovement}
            onAdjustStock={handleAdjustStock}
            onRefresh={loadStaffData}
          />
        )}

        {adminTab === 'invoices' && (
          <InvoicingView invoices={invoices} initialInvoiceNumber="" />
        )}

        {adminTab === 'reports' && <ReportsDashboard />}

        {adminTab === 'cms' && (
          <CmsSettings services={services} onUpdateService={handleUpdateService} />
        )}

        {adminTab === 'audit' && <AuditLogsView />}

        {adminTab === 'users' && <UsersView />}

        {adminTab === 'account' && <AccountView />}

        {/* Global DVI Inspection Editor Modal */}
        {activeDVIWorkOrder && (
          <InspectionEditor
            workOrder={activeDVIWorkOrder}
            existingInspection={null}
            onClose={() => setActiveDVIWorkOrder(null)}
            onSaveInspection={handleSaveInspection}
          />
        )}
      </AdminLayout>
    );
  }

  return (
    <div className="min-h-screen bg-[#000000] text-slate-100 flex flex-col font-sans selection:bg-[#159EF3] selection:text-black">
      <Header
        onOpenBooking={() => handleOpenBookingWithService()}
        onOpenStaff={() => setStaffLoginOpen(true)}
      />

      <main className="flex-1">
        <Routes>
          {/* HOME — premium 4-service preview; full catalogue lives at /services */}
          <Route
            path="/"
            element={
              <>
                <Hero onOpenBooking={() => handleOpenBookingWithService()} />
                <HunterServiceLine />
                <ServicePreview
                  services={services}
                  selectedServiceIds={selectedServiceIds}
                  onToggleServiceSelection={toggleServiceSelection}
                  onOpenBookingWithService={handleOpenBookingWithService}
                />
                <ContactSection />
              </>
            }
          />

          {/* SERVICES — the canonical full catalogue */}
          <Route
            path="/services"
            element={
              <ServiceCatalogue
                services={services}
                selectedServiceIds={selectedServiceIds}
                onToggleServiceSelection={toggleServiceSelection}
                onOpenBookingWithService={handleOpenBookingWithService}
              />
            }
          />

          {/* SERVICE DETAIL — deep-linkable */}
          <Route
            path="/services/:serviceId"
            element={
              <ServiceDetailPage
                services={services}
                onOpenBookingWithService={handleOpenBookingWithService}
              />
            }
          />

          <Route
            path="/vehicle"
            element={
              <VehiclePassportView
                initialPlate={passportPlateQuery}
                onBookForThisVehicle={() => handleOpenBookingWithService()}
                onViewInvoice={handleViewInvoice}
              />
            }
          />

          <Route
            path="/status"
            element={
              <ServiceStatusTracker
                initialReference={statusTrackQuery}
                onOpenPassport={handleOpenPassport}
              />
            }
          />

          <Route path="/contact" element={<ContactSection />} />

          {/* Fallbacks */}
          <Route path="/passport" element={<Navigate to="/vehicle" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Mobile Persistent Bottom Bar (customer only) */}
      <MobileBottomNav
        onOpenBooking={() => handleOpenBookingWithService()}
        onOpenStaff={() => setStaffLoginOpen(true)}
      />

      {/* Global 5-Step Progressive Booking Flow */}
      {isBookingOpen && (
        <BookingWorkflow
          services={services}
          preselectedServiceId={bookingPreselectedServiceId}
          onClose={() => setIsBookingOpen(false)}
          onBookingSuccess={(appt) => {
            setStatusTrackQuery(appt.reference);
          }}
        />
      )}

      {/* Staff login — the ONLY path into the staff console */}
      {staffLoginOpen && (
        <StaffLogin
          authReady={authReady}
          onClose={() => setStaffLoginOpen(false)}
          onAuthenticated={handleStaffAuthenticated}
        />
      )}
    </div>
  );
}

/** Router wrapper — real URLs for every public surface. */
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
