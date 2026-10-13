import assert from 'node:assert/strict';
import { createServer as createHttpServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { after, afterEach, before, beforeEach, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { renderToString } from '@vue/server-renderer';
import { createPinia, setActivePinia } from 'pinia';
import { createServer } from 'vite';
import type { ViteDevServer } from 'vite';
import { effectScope, h, nextTick } from 'vue';
import type { Component, EffectScope } from 'vue';

import type { CreateMatchStatsDTO } from '../src/dtos/CreateMatchStatsDTO.js';
import type { CreateTeamDTO } from '../src/dtos/CreateTeamDTO.js';
import type { CreatePlayerDTO } from '../src/dtos/CreatePlayerDTO.js';
import type { TeamInterface } from '../src/interfaces/TeamInterface.js';
import type { PlayerInterface } from '../src/interfaces/PlayerInterface.js';
import type { MatchStatsInterface } from '../src/interfaces/MatchStatsInterface.js';

let vite: ViteDevServer;
let state: typeof import('../src/composables/useTeamPlayerData.js');
let administration: typeof import('../src/composables/useResourceAdministration.js');
let comparison: typeof import('../src/utils/teamComparison.js');
let auth: typeof import('../src/services/AuthService.js');
let stores: typeof import('../src/stores/authstore.js');
let matchesApi: typeof import('../src/services/MatchStatsService.js');
let analytics: typeof import('../src/utils/matchAnalytics.js');
let matchForm: Component;
let chart: Component;
let teams: TeamInterface[];
let players: PlayerInterface[];
let actorRole: 'admin' | 'user';
let requests: {
  url: string;
  method: string;
  authorization: string | undefined;
  body?: Record<string, unknown>;
}[];
let handler: (request: IncomingMessage, response: ServerResponse) => void;
let scopes: EffectScope[];
const originalBaseUrl = process.env.VITE_API_BASE_URL;
const firstId = '11111111-1111-4111-8111-111111111111';
const secondId = '22222222-2222-4222-8222-222222222222';
const playerId = '33333333-3333-4333-8333-333333333333';
const createdId = '44444444-4444-4444-8444-444444444444';
const adminId = '55555555-5555-4555-8555-555555555555';
const timestamp = '2026-01-01T00:00:00.000Z';
const teamPayload: CreateTeamDTO = {
  name: 'New Team',
  country: 'Colombia',
  logoURL: 'https://example.test/logo.png',
  stadium: 'New Stadium',
  foundedDate: '2020-01-01',
};
const playerPayload: CreatePlayerDTO = {
  name: 'New Player',
  position: 'Forward',
  status: 'active',
  teamId: firstId,
  goals: 3,
  assists: 2,
};
const match: MatchStatsInterface = {
  id: createdId,
  date: '2026-01-01',
  homeTeamId: firstId,
  awayTeamId: secondId,
  goalsHomeTeam: 2,
  goalsAwayTeam: 1,
  attendance: 120,
  stadium: 'Backend Stadium',
  createdAt: timestamp,
  updatedAt: timestamp,
};
const server = createHttpServer((request, response) => {
  requests.push({
    url: request.url ?? '',
    method: request.method ?? '',
    authorization: request.headers.authorization,
  });
  handler(request, response);
});
function json(response: ServerResponse, status: number, data: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(data));
}
function failure(response: ServerResponse, status: number, message: string): void {
  json(response, status, { statusCode: status, message: [message], path: '/api/teams', timestamp });
}
function profile() {
  return { id: adminId, name: 'Backend Actor', email: 'actor@example.test', role: actorRole };
}
function startSession(role: 'admin' | 'user' = 'admin', suffix = ''): void {
  actorRole = role;
  stores
    .useAuthStore()
    .setSession(
      profile(),
      `academic.${Buffer.from(JSON.stringify({ sub: adminId, exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url')}.signature${suffix}`,
      Date.now() + 900000,
    );
}
function team(id: string, name = 'Backend Team'): TeamInterface {
  return { ...teamPayload, id, name, createdAt: timestamp, updatedAt: timestamp };
}
function player(teamId: string | null = firstId): PlayerInterface {
  return {
    ...playerPayload,
    id: playerId,
    name: 'Backend Player',
    teamId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
function defaultHandler(request: IncomingMessage, response: ServerResponse): void {
  if (!request.headers.authorization) return failure(response, 401, 'Private token detail');
  if (request.url === '/api/auth/me') return json(response, 200, profile());
  if (request.method !== 'GET' && actorRole !== 'admin')
    return failure(response, 403, 'Private permissions');
  if (request.url === '/api/match-stats') return json(response, 200, [match]);
  const isTeam = request.url?.startsWith('/api/teams');
  const records = isTeam ? teams : players;
  const endpoint = isTeam ? '/api/teams' : '/api/players';
  const id = request.url?.split('/').at(-1);
  const existing = records.find((record) => record.id === id);
  if (request.method === 'GET')
    return json(
      response,
      existing || request.url === endpoint ? 200 : 404,
      existing ??
        (request.url === endpoint
          ? records
          : { statusCode: 404, message: ['Record not found.'], path: endpoint, timestamp }),
    );
  if (request.method !== 'POST' && !existing) return failure(response, 404, 'Record not found.');
  if (request.method === 'DELETE') {
    if (isTeam) {
      teams = teams.filter((record) => record.id !== id);
      players = players.map((record) =>
        record.teamId === id ? { ...record, teamId: null } : record,
      );
    } else players = players.filter((record) => record.id !== id);
    response.statusCode = 204;
    response.end();
    return;
  }
  let body = '';
  const logged = requests.at(-1);
  request.on('data', (chunk: Buffer) => {
    body += chunk.toString();
  });
  request.on('end', () => {
    const payload = JSON.parse(body) as Record<string, unknown>;
    if (logged) logged.body = payload;
    const normalized = {
      ...(existing ?? (isTeam ? team(createdId) : { ...player(), id: createdId })),
      ...payload,
      name: typeof payload.name === 'string' ? payload.name.trim() : existing?.name,
    };
    if (isTeam)
      teams = [
        ...teams.filter((record) => record.id !== normalized.id),
        normalized as TeamInterface,
      ];
    else
      players = [
        ...players.filter((record) => record.id !== normalized.id),
        normalized as PlayerInterface,
      ];
    json(response, request.method === 'POST' ? 201 : 200, normalized);
  });
}
function makeData(includeMatches = true, includePlayers = true) {
  const scope = effectScope();
  scopes.push(scope);
  const data = scope.run(() => state.useTeamPlayerData(includeMatches, includePlayers));
  assert.ok(data);
  return data;
}
async function ready(data: ReturnType<typeof makeData>): Promise<void> {
  for (let count = 0; data.isLoading.value && count < 500; count++) await delay(2);
  assert.equal(data.isLoading.value, false);
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
    plugins: [vue()],
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    resolve: { alias: { '@': `${root}/src` } },
  });
  state = (await vite.ssrLoadModule('/src/composables/useTeamPlayerData.ts')) as typeof state;
  administration = (await vite.ssrLoadModule(
    '/src/composables/useResourceAdministration.ts',
  )) as typeof administration;
  comparison = (await vite.ssrLoadModule('/src/utils/teamComparison.ts')) as typeof comparison;
  auth = (await vite.ssrLoadModule('/src/services/AuthService.ts')) as typeof auth;
  stores = (await vite.ssrLoadModule('/src/stores/authstore.ts')) as typeof stores;
  matchesApi = (await vite.ssrLoadModule(
    '/src/services/MatchStatsService.ts',
  )) as typeof matchesApi;
  analytics = (await vite.ssrLoadModule('/src/utils/matchAnalytics.ts')) as typeof analytics;
  matchForm = (await vite.ssrLoadModule('/src/components/MatchStatsFormPanel.vue'))
    .default as Component;
  chart = (await vite.ssrLoadModule('/src/components/ChartCard.vue')).default as Component;
});
beforeEach(() => {
  setActivePinia(createPinia());
  teams = [team(firstId, 'First Backend Team'), team(secondId, 'Second Backend Team')];
  players = [player()];
  requests = [];
  scopes = [];
  handler = defaultHandler;
  startSession();
});
afterEach(async () => {
  scopes.forEach((scope) => scope.stop());
  auth.AuthService.logout();
  await nextTick();
});
after(async () => {
  await vite?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (originalBaseUrl === undefined) delete process.env.VITE_API_BASE_URL;
  else process.env.VITE_API_BASE_URL = originalBaseUrl;
});

const matchPayload: CreateMatchStatsDTO = {
  date: match.date,
  homeTeamId: firstId,
  awayTeamId: secondId,
  goalsHomeTeam: 2,
  goalsAwayTeam: 1,
  stadium: 'Backend Stadium',
  attendance: 120,
};
function makeEditor(data: ReturnType<typeof makeData>) {
  const scope = effectScope();
  scopes.push(scope);
  const result = scope.run(() =>
    administration.useResourceAdministration<
      MatchStatsInterface,
      CreateMatchStatsDTO,
      CreateMatchStatsDTO
    >(
      data.matchStats,
      data.isLoading,
      data.loadData,
      {
        get: matchesApi.MatchStatsService.getMatchStatsById,
        create: matchesApi.MatchStatsService.createMatchStats,
        update: matchesApi.MatchStatsService.updateMatchStats,
        remove: matchesApi.MatchStatsService.deleteMatchStats,
      },
      'Match statistics',
      (record) => `${record.date} Home vs Away`,
    ),
  );
  assert.ok(result);
  return result;
}
test('match reads preserve ten normalized properties and discard embedded teams', async () => {
  handler = (_request, response) =>
    json(response, 200, [{ ...match, homeTeam: { password: 'private' } }]);
  const result = await matchesApi.MatchStatsService.getMatchStats();
  assert.ok(result.success);
  assert.deepEqual(result.data[0], match);
  assert.equal(Object.keys(result.data[0]!).length, 10);
});
test('match CRUD sends whitelisted IDs and fields, accepts normalized responses and DELETE 204', async () => {
  handler = (request, response) => {
    if (request.method === 'DELETE') {
      response.statusCode = 204;
      response.end();
      return;
    }
    let body = '';
    const entry = requests.at(-1);
    request.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    request.on('end', () => {
      if (entry) entry.body = JSON.parse(body) as Record<string, unknown>;
      json(response, request.method === 'POST' ? 201 : 200, {
        ...match,
        stadium: 'Normalized Stadium',
      });
    });
  };
  const created = await matchesApi.MatchStatsService.createMatchStats({
    ...matchPayload,
    stadium: '  Normalized Stadium  ',
    homeTeam: { id: firstId },
    id: 'injected',
  } as CreateMatchStatsDTO);
  assert.ok(created.success);
  assert.equal(created.data.stadium, 'Normalized Stadium');
  assert.equal(Object.keys(requests.at(-1)?.body ?? {}).length, 7);
  assert.ok(
    (await matchesApi.MatchStatsService.updateMatchStats(createdId, { goalsHomeTeam: 0 })).success,
  );
  assert.deepEqual(requests.at(-1)?.body, { goalsHomeTeam: 0 });
  assert.deepEqual(await matchesApi.MatchStatsService.deleteMatchStats(createdId), {
    success: true,
    data: undefined,
  });
});
for (const bad of [
  { date: '2026-02-30' },
  { attendance: -1 },
  { goalsHomeTeam: 0.5 },
  { awayTeamId: firstId },
  { homeTeamId: 'embedded' },
]) {
  test(`malformed match response is rejected: ${JSON.stringify(bad)}`, async () => {
    handler = (_request, response) => json(response, 200, [{ ...match, ...bad }]);
    const result = await matchesApi.MatchStatsService.getMatchStats();
    assert.ok(!result.success);
  });
}
test('regular users can read matches but mutation UX checks send no request', async () => {
  startSession('user');
  assert.ok((await matchesApi.MatchStatsService.getMatchStats()).success);
  requests = [];
  const result = await matchesApi.MatchStatsService.createMatchStats(matchPayload);
  assert.ok(!result.success);
  assert.equal(result.statusCode, 403);
  assert.equal(requests.length, 0);
});
for (const status of [400, 409]) {
  test(`backend ${status} keeps the match form open and refreshes required dependencies`, async () => {
    const data = makeData(true, false);
    await ready(data);
    const editor = makeEditor(data);
    editor.openCreateForm();
    handler = (request, response) =>
      request.method === 'POST'
        ? failure(response, status, 'Match date and team combination already exists.')
        : defaultHandler(request, response);
    await editor.save(matchPayload);
    assert.equal(editor.isFormOpen.value, true);
    assert.match(editor.feedbackErrors.value.join(' '), /already exists/);
    assert.equal(data.isReady.value, true);
    assert.ok(requests.filter((entry) => entry.url === '/api/teams').length >= 2);
  });
}
test('canceling match deletion makes no HTTP request and receives a meaningful label', async () => {
  const data = makeData(true, false);
  await ready(data);
  const editor = makeEditor(data);
  requests = [];
  const result = await editor.deleteRecord(createdId, async (label) => {
    assert.equal(label, '2026-01-01 Home vs Away');
    return false;
  });
  assert.deepEqual(result, { success: true, data: false });
  assert.equal(requests.length, 0);
});
test('an externally deleted match keeps its draft stale and blocks another submission', async () => {
  const data = makeData(true, false);
  await ready(data);
  const editor = makeEditor(data);
  handler = (request, response) =>
    request.url === `/api/match-stats/${createdId}`
      ? json(response, 200, match)
      : defaultHandler(request, response);
  await editor.openEditForm(createdId);
  handler = (request, response) =>
    request.method === 'PATCH'
      ? failure(response, 404, 'Missing match.')
      : defaultHandler(request, response);
  await editor.save(matchPayload);
  assert.equal(editor.isFormOpen.value, true);
  assert.equal(editor.isStale.value, true);
  assert.equal(editor.editingRecord.value?.id, createdId);
  requests = [];
  await editor.save(matchPayload);
  assert.equal(requests.length, 0);
  editor.closeForm();
  assert.equal(editor.isFormOpen.value, false);
});
for (const dependency of ['teams', 'players', 'match-stats']) {
  test(`failed ${dependency} hides analytical data until a complete retry`, async () => {
    handler = (request, response) =>
      request.url === `/api/${dependency}`
        ? failure(response, 500, 'Private SQL detail')
        : defaultHandler(request, response);
    const data = makeData();
    await ready(data);
    assert.equal(data.isReady.value, false);
    assert.equal(data.matchStats.value.length, 0);
    assert.ok(data.loadErrors.value.length > 0);
    assert.ok(!data.loadErrors.value.join(' ').includes('Private SQL'));
    handler = defaultHandler;
    await data.loadData();
    assert.equal(data.isReady.value, true);
    assert.equal(data.matchStats.value.length, 1);
  });
}
test('match browsing does not request unrelated players', async () => {
  handler = (request, response) =>
    request.url === '/api/players'
      ? failure(response, 500, 'Unavailable')
      : defaultHandler(request, response);
  const data = makeData(true, false);
  await ready(data);
  assert.equal(data.isReady.value, true);
  assert.deepEqual(data.players.value, []);
  assert.ok(!requests.some((entry) => entry.url === '/api/players'));
});
test('missing related teams reject partial snapshots instead of inventing labels', async () => {
  teams = [team(firstId)];
  const data = makeData(true, false);
  await ready(data);
  assert.equal(data.isReady.value, false);
  assert.match(data.loadErrors.value.join(' '), /Related teams changed/);
  teams.push(team(secondId));
  await data.loadData();
  assert.equal(data.isReady.value, true);
});
test('failed reload hides a previously complete analytical snapshot', async () => {
  const data = makeData();
  await ready(data);
  handler = (_request, response) => failure(response, 503, 'Private');
  await data.loadData();
  assert.equal(data.hasLoaded.value, true);
  assert.equal(data.isReady.value, false);
});
test('zero records produce a valid empty backend snapshot', async () => {
  handler = (_request, response) => json(response, 200, []);
  const data = makeData();
  await ready(data);
  assert.equal(data.isReady.value, true);
  assert.deepEqual(analytics.calculateResultDistribution(data.matchStats.value), []);
});
test('standings and comparison correctly combine home wins, away wins, draws and attendance', () => {
  const records = [
    match,
    {
      ...match,
      id: playerId,
      date: '2026-01-02',
      homeTeamId: secondId,
      awayTeamId: firstId,
      goalsHomeTeam: 0,
      goalsAwayTeam: 3,
      attendance: 0,
    },
    { ...match, date: '2026-01-03', goalsHomeTeam: 0, goalsAwayTeam: 0, attendance: 30 },
  ];
  const before = JSON.stringify(records);
  assert.deepEqual(analytics.calculateTeamMatchRows(teams, records), [
    {
      id: firstId,
      team: 'First Backend Team',
      played: 3,
      wins: 2,
      draws: 1,
      losses: 0,
      goalsFor: 5,
      goalsAgainst: 1,
      attendance: 150,
    },
    {
      id: secondId,
      team: 'Second Backend Team',
      played: 3,
      wins: 0,
      draws: 1,
      losses: 2,
      goalsFor: 1,
      goalsAgainst: 5,
      attendance: 150,
    },
  ]);
  const indicators = comparison.calculateTeamComparisonIndicators(
    teams[0]!,
    [player(firstId), { ...player(null), goals: 99 }],
    records,
  );
  assert.equal(indicators.averageAttendance, 50);
  assert.equal(indicators.goalDifference, 4);
  assert.equal(indicators.playerGoals, 3);
  assert.equal(indicators.playerAssists, 2);
  assert.deepEqual(analytics.calculateResultDistribution(records), [1, 1, 1]);
  assert.equal(JSON.stringify(records), before);
});
test('filters combine either team, stadium and inclusive dates without changing records', () => {
  const records = [
    match,
    { ...match, date: '2026-01-02', stadium: 'Other' },
    { ...match, date: '2026-01-03' },
  ];
  assert.deepEqual(
    analytics.filterMatches(records, {
      teamId: secondId,
      stadium: 'Backend Stadium',
      startDate: '2026-01-01',
      endDate: '2026-01-03',
    }),
    [records[0], records[2]],
  );
  assert.equal(analytics.filterMatches(records, { teamId: 'all', stadium: 'all' }).length, 3);
  assert.deepEqual(analytics.filterMatches(records, { startDate: '2027-01-01' }), []);
  assert.equal(records.length, 3);
});
test('zero goals remain a real draw and an empty result has no phantom chart entries', () => {
  assert.deepEqual(
    analytics.calculateResultDistribution([{ ...match, goalsHomeTeam: 0, goalsAwayTeam: 0 }]),
    [0, 1, 0],
  );
  assert.deepEqual(analytics.calculateResultDistribution([]), []);
  assert.deepEqual(analytics.calculateMatchGoals(teams, []).goals, []);
  assert.deepEqual(
    analytics.calculateMatchGoals(teams, [{ ...match, goalsHomeTeam: 0, goalsAwayTeam: 0 }]).goals,
    [0, 0],
  );
});
test('duplicate team names get country captions in match goal labels', () => {
  assert.deepEqual(
    analytics.calculateMatchGoals(
      [
        { ...team(firstId, 'United'), country: 'Colombia' },
        { ...team(secondId, 'United'), country: 'Peru' },
      ],
      [match],
    ).labels,
    ['United (Colombia)', 'United (Peru)'],
  );
});
test('roster aggregation keeps zero values and excludes free agents', () => {
  assert.deepEqual(
    analytics.calculateRosterGoals(teams, [
      { ...player(firstId), goals: 0 },
      { ...player(null), goals: 99 },
    ]),
    [{ team: 'First Backend Team', goals: 0 }],
  );
  assert.deepEqual(analytics.calculateRosterGoals(teams, []), []);
});
test('rendered match form retains selected values and inline server error feedback', async () => {
  const html = await renderToString(
    h(matchForm, { editingMatchStats: match, teams, errors: ['Exact match duplicate.'] }),
  );
  assert.match(html, /Exact match duplicate/);
  assert.match(html, /value="Backend Stadium"/);
  assert.match(html, /value="2026-01-01"/);
  assert.ok(html.includes(firstId) && html.includes(secondId));
});
test('stale form shows missing team feedback and disables saving', async () => {
  const html = await renderToString(
    h(matchForm, { editingMatchStats: match, teams: [teams[0]!], isStale: true }),
  );
  assert.match(html, /unavailable/i);
  assert.match(html, /disabled/);
  assert.match(html, /no longer exists/i);
});
for (const [values, hasCanvas] of [
  [[], false],
  [[0, 0], true],
] as const) {
  test(`chart handles ${hasCanvas ? 'real zero values' : 'empty data'}`, async () => {
    const html = await renderToString(
      h(chart, {
        title: 'Goals',
        type: 'bar',
        data: { labels: ['Home', 'Away'], datasets: [{ label: 'Goals', data: [...values] }] },
      }),
    );
    assert.equal(html.includes('<canvas'), hasCanvas);
    assert.equal(html.includes('No data is available'), !hasCanvas);
  });
}
