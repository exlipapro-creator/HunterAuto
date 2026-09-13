import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, AlertCircle } from 'lucide-react';
import { HunterLogo } from '../brand/HunterLogo';
import { getSupabaseBrowser, fetchStaffIdentity, type StaffAuthUser } from '../../lib/supabase';

interface StaffLoginProps {
  authReady: boolean;
  onClose: () => void;
  onAuthenticated: (user: StaffAuthUser) => void;
}

/**
 * Staff sign-in — the ONLY entry to the Hunter staff console.
 * Replaces the removed public "Hunter Control" toggle and role simulator.
 */
export const StaffLogin: React.FC<StaffLoginProps> = ({ authReady, onClose, onAuthenticated }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // If a session already exists, verify it immediately.
  useEffect(() => {
    const check = async () => {
      const sb = getSupabaseBrowser();
      if (!sb) return;
      const { data } = await sb.auth.getSession();
      if (data.session?.access_token) {
        const me = await fetchStaffIdentity(data.session.access_token);
        if (me) onAuthenticated(me);
      }
    };
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const configured = Boolean(getSupabaseBrowser());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error || 'Sign-in failed. Please try again.');
        return;
      }
      // Persist the session client-side so the browser holds the tokens.
      const sb = getSupabaseBrowser();
      if (sb) {
        const { error: sessionErr } = await sb.auth.setSession({
          access_token: json.data.access_token,
          refresh_token: json.data.refresh_token,
        });
        if (sessionErr) {
          // A stored session is required for every subsequent staff API call
          // (they carry the Bearer token from the browser client). Proceeding
          // without it would render a console that 401s on everything.
          setError('Credentials accepted, but this browser could not store your session. Please try again.');
          return;
        }
      }
      onAuthenticated(json.data.user);
    } catch {
      setError('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
      id="staff-login-backdrop"
      onClick={onClose}
    >
      <div
        className="bg-[#00101F] border border-[#132038] w-full max-w-sm rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        id="staff-login-card"
      >
        <div className="bg-[#000000] p-5 border-b border-[#132038] flex items-start justify-between">
          <div>
            <HunterLogo variant="full" className="scale-90 origin-left" />
            <p className="text-[10px] font-mono-telemetry uppercase tracking-[0.25em] text-[#8E9BAE] mt-2">
              Staff Sign In
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close sign in"
            id="staff-login-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {!configured && (
            <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Staff sign-in is not configured yet. The Supabase anon key must be set by the
                administrator (VITE_SUPABASE_ANON_KEY).
              </span>
            </div>
          )}

          <div>
            <label htmlFor="staff-email" className="block text-xs font-medium text-slate-300 mb-1.5">
              Work email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="staff-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@hunterautoworks.co.tz"
                className="w-full bg-[#000000] border border-[#132038] focus:border-[#159EF3] rounded px-9 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="staff-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#000000] border border-[#132038] focus:border-[#159EF3] rounded px-9 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none"
              />
            </div>
          </div>

          {error && (
            <div role="alert" className="flex items-start gap-2 text-xs bg-red-500/10 border border-red-500/30 text-red-300 rounded p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !authReady || !configured}
            className="w-full bg-[#159EF3] hover:bg-[#38B2FF] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold text-sm py-2.5 rounded transition-colors active:scale-[0.99]"
            id="staff-login-submit"
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Access is restricted to Hunter Autoworks staff.
            <br />
            Unauthorized access attempts are logged.
          </p>
        </form>
      </div>
    </div>
  );
};
