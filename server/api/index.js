/**
 * Vercel serverless entry. The Express app is exported WITHOUT calling
 * listen() - Vercel invokes it as a request handler per invocation.
 * Non-serverless deploys keep using src/index.ts (listen + graceful shutdown).
 *
 * The app is built lazily inside the handler: if any module-load step fails
 * (env validation, bundling gaps), the error reaches the response as JSON
 * instead of an opaque FUNCTION_INVOCATION_FAILED, and is logged for the
 * Vercel runtime logs.
 */

console.log('[api/index.js] module loaded');

let appPromise;

function getApp() {
  appPromise ??= import('../dist/app.js').then((m) => m.createApp());
  return appPromise;
}

export default async function handler(req, res) {
  // Vercel sometimes sends an empty or rewrite-destination path for root.
  // Normalize before handing to Express so the existing `app.get('/')` route
  // and `/api/*` router still match correctly.
  const originalUrl = req.originalUrl ?? req.url ?? '/';
  const url = req.url && req.url.length > 0 ? req.url : originalUrl || '/';
  console.log(`[handler] method=${req.method} url=${JSON.stringify(req.url)} originalUrl=${JSON.stringify(req.originalUrl)} normalized=${JSON.stringify(url)}`);

  req.url = url;
  if (req.originalUrl === undefined) req.originalUrl = originalUrl;

  // Zero-dependency probe: if even this fails, Vercel never reaches user code
  // and the problem is function registration/routing, not our modules.
  if (req.url === '/__ping') {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ pong: true }));
    return;
  }
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    console.error('API boot failed:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'BOOT_FAILED',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
