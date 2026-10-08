import axios from 'axios';
import type { AxiosInstance } from 'axios';

import { getApiBaseUrl } from '@/config/environment.js';
import type { ApiRequestDTO } from '@/dtos/ApiRequestDTO.js';
import { ApiErrorService } from '@/services/ApiErrorService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { useAuthStore } from '@/stores/authstore.js';

// Restrict this authenticated client to endpoints below its configured API base path.
function validateEndpoint(url: string): void {
  const path = decodeURIComponent(url);

  if (
    !/^\/?[a-zA-Z0-9_-]/.test(path) ||
    path.includes(':') ||
    path.includes('\\') ||
    path.includes('?') ||
    path.includes('#') ||
    path.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error('Use a relative API endpoint and pass query values through params.');
  }
}

export class ApiService {
  private static client: AxiosInstance | null = null;

  static async request<T>(request: ApiRequestDTO): Promise<ServiceResult<T>> {
    const requiresAuth = request.requiresAuth !== false;

    try {
      validateEndpoint(request.url);
      const response = await ApiService.getClient().request<T>({
        url: request.url,
        method: request.method ?? 'GET',
        data: request.data,
        params: request.params,
        signal: request.signal,
        // Axios uses false to suppress this header, including in the request interceptor.
        headers: requiresAuth ? undefined : { Authorization: false },
      });

      return { success: true, data: response.data };
    } catch (error: unknown) {
      const statusCode = ApiErrorService.getStatusCode(error);
      return {
        success: false,
        errors: ApiErrorService.getMessages(error, requiresAuth),
        ...(statusCode === undefined ? {} : { statusCode }),
      };
    }
  }

  private static getClient(): AxiosInstance {
    if (ApiService.client !== null) {
      return ApiService.client;
    }

    // Initialization is lazy: existing local services remain usable before API integration.
    const client = axios.create({
      baseURL: getApiBaseUrl(),
      timeout: 10_000,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      withCredentials: false,
      withXSRFToken: false,
      allowAbsoluteUrls: false,
    });

    client.interceptors.request.use((config) => {
      if (config.headers.get('Authorization') !== false) {
        const authStore = useAuthStore();
        // Background tabs throttle timers; enforce expiration before a new protected request.
        if (authStore.expiresAt !== null && authStore.expiresAt <= Date.now()) {
          authStore.clearCurrentUser();
        }
        const token = authStore.accessToken;
        config.headers.set('Authorization', token === null ? undefined : `Bearer ${token}`);
      }

      return config;
    });

    client.interceptors.response.use(
      (response) => response,
      (error: unknown) => {
        if (axios.isAxiosError<unknown>(error) && error.response?.status === 401) {
          const authorization = error.config?.headers.get('Authorization');

          if (authorization !== false) {
            const authStore = useAuthStore();
            const activeAuthorization =
              authStore.accessToken === null ? undefined : `Bearer ${authStore.accessToken}`;

            // Concurrent failures clear once; a stale response cannot log out a newer session.
            if (authorization === activeAuthorization) {
              authStore.clearCurrentUser();
            }
          }
        }

        // Navigation stays in the existing router/consumers; no retry or redirect loop here.
        return Promise.reject(error);
      },
    );

    ApiService.client = client;
    return client;
  }
}
