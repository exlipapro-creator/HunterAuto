import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/api.js';
import { repositoryBackend } from './server/lib/repository.js';

async function startServer() {
  const app = express();
  // PORT is environment-overridable (Phase E / VPS rebuild + isolated restore
  // testing) with the historical 3000 as the default.
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // ---- Security headers (production hardening; same-origin app, no CORS needed) ----
  // CSP allows the Google Fonts used by index.html; everything else is self.
  // script-src: Vite DEV injects inline scripts (react-refresh preamble), so
  // dev needs 'unsafe-inline'; the production build ships external files only.
  // connect-src: the Supabase project URL must be reachable from the browser —
  // supabase-js validates/refreshes Auth tokens directly against it
  // (setSession / autoRefreshToken). Blocking it silently breaks staff
  // session persistence. Read from env; no other third-party origins.
  // img-src additionally allows OpenStreetMap raster tiles — the ONLY external
  // image origin — required by the "Take Me to Hunter" in-site navigation map
  // (Leaflet). Routing traffic does NOT need connect-src here: route requests
  // go through our own /api/v1/directions endpoint ('self').
  // Permissions-Policy: geolocation=(self) — browser Geolocation is enabled
  // for this origin only (requested exclusively after the customer taps
  // "Take Me to Hunter"); camera/microphone remain fully disabled and no
  // other origin is granted geolocation.
  const isProd = process.env.NODE_ENV === 'production';
  const supabaseOrigin = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\/$/, '');
  const connectSrc = ["'self'", ...(supabaseOrigin.startsWith('https://') ? [supabaseOrigin] : []), ...(isProd ? [] : ['ws:', 'wss:'])].join(' ');
  const CSP = [
    "default-src 'self'",
    `script-src 'self'${isProd ? '' : " 'unsafe-inline'"}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    `connect-src ${connectSrc}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
    res.setHeader('Content-Security-Policy', CSP);
    if (isProd) {
      // HSTS only in production: dev runs on plain http://localhost.
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // ---- Request correlation: every request/response carries an x-request-id.
  // Registered BEFORE the API mounts so router responses include the header.
  // Server-generated when the client supplies none; a client-supplied ID is
  // echoed ONLY as a correlation handle (length-capped, never trusted as an
  // identity or used for any authorization decision).
  let requestCounter = 0;
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const raw = req.header('x-request-id');
    const id = (raw && raw.length <= 64 ? raw : '') || `req-${Date.now().toString(36)}-${(++requestCounter).toString(36)}`;
    res.setHeader('x-request-id', id);
    next();
  });

  // Mount API endpoints first
  app.use('/api/v1', apiRouter);

  // Also support legacy /api alias
  app.use('/api', apiRouter);
  // Unknown /api paths must return JSON 404, never the SPA HTML shell:
  // an API consumer relying on status codes / JSON bodies (or an authz
  // probe hitting a mistyped path) must not be served the customer app.
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'Not found.', code: 'NOT_FOUND' });
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Hunter Autoworks — The Car Lab server running on http://0.0.0.0:${PORT}`);
    if (process.env.NODE_ENV === 'production' && repositoryBackend() === 'json') {
      console.error('FATAL: Supabase credentials are not configured. Production refuses to serve on the JSON development store (fail-closed). Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then restart.');
      process.exit(1);
    }
  });

  // ---- Graceful shutdown (Render sends SIGTERM on redeploys/instability) ----
  // 1) stop accepting new connections 2) let in-flight requests finish
  // (bounded) 3) close the listener 4) exit deterministically.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return; // second signal force-exits below
    shuttingDown = true;
    console.log(`[server] ${signal} received — draining connections…`);
    server.close(() => {
      console.log('[server] closed cleanly');
      process.exit(0);
    });
    // Render expects redeploy turnaround in well under a minute; never hang.
    setTimeout(() => {
      console.log('[server] drain timeout elapsed — exiting');
      process.exit(0);
    }, 8000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandled rejection:', reason instanceof Error ? reason.message : reason);
  });

  // ---- Final error handler: never leak stacks/SQL/paths to clients ----
  // Body-parse failures (malformed JSON, oversized payloads) become clean 400/413 JSON;
  // everything else becomes a generic structured 500.
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (res.headersSent) return;
    const isParse = err?.type === 'entity.parse.failed' || err instanceof SyntaxError;
    const isTooLarge = err?.type === 'entity.too.large';
    const status = isParse ? 400 : isTooLarge ? 413 : 500;
    const message = isParse ? 'Malformed request body.' : isTooLarge ? 'Request body too large.' : 'Request failed.';
    if (status === 500) console.error('[server] unhandled error:', err?.message ?? err);
    res.status(status).json({ success: false, error: message, code: isParse ? 'BAD_JSON' : isTooLarge ? 'BODY_TOO_LARGE' : 'INTERNAL' });
  });
}

startServer();
