import type { Role } from '../generated/prisma/enums.js';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `requireAuth` / `optionalAuth`. */
      user?: { id: string; email: string; role: Role };
    }
  }
}

export {};
