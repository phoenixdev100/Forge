import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import apiRouter from './routes.js';

export function createApp() {
  const app = express();

  // Behind a proxy (Render/Fly/Nginx) this is required for correct client IPs,
  // which the rate limiter and refresh-token audit trail both depend on.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // The SPA is served separately; a restrictive CSP belongs on that origin.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Same-origin and server-to-server requests send no Origin header.
        if (!origin || env.CORS_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed`));
      },
      credentials: true,
    }),
  );

  app.use(compression());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  app.use(
    pinoHttp({
      logger,
      // Successful set-logging calls are high-frequency; keep them quiet.
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'debug';
      },
    }),
  );

  // Root probe - opening the API origin in a browser should answer with
  // something useful instead of a 404.
  app.get('/', (_req, res) => {
    res.json({ name: 'Forge API', status: 'ok', health: '/api/health' });
  });

  app.use('/api', apiRouter);

  // Locally uploaded exercise media / progress photos.
  app.use('/uploads', express.static(env.UPLOAD_DIR, { maxAge: '7d', fallthrough: true }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
