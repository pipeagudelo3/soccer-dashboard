import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { createPinia, setActivePinia } from 'pinia';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { nextTick } from 'vue';

let vite: ViteDevServer;
let cleanup: typeof import('../src/services/LegacyStorageService.js');
let auth: typeof import('../src/stores/authstore.js');
before(async () => {
  vite = await createServer({
    configFile: false,
    mode: 'test',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  });
  cleanup = (await vite.ssrLoadModule('/src/services/LegacyStorageService.ts')) as typeof cleanup;
  auth = (await vite.ssrLoadModule('/src/stores/authstore.ts')) as typeof auth;
});
after(async () => vite?.close());

function withStorage(storage: unknown, run: () => void): void {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  try {
    run();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
}
for (const snapshot of [
  'invalid JSON',
  '{"version":2,"state":{"auth":{"accessToken":"old-token"},"users":{"users":[{"password":"old-secret"}]}}}',
  '{}',
]) {
  test('removes a legacy snapshot without reading it or touching unrelated keys', () => {
    const values = new Map([
      ['piniaState', snapshot],
      ['unrelated-preference', 'dark'],
    ]);
    const removed: string[] = [];
    withStorage(
      {
        getItem: () => assert.fail('Cleanup must not read legacy credentials.'),
        setItem: () => assert.fail('Cleanup must not persist or back up anything.'),
        removeItem: (key: string) => {
          removed.push(key);
          values.delete(key);
        },
      },
      () => {
        cleanup.LegacyStorageService.clearObsoleteState();
        cleanup.LegacyStorageService.clearObsoleteState();
      },
    );
    assert.deepEqual(removed, ['piniaState', 'piniaState']);
    assert.equal(values.has('piniaState'), false);
    assert.equal(values.get('unrelated-preference'), 'dark');
  });
}

test('blocked storage reports only a generic warning and does not prevent session use', () => {
  const messages: unknown[][] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    messages.push(args);
  };
  try {
    withStorage(
      {
        removeItem: () => {
          throw new Error('sensitive diagnostic');
        },
      },
      () => {
        assert.doesNotThrow(() => cleanup.LegacyStorageService.clearObsoleteState());
      },
    );
    assert.deepEqual(messages, [['Unable to remove obsolete browser state.']]);
    setActivePinia(createPinia());
    auth
      .useAuthStore()
      .setSession(
        { id: 'admin', name: 'Admin', email: 'admin@example.test', role: 'admin' },
        'test-token',
        Date.now() + 60000,
      );
    assert.equal(auth.useAuthStore().isAdmin, true);
    auth.useAuthStore().clearCurrentUser();
  } finally {
    console.warn = warn;
  }
});

test('session mutations never write browser storage and a new application starts as a guest', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get: () => assert.fail('Session must not access storage.'),
  });
  try {
    setActivePinia(createPinia());
    const store = auth.useAuthStore();
    store.setSession(
      { id: 'admin', name: 'Admin', email: 'admin@example.test', role: 'admin' },
      'test-token',
      Date.now() + 60000,
    );
    await nextTick();
    assert.equal(store.isAdmin, true);
    store.clearCurrentUser();
    await nextTick();
    assert.equal(store.isAuthenticated, false);
    const reloaded = createPinia();
    setActivePinia(reloaded);
    assert.equal(auth.useAuthStore().accessToken, null);
    assert.equal(auth.useAuthStore().currentUser, null);
    assert.deepEqual(Object.keys(reloaded.state.value), ['auth']);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
