/** Standard API response wrapper — khớp backend ApiResponse<T> */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errorCode?: string | null;
  errors?: Record<string, string[]> | null;
  timestamp: string;
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
