import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { effectScope, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Router } from 'vue-router';

let vite: ViteDevServer;
let auth: typeof import('../src/services/AuthService.js');
let stores: typeof import('../src/stores/authstore.js');
let guards: typeof import('../src/router/authenticationGuard.js');
let navigation: typeof import('../src/router/sessionNavigation.js');
let persistence: typeof import('../src/PiniaConfig.js');
let users: typeof import('../src/services/UserService.js');
let userStores: typeof import('../src/stores/userstore.js');
let api: typeof import('../src/services/ApiService.js');
let handler: (request: IncomingMessage, response: ServerResponse) => void;
let requestCount = 0;
const userId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
let profile = { id: userId, name: 'Backend User', email: 'user@soccer.example', role: 'user' };
const originalBaseUrl = process.env.VITE_API_BASE_URL;
const server = createHttpServer((request, response) => {
  requestCount += 1;
  handler(request, response);
});

function json(response: ServerResponse, status: number, data: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(data));
}

function loginResponse(expiresIn = 900, expirySeconds = expiresIn) {
  // Stub signature for contract tests only; real NestJS JWT checks are verified separately.
  const header = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: profile.id, exp: Math.floor(Date.now() / 1000) + expirySeconds }),
  ).toString('base64url');
  return {
    accessToken: `${header}.${payload}.academic_signature`,
    tokenType: 'Bearer',
    expiresIn,
    user: { ...profile, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  };
}

function defaultHandler(request: IncomingMessage, response: ServerResponse): void {
  if (request.url === '/api/auth/login') {
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      const credentials = JSON.parse(body) as { email: string; password: string };
      const isUser =
        credentials.email === 'user@soccer.example' && credentials.password === 'UserDemo123';
      const isAdmin =
        credentials.email === 'admin@soccer.example' && credentials.password === 'AdminDemo123';
      if (!isUser && !isAdmin) {
        json(response, 401, { statusCode: 401, message: ['Invalid email or password.'] });
        return;
      }
      profile = isAdmin
        ? { id: adminId, name: 'Backend Admin', email: credentials.email, role: 'admin' }
        : { id: userId, name: 'Backend User', email: credentials.email, role: 'user' };
      json(response, 200, loginResponse());
    });
    return;
  }
  if (request.url === '/api/auth/me') {
    json(response, 200, profile);
    return;
  }
  json(response, 404, { statusCode: 404, message: ['Not found.'] });
}

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  process.env.VITE_API_BASE_URL = `http://127.0.0.1:${address.port}/api`;
  vite = await createServer({
    configFile: false,
    mode: 'test',
    server: { middlewareMode: true, watch: null },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  });
  auth = (await vite.ssrLoadModule('/src/services/AuthService.ts')) as typeof auth;
  stores = (await vite.ssrLoadModule('/src/stores/authstore.ts')) as typeof stores;
  guards = (await vite.ssrLoadModule('/src/router/authenticationGuard.ts')) as typeof guards;
  navigation = (await vite.ssrLoadModule('/src/router/sessionNavigation.ts')) as typeof navigation;
  persistence = (await vite.ssrLoadModule('/src/PiniaConfig.ts')) as typeof persistence;
  users = (await vite.ssrLoadModule('/src/services/UserService.ts')) as typeof users;
  userStores = (await vite.ssrLoadModule('/src/stores/userstore.ts')) as typeof userStores;
  api = (await vite.ssrLoadModule('/src/services/ApiService.ts')) as typeof api;
});

beforeEach(async () => {
  setActivePinia(createPinia());
  handler = defaultHandler;
  profile = { id: userId, name: 'Backend User', email: 'user@soccer.example', role: 'user' };
  requestCount = 0;
  await auth.AuthService.reconcileSession();
});

afterEach(() => auth.AuthService.logout());

after(async () => {
  await vite?.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (originalBaseUrl === undefined) delete process.env.VITE_API_BASE_URL;
  else process.env.VITE_API_BASE_URL = originalBaseUrl;
});

function loginAsUser() {
  return auth.AuthService.login({ email: 'user@soccer.example', password: 'UserDemo123' });
}
function loginAsAdmin() {
  return auth.AuthService.login({ email: 'admin@soccer.example', password: 'AdminDemo123' });
}

function routerForTest(): Router {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: {} },
      { path: '/login', name: 'login', component: {} },
      { path: '/dashboard', name: 'dashboard', component: {}, meta: { requiresAuth: true } },
      { path: '/teams', name: 'teams', component: {}, meta: { requiresAuth: true } },
      {
        path: '/admin/users',
        name: 'admin.users',
        component: {},
        meta: { requiresAuth: true, requiresAdmin: true },
      },
    ],
  });
  router.beforeEach(guards.authenticationGuard);
  return router;
}

async function waitFor(condition: () => boolean, timeout = 2000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!condition() && Date.now() < deadline)
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  assert.ok(condition(), 'Expected session/navigation transition before timeout.');
}

test('normalizes email, preserves password bytes and stores only the backend profile', async () => {
  handler = (request, response) => {
    assert.equal(request.method, 'POST');
    assert.equal(request.url, '/api/auth/login');
    assert.equal(request.headers.authorization, undefined);
    let body = '';
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      assert.deepEqual(JSON.parse(body), {
        email: 'user@soccer.example',
        password: ' password with spaces ',
      });
      const result = loginResponse();
      json(response, 200, { ...result, user: { ...result.user, passwordHash: 'not-a-real-hash' } });
    });
  };
  const result = await auth.AuthService.login({
    email: '  USER@SOCCER.EXAMPLE ',
    password: ' password with spaces ',
  });
  assert.deepEqual(result, { success: true, data: profile });
  assert.deepEqual(stores.useAuthStore().currentUser, profile);
  assert.equal(auth.AuthService.isAuthenticated(), true);
  assert.equal(auth.AuthService.isAdmin(), false);
  assert.equal('passwordHash' in (result.success ? result.data : {}), false);
});

test('rejects fictional local credentials and never authenticates against userstore', async () => {
  userStores.useUserStore().users = [
    {
      id: userId,
      name: 'Local Admin',
      email: 'local@example.test',
      password: 'Local123!',
      role: 'admin',
      createdAt: 'test',
      updatedAt: 'test',
    },
  ];
  const result = await auth.AuthService.login({
    email: 'local@example.test',
    password: 'Local123!',
  });
  assert.deepEqual(result, { success: false, errors: ['Invalid email or password.'] });
  assert.equal(auth.AuthService.isAuthenticated(), false);
  assert.equal(requestCount, 1);
  assert.equal((await loginAsUser()).success, true);
  assert.equal(auth.AuthService.getCurrentUser()?.name, 'Backend User');
});

for (const email of ['missing@soccer.example', 'user@soccer.example']) {
  test(`invalid credentials for ${email} have the same generic feedback`, async () => {
    assert.deepEqual(await auth.AuthService.login({ email, password: 'incorrect' }), {
      success: false,
      errors: ['Invalid email or password.'],
    });
    assert.equal(stores.useAuthStore().accessToken, null);
  });
}

test('empty credentials never send a request and preserve generic feedback', async () => {
  assert.equal((await auth.AuthService.login({ email: '', password: '' })).success, false);
  assert.equal(requestCount, 0);
  assert.equal(stores.useAuthStore().isSessionLoading, false);
});

test('a malformed or already-expired login response cannot establish a session', async () => {
  for (const response of [
    {},
    { ...loginResponse(), accessToken: 'not-a-jwt' },
    { ...loginResponse(), expiresIn: 0 },
    { ...loginResponse(), expiresIn: 3601 },
    { ...loginResponse(), user: { ...profile, role: 'owner' } },
    loginResponse(1, -1),
  ]) {
    handler = (_request, res) => json(res, 200, response);
    assert.equal((await loginAsUser()).success, false);
    assert.equal(stores.useAuthStore().accessToken, null);
    assert.equal(stores.useAuthStore().isSessionLoading, false);
  }
});

test('logout cancels an in-flight login so its response cannot restore the account', async () => {
  let release: (() => void) | undefined;
  let received: () => void = () => {};
  const requestReceived = new Promise<void>((resolve) => {
    received = resolve;
  });
  handler = (_request, response) => {
    release = () => json(response, 200, loginResponse());
    received();
  };
  const result = loginAsUser();
  await requestReceived;
  auth.AuthService.logout();
  release?.();
  assert.equal((await result).success, false);
  assert.equal(auth.AuthService.isAuthenticated(), false);
});

test('session checks coalesce and hide protected identity while awaiting auth/me', async () => {
  await loginAsUser();
  let release: (() => void) | undefined;
  let received: () => void = () => {};
  const requestReceived = new Promise<void>((resolve) => {
    received = resolve;
  });
  handler = (request, response) => {
    assert.equal(request.url, '/api/auth/me');
    assert.ok(request.headers.authorization?.startsWith('Bearer '));
    release = () => json(response, 200, profile);
    received();
  };
  const first = auth.AuthService.reconcileSession();
  const second = auth.AuthService.reconcileSession();
  assert.equal(first, second);
  assert.equal(stores.useAuthStore().isSessionLoading, true);
  assert.equal(auth.AuthService.isAuthenticated(), false);
  await requestReceived;
  release?.();
  assert.equal((await first).success, true);
  assert.equal(requestCount, 2);
  assert.equal(stores.useAuthStore().isSessionLoading, false);
  assert.equal(auth.AuthService.isAuthenticated(), true);
});

test('auth/me updates the profile and role from the server while keeping the token', async () => {
  await loginAsAdmin();
  const token = stores.useAuthStore().accessToken;
  profile = { ...profile, name: 'Changed on server', role: 'user' };
  assert.equal((await auth.AuthService.reconcileSession()).success, true);
  assert.equal(auth.AuthService.getCurrentUser()?.name, 'Changed on server');
  assert.equal(auth.AuthService.isAdmin(), false);
  assert.equal(stores.useAuthStore().accessToken, token);
});

for (const reason of ['invalid token', 'expired token', 'deleted user']) {
  test(`auth/me 401 for ${reason} logs out safely`, async () => {
    await loginAsUser();
    handler = (_request, response) => json(response, 401, { statusCode: 401, message: [reason] });
    assert.equal((await auth.AuthService.reconcileSession()).success, false);
    assert.equal(stores.useAuthStore().accessToken, null);
    assert.equal(auth.AuthService.getCurrentUser(), null);
    assert.equal(stores.useAuthStore().isSessionLoading, false);
  });
}

test('a transient server error blocks protected rendering and allows a later session check', async () => {
  await loginAsUser();
  const token = stores.useAuthStore().accessToken;
  handler = (_request, response) =>
    json(response, 500, { statusCode: 500, message: ['private stack'] });
  assert.equal((await auth.AuthService.reconcileSession()).success, false);
  assert.equal(auth.AuthService.isAuthenticated(), false);
  assert.equal(stores.useAuthStore().accessToken, token);
  assert.ok(!stores.useAuthStore().sessionError?.includes('stack'));
  handler = defaultHandler;
  assert.equal((await auth.AuthService.reconcileSession()).success, true);
  assert.equal(auth.AuthService.isAuthenticated(), true);
});

test('logout during auth/me prevents a late response from restoring identity', async () => {
  await loginAsUser();
  let release: (() => void) | undefined;
  let received: () => void = () => {};
  const requestReceived = new Promise<void>((resolve) => {
    received = resolve;
  });
  handler = (_request, response) => {
    release = () => json(response, 200, profile);
    received();
  };
  const pending = auth.AuthService.reconcileSession();
  await requestReceived;
  auth.AuthService.logout();
  release?.();
  assert.equal((await pending).success, false);
  assert.equal(auth.AuthService.getCurrentUser(), null);
});

test('expiry automatically clears the session even without another HTTP request', async () => {
  handler = (_request, response) => json(response, 200, loginResponse(1, 2));
  assert.equal((await loginAsUser()).success, true);
  await waitFor(() => stores.useAuthStore().accessToken === null);
  assert.equal(auth.AuthService.isAuthenticated(), false);
});

test('local user edits/deletions cannot change the backend-authenticated profile or role', async () => {
  await loginAsAdmin();
  const stored = {
    id: adminId,
    name: 'Local Copy',
    email: 'copy@example.test',
    password: 'Local123!',
    role: 'admin',
    createdAt: 'test',
    updatedAt: 'test',
  };
  userStores.useUserStore().users = [
    stored,
    { ...stored, id: userId, email: 'other@example.test' },
  ];
  assert.equal(
    users.UserService.updateUser(adminId, { name: 'Local Edit', role: 'user' }).success,
    true,
  );
  assert.equal(auth.AuthService.getCurrentUser()?.name, 'Backend Admin');
  assert.equal(auth.AuthService.isAdmin(), true);
  assert.equal(users.UserService.deleteUser(adminId).success, true);
  assert.equal(auth.AuthService.isAuthenticated(), true);
});

test('a browser reload ignores persisted auth but preserves domain state', async () => {
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
    await loginAsUser();
    await nextTick();
    const token = stores.useAuthStore().accessToken;
    assert.ok(token !== null);
    const saved = storage.getItem(persistence.piniaStateKey) ?? '{}';
    assert.ok(!saved.includes(token));
    assert.ok(!saved.includes('Backend User'));
    const snapshot = JSON.parse(saved) as { state: Record<string, unknown>; version: number };
    const teams = snapshot.state.teams;
    snapshot.state.auth = {
      currentUser: { ...profile, role: 'admin' },
      accessToken: token,
      expiresAt: Date.now() + 900000,
      isSessionVerified: true,
    };
    auth.AuthService.logout();
    storage.setItem(persistence.piniaStateKey, JSON.stringify(snapshot));
    const reloaded = createPinia();
    setActivePinia(reloaded);
    scope.run(() => persistence.configurePinia(reloaded));
    await auth.AuthService.reconcileSession();
    assert.equal(stores.useAuthStore().accessToken, null);
    assert.equal(stores.useAuthStore().currentUser, null);
    assert.equal(auth.AuthService.isAuthenticated(), false);
    assert.deepEqual(reloaded.state.value.teams, teams);
    assert.equal(requestCount, 1);
  } finally {
    scope.stop();
    if (oldStorage === undefined) Reflect.deleteProperty(globalThis, 'localStorage');
    else Object.defineProperty(globalThis, 'localStorage', oldStorage);
  }
});

test('guest admin URLs redirect once to login and preserve the intended destination', async () => {
  const router = routerForTest();
  let checks = 0;
  router.beforeEach(() => {
    checks += 1;
  });
  await router.push('/admin/users');
  assert.equal(router.currentRoute.value.name, 'login');
  assert.equal(router.currentRoute.value.query.redirect, '/admin/users');
  assert.ok(checks < 4);
  assert.equal(requestCount, 0);
});

test('regular users cannot open an admin URL and administrators can', async () => {
  await loginAsUser();
  const router = routerForTest();
  await router.push('/admin/users');
  assert.equal(router.currentRoute.value.name, 'dashboard');
  await loginAsAdmin();
  await router.push('/admin/users');
  assert.equal(router.currentRoute.value.name, 'admin.users');
});

test('authenticated login navigation and public home navigation have no redirect loop', async () => {
  await loginAsUser();
  const router = routerForTest();
  await router.push('/login');
  assert.equal(router.currentRoute.value.name, 'dashboard');
  await router.push('/');
  assert.equal(router.currentRoute.value.name, 'home');
  auth.AuthService.logout();
  await router.push('/login');
  assert.equal(router.currentRoute.value.name, 'login');
});

test('active-page 401 redirects to login without transport retries or redirect loops', async () => {
  await loginAsUser();
  const router = routerForTest();
  await router.push('/teams');
  const stop = navigation.registerSessionNavigation(router);
  try {
    handler = (_request, response) =>
      json(response, 401, { statusCode: 401, message: ['invalid'] });
    await api.ApiService.request({ url: '/teams' });
    await waitFor(() => router.currentRoute.value.name === 'login');
    assert.equal(router.currentRoute.value.query.redirect, '/teams');
    assert.equal(stores.useAuthStore().accessToken, null);
  } finally {
    stop();
  }
});

test('an active admin page leaves after a server-side role downgrade', async () => {
  await loginAsAdmin();
  const router = routerForTest();
  await router.push('/admin/users');
  const stop = navigation.registerSessionNavigation(router);
  try {
    profile = { ...profile, role: 'user' };
    await auth.AuthService.reconcileSession();
    await waitFor(() => router.currentRoute.value.name === 'dashboard');
  } finally {
    stop();
  }
});

test('login redirects accept only known internal destinations and never return to login', () => {
  const router = routerForTest();
  for (const value of [
    undefined,
    ['//external.example'],
    'https://external.example',
    '//external.example',
    '/login?redirect=/login',
    '/\\external.example',
  ]) {
    assert.equal(guards.resolveLoginRedirect(router, value), '/dashboard');
  }
  assert.equal(guards.resolveLoginRedirect(router, '/teams?filter=active'), '/teams?filter=active');
});
