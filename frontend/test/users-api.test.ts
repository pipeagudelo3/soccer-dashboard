import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { effectScope, h, nextTick } from 'vue';
import type { Component } from 'vue';
import type { EffectScope } from 'vue';

import type { UserInterface } from '../src/interfaces/UserInterface.js';

let vite: ViteDevServer;
let userForm: Component;
let service: typeof import('../src/services/UserService.js');
let state: typeof import('../src/composables/useUserAdministration.js');
let auth: typeof import('../src/services/AuthService.js');
let stores: typeof import('../src/stores/authstore.js');
let api: typeof import('../src/services/ApiService.js');
let persistence: typeof import('../src/PiniaConfig.js');
let page: ReturnType<typeof state.useUserAdministration>;
let scope: EffectScope;
let records: UserInterface[];
let handler: (request: IncomingMessage, response: ServerResponse) => void;
let requests: { url: string; method: string; authorization: string | undefined }[];
const adminId = '22222222-2222-4222-8222-222222222222';
const userId = '11111111-1111-4111-8111-111111111111';
const createdId = '33333333-3333-4333-8333-333333333333';
const originalBaseUrl = process.env.VITE_API_BASE_URL;
const timestamp = '2026-01-01T00:00:00.000Z';
let fixtureExpiry = Math.floor(Date.now() / 1000) + 900;
const server = createHttpServer((request, response) => {
  requests.push({
    url: request.url ?? '',
    method: request.method ?? '',
    authorization: request.headers.authorization,
  });
  handler(request, response);
});

function record(id: string, role: 'admin' | 'user' = 'user'): UserInterface {
  return {
    id,
    role,
    name: role === 'admin' ? 'Backend Admin' : 'Backend User',
    email: role === 'admin' ? 'admin@soccer.example' : 'user@soccer.example',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
function token(id: string): string {
  return (
    'academic.' +
    Buffer.from(JSON.stringify({ sub: id, exp: fixtureExpiry })).toString('base64url') +
    '.signature'
  );
}
function startSession(id = adminId): void {
  const user = records.find((value) => value.id === id);
  assert.ok(user);
  stores.useAuthStore().setSession(user, token(id), Date.now() + 900000);
}
function json(response: ServerResponse, status: number, data: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(data));
}
function failure(response: ServerResponse, status: number, message: string): void {
  json(response, status, { statusCode: status, message: [message], path: '/api/users', timestamp });
}
function defaultHandler(request: IncomingMessage, response: ServerResponse): void {
  const actor = records.find(
    (user) => request.headers.authorization === `Bearer ${token(user.id)}`,
  );
  if (!actor) return failure(response, 401, 'Private identity detail');
  if (request.url === '/api/auth/me') return json(response, 200, actor);
  if (actor.role !== 'admin') return failure(response, 403, 'Private permissions');
  if (request.url === '/api/users' && request.method === 'GET') return json(response, 200, records);
  const id = request.url?.split('/').at(-1);
  const current = records.find((user) => user.id === id);
  if (request.url !== '/api/users' && !current) return failure(response, 404, 'User not found.');
  if (request.method === 'GET') return json(response, 200, current);
  if (request.method === 'DELETE') {
    records = records.filter((user) => user.id !== id);
    response.statusCode = 204;
    response.end();
    return;
  }
  let body = '';
  request.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  request.on('end', () => {
    const payload = JSON.parse(body) as Record<string, unknown>;
    if (payload.name === '') return failure(response, 400, 'name should not be empty');
    if (records.some((user) => user.id !== id && user.email === payload.email)) {
      return failure(response, 409, 'A user with this email already exists.');
    }
    const value = { ...(current ?? record(createdId)), ...payload, updatedAt: timestamp };
    // Test fixture emulates the public DTO; cryptographic and transaction rules are tested in NestJS.
    const user: UserInterface = {
      id: value.id,
      name: String(value.name).trim(),
      email: String(value.email).trim().toLowerCase(),
      role: value.role,
      createdAt: value.createdAt,
      updatedAt: value.updatedAt,
    };
    records = [...records.filter((item) => item.id !== user.id), user];
    json(response, current ? 200 : 201, user);
  });
}

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address !== 'string');
  process.env.VITE_API_BASE_URL = `http://127.0.0.1:${address.port}/api`;
  vite = await createServer({
    configFile: false,
    plugins: [vue()],
    mode: 'test',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  });
  userForm = (await vite.ssrLoadModule('/src/components/UserFormPanel.vue')).default as Component;
  service = (await vite.ssrLoadModule('/src/services/UserService.ts')) as typeof service;
  state = (await vite.ssrLoadModule('/src/composables/useUserAdministration.ts')) as typeof state;
  auth = (await vite.ssrLoadModule('/src/services/AuthService.ts')) as typeof auth;
  stores = (await vite.ssrLoadModule('/src/stores/authstore.ts')) as typeof stores;
  api = (await vite.ssrLoadModule('/src/services/ApiService.ts')) as typeof api;
  persistence = (await vite.ssrLoadModule('/src/PiniaConfig.ts')) as typeof persistence;
});
beforeEach(() => {
  fixtureExpiry = Math.floor(Date.now() / 1000) + 900;
  setActivePinia(createPinia());
  records = [record(adminId, 'admin'), record(userId)];
  requests = [];
  handler = defaultHandler;
  startSession();
  scope = effectScope();
  const created = scope.run(() => state.useUserAdministration());
  assert.ok(created);
  page = created;
});
afterEach(() => {
  scope.stop();
  auth.AuthService.logout();
});
after(async () => {
  await vite?.close();
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (originalBaseUrl === undefined) delete process.env.VITE_API_BASE_URL;
  else process.env.VITE_API_BASE_URL = originalBaseUrl;
});

test('reads database users and reconstructs safe six-property public profiles', async () => {
  handler = (_request, response) =>
    json(
      response,
      200,
      records.map((user) => ({ ...user, password: 'sensitive', passwordHash: 'private' })),
    );
  const result = await service.UserService.getUsers();
  assert.ok(result.success);
  assert.deepEqual(result.data, records);
  assert.deepEqual(Object.keys(result.data[0] ?? {}).sort(), [
    'createdAt',
    'email',
    'id',
    'name',
    'role',
    'updatedAt',
  ]);
  assert.equal(requests[0]?.authorization, `Bearer ${token(adminId)}`);
});
test('GET by id reads a fresh record instead of a local user store', async () => {
  const result = await service.UserService.getUserById(userId);
  assert.deepEqual(result, { success: true, data: record(userId) });
  assert.equal(requests[0]?.url, `/api/users/${userId}`);
});
test('creates users through POST, sends only editable DTO fields and uses backend normalization', async () => {
  const result = await service.UserService.createUser({
    name: '  Created  ',
    email: ' CREATED@EXAMPLE.TEST ',
    password: ' password bytes ',
    role: 'user',
    ...{ id: 'not-writable', passwordHash: 'not-writable' },
  });
  assert.ok(result.success);
  assert.equal(result.data.name, 'Created');
  assert.equal(result.data.email, 'created@example.test');
  assert.equal(result.data.id, createdId);
  assert.equal('password' in result.data, false);
  assert.equal(requests[0]?.method, 'POST');
});
test('PATCH omits password when unchanged and does not mutate local data', async () => {
  let body = '';
  handler = (request, response) => {
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => json(response, 200, { ...record(userId), name: 'Updated' }));
  };
  const result = await service.UserService.updateUser(userId, {
    name: 'Updated',
    ...{ id: 'ignored', passwordHash: 'ignored' },
  });
  assert.ok(result.success);
  assert.deepEqual(JSON.parse(body), { name: 'Updated' });
});
test('DELETE accepts 204 and does not log out when another user is deleted', async () => {
  assert.deepEqual(await service.UserService.deleteUser(userId), {
    success: true,
    data: { deletedCurrentUser: false },
  });
  assert.equal(auth.AuthService.isAdmin(), true);
  assert.equal(requests[0]?.method, 'DELETE');
});
test('regular users cannot call any administration service operation', async () => {
  startSession(userId);
  const results = await Promise.all([
    service.UserService.getUsers(),
    service.UserService.getUserById(adminId),
    service.UserService.createUser({
      name: 'Denied',
      email: 'denied@test.example',
      password: 'Denied123',
      role: 'admin',
    }),
    service.UserService.updateUser(adminId, { role: 'user' }),
    service.UserService.deleteUser(adminId),
  ]);
  assert.ok(results.every((result) => !result.success && result.statusCode === 403));
  assert.equal(requests.length, 0);
});
test('bypassing UI and service permissions still receives the backend 403', async () => {
  startSession(userId);
  const result = await api.ApiService.request({ url: '/users', method: 'POST', data: {} });
  assert.ok(!result.success);
  assert.equal(result.statusCode, 403);
});
for (const status of [400, 409, 422]) {
  test(`preserves ${status} backend validation/conflict feedback and keeps create form open`, async () => {
    handler = (_request, response) => failure(response, status, 'Backend validation feedback');
    page.openCreateForm();
    await page.createUser({
      name: '',
      email: 'duplicate@example.test',
      password: 'invalid',
      role: 'user',
    });
    assert.equal(page.isFormOpen.value, true);
    assert.deepEqual(page.feedbackErrors.value, ['Backend validation feedback']);
    assert.equal(page.isSaving.value, false);
    assert.equal(page.users.value.length, 0);
  });
}
test('400 update validation keeps the selected form open without changing list data', async () => {
  await page.loadUsers();
  await page.openEditForm(userId);
  handler = (_request, response) => failure(response, 400, 'Password does not meet the policy.');
  await page.updateUser({ password: 'invalid' });
  assert.equal(page.isFormOpen.value, true);
  assert.equal(page.editingUser.value?.id, userId);
  assert.equal(page.users.value.find((user) => user.id === userId)?.name, 'Backend User');
  assert.deepEqual(page.feedbackErrors.value, ['Password does not meet the policy.']);
});
test('backend last-administrator conflict is authoritative and does not log out the actor', async () => {
  handler = (_request, response) =>
    failure(response, 409, 'The last administrator cannot be demoted or deleted.');
  const update = await service.UserService.updateUser(adminId, { role: 'user' });
  const deletion = await service.UserService.deleteUser(adminId);
  assert.ok(!update.success && !deletion.success);
  assert.equal(update.statusCode, 409);
  assert.equal(auth.AuthService.isAdmin(), true);
});
test('self-update refreshes current name/email/role through auth/me', async () => {
  const result = await service.UserService.updateUser(adminId, {
    name: 'Current Name',
    email: 'current@example.test',
    role: 'user',
  });
  assert.ok(result.success);
  assert.equal(auth.AuthService.getCurrentUser()?.name, 'Current Name');
  assert.equal(auth.AuthService.getCurrentUser()?.email, 'current@example.test');
  assert.equal(auth.AuthService.isAdmin(), false);
  assert.equal(requests.at(-1)?.url, '/api/auth/me');
});
test('a successful PATCH with a transient me failure is not reported as a failed write', async () => {
  handler = (request, response) =>
    request.url === '/api/auth/me'
      ? failure(response, 500, 'Private server error')
      : defaultHandler(request, response);
  const result = await service.UserService.updateUser(adminId, { name: 'Saved' });
  assert.ok(result.success);
  assert.equal(records.find((user) => user.id === adminId)?.name, 'Saved');
  assert.equal(auth.AuthService.isAuthenticated(), false);
  assert.notEqual(stores.useAuthStore().accessToken, null);
  assert.equal(requests.filter((request) => request.method === 'PATCH').length, 1);
});
test('self-delete clears token and profile only after a successful server deletion', async () => {
  assert.deepEqual(await service.UserService.deleteUser(adminId), {
    success: true,
    data: { deletedCurrentUser: true },
  });
  assert.equal(stores.useAuthStore().currentUser, null);
  assert.equal(stores.useAuthStore().accessToken, null);
});
test('a late self-delete cannot log out a different active session', async () => {
  let release: (() => void) | undefined;
  handler = (_request, response) => {
    release = () => {
      response.statusCode = 204;
      response.end();
    };
  };
  const pending = service.UserService.deleteUser(adminId);
  while (!release) await new Promise<void>((resolve) => setImmediate(resolve));
  startSession(userId);
  release();
  const result = await pending;
  assert.ok(result.success);
  assert.equal(result.data.deletedCurrentUser, false);
  assert.equal(stores.useAuthStore().currentUser?.id, userId);
});
test('401 invalidates session and presents generic feedback', async () => {
  handler = (_request, response) => failure(response, 401, 'Password hash private');
  const result = await service.UserService.getUsers();
  assert.ok(!result.success);
  assert.equal(result.statusCode, 401);
  assert.equal(stores.useAuthStore().accessToken, null);
  assert.ok(!result.errors.join(' ').includes('private'));
});
test('403 rechecks a changed role from auth/me instead of trusting an old admin profile', async () => {
  records[0] = record(adminId, 'user');
  const result = await service.UserService.getUsers();
  assert.ok(!result.success);
  assert.equal(result.statusCode, 403);
  assert.equal(auth.AuthService.isAdmin(), false);
  assert.equal(requests.at(-1)?.url, '/api/auth/me');
});
test('load exposes loading, server error, retry and successful empty states', async () => {
  let release: (() => void) | undefined;
  handler = (_request, response) => {
    release = () => failure(response, 500, 'Private stack');
  };
  const pending = page.loadUsers();
  assert.equal(page.isLoading.value, true);
  while (!release) await new Promise<void>((resolve) => setImmediate(resolve));
  release();
  await pending;
  assert.equal(page.hasLoaded.value, false);
  assert.ok(page.loadErrors.value.length > 0);
  handler = (_request, response) => json(response, 200, []);
  await page.loadUsers();
  assert.equal(page.hasLoaded.value, true);
  assert.deepEqual(page.users.value, []);
  assert.deepEqual(page.loadErrors.value, []);
});
test('latest reload wins when list responses arrive out of order', async () => {
  let first: (() => void) | undefined;
  let count = 0;
  handler = (_request, response) => {
    count += 1;
    if (count === 1) first = () => json(response, 200, [record(userId)]);
    else json(response, 200, [record(adminId, 'admin')]);
  };
  const old = page.loadUsers();
  while (!first) await new Promise<void>((resolve) => setImmediate(resolve));
  await page.loadUsers();
  first();
  await old;
  assert.equal(page.users.value[0]?.id, adminId);
});
test('late list responses cannot repopulate the page after logout', async () => {
  let release: (() => void) | undefined;
  handler = (_request, response) => {
    release = () => json(response, 200, records);
  };
  const pending = page.loadUsers();
  while (!release) await new Promise<void>((resolve) => setImmediate(resolve));
  auth.AuthService.logout();
  release();
  await pending;
  await nextTick();
  assert.deepEqual(page.users.value, []);
});
test('create, update and delete update displayed data without a full reload', async () => {
  await page.loadUsers();
  page.openCreateForm();
  await page.createUser({
    name: 'Created',
    email: 'created@example.test',
    password: 'Created123',
    role: 'user',
  });
  assert.equal(page.isFormOpen.value, false);
  assert.equal(page.users.value.length, 3);
  await page.openEditForm(createdId);
  await page.updateUser({ name: 'Changed' });
  assert.equal(page.users.value.find((user) => user.id === createdId)?.name, 'Changed');
  const result = await page.deleteUser(createdId);
  assert.ok(result.success);
  assert.equal(page.users.value.length, 2);
  await page.loadUsers();
  assert.deepEqual(page.users.value, records);
});
test('duplicate submit is suppressed while the first create is pending', async () => {
  let release: (() => void) | undefined;
  handler = (_request, response) => {
    release = () => json(response, 201, record(createdId));
  };
  page.openCreateForm();
  const payload = {
    name: 'New',
    email: 'new@example.test',
    password: 'New12345',
    role: 'user' as const,
  };
  const pending = page.createUser(payload);
  await page.createUser(payload);
  while (!release) await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  page.closeForm();
  assert.equal(page.isFormOpen.value, true);
  release();
  await pending;
  assert.equal(page.isSaving.value, false);
});
test('stale GET 404 removes the vanished row and does not open an edit form', async () => {
  await page.loadUsers();
  records = records.filter((user) => user.id !== userId);
  await page.openEditForm(userId);
  assert.equal(page.isFormOpen.value, false);
  assert.equal(
    page.users.value.some((user) => user.id === userId),
    false,
  );
  assert.ok(page.feedbackErrors.value.length > 0);
});
test('stale PATCH 404 keeps the draft open, disables resubmit and allows cancel', async () => {
  await page.loadUsers();
  await page.openEditForm(userId);
  records = records.filter((user) => user.id !== userId);
  await page.updateUser({ name: 'Draft' });
  assert.equal(page.isFormOpen.value, true);
  assert.equal(page.isEditingStale.value, true);
  const count = requests.length;
  await page.updateUser({ name: 'Draft' });
  assert.equal(requests.length, count);
  page.closeForm();
  assert.equal(page.isFormOpen.value, false);
  assert.equal(page.isEditingStale.value, false);
});
test('stale DELETE 404 removes only the vanished row and exposes feedback', async () => {
  await page.loadUsers();
  records = records.filter((user) => user.id !== userId);
  const result = await page.deleteUser(userId);
  assert.ok(!result.success);
  assert.equal(result.statusCode, 404);
  assert.equal(
    page.users.value.some((user) => user.id === userId),
    false,
  );
  assert.ok(page.feedbackErrors.value.length > 0);
});
test('legacy persisted users are neither hydrated nor saved while other domains survive', async () => {
  const values = new Map<string, string>();
  const local = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: local });
  const persistenceScope = effectScope();
  try {
    local.setItem(
      'piniaState',
      JSON.stringify({
        version: 2,
        state: {
          users: { users: [{ password: 'old-secret', name: 'Old User' }] },
          auth: { accessToken: 'old-token' },
          teams: { teams: [{ id: 'preserved-team' }] },
          players: { players: [] },
          matchStats: { matchStats: [] },
        },
      }),
    );
    const pinia = createPinia();
    setActivePinia(pinia);
    persistenceScope.run(() => persistence.configurePinia(pinia));
    assert.equal(pinia.state.value.users, undefined);
    assert.equal(pinia.state.value.auth, undefined);
    assert.deepEqual(pinia.state.value.teams, { teams: [{ id: 'preserved-team' }] });
    assert.ok(!local.getItem('piniaState')?.includes('old-secret'));
  } finally {
    persistenceScope.stop();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
for (const bad of [
  {},
  { ...record(userId), updatedAt: 'invalid' },
  { ...record(userId), role: 'root' },
]) {
  test(`rejects malformed public data ${JSON.stringify(bad)} without exposing it`, async () => {
    handler = (_request, response) => json(response, 200, [bad]);
    const result = await service.UserService.getUsers();
    assert.ok(!result.success);
    assert.ok(result.errors[0]?.includes('reload'));
  });
}

test('edit form displays backend feedback inline and never fills a stored password', async () => {
  const html = await renderToString(
    h(userForm, {
      editingUser: record(userId),
      errors: ['Email conflicts with existing data.'],
    }),
  );
  assert.ok(html.includes('Email conflicts with existing data.'));
  assert.ok(html.includes('Leave blank to keep the current password.'));
  assert.ok(html.includes('type="password"'));
  assert.ok(!html.includes('sensitive'));
});

test('pending and stale forms disable fields and submit while preserving their contents', async () => {
  const pending = await renderToString(
    h(userForm, {
      editingUser: record(userId),
      isSubmitting: true,
    }),
  );
  assert.ok(pending.includes('Saving...'));
  assert.ok(pending.includes('disabled'));
  assert.ok(pending.includes('Backend User'));
  const stale = await renderToString(
    h(userForm, {
      editingUser: record(userId),
      isStale: true,
      errors: ['User not found.'],
    }),
  );
  assert.ok(stale.includes('User not found.'));
  assert.ok(stale.includes('disabled'));
  assert.ok(stale.includes('Cancel'));
});

test('a 403 with an unchanged admin role keeps the page mounted for an explicit retry', async () => {
  handler = (request, response) =>
    request.url === '/api/auth/me'
      ? json(response, 200, record(adminId, 'admin'))
      : failure(response, 403, 'Private permission detail');
  page.openCreateForm();
  await page.loadUsers();
  assert.equal(stores.useAuthStore().isSessionLoading, false);
  assert.equal(auth.AuthService.isAdmin(), true);
  assert.equal(page.isFormOpen.value, true);
  assert.equal(page.loadErrors.value.length, 1);
  assert.equal(requests.length, 2);
});
