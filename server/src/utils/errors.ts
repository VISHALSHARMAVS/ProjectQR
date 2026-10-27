export class AppError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function assertFound<T>(value: T | null | undefined, message = 'Record not found'): T {
  if (!value) throw new AppError(404, 'NOT_FOUND', message);
  return value;
}
