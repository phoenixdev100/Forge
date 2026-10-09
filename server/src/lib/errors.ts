/**
 * Application errors carry a stable machine-readable `code` alongside a
 * human-friendly `message`. The client maps codes to copy where it wants
 * something more specific than the default message.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { details?: unknown; expose?: boolean; cause?: unknown } = {},
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.expose = options.expose ?? status < 500;
  }
}

export const badRequest = (message = 'The request was invalid.', details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, { details });

export const unauthorized = (message = 'You need to sign in to continue.', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'You do not have access to this.') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (what = 'resource') =>
  new AppError(404, 'NOT_FOUND', `We could not find that ${what}.`);

export const conflict = (message: string, code = 'CONFLICT', details?: unknown) =>
  new AppError(409, code, message, { details });

export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'UNPROCESSABLE', message, { details });

export const tooManyRequests = (message = 'Too many attempts. Please try again shortly.') =>
  new AppError(429, 'RATE_LIMITED', message);

export const internal = (message = 'Something went wrong on our end.', cause?: unknown) =>
  new AppError(500, 'INTERNAL', message, { cause, expose: false });
