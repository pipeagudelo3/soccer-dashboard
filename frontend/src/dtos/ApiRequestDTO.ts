// Domain services describe requests without importing Axios or configuring transport headers.
export interface ApiRequestDTO {
  url: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  data?: unknown;
  params?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  requiresAuth?: boolean;
}
