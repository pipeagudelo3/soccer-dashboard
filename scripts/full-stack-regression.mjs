import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer as createHttpServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// No project dependency is added: Vite loads exactly the same services and aliases as the SPA.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const frontendRequire = createRequire(join(root, 'frontend/package.json'));
const backendRequire = createRequire(join(root, 'backend/package.json'));
const { createServer } = await import(pathToFileURL(frontendRequire.resolve('vite')));
const { createPinia, setActivePinia } = await import(
  pathToFileURL(frontendRequire.resolve('pinia'))
);
const { effectScope } = await import(pathToFileURL(frontendRequire.resolve('vue')));
const { createMemoryHistory, createRouter } = await import(
  pathToFileURL(frontendRequire.resolve('vue-router'))
);
const { NestFactory } = await import(pathToFileURL(backendRequire.resolve('@nestjs/core')));
const { JwtService } = await import(pathToFileURL(backendRequire.resolve('@nestjs/jwt')));
const outputIndex = process.argv.indexOf('--output');
const outputDirectory =
  outputIndex < 0 ? null : resolve(process.argv[outputIndex + 1] ?? 'regression-evidence');
const temporary = await mkdtemp(join(tmpdir(), 'soccer-regression-'));
const environmentBefore = { ...process.env };
const storageBefore = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const outcomes = [];
const startedAt = new Date().toISOString();
const tokens = [];
const scopes = [];
let activeCase = 'SETUP';
let backend;
let backendPort;
let backendLogs = '';
let vite;
let seedContext;
let migrationSource;
let auth;
let mode = null;
const secret = randomBytes(32).toString('hex');
const fakeId = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const sleep = (milliseconds) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

async function until(predicate, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (!(await predicate())) {
    assert.ok(Date.now() < deadline, 'Timed out waiting for the regression condition.');
    await sleep(20);
  }
}
async function check(id, title, run) {
  activeCase = id;
  await run();
  outcomes.push({ id, title, status: 'PASS' });
  console.log(`PASS ${id}: ${title}`);
}
async function freePort() {
  const probe = createHttpServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const port = probe.address().port;
  await new Promise((resolveClose) => probe.close(resolveClose));
  return port;
}
async function stopBackend() {
  if (!backend || backend.exitCode !== null || backend.signalCode !== null) return;
  const child = backend;
  const done = once(child, 'exit');
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
  try {
    await done;
  } finally {
    clearTimeout(timer);
  }
}
async function startBackend() {
  backend = spawn(process.execPath, [join(root, 'backend/dist/main.js')], {
    cwd: temporary,
    env: { ...process.env, PORT: String(backendPort) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [backend.stdout, backend.stderr]) {
    stream.on('data', (chunk) => {
      backendLogs = (backendLogs + chunk.toString()).slice(-2_000_000);
    });
  }
  backend.on('error', () => {
    backendLogs += '\nBACKEND_PROCESS_ERROR';
  });
  await until(async () => {
    assert.equal(backend.exitCode, null, 'Backend stopped before becoming ready.');
    try {
      return (await fetch(`http://127.0.0.1:${backendPort}/api/health`)).ok;
    } catch {
      return false;
    }
  }, 20000);
}
async function direct(path, { method = 'GET', token, data, headers = {} } = {}) {
  const response = await fetch(`http://127.0.0.1:${backendPort}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : undefined,
    headers: response.headers,
  };
}
const succeeded = async (operation) => {
  const value = await operation;
  assert.equal(value.success, true, 'Expected a successful service response.');
  return value.data;
};
const rejected = async (operation, status) => {
  const value = await operation;
  assert.equal(value.success, false, 'Expected a rejected service response.');
  assert.equal(value.statusCode, status);
  assert.ok(value.errors.length > 0);
  return value;
};
const proxy = createHttpServer(async (request, response) => {
  try {
    const fault = mode;
    if (fault?.path === request.url) {
      if (fault.delay) await sleep(fault.delay);
      if (fault.status) {
        response.writeHead(fault.status, { 'Content-Type': 'application/json' });
        response.end(
          JSON.stringify({
            statusCode: fault.status,
            message: ['Diagnostic details must stay private.'],
            path: request.url,
            timestamp: new Date().toISOString(),
          }),
        );
        return;
      }
      if (fault.empty) {
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end('[]');
        return;
      }
    }
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const upstream = await fetch(`http://127.0.0.1:${backendPort}${request.url}`, {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
        ...(request.headers.authorization ? { Authorization: request.headers.authorization } : {}),
      },
      ...(['GET', 'HEAD'].includes(request.method) ? {} : { body: Buffer.concat(chunks) }),
    });
    response.writeHead(upstream.status, { 'Content-Type': 'application/json' });
    response.end(await upstream.text());
  } catch {
    // A refused connection must reach Axios as a network error, not as invented domain data.
    response.destroy();
  }
});

try {
  await access(join(root, 'backend/dist/main.js'));
  Object.assign(process.env, {
    NODE_ENV: 'test',
    PORT: '3000',
    JWT_SECRET: secret,
    JWT_EXPIRES_IN: '15m',
    CORS_ORIGIN: 'http://127.0.0.1:5173',
    SQLITE_PATH: join(temporary, 'database.sqlite'),
    SQLITE_SYNCHRONIZE: 'false',
  });
  ({ default: migrationSource } = await import(
    pathToFileURL(join(root, 'backend/dist/database/data-source.js'))
  ));
  await migrationSource.initialize();
  await migrationSource.runMigrations();
  await migrationSource.destroy();
  migrationSource = undefined;
  const { SeedModule } = await import(
    pathToFileURL(join(root, 'backend/dist/seed/seed.module.js'))
  );
  const { SeedService } = await import(
    pathToFileURL(join(root, 'backend/dist/seed/seed.service.js'))
  );
  seedContext = await NestFactory.createApplicationContext(SeedModule, {
    logger: false,
  });
  await seedContext.get(SeedService).run();
  const secondSeed = await seedContext.get(SeedService).run();
  await seedContext.close();
  seedContext = undefined;
  await check(
    'DB-01',
    'Isolated SQLite migrations and idempotent explicit backend seed',
    async () => {
      assert.equal(
        secondSeed.teams.created +
          secondSeed.users.created +
          secondSeed.players.created +
          secondSeed.matchStats.created,
        0,
      );
    },
  );
  backendPort = await freePort();
  await startBackend();
  proxy.listen(0, '127.0.0.1');
  await once(proxy, 'listening');
  process.env.VITE_API_BASE_URL = `http://127.0.0.1:${proxy.address().port}/api`;
  vite = await createServer({
    root: join(root, 'frontend'),
    configFile: false,
    mode: 'test',
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    resolve: { alias: { '@': join(root, 'frontend/src') } },
  });
  const loadService = async (name) => (await vite.ssrLoadModule(`/src/services/${name}.ts`))[name];
  auth = await loadService('AuthService');
  const api = await loadService('ApiService');
  const cleanup = await loadService('LegacyStorageService');
  const users = await loadService('UserService');
  const teams = await loadService('TeamService');
  const players = await loadService('PlayerService');
  const matches = await loadService('MatchStatsService');
  const { useAuthStore } = await vite.ssrLoadModule('/src/stores/authstore.ts');
  const { authenticationGuard } = await vite.ssrLoadModule('/src/router/authenticationGuard.ts');
  const analytics = await vite.ssrLoadModule('/src/utils/matchAnalytics.ts');
  const comparison = await vite.ssrLoadModule('/src/utils/teamComparison.ts');
  const { useTeamPlayerData } = await vite.ssrLoadModule('/src/composables/useTeamPlayerData.ts');
  const { useUserAdministration } = await vite.ssrLoadModule(
    '/src/composables/useUserAdministration.ts',
  );
  const storage = new Map([
    [
      'piniaState',
      '{"users":{"users":[{"password":"obsolete"}]},"auth":{"accessToken":"obsolete"}}',
    ],
    ['unrelated-preference', 'dark'],
  ]);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      removeItem: (key) => storage.delete(key),
      getItem: () => assert.fail('Domain data must not read LocalStorage.'),
      setItem: () => assert.fail('Domain data must not write LocalStorage.'),
    },
  });
  setActivePinia(createPinia());
  const login = async (role = 'admin') => {
    auth.logout();
    await succeeded(
      auth.login({
        email: `${role}@soccer.example`,
        password: role === 'admin' ? 'AdminDemo123' : 'UserDemo123',
      }),
    );
    tokens.push(useAuthStore().accessToken);
    return useAuthStore().accessToken;
  };
  const pageData = () => {
    const scope = effectScope();
    scopes.push(scope);
    return scope.run(() => useTeamPlayerData(true));
  };
  const waitData = async (data) =>
    until(
      () => !data.isLoading.value && (data.hasLoaded.value || data.loadErrors.value.length > 0),
    );
  const routes = [
    ['/', 'home', false, false],
    ['/login', 'login', false, false],
    ['/dashboard', 'dashboard', true, false],
    ['/teams', 'teams', true, false],
    ['/players', 'players', true, false],
    ['/matches', 'matches', true, false],
    ['/statistics', 'statistics', true, false],
    ['/team-comparison', 'team-comparison', true, false],
    ['/admin/users', 'admin.users', true, true],
    ['/admin/match-stats', 'admin.match-stats', true, true],
  ];
  const makeRouter = () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: routes.map(([path, name, requiresAuth, requiresAdmin]) => ({
        path,
        name,
        component: { render: () => null },
        meta: { requiresAuth, requiresAdmin },
      })),
    });
    router.beforeEach(authenticationGuard);
    return router;
  };
  await check(
    'ST-01',
    'Legacy cleanup removes only piniaState without reading or recreating fixtures',
    async () => {
      cleanup.clearObsoleteState();
      cleanup.clearObsoleteState();
      assert.equal(storage.has('piniaState'), false);
      assert.equal(storage.get('unrelated-preference'), 'dark');
    },
  );
  await check(
    'AUTH-01',
    'Administrator login normalizes email and keeps a safe in-memory profile',
    async () => {
      await succeeded(
        auth.login({
          email: '  ADMIN@SOCCER.EXAMPLE ',
          password: 'AdminDemo123',
        }),
      );
      assert.equal(auth.isAdmin(), true);
      assert.equal(Object.keys(auth.getCurrentUser()).length, 4);
      tokens.push(useAuthStore().accessToken);
    },
  );
  const adminId = auth.getCurrentUser().id;
  let adminToken = useAuthStore().accessToken;
  await check(
    'AUTH-02',
    'Unknown email and wrong password return identical generic 401 feedback',
    async () => {
      const wrong = await rejected(
        auth.login({ email: 'admin@soccer.example', password: 'WrongDemo123' }),
        401,
      );
      const missing = await rejected(
        auth.login({ email: 'missing@example.test', password: 'WrongDemo123' }),
        401,
      );
      assert.deepEqual(wrong.errors, missing.errors);
      assert.equal(auth.isAdmin(), true);
    },
  );
  await check(
    'AUTH-03',
    'Missing, invalid and expired JWTs are rejected on every protected domain',
    async () => {
      const jwt = new JwtService();
      const expired = jwt.sign({ sub: adminId }, { secret, algorithm: 'HS256', expiresIn: -60 });
      const invalid = jwt.sign(
        { sub: adminId },
        {
          secret: randomBytes(32).toString('hex'),
          algorithm: 'HS256',
          expiresIn: 900,
        },
      );
      tokens.push(expired, invalid);
      for (const token of [undefined, 'invalid-token', invalid, expired]) {
        for (const path of ['/auth/me', '/users', '/teams', '/players', '/match-stats'])
          assert.equal((await direct(path, { token })).status, 401);
      }
    },
  );
  await check(
    'AUTH-04',
    'Real backend role checks reject regular-user direct mutations with 403',
    async () => {
      const regular = await login('user');
      assert.equal(auth.isAdmin(), false);
      for (const path of ['/teams', '/players', '/match-stats'])
        assert.equal((await direct(path, { token: regular })).status, 200);
      assert.equal((await direct('/users', { token: regular })).status, 403);
      for (const domain of ['/users', '/teams', '/players', '/match-stats']) {
        for (const method of ['POST', 'PATCH', 'DELETE']) {
          const path = method === 'POST' ? domain : `${domain}/${fakeId}`;
          assert.equal(
            (
              await direct(path, {
                token: regular,
                method,
                ...(method === 'DELETE' ? {} : { data: {} }),
              })
            ).status,
            403,
          );
        }
      }
      adminToken = await login();
    },
  );
  await check(
    'AUTH-05',
    'Actual guard with real auth/me permits admin routes and prevents guest/user loops',
    async () => {
      let router = makeRouter();
      for (const [path, , protectedRoute] of routes)
        if (protectedRoute) {
          await router.push(path);
          assert.equal(router.currentRoute.value.path, path);
        }
      await login('user');
      router = makeRouter();
      for (const [path, , protectedRoute, adminRoute] of routes)
        if (protectedRoute) {
          await router.push(path);
          assert.equal(router.currentRoute.value.path, adminRoute ? '/dashboard' : path);
        }
      auth.logout();
      router = makeRouter();
      await router.push('/admin/users');
      assert.equal(router.currentRoute.value.path, '/login');
      assert.equal(router.currentRoute.value.query.redirect, '/admin/users');
      adminToken = await login();
    },
  );
  let user;
  await check(
    'US-01',
    'Users create/read/update/delete through Axios and Nest return safe database records',
    async () => {
      user = await succeeded(
        users.createUser({
          name: 'Regression User',
          email: 'regression@example.test',
          password: 'Regression123',
          role: 'user',
        }),
      );
      assert.equal(Object.keys(user).length, 6);
      assert.equal('passwordHash' in user, false);
      await succeeded(users.updateUser(user.id, { name: 'Updated Regression User' }));
      assert.equal((await succeeded(users.getUserById(user.id))).name, 'Updated Regression User');
      assert.ok((await succeeded(users.getUsers())).some((entry) => entry.id === user.id));
    },
  );
  await check(
    'US-02',
    'Duplicate email, invalid role/password and stale user IDs preserve consistent feedback',
    async () => {
      await rejected(
        users.createUser({
          name: 'Duplicate',
          email: 'REGRESSION@example.test',
          password: 'Regression123',
          role: 'user',
        }),
        409,
      );
      for (const data of [
        { name: '', email: 'bad', password: 'short', role: 'user' },
        {
          name: 'Bad',
          email: 'bad@example.test',
          password: 'Regression123',
          role: 'root',
        },
      ])
        assert.equal(
          (await direct('/users', { method: 'POST', token: adminToken, data })).status,
          400,
        );
      await rejected(users.getUserById(fakeId), 404);
      await rejected(users.updateUser(fakeId, { name: 'Missing' }), 404);
      await rejected(users.deleteUser(fakeId), 404);
    },
  );
  await check('US-03', 'Last administrator cannot be removed or demoted', async () => {
    await rejected(users.deleteUser(adminId), 409);
    await rejected(users.updateUser(adminId, { role: 'user' }), 409);
  });
  await check(
    'US-04',
    'Role changes and deleted accounts invalidate old authority on protected requests',
    async () => {
      const alternate = await succeeded(
        users.createUser({
          name: 'Alternate Admin',
          email: 'alternate@example.test',
          password: 'Alternate123',
          role: 'admin',
        }),
      );
      await succeeded(
        auth.login({
          email: 'alternate@example.test',
          password: 'Alternate123',
        }),
      );
      const oldToken = useAuthStore().accessToken;
      tokens.push(oldToken);
      assert.equal(
        (
          await direct(`/users/${alternate.id}`, {
            method: 'PATCH',
            token: adminToken,
            data: { role: 'user' },
          })
        ).status,
        200,
      );
      assert.equal((await direct('/users', { token: oldToken })).status, 403);
      await succeeded(auth.reconcileSession({ background: true }));
      assert.equal(auth.getCurrentUser().role, 'user');
      assert.equal(
        (
          await direct(`/users/${alternate.id}`, {
            method: 'DELETE',
            token: adminToken,
          })
        ).status,
        204,
      );
      await rejected(api.request({ url: '/auth/me' }), 401);
      assert.equal(useAuthStore().accessToken, null);
      adminToken = await login();
      await succeeded(users.deleteUser(user.id));
    },
  );
  const teamPayload = (name) => ({
    name,
    country: 'Colombia',
    logoURL: 'https://example.com/regression.png',
    stadium: 'Regression Stadium',
    foundedDate: '2000-01-01',
  });
  let firstTeam;
  let secondTeam;
  let player;
  let firstMatch;
  let secondMatch;
  await check(
    'TM-01',
    'Teams create/read/update and duplicate/invalid checks use the database',
    async () => {
      firstTeam = await succeeded(teams.createTeam(teamPayload('Regression A')));
      secondTeam = await succeeded(teams.createTeam(teamPayload('Regression B')));
      assert.equal(Object.keys(firstTeam).length, 8);
      firstTeam = await succeeded(teams.updateTeam(firstTeam.id, { stadium: 'Updated Stadium' }));
      assert.equal((await succeeded(teams.getTeamById(firstTeam.id))).stadium, 'Updated Stadium');
      await rejected(teams.createTeam(teamPayload('Regression A')), 409);
      for (const change of [
        { foundedDate: '2020-02-30' },
        { foundedDate: '2999-01-01' },
        { name: '' },
      ])
        await rejected(teams.createTeam({ ...teamPayload('Invalid Team'), ...change }), 400);
      await rejected(teams.getTeamById(fakeId), 404);
      await rejected(teams.updateTeam(fakeId, { stadium: 'Missing' }), 404);
      await rejected(teams.deleteTeam(fakeId), 404);
    },
  );
  const playerPayload = {
    name: 'Regression Player',
    position: 'Forward',
    status: 'active',
    teamId: null,
    goals: 0,
    assists: 0,
  };
  await check(
    'PL-01',
    'Players create/update preserve nine fields and nullable normalized teamId',
    async () => {
      player = await succeeded(players.createPlayer(playerPayload));
      assert.equal(player.teamId, null);
      assert.equal(Object.keys(player).length, 9);
      player = await succeeded(
        players.updatePlayer(player.id, {
          teamId: firstTeam.id,
          goals: 4,
          assists: 2,
        }),
      );
      assert.equal(player.teamId, firstTeam.id);
      assert.equal((await succeeded(players.getPlayerById(player.id))).goals, 4);
    },
  );
  await check(
    'PL-02',
    'Unknown teams, invalid status/counts and stale player IDs are rejected',
    async () => {
      for (const change of [
        { teamId: fakeId },
        { status: 'invalid' },
        { goals: -1 },
        { goals: 1.5 },
        { assists: null },
      ])
        await rejected(players.createPlayer({ ...playerPayload, ...change }), 400);
      await rejected(players.getPlayerById(fakeId), 404);
      await rejected(players.updatePlayer(fakeId, { goals: 0 }), 404);
      await rejected(players.deletePlayer(fakeId), 404);
    },
  );
  const matchPayload = () => ({
    date: '2020-02-29',
    homeTeamId: firstTeam.id,
    awayTeamId: secondTeam.id,
    goalsHomeTeam: 0,
    goalsAwayTeam: 0,
    stadium: 'Regression Stadium',
    attendance: 0,
  });
  await check(
    'MA-01',
    'Matches create/read/update retain ten fields, real dates and zero values',
    async () => {
      firstMatch = await succeeded(matches.createMatchStats(matchPayload()));
      assert.equal(Object.keys(firstMatch).length, 10);
      firstMatch = await succeeded(
        matches.updateMatchStats(firstMatch.id, {
          goalsHomeTeam: 2,
          attendance: 100,
        }),
      );
      assert.equal((await succeeded(matches.getMatchStatsById(firstMatch.id))).goalsHomeTeam, 2);
      secondMatch = await succeeded(
        matches.createMatchStats({
          ...matchPayload(),
          date: '2020-03-01',
          goalsHomeTeam: 1,
          goalsAwayTeam: 1,
          attendance: 0,
        }),
      );
    },
  );
  await check(
    'MA-02',
    'Different existing teams, real non-future dates and finite nonnegative counts are required',
    async () => {
      for (const change of [
        { homeTeamId: fakeId },
        { awayTeamId: firstTeam.id },
        { date: '2020-02-30' },
        { date: '2999-01-01' },
        { goalsHomeTeam: -1 },
        { goalsAwayTeam: 0.5 },
        { attendance: null },
        { stadium: ' ' },
      ])
        await rejected(matches.createMatchStats({ ...matchPayload(), ...change }), 400);
    },
  );
  await check(
    'MA-03',
    'Exact duplicates are rejected; unchanged edited identity excludes its own record',
    async () => {
      await rejected(matches.createMatchStats(matchPayload()), 409);
      await succeeded(
        matches.updateMatchStats(firstMatch.id, {
          date: firstMatch.date,
          homeTeamId: firstTeam.id,
          awayTeamId: secondTeam.id,
        }),
      );
      await rejected(matches.updateMatchStats(secondMatch.id, { date: firstMatch.date }), 409);
      await rejected(matches.getMatchStatsById(fakeId), 404);
      await rejected(matches.updateMatchStats(fakeId, { attendance: 0 }), 404);
      await rejected(matches.deleteMatchStats(fakeId), 404);
    },
  );
  await check(
    'AN-01',
    'Coherent Vue snapshots and analytical calculations match real backend fixtures',
    async () => {
      const data = pageData();
      await waitData(data);
      assert.equal(data.isReady.value, true);
      const selectedTeams = data.teams.value.filter((entry) =>
        [firstTeam.id, secondTeam.id].includes(entry.id),
      );
      const selectedMatches = data.matchStats.value.filter((entry) =>
        [firstMatch.id, secondMatch.id].includes(entry.id),
      );
      const rows = analytics.calculateTeamMatchRows(selectedTeams, selectedMatches);
      assert.deepEqual(
        rows.map(({ played, wins, draws, losses, goalsFor, goalsAgainst, attendance }) => ({
          played,
          wins,
          draws,
          losses,
          goalsFor,
          goalsAgainst,
          attendance,
        })),
        [
          {
            played: 2,
            wins: 1,
            draws: 1,
            losses: 0,
            goalsFor: 3,
            goalsAgainst: 1,
            attendance: 100,
          },
          {
            played: 2,
            wins: 0,
            draws: 1,
            losses: 1,
            goalsFor: 1,
            goalsAgainst: 3,
            attendance: 100,
          },
        ],
      );
      assert.deepEqual(analytics.calculateResultDistribution(selectedMatches), [1, 1, 0]);
      assert.equal(
        analytics.filterMatches(selectedMatches, {
          startDate: '2020-03-01',
          teamId: firstTeam.id,
        }).length,
        1,
      );
      const indicators = comparison.calculateTeamComparisonIndicators(
        firstTeam,
        data.players.value,
        selectedMatches,
      );
      assert.equal(indicators.playerGoals, 4);
      assert.equal(indicators.playerAssists, 2);
      assert.equal(indicators.averageAttendance, 50);
      assert.deepEqual(analytics.calculateMatchGoals(selectedTeams, []), {
        labels: [],
        goals: [],
      });
    },
  );
  await check(
    'UI-01',
    'Loading hides readiness until all real dependent HTTP reads complete',
    async () => {
      mode = { path: '/api/players', delay: 150 };
      const data = pageData();
      assert.equal(data.isLoading.value, true);
      assert.equal(data.isReady.value, false);
      await waitData(data);
      assert.equal(data.isReady.value, true);
      mode = null;
    },
  );
  await check(
    'UI-02',
    'Injected dependency 500 prevents partial analysis and supports explicit retry',
    async () => {
      mode = { path: '/api/players', status: 500 };
      const data = pageData();
      await waitData(data);
      assert.equal(data.isReady.value, false);
      assert.ok(data.loadErrors.value.length > 0);
      assert.deepEqual(data.teams.value, []);
      assert.deepEqual(data.matchStats.value, []);
      assert.ok(!data.loadErrors.value.join(' ').includes('Diagnostic'));
      mode = null;
      await data.loadData();
      assert.equal(data.isReady.value, true);
    },
  );
  await check(
    'UI-03',
    'Injected empty lists expose empty state without invented fixtures or chart data',
    async () => {
      const scope = effectScope();
      scopes.push(scope);
      mode = { path: '/api/users', empty: true };
      const page = scope.run(() => useUserAdministration());
      await page.loadUsers();
      assert.equal(page.hasLoaded.value, true);
      assert.deepEqual(page.users.value, []);
      mode = null;
    },
  );
  await check(
    'UI-04',
    'Stale records disappear after real deletion and the editor remains safely blocked',
    async () => {
      const entry = await succeeded(
        users.createUser({
          name: 'Stale User',
          email: 'stale@example.test',
          password: 'StaleDemo123',
          role: 'user',
        }),
      );
      const scope = effectScope();
      scopes.push(scope);
      const page = scope.run(() => useUserAdministration());
      await page.loadUsers();
      await succeeded(users.deleteUser(entry.id));
      await page.openEditForm(entry.id);
      assert.ok(!page.users.value.some((row) => row.id === entry.id));
      assert.equal(page.isFormOpen.value, false);
      assert.ok(page.feedbackErrors.value.length > 0);
    },
  );
  await check(
    'AUTH-06',
    'An invalid active token clears session on 401 without request retry loops',
    async () => {
      useAuthStore().setAccessToken('invalid-token');
      await rejected(api.request({ url: '/auth/me' }), 401);
      assert.equal(useAuthStore().accessToken, null);
      await login();
    },
  );
  await check(
    'DB-02',
    'Stopping the real backend produces a safe network error with no local fallback',
    async () => {
      await stopBackend();
      const value = await api.request({ url: '/teams' });
      assert.equal(value.success, false);
      assert.equal(value.statusCode, undefined);
      assert.deepEqual(value.errors, [
        'Unable to connect to the server. Check your connection and try again.',
      ]);
      assert.equal(storage.has('piniaState'), false);
    },
  );
  await check(
    'DB-03',
    'A new backend process and new Pinia instance preserve SQLite records after re-login',
    async () => {
      const previousPid = backend.pid;
      await startBackend();
      assert.notEqual(backend.pid, previousPid);
      for (const scope of scopes) scope.stop();
      auth.logout();
      const reloaded = createPinia();
      setActivePinia(reloaded);
      cleanup.clearObsoleteState();
      await auth.reconcileSession();
      assert.equal(useAuthStore().accessToken, null);
      assert.deepEqual(Object.keys(reloaded.state.value), ['auth']);
      adminToken = await login();
      assert.equal((await succeeded(players.getPlayerById(player.id))).goals, 4);
      assert.equal((await succeeded(matches.getMatchStatsById(firstMatch.id))).attendance, 100);
      assert.equal((await succeeded(teams.getTeamById(firstTeam.id))).stadium, 'Updated Stadium');
      assert.equal(storage.has('piniaState'), false);
    },
  );
  await check(
    'REL-01',
    'Teams with matches return 409; after match deletion players become null atomically',
    async () => {
      await rejected(teams.deleteTeam(firstTeam.id), 409);
      assert.equal((await succeeded(players.getPlayerById(player.id))).teamId, firstTeam.id);
      await succeeded(matches.deleteMatchStats(firstMatch.id));
      await succeeded(matches.deleteMatchStats(secondMatch.id));
      await succeeded(teams.deleteTeam(firstTeam.id));
      assert.equal((await succeeded(players.getPlayerById(player.id))).teamId, null);
      await succeeded(players.deletePlayer(player.id));
      await succeeded(teams.deleteTeam(secondTeam.id));
      await rejected(players.getPlayerById(player.id), 404);
      await rejected(matches.getMatchStatsById(firstMatch.id), 404);
    },
  );
  await check(
    'HTTP-01',
    'CORS preflight accepts only the configured origin and JWT headers',
    async () => {
      const allowed = await direct('/teams', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://127.0.0.1:5173',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'authorization',
        },
      });
      assert.equal(allowed.status, 204);
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
      const denied = await direct('/teams', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://unapproved.example',
          'Access-Control-Request-Method': 'GET',
        },
      });
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
    },
  );
  await check(
    'LOG-01',
    'Backend child logs contain no secrets, tokens or unhandled runtime errors',
    async () => {
      assert.ok(!backendLogs.includes(secret));
      for (const token of tokens) assert.ok(!backendLogs.includes(token));
      assert.ok(
        !/UnhandledPromiseRejection|uncaughtException|BACKEND_PROCESS_ERROR|\bERROR\b/.test(
          backendLogs,
        ),
      );
    },
  );
  console.log(
    `Completed ${outcomes.length} full-stack checks. Browser rendering and Docker restart are separate pending checks.`,
  );
} catch (error) {
  outcomes.push({
    id: activeCase,
    title: 'Regression condition failed',
    status: 'FAIL',
    errorType: error instanceof Error ? error.name : 'UnknownError',
  });
  // Assertion messages can include payloads; never print tokens, credentials or raw responses.
  console.error(
    `FAIL ${activeCase}: regression condition failed. See the named check; diagnostic payloads were suppressed.`,
  );
  process.exitCode = 1;
} finally {
  for (const scope of scopes) scope.stop();
  auth?.logout();
  await vite?.close();
  proxy.closeAllConnections();
  if (proxy.listening) await new Promise((resolveClose) => proxy.close(resolveClose));
  await stopBackend();
  if (migrationSource?.isInitialized) await migrationSource.destroy();
  await seedContext?.close();
  if (storageBefore) Object.defineProperty(globalThis, 'localStorage', storageBefore);
  else Reflect.deleteProperty(globalThis, 'localStorage');
  for (const key of Object.keys(process.env))
    if (!(key in environmentBefore)) delete process.env[key];
  Object.assign(process.env, environmentBefore);
  await rm(temporary, { recursive: true, force: true });
  if (outputDirectory) {
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(
      join(outputDirectory, 'full-stack-results.json'),
      JSON.stringify(
        {
          node: process.version,
          startedAt,
          completedAt: new Date().toISOString(),
          outcomes,
          pending: [
            'BROWSER: actual UI rendering/console',
            'CONTAINER: Docker restart with persistent volume',
          ],
          database: 'Disposable temporary SQLite, removed after run',
        },
        null,
        2,
      ),
    );
  }
}
