import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { effectScope } from 'vue';
import type { EffectScope } from 'vue';

let vite: ViteDevServer;
let scope: EffectScope;
let state: typeof import('../src/composables/useUserAdministration.js');
let stores: typeof import('../src/stores/authstore.js');
let page: ReturnType<typeof state.useUserAdministration>;
let deletions = 0;
const originalBaseUrl = process.env.VITE_API_BASE_URL;
const userId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';
const server = createHttpServer((request, response) => {
  if (request.method === 'DELETE') deletions += 1;
  response.statusCode = 204;
  response.end();
});
function startSession(suffix = ''): void {
  stores
    .useAuthStore()
    .setSession(
      { id: adminId, name: 'Admin', email: 'admin@example.test', role: 'admin' },
      `academic.${Buffer.from(JSON.stringify({ sub: adminId, exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')}.signature${suffix}`,
      Date.now() + 900000,
    );
}
before(async () => {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  process.env.VITE_API_BASE_URL = `http://127.0.0.1:${address.port}/api`;
  const root = fileURLToPath(new URL('..', import.meta.url));
  vite = await createServer({
    root,
    configFile: false,
    mode: 'test',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    resolve: { alias: { '@': `${root}/src` } },
  });
  state = (await vite.ssrLoadModule('/src/composables/useUserAdministration.ts')) as typeof state;
  stores = (await vite.ssrLoadModule('/src/stores/authstore.ts')) as typeof stores;
});
beforeEach(() => {
  deletions = 0;
  setActivePinia(createPinia());
  startSession();
  scope = effectScope();
  const created = scope.run(() => state.useUserAdministration());
  assert.ok(created);
  page = created;
});
afterEach(() => {
  scope.stop();
  stores.useAuthStore().clearCurrentUser();
});
after(async () => {
  await vite?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (originalBaseUrl === undefined) delete process.env.VITE_API_BASE_URL;
  else process.env.VITE_API_BASE_URL = originalBaseUrl;
});

test('an active Users page can still perform a confirmed administrator deletion', async () => {
  const result = await page.deleteUser(userId);
  assert.ok(result.success);
  assert.equal(deletions, 1);
});
test('a disposed Users page cannot send a delete after its pending dialog resolves', async () => {
  scope.stop();
  const result = await page.deleteUser(userId);
  assert.ok(!result.success);
  assert.equal(deletions, 0);
});
test('a disposed Users page cannot delete with a newly active session', async () => {
  scope.stop();
  stores.useAuthStore().clearCurrentUser();
  startSession('new');
  const result = await page.deleteUser(userId);
  assert.ok(!result.success);
  assert.equal(deletions, 0);
});
