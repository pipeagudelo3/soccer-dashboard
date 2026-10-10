// Validate public configuration without printing its value or falling back to a local host.
export function resolveApiBaseUrl(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('Configure VITE_API_BASE_URL before using the backend API.');
  }

  const baseUrl = value.trim();
  const isRelative = baseUrl.startsWith('/') && !baseUrl.startsWith('//');
  const parsedUrl = new URL(baseUrl, 'https://configuration.invalid');

  if (
    (!isRelative && !/^https?:\/\//i.test(baseUrl)) ||
    parsedUrl.username !== '' ||
    parsedUrl.password !== '' ||
    parsedUrl.search !== '' ||
    parsedUrl.hash !== '' ||
    baseUrl.includes('\\')
  ) {
    throw new Error('VITE_API_BASE_URL must be an HTTP(S) URL or a same-origin absolute path.');
  }

  return (isRelative ? parsedUrl.pathname : parsedUrl.href).replace(/\/+$/, '') || '/';
}

export function getApiBaseUrl(): string {
  return resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
}
