export type SuccessEnvelope<T> = { success: true; data: T };
export type ErrorEnvelope = {
  success: false;
  error: {
    code: string;
    message: string;
    data?: unknown;
  };
};

export function ok<T>(data: T): SuccessEnvelope<T> {
  return { success: true, data };
}

export function fail(code: string, message: string, data?: unknown): ErrorEnvelope {
  return {
    success: false,
    error: data === undefined ? { code, message } : { code, message, data }
  };
}

