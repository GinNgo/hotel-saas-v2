/** Standard API response wrapper — khớp backend ApiResponse<T> */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
  timestamp: string;
}

/** Optional API envelope returned by endpoints that wrap payloads in `{ data }`. */
export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T | null;
  message?: string | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
  timestamp?: string;
}

/** Unwraps `{ data }` envelopes while passing direct payloads through unchanged. */
export function unwrapApiEnvelope<T>(res: ApiEnvelope<T> | T): T {
  if (
    res !== null &&
    res !== undefined &&
    typeof res === 'object' &&
    !Array.isArray(res) &&
    'data' in res &&
    res.data !== undefined &&
    res.data !== null
  ) {
    return res.data;
  }
  return res as T;
}

/** Paginated result — khớp backend PagedResult<T> */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}
