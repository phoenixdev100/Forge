/**
 * Vercel serverless entry. Express app is imported from the compiled dist/
 * and re-exported as the default handler so the framework runtime can
 * invoke it per request. The long-running deployment uses src/index.ts.
 */
import app from '../dist/app.js';

export default app;
