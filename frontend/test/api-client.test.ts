import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { after, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { AxiosError } from 'axios';
import { createPinia, setActivePinia } from 'pinia';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { effectScope, nextTick } from 'vue';

// Vite resolves the same aliases and import.meta.env as the application, without another test library.
let vite: ViteDevServer;
let api: typeof import('../src/services/ApiService.js');
let errors: typeof import('../src/services/ApiErrorService.js');
let environment: typeof import('../src/config/environment.js');
let auth: typeof import('../src/stores/authstore.js');
let persistence: typeof import('../src/PiniaConfig.js');
let requestCount = 0;
let handler: (request: IncomingMessage, response: ServerResponse) => void;

const previousBaseUrl = process.env.VITE_API_BASE_URL;
const httpServer = createHttpServer((request, response) => {
  requestCount += 1;
  handler(request, response);
});

before(async () => {
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const address = httpServer.address();
  assert.ok(address !== null && typeof address !== 'string');
  process.env.VITE_API_BASE_URL = `http://127.0.0.1:${address.port}/api`;

  vite = await createServer({
    configFile: false,
    mode: 'test',
    server: { middlewareMode: true, watch: null },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  });
  api = (await vite.ssrLoadModule('/src/services/ApiService.ts')) as typeof api;
  errors = (await vite.ssrLoadModule('/src/services/ApiErrorService.ts')) as typeof errors;
  environment = (await vite.ssrLoadModule('/src/config/environment.ts')) as typeof environment;
  auth = (await vite.ssrLoadModule('/src/stores/authstore.ts')) as typeof auth;
  persistence = (await vite.ssrLoadModule('/src/PiniaConfig.ts')) as typeof persistence;
});

beforeEach(() => {
  setActivePinia(createPinia());
  requestCount = 0;
  handler = (_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ ok: true }));
  };
});

after(async () => {
  await vite?.close();
  httpServer.closeAllConnections();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));

  if (previousBaseUrl === undefined) {
    delete process.env.VITE_API_BASE_URL;
  } else {
    process.env.VITE_API_BASE_URL = previousBaseUrl;
  }
});

function startSession(token = 'academic-test-token'): ReturnType<typeof auth.useAuthStore> {
  const store = auth.useAuthStore();
  store.setCurrentUser({
    id: 'test-user',
    name: 'Test User',
    email: 'user@example.test',
    role: 'user',
  });
  store.setAccessToken(token);
  return store;
}

function respondWithError(status: number, message: unknown): void {
  handler = (_request, response) => {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({ statusCode: status, message, path: '/api/test', timestamp: 'test' }),
    );
  };
}

test('uses the configured API prefix, query values, JSON headers and current token', async () => {
  startSession();
  handler = (request, response) => {
    assert.equal(request.url, '/api/players?status=active');
    assert.equal(request.headers.authorization, 'Bearer academic-test-token');
    assert.equal(request.headers.accept, 'application/json');
    assert.equal(request.headers['content-type'], 'application/json');
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify([{ id: 'player' }]));
  };
  const result = await api.ApiService.request<{ id: string }[]>({
    url: '/players',
    params: { status: 'active' },
  });
  assert.deepEqual(result, { success: true, data: [{ id: 'player' }] });
});

test('reads a changed token for every request and sends no token after logout', async () => {
  const store = startSession();
  const authorizations: (string | undefined)[] = [];
  handler = (request, response) => {
    authorizations.push(request.headers.authorization);
    response.end('{}');
  };
  await api.ApiService.request({ url: 'teams' });
  store.setAccessToken('updated-academic-token');
  await api.ApiService.request({ url: 'teams' });
  store.clearCurrentUser();
  await api.ApiService.request({ url: 'teams' });
  assert.deepEqual(authorizations, [
    'Bearer academic-test-token',
    'Bearer updated-academic-token',
    undefined,
  ]);
});

test('serializes POST payloads and accepts a DELETE with no response body', async () => {
  handler = (request, response) => {
    assert.equal(request.method, 'POST');
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      assert.deepEqual(JSON.parse(body), { name: 'Test Team' });
      response.statusCode = 201;
      response.end('{"id":"team"}');
    });
  };
  assert.deepEqual(
    await api.ApiService.request({ url: '/teams', method: 'POST', data: { name: 'Test Team' } }),
    {
      success: true,
      data: { id: 'team' },
    },
  );
  handler = (request, response) => {
    assert.equal(request.method, 'DELETE');
    response.statusCode = 204;
    response.end();
  };
  assert.equal(
    (await api.ApiService.request<void>({ url: '/teams/team', method: 'DELETE' })).success,
    true,
  );
});

test('invalid public login does not send a token or clear an existing session', async () => {
  const store = startSession();
  handler = (request, response) => {
    assert.equal(request.headers.authorization, undefined);
    response.statusCode = 401;
    response.end('{"message":"private authentication detail"}');
  };
  assert.deepEqual(
    await api.ApiService.request({ url: '/auth/login', method: 'POST', requiresAuth: false }),
    {
      success: false,
      errors: ['Invalid email or password.'],
    },
  );
  assert.equal(store.accessToken, 'academic-test-token');
  assert.notEqual(store.currentUser, null);
});

test('simultaneous protected 401 responses clear the session without retries', async () => {
  const store = startSession();
  respondWithError(401, ['private detail']);
  const results = await Promise.all([
    api.ApiService.request({ url: '/teams' }),
    api.ApiService.request({ url: '/players' }),
  ]);
  assert.equal(requestCount, 2);
  assert.equal(store.currentUser, null);
  assert.equal(store.accessToken, null);
  assert.ok(results.every((result) => !result.success));
});

test('a stale 401 cannot clear a newly established session', async () => {
  const store = startSession();
  let release: (() => void) | undefined;
  let received: () => void = () => {};
  const pendingRequest = new Promise<void>((resolve) => {
    received = resolve;
  });
  handler = (_request, response) => {
    release = () => {
      response.statusCode = 401;
      response.end('{}');
    };
    received();
  };
  const result = api.ApiService.request({ url: '/teams' });
  await pendingRequest;
  store.setAccessToken('new-academic-session-token');
  release?.();
  assert.equal((await result).success, false);
  assert.equal(store.accessToken, 'new-academic-session-token');
  assert.notEqual(store.currentUser, null);
});

for (const [status, expected] of [
  [403, 'You do not have permission to perform this operation.'],
  [404, 'The requested resource was not found.'],
  [500, 'The server is temporarily unavailable. Please try again later.'],
  [503, 'The server is temporarily unavailable. Please try again later.'],
] as const) {
  test(`normalizes ${status} without exposing response details or clearing the session`, async () => {
    const store = startSession();
    respondWithError(status, ['SQL stack private token']);
    assert.deepEqual(await api.ApiService.request({ url: '/teams' }), {
      success: false,
      errors: [expected],
    });
    assert.equal(store.accessToken, 'academic-test-token');
  });
}

for (const status of [400, 409, 422]) {
  test(`preserves documented ${status} validation/conflict messages`, async () => {
    respondWithError(status, ['  Invalid team.  ', 'Invalid name.']);
    assert.deepEqual(await api.ApiService.request({ url: '/teams' }), {
      success: false,
      errors: ['Invalid team.', 'Invalid name.'],
    });
  });
}

test('handles malformed error envelopes predictably', async () => {
  respondWithError(400, { detail: 'untrusted object' });
  assert.deepEqual(await api.ApiService.request({ url: '/teams' }), {
    success: false,
    errors: ['Check the submitted data.'],
  });
});

test('handles network failure and cancellation without clearing the session', async () => {
  const store = startSession();
  handler = (request) => {
    request.socket.destroy();
  };
  assert.deepEqual(await api.ApiService.request({ url: '/teams' }), {
    success: false,
    errors: ['Unable to connect to the server. Check your connection and try again.'],
  });
  const controller = new AbortController();
  controller.abort();
  assert.deepEqual(await api.ApiService.request({ url: '/teams', signal: controller.signal }), {
    success: false,
    errors: ['The request was canceled.'],
  });
  assert.equal(store.accessToken, 'academic-test-token');
});

test('normalizes timeouts and unexpected errors without echoing diagnostic data', () => {
  assert.deepEqual(
    errors.ApiErrorService.getMessages(new AxiosError('private', 'ECONNABORTED'), true),
    ['The request timed out. Please try again.'],
  );
  assert.deepEqual(errors.ApiErrorService.getMessages(new Error('private token'), true), [
    'Unable to complete the request. Please try again.',
  ]);
});

for (const endpoint of [
  'https://external.example/steal',
  '//external.example/steal',
  '../users',
  '/%2e%2e/users',
  '/teams?token=value',
  '/teams\\users',
]) {
  test(`rejects an unsafe endpoint ${endpoint} before sending a request`, async () => {
    startSession();
    assert.equal((await api.ApiService.request({ url: endpoint })).success, false);
    assert.equal(requestCount, 0);
  });
}

test('validates configuration and supports same-origin deployments without a localhost fallback', () => {
  assert.equal(
    environment.resolveApiBaseUrl(' https://api.example.test/api/ '),
    'https://api.example.test/api',
  );
  assert.equal(environment.resolveApiBaseUrl('/api/'), '/api');
  for (const value of [
    undefined,
    '',
    'localhost:3000',
    '//external.example/api',
    'ftp://example.test/api',
    'https://user:pass@example.test/api',
    'https://example.test/api?token=value',
    'https://example.test/api#fragment',
  ]) {
    assert.throws(() => environment.resolveApiBaseUrl(value));
  }
});

test('never saves or restores the token through centralized Pinia persistence', async () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const oldStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const scope = effectScope();

  try {
    const pinia = createPinia();
    setActivePinia(pinia);
    scope.run(() => persistence.configurePinia(pinia));
    const store = startSession();
    await nextTick();
    assert.ok(!storage.getItem(persistence.piniaStateKey)?.includes('academic-test-token'));
    assert.equal(store.accessToken, 'academic-test-token');
    const saved = JSON.parse(storage.getItem(persistence.piniaStateKey) ?? '{}') as {
      state: { auth: { currentUser: { id: string }; accessToken?: string } };
    };
    assert.equal(saved.state.auth, undefined);
    saved.state.auth = {
      currentUser: { id: 'test-user' },
      accessToken: 'previously-persisted-test-token',
    };
    storage.setItem(persistence.piniaStateKey, JSON.stringify(saved));
    const reloaded = createPinia();
    setActivePinia(reloaded);
    scope.run(() => persistence.configurePinia(reloaded));
    assert.equal(auth.useAuthStore().accessToken, null);
    assert.ok(
      !storage.getItem(persistence.piniaStateKey)?.includes('previously-persisted-test-token'),
    );
    assert.equal(auth.useAuthStore().currentUser, null);
    assert.equal(auth.useAuthStore().isAuthenticated, false);
  } finally {
    scope.stop();
    if (oldStorage === undefined) {
      Reflect.deleteProperty(globalThis, 'localStorage');
    } else {
      Object.defineProperty(globalThis, 'localStorage', oldStorage);
    }
  }
});
