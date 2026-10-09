import { ApiService } from '@/services/ApiService.js';
import { AuthService } from '@/services/AuthService.js';
import type { ServiceResult } from '@/services/ServiceResult.js';
import { useAuthStore } from '@/stores/authstore.js';

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
export function isText(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}
export function isCount(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value) && value >= 0
  );
}

// Teams, Players and MatchStats share transport behavior; their DTOs and public response readers stay separate.
export function createRestResource<T, Create extends object, Update extends object>(
  endpoint: string,
  read: (value: unknown) => T | null,
  fields: readonly (keyof Create & keyof Update)[],
) {
  const invalid = (): ServiceResult<never> => ({
    success: false,
    errors: ['Unable to read the server data. Please reload and try again.'],
  });
  const forbidden = (): ServiceResult<never> => ({
    success: false,
    statusCode: 403,
    errors: ['Administrator access is required.'],
  });
  async function request(
    url: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    payload?: Create | Update,
  ): Promise<ServiceResult<unknown>> {
    if (method !== 'GET' && !AuthService.isAdmin()) return forbidden();
    const token = useAuthStore().accessToken;
    const data =
      payload === undefined
        ? undefined
        : Object.fromEntries(
            fields.filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]]),
          );
    const result = await ApiService.request<unknown>({ url, method, data });
    if (
      !result.success &&
      result.statusCode === 403 &&
      token !== null &&
      token === useAuthStore().accessToken
    ) {
      await AuthService.reconcileSession({ background: true });
    }
    return result;
  }
  async function readOne(
    url: string,
    method: 'GET' | 'POST' | 'PATCH',
    payload?: Create | Update,
  ): Promise<ServiceResult<T>> {
    const result = await request(url, method, payload);
    if (!result.success) return result;
    const record = read(result.data);
    return record === null ? invalid() : { success: true, data: record };
  }
  return {
    async list(): Promise<ServiceResult<T[]>> {
      const result = await request(endpoint, 'GET');
      if (!result.success) return result;
      if (!Array.isArray(result.data)) return invalid();
      const records = result.data.map(read);
      if (records.some((record) => record === null)) return invalid();
      return { success: true, data: records.filter((record): record is T => record !== null) };
    },
    get: (id: string) => readOne(`${endpoint}/${encodeURIComponent(id)}`, 'GET'),
    create: (payload: Create) => readOne(endpoint, 'POST', payload),
    update: (id: string, payload: Update) =>
      readOne(`${endpoint}/${encodeURIComponent(id)}`, 'PATCH', payload),
    async remove(id: string): Promise<ServiceResult<undefined>> {
      const result = await request(`${endpoint}/${encodeURIComponent(id)}`, 'DELETE');
      return result.success ? { success: true, data: undefined } : result;
    },
  };
}
