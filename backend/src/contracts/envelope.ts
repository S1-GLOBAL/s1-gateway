/** Every successful response body. */
export interface DataEnvelope<T> {
  data: T;
}

/** Every error response body. Field-level problems are in `details.fields`. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
