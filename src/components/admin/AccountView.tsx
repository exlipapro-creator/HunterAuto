import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, MonitorSmartphone, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { getSupabaseBrowser } from '../../lib/supabase';

/**
 * Account — real, self-service staff account settings (Phase B).
 *
 * Every value shown comes from the server: name/role/active from the staff
 * record the server resolves the signed-in token against; email and
 * member-since from the Supabase Auth directory; sessions are real Auth
 * session records. Password change re-verifies the CURRENT password
 * server-side before rotating. No fake data, no client-side authorization.
 */

interface AccountProfile {
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  phone: string | null;
  memberSince: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  MANAGER: 'Workshop Manager',
  SERVICE_ADVISOR: 'Service Advisor',
  TECHNICIAN: 'Technician',
  CASHIER: 'Cashier',
  INVENTORY_MANAGER: 'Inventory Manager',
  ACCOUNTANT: 'Accountant',
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export const AccountView: React.FC = () => {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loadError, setLoadError] = useState('');

  // password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const [revokeBusy, setRevokeBusy] = useState(false);
  const [revokeDone, setRevokeDone] = useState(false);
  const [revokeError, setRevokeError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const p = await apiFetch('/api/v1/account/profile');
      if (p.ok && p.data?.success) setProfile(p.data.data);
      else setLoadError(p.data?.error || 'Could not load your account.');
    } catch {
      setLoadError('Could not reach the account service.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(''); setPwSuccess(false);
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    setPwBusy(true);
    try {
      const res = await apiFetch('/api/v1/account/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok && res.data?.success) {
        setPwSuccess(true);
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      } else {
        setPwError(res.data?.error || 'Could not change the password.');
      }
    } catch {
      setPwError('Could not reach the account service.');
    } finally {
      setPwBusy(false);
    }
  };

  const revokeOthers = async () => {
    setRevokeBusy(true); setRevokeError(''); setRevokeDone(false);
    try {
      const res = await apiFetch('/api/v1/account/sessions/revoke-others', { method: 'POST' });
      if (res.ok && res.data?.success) {
        // Also clear any remembered sessions in THIS browser other than the
        // current tab's session, so stale tokens cannot linger.
        const sb = getSupabaseBrowser();
        if (sb) { await sb.auth.signOut({ scope: 'others' }); }
        setRevokeDone(true);
      } else {
        setRevokeError(res.data?.error || 'Could not sign out other sessions.');
      }
    } catch {
      setRevokeError('Could not reach the account service.');
    } finally {
      setRevokeBusy(false);
    }
  };

  if (loadError && !profile) {
    return (
      <div className="p-6 max-w-2xl">
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded p-4 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return <div className="p-6 text-sm text-slate-400">Loading your account…</div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Account</h1>
        <p className="text-sm text-slate-400 mt-1">Your profile, password and signed-in sessions.</p>
      </div>

      {/* ---------- Profile ---------- */}
      <section className="bg-[#04121F] border border-[#132038] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#132038] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#159EF3]" />
          <h2 className="text-sm font-semibold text-white">Profile</h2>
        </div>
        <dl className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Name</dt>
            <dd className="text-slate-200">{profile.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Work email</dt>
            <dd className="text-slate-200 break-all">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Role</dt>
            <dd className="text-slate-200">{ROLE_LABELS[profile.role] || profile.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Status</dt>
            <dd>
              <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded border ${profile.active ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' : 'text-red-300 border-red-500/30 bg-red-500/10'}`}>
                {profile.active ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 mb-0.5">Member since</dt>
            <dd className="text-slate-200">{fmtDate(profile.memberSince)}</dd>
          </div>
          {profile.phone && (
            <div>
              <dt className="text-xs text-slate-500 mb-0.5">Phone</dt>
              <dd className="text-slate-200">{profile.phone}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* ---------- Security / password ---------- */}
      <section className="bg-[#04121F] border border-[#132038] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#132038] flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#159EF3]" />
          <h2 className="text-sm font-semibold text-white">Password</h2>
        </div>
        <form onSubmit={submitPassword} className="px-5 py-4 space-y-4 max-w-md">
          {pwSuccess && (
            <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded p-3 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Password changed successfully.</span>
            </div>
          )}
          {pwError && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded p-3 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{pwError}</span>
            </div>
          )}
          <div>
            <label htmlFor="pw-current" className="block text-xs font-medium text-slate-300 mb-1.5">Current password</label>
            <input
              id="pw-current"
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-[#00101F] border border-[#132038] rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#159EF3]"
            />
          </div>
          <div>
            <label htmlFor="pw-new" className="block text-xs font-medium text-slate-300 mb-1.5">New password</label>
            <input
              id="pw-new"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-[#00101F] border border-[#132038] rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#159EF3]"
            />
            <p className="text-[11px] text-slate-500 mt-1">At least 8 characters.</p>
          </div>
          <div>
            <label htmlFor="pw-confirm" className="block text-xs font-medium text-slate-300 mb-1.5">Confirm new password</label>
            <input
              id="pw-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[#00101F] border border-[#132038] rounded px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#159EF3]"
            />
          </div>
          <button
            type="submit"
            disabled={pwBusy}
            id="account-change-password"
            className="bg-[#159EF3] hover:bg-[#159EF3]/90 disabled:opacity-50 text-[#00101F] text-sm font-semibold px-4 py-2 rounded transition-colors"
          >
            {pwBusy ? 'Changing…' : 'Change password'}
          </button>
        </form>
      </section>

      {/* ---------- Sessions / device safety ---------- */}
      <section className="bg-[#04121F] border border-[#132038] rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-[#132038] flex items-center gap-2">
          <MonitorSmartphone className="w-4 h-4 text-[#159EF3]" />
          <h2 className="text-sm font-semibold text-white">Devices</h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-slate-400">
            If you have used your account on another computer or phone, signing it out there
            protects your account. This device stays signed in.
          </p>
          {revokeDone && (
            <div className="flex items-start gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 rounded p-3 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>All other devices have been signed out.</span>
            </div>
          )}
          {revokeError && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-300 rounded p-3 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{revokeError}</span>
            </div>
          )}
          <button
            onClick={revokeOthers}
            disabled={revokeBusy}
            id="account-revoke-others"
            className="text-sm border border-[#132038] hover:border-red-500/40 hover:text-red-300 text-slate-300 px-4 py-2 rounded transition-colors disabled:opacity-50"
          >
            {revokeBusy ? 'Signing out…' : 'Sign out other devices'}
          </button>
        </div>
      </section>
    </div>
  );
};
