/** Application error rendered as RFC 7807 application/problem+json. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly title: string,
    public readonly detail?: string,
    public readonly type: string = 'about:blank',
  ) {
    super(detail ?? title);
    this.name = 'AppError';
  }
}

export const unauthorized = (detail?: string) => new AppError(401, 'Unauthorized', detail);
export const forbidden = (detail?: string) => new AppError(403, 'Forbidden', detail);
export const notFound = (detail?: string) => new AppError(404, 'Not Found', detail);
export const badRequest = (detail?: string) => new AppError(400, 'Bad Request', detail);
export const conflict = (detail?: string) => new AppError(409, 'Conflict', detail);
