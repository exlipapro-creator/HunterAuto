import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, RefreshCw, MailCheck, ShieldX, ShieldCheck } from 'lucide-react';

/**
 * Owner-only user management (server-enforced: /api/v1/users is OWNER-gated).
 * Plain business language, existing Hunter design tokens, no decorative noise.
 */

interface ManagedUser {
  id: string;
  legacyId: string | null;
  name: string;
  email: string;
  phone: string;
  role: string;
  active: boolean;
  linked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ASSIGNABLE_ROLES = [
  { value: 'MANAGER', label: 'Manager' },
  { value: 'SERVICE_ADVISOR', label: 'Service Advisor' },
  { value: 'TECHNICIAN', label: 'Technician' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'INVENTORY_MANAGER', label: 'Inventory Manager' },
  { value: 'ACCOUNTANT', label: 'Accountant' },
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  SERVICE_ADVISOR: 'Service Advisor',
  TECHNICIAN: 'Technician',
  CASHIER: 'Cashier',
  INVENTORY_MANAGER: 'Inventory Manager',
  ACCOUNTANT: 'Accountant',
};

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'MANAGER', password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/users');
      const json = await res.json();
      if (json.success) setUsers(json.data);
      else setNotice({ kind: 'err', text: json.error ?? 'Could not load users' });
    } catch {
      setNotice({ kind: 'err', text: 'Could not reach the server' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setNotice(null);
    try {
      const res = await fetch(`/api/v1/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) { await load(); setNotice({ kind: 'ok', text: 'Saved.' }); }
      else setNotice({ kind: 'err', text: json.error ?? 'Change was not saved' });
    } catch {
      setNotice({ kind: 'err', text: 'Could not reach the server' });
    } finally {
      setBusy(null);
    }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('invite');
    setNotice(null);
    try {
      const res = await fetch('/api/v1/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setForm({ name: '', email: '', role: 'MANAGER', password: '' });
        await load();
        setNotice({ kind: 'ok', text: 'User created.' });
      } else {
        setNotice({ kind: 'err', text: json.error ?? 'Could not create the user' });
      }
    } catch {
      setNotice({ kind: 'err', text: 'Could not reach the server' });
    } finally {
      setBusy(null);
    }
  };

  const inputCls = 'w-full px-3 py-2 bg-[#000000] border border-[#132038] rounded text-sm text-white focus:outline-none focus:border-[#159EF3]';
  const btnCls = 'px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wide border transition-colors disabled:opacity-50';

  return (
    <div className="space-y-6" id="users-view">
      <div className="bg-[#00101F] border border-[#132038] p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono-telemetry text-[#159EF3] uppercase tracking-widest block">OWNER ONLY</span>
          <h2 className="text-xl sm:text-2xl font-display font-extrabold text-white uppercase flex items-center gap-2">
            <Users className="w-6 h-6 text-[#159EF3]" /> TEAM
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Add team members, set roles, and deactivate accounts. Changes take effect immediately.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button id="users-refresh-btn" onClick={() => void load()} className={`${btnCls} bg-[#00101F] border-[#132038] text-slate-200 hover:border-[#159EF3]`}>
            <RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button
            id="users-add-btn"
            onClick={() => setShowForm((s) => !s)}
            className={`${btnCls} bg-[#159EF3] border-[#159EF3] text-[#00101F] hover:bg-[#3fb2f7]`}
          >
            <UserPlus className="w-3.5 h-3.5 inline mr-1" /> Add user
          </button>
        </div>
      </div>

      {notice && (
        <div role="status" className={`text-xs rounded p-3 border ${notice.kind === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          {notice.text}
        </div>
      )}

      {showForm && (
        <form id="users-invite-form" onSubmit={invite} className="bg-[#00101F] border border-[#132038] rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">Full name</span>
            <input id="users-invite-name" className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} maxLength={120} />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">Email</span>
            <input id="users-invite-email" type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">Role</span>
            <select id="users-invite-role" className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 block mb-1.5">Temporary password (optional)</span>
            <input id="users-invite-password" type="password" className={inputCls} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} placeholder="Leave empty to send an invite email" />
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={busy === 'invite'} className={`${btnCls} bg-[#159EF3] border-[#159EF3] text-[#00101F] hover:bg-[#3fb2f7]`}>
              {busy === 'invite' ? 'Creating…' : 'Create user'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className={`${btnCls} bg-transparent border-[#132038] text-slate-300 hover:border-[#159EF3]`}>Cancel</button>
            <span className="text-[10px] text-slate-500">Owner accounts are provisioned separately and never assignable here.</span>
          </div>
        </form>
      )}

      <div className="bg-[#00101F] border border-[#132038] rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono-telemetry text-xs">
            <thead className="bg-[#000000] border-b border-[#132038] text-[#8E9BAE] uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Name</th>
                <th className="p-3.5">Email</th>
                <th className="p-3.5">Role</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Last sign-in</th>
                <th className="p-3.5">Added</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#132038]">
              {loading && (
                <tr><td className="p-6 text-slate-400" colSpan={7}>Loading…</td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td className="p-6 text-slate-400" colSpan={7}>No users found.</td></tr>
              )}
              {users.map((u) => {
                const isOwner = u.role === 'OWNER';
                const isSelfRow = u.role === 'OWNER';
                return (
                  <tr key={u.id} className="hover:bg-[#001830] transition-colors" data-user-row={u.email}>
                    <td className="p-3.5">
                      <span className="font-bold text-white">{u.name}</span>
                      {!u.linked && <span className="ml-2 text-[10px] text-amber-400 uppercase">not linked</span>}
                    </td>
                    <td className="p-3.5 text-slate-300">{u.email || '—'}</td>
                    <td className="p-3.5">
                      {isOwner ? (
                        <span className="px-2 py-0.5 rounded font-bold text-[10px] uppercase bg-[#002958] text-[#159EF3] border border-[#159EF3]/30">{ROLE_LABELS[u.role]}</span>
                      ) : (
                        <select
                          aria-label={`Role for ${u.name}`}
                          className="bg-[#000000] border border-[#132038] rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-[#159EF3] disabled:opacity-50"
                          value={u.role}
                          disabled={busy === u.id}
                          onChange={(e) => void patch(u.id, { role: e.target.value })}
                        >
                          {ASSIGNABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="p-3.5">
                      {u.active ? (
                        <span className="text-emerald-400 font-bold uppercase text-[10px]">Active</span>
                      ) : (
                        <span className="text-red-400 font-bold uppercase text-[10px]">Inactive</span>
                      )}
                    </td>
                    <td className="p-3.5 text-slate-400 whitespace-nowrap">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
                    <td className="p-3.5 text-slate-400 whitespace-nowrap">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {u.linked && (
                          <button
                            id={`users-resend-${u.legacyId ?? u.id}`}
                            title="Send the invite email again"
                            disabled={busy === u.id || !u.email}
                            onClick={async () => {
                              setBusy(u.id);
                              const res = await fetch(`/api/v1/users/${u.id}/resend-invite`, { method: 'POST' });
                              const json = await res.json();
                              setNotice(json.success ? { kind: 'ok', text: 'Invite email sent.' } : { kind: 'err', text: json.error ?? 'Could not send' });
                              setBusy(null);
                            }}
                            className={`${btnCls} bg-transparent border-[#132038] text-slate-300 hover:border-[#159EF3]`}
                          >
                            <MailCheck className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {u.active ? (
                          <button
                            id={`users-deactivate-${u.legacyId ?? u.id}`}
                            disabled={busy === u.id || isSelfRow}
                            title={isSelfRow ? 'The primary Owner cannot be deactivated here' : 'Sign the user out and block future sign-ins'}
                            onClick={() => void patch(u.id, { active: false })}
                            className={`${btnCls} bg-transparent border-red-500/40 text-red-300 hover:bg-red-500/10`}
                          >
                            <ShieldX className="w-3.5 h-3.5 inline mr-1" /> Deactivate
                          </button>
                        ) : (
                          <button
                            id={`users-reactivate-${u.legacyId ?? u.id}`}
                            disabled={busy === u.id}
                            onClick={() => void patch(u.id, { active: true })}
                            className={`${btnCls} bg-transparent border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10`}
                          >
                            <ShieldCheck className="w-3.5 h-3.5 inline mr-1" /> Reactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
