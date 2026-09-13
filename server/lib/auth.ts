import type { Request, Response, NextFunction } from 'express';
import { resolveActor, isSupabaseConfigured, type AuthenticatedActor } from './supabaseAdmin';

export type UserRole =
  | 'OWNER'
  | 'MANAGER'
  | 'SERVICE_ADVISOR'
  | 'TECHNICIAN'
  | 'CASHIER'
  | 'INVENTORY_MANAGER'
  | 'ACCOUNTANT';

/**
 * Hunter Autoworks role → endpoint-family permission matrix.
 *
 * Backend source of truth for authorization. Frontend role display is NEVER
 * a security boundary; every protected route resolves the actor server-side
 * and enforces these permissions.
 */
const FAMILY_PERMISSIONS: Record<UserRole, string[]> = {
  OWNER: ['*'],
  MANAGER: [
    'workshop', 'work-orders', 'appointments', 'customers', 'vehicles',
    'inventory', 'pos', 'invoices', 'reports', 'staff', 'settings', 'inspections', 'audit', 'account',
  ],
  SERVICE_ADVISOR: ['workshop', 'work-orders', 'appointments', 'customers', 'vehicles', 'inspections', 'invoices', 'account'],
  TECHNICIAN: ['workshop', 'work-orders:assigned', 'inspections', 'account'],
  CASHIER: ['pos', 'invoices', 'customers', 'account'],
  INVENTORY_MANAGER: ['inventory', 'reports:inventory', 'account'],
  ACCOUNTANT: ['invoices', 'reports', 'expenses', 'account'],
};

/** Roles allowed to write (mutate) within a family. */
const WRITE_ROLES: Record<string, UserRole[]> = {
  'work-orders': ['OWNER', 'MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN'],
  'inspections': ['OWNER', 'MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN'],
  'appointments': ['OWNER', 'MANAGER', 'SERVICE_ADVISOR'],
  'customers': ['OWNER', 'MANAGER', 'SERVICE_ADVISOR', 'CASHIER'],
  'inventory': ['OWNER', 'MANAGER', 'INVENTORY_MANAGER'],
  'pos': ['OWNER', 'MANAGER', 'CASHIER'],
  'invoices': ['OWNER', 'MANAGER', 'CASHIER', 'ACCOUNTANT'],
  'staff': ['OWNER', 'MANAGER'],
  'settings': ['OWNER'],
  'reports': ['OWNER', 'MANAGER', 'ACCOUNTANT'],
  'audit': ['OWNER', 'MANAGER'],
  // Account settings: every role may manage its OWN password/sessions.
  // Owner-only account administration (roles, activation) is a different
  // family ('staff') and is NOT granted here.
  'account': ['OWNER', 'MANAGER', 'SERVICE_ADVISOR', 'TECHNICIAN', 'CASHIER', 'INVENTORY_MANAGER', 'ACCOUNTANT'],
};

export interface AuthedRequest extends Request {
  actor?: AuthenticatedActor;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

function familyOf(path: string): string {
  // /api/v1/<family>/...
  const parts = path.split('?')[0].split('/').filter(Boolean);
  return parts[2] || parts[1] || '';
}

function roleAllows(role: string, family: string, method: string): boolean {
  const grants = FAMILY_PERMISSIONS[role as UserRole];
  if (!grants) return false;
  if (grants.includes('*')) return true;

  const isWrite = method !== 'GET' && method !== 'HEAD';
  if (isWrite && grants.includes(`${family}:assigned`)) return true; // technician workflow writes

  if (!grants.includes(family)) return false;
  if (isWrite) {
    const writers = WRITE_ROLES[family];
    return writers ? writers.includes(role as UserRole) : false;
  }
  return true;
}

/** Factory enforcing authentication + RBAC for an endpoint family (or '*'). */
export function requireAuth(family?: string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    try {
      if (!isSupabaseConfigured()) {
        throw new HttpError(503, 'AUTH_UNAVAILABLE', 'Authentication is not configured on this server.');
      }
      const actor = await resolveActor(req);
      if (!actor) {
        throw new HttpError(401, 'UNAUTHENTICATED', 'Sign in required.');
      }
      if (!actor.role || !FAMILY_PERMISSIONS[actor.role as UserRole]) {
        throw new HttpError(403, 'NO_STAFF_ROLE', 'This account has no active Hunter staff role.');
      }
      if (family && family !== '*') {
        if (!roleAllows(actor.role, family, req.method)) {
          throw new HttpError(403, 'FORBIDDEN', 'You do not have permission for this operation.');
        }
      }
      req.actor = actor;
      next();
    } catch (err) {
      if (err instanceof HttpError) {
        res.status(err.status).json({ success: false, error: err.message, code: err.code });
      } else {
        res.status(500).json({ success: false, error: 'Authentication failure', code: 'AUTH_FAILURE' });
      }
    }
  };
}

/** Wrap a handler (sync or ASYNC) so HttpError becomes a safe JSON response.
 *  Async rejections MUST be awaited here: an unhandled rejection terminates
 *  Node ≥15 by default and would crash the whole server on e.g. an invalid
 *  Bearer token reaching `await admin.auth.getUser(token)`. */
export function handler(fn: (req: AuthedRequest, res: Response) => unknown) {
  return (req: AuthedRequest, res: Response) => {
    Promise.resolve()
      .then(() => fn(req, res))
      .catch((err) => {
        if (res.headersSent) return; // response already in flight
        if (err instanceof HttpError) {
          res.status(err.status).json({ success: false, error: err.message, code: err.code });
        } else {
          res.status(500).json({ success: false, error: 'Request failed', code: 'INTERNAL' });
        }
      });
  };
}
