/**
 * Vercel serverless entry. The Express app is exported WITHOUT calling
 * listen() - Vercel invokes it as a request handler per invocation.
 * Non-serverless deploys keep using src/index.ts (listen + graceful shutdown).
 *
 * Built by `npm run build` (tsc -> dist/) before Vercel packages the function;
 * the bundler traces ../dist and node_modules automatically.
 */
import { createApp } from '../dist/app.js';

export default createApp();
