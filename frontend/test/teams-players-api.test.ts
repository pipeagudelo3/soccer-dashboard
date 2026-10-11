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

import type { CreateTeamDTO } from '../src/dtos/CreateTeamDTO.js';
import type { CreatePlayerDTO } from '../src/dtos/CreatePlayerDTO.js';
import type { TeamInterface } from '../src/interfaces/TeamInterface.js';
import type { PlayerInterface } from '../src/interfaces/PlayerInterface.js';
import type { MatchStatsInterface } from '../src/interfaces/MatchStatsInterface.js';

let vite: ViteDevServer;
let teamService: typeof import('../src/services/TeamService.js');
let playerService: typeof import('../src/services/PlayerService.js');
let state: typeof import('../src/composables/useTeamPlayerData.js');
let administration: typeof import('../src/composables/useResourceAdministration.js');
let comparison: typeof import('../src/utils/teamComparison.js');
let auth: typeof import('../src/services/AuthService.js');
let stores: typeof import('../src/stores/authstore.js');
let api: typeof import('../src/services/ApiService.js');
let teamForm: Component;
let playerForm: Component;
let loadState: Component;
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
function makeData(includeMatches = false) {
  const scope = effectScope();
  scopes.push(scope);
  const data = scope.run(() => state.useTeamPlayerData(includeMatches));
  assert.ok(data);
  return data;
}
async function ready(data: ReturnType<typeof makeData>): Promise<void> {
  for (let count = 0; data.isLoading.value && count < 500; count++) await delay(2);
  assert.equal(data.isLoading.value, false);
}
function makeTeamEditor(data: ReturnType<typeof makeData>) {
  const scope = effectScope();
  scopes.push(scope);
  const editor = scope.run(() =>
    administration.useResourceAdministration<TeamInterface, CreateTeamDTO, CreateTeamDTO>(
      data.teams,
      data.isLoading,
      data.loadData,
      {
        get: teamService.TeamService.getTeamById,
        create: teamService.TeamService.createTeam,
        update: teamService.TeamService.updateTeam,
        remove: teamService.TeamService.deleteTeam,
      },
      'Team',
    ),
  );
  assert.ok(editor);
  return editor;
}
function makePlayerEditor(data: ReturnType<typeof makeData>) {
  const scope = effectScope();
  scopes.push(scope);
  const editor = scope.run(() =>
    administration.useResourceAdministration<PlayerInterface, CreatePlayerDTO, CreatePlayerDTO>(
      data.players,
      data.isLoading,
      data.loadData,
      {
        get: playerService.PlayerService.getPlayerById,
        create: playerService.PlayerService.createPlayer,
        update: playerService.PlayerService.updatePlayer,
        remove: playerService.PlayerService.deletePlayer,
      },
      'Player',
    ),
  );
  assert.ok(editor);
  return editor;
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
  teamService = (await vite.ssrLoadModule('/src/services/TeamService.ts')) as typeof teamService;
  playerService = (await vite.ssrLoadModule(
    '/src/services/PlayerService.ts',
  )) as typeof playerService;
  state = (await vite.ssrLoadModule('/src/composables/useTeamPlayerData.ts')) as typeof state;
  administration = (await vite.ssrLoadModule(
    '/src/composables/useResourceAdministration.ts',
  )) as typeof administration;
  comparison = (await vite.ssrLoadModule('/src/utils/teamComparison.ts')) as typeof comparison;
  auth = (await vite.ssrLoadModule('/src/services/AuthService.ts')) as typeof auth;
  stores = (await vite.ssrLoadModule('/src/stores/authstore.ts')) as typeof stores;
  api = (await vite.ssrLoadModule('/src/services/ApiService.ts')) as typeof api;
  teamForm = (await vite.ssrLoadModule('/src/components/TeamFormPanel.vue')).default as Component;
  playerForm = (await vite.ssrLoadModule('/src/components/PlayerFormPanel.vue'))
    .default as Component;
  loadState = (await vite.ssrLoadModule('/src/components/ApiLoadState.vue')).default as Component;
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

test('teams and players use authenticated database reads and keep their eight/nine-property contracts', async () => {
  const teamResult = await teamService.TeamService.getTeams();
  const playerResult = await playerService.PlayerService.getPlayers();
  assert.ok(teamResult.success && playerResult.success);
  assert.equal(teamResult.data[0]?.name, 'First Backend Team');
  assert.equal(playerResult.data[0]?.teamId, firstId);
  assert.equal(Object.keys(teamResult.data[0] ?? {}).length, 8);
  assert.equal(Object.keys(playerResult.data[0] ?? {}).length, 9);
  assert.ok(
    requests.every(
      (request) => request.authorization === `Bearer ${stores.useAuthStore().accessToken}`,
    ),
  );
});
for (const domain of ['team', 'player'] as const) {
  test(`${domain} administrator create/update/delete uses whitelisted DTOs and server timestamps`, async () => {
    const payload = {
      ...(domain === 'team' ? teamPayload : playerPayload),
      name: '  Server Normalized ',
      id: 'injected',
      createdAt: 'injected',
      team: { id: 'embedded' },
    };
    const created =
      domain === 'team'
        ? await teamService.TeamService.createTeam(payload as CreateTeamDTO)
        : await playerService.PlayerService.createPlayer(payload as CreatePlayerDTO);
    assert.ok(created.success);
    assert.equal(created.data.name, 'Server Normalized');
    assert.equal(created.data.id, createdId);
    assert.ok(!('id' in (requests.at(-1)?.body ?? {})));
    assert.ok(!('team' in (requests.at(-1)?.body ?? {})));
    assert.ok(!('createdAt' in (requests.at(-1)?.body ?? {})));
    const updated =
      domain === 'team'
        ? await teamService.TeamService.updateTeam(createdId, { name: 'Edited' })
        : await playerService.PlayerService.updatePlayer(createdId, {
            name: 'Edited',
            teamId: null,
          });
    assert.ok(updated.success);
    assert.equal(updated.data.name, 'Edited');
    assert.deepEqual(
      requests.at(-1)?.body,
      domain === 'team' ? { name: 'Edited' } : { name: 'Edited', teamId: null },
    );
    const deleted =
      domain === 'team'
        ? await teamService.TeamService.deleteTeam(createdId)
        : await playerService.PlayerService.deletePlayer(createdId);
    assert.deepEqual(deleted, { success: true, data: undefined });
    const missing =
      domain === 'team'
        ? await teamService.TeamService.getTeamById(createdId)
        : await playerService.PlayerService.getPlayerById(createdId);
    assert.equal(missing.success, false);
    if (!missing.success) assert.equal(missing.statusCode, 404);
  });
}
test('regular users read both resources but cannot trigger service mutations or mutate through the API', async () => {
  startSession('user');
  assert.equal((await teamService.TeamService.getTeams()).success, true);
  assert.equal((await playerService.PlayerService.getPlayers()).success, true);
  requests = [];
  const denied = await Promise.all([
    teamService.TeamService.createTeam(teamPayload),
    teamService.TeamService.updateTeam(firstId, {}),
    teamService.TeamService.deleteTeam(firstId),
    playerService.PlayerService.createPlayer(playerPayload),
    playerService.PlayerService.updatePlayer(playerId, {}),
    playerService.PlayerService.deletePlayer(playerId),
  ]);
  assert.ok(denied.every((result) => !result.success && result.statusCode === 403));
  assert.equal(requests.length, 0);
  const direct = await api.ApiService.request({
    url: '/players',
    method: 'POST',
    data: playerPayload,
  });
  assert.ok(!direct.success);
  assert.equal(direct.statusCode, 403);
});
test('player null team relationships and zero counts survive a server round trip', async () => {
  const result = await playerService.PlayerService.createPlayer({
    ...playerPayload,
    teamId: null,
    goals: 0,
    assists: 0,
  });
  assert.ok(result.success);
  assert.equal(result.data.teamId, null);
  assert.equal(result.data.goals, 0);
  const loaded = await playerService.PlayerService.getPlayerById(createdId);
  assert.ok(loaded.success);
  assert.equal(loaded.data.teamId, null);
});
for (const [status, message] of [
  [400, 'Unknown team or invalid values.'],
  [409, 'This team has recorded matches.'],
  [422, 'Name is required.'],
] as const) {
  test(`backend ${status} feedback remains inline and the draft form stays open`, async () => {
    const data = makeData();
    await ready(data);
    const editor = makePlayerEditor(data);
    editor.openCreateForm();
    handler = (request, response) =>
      request.method === 'POST'
        ? failure(response, status, message)
        : defaultHandler(request, response);
    await editor.save(playerPayload);
    assert.equal(editor.isFormOpen.value, true);
    assert.deepEqual(editor.feedbackErrors.value, [message]);
    assert.equal(data.players.value.length, 1);
  });
}
test('a missing edited record is removed from the list without discarding its open draft', async () => {
  const data = makeData();
  await ready(data);
  const editor = makePlayerEditor(data);
  await editor.openEditForm(playerId);
  players = [];
  await editor.save(playerPayload);
  assert.equal(editor.isFormOpen.value, true);
  assert.equal(editor.isStale.value, true);
  assert.equal(editor.editingRecord.value?.id, playerId);
  assert.equal(data.players.value.length, 0);
  requests = [];
  await editor.save(playerPayload);
  assert.equal(requests.length, 0);
  editor.closeForm();
  assert.equal(editor.isFormOpen.value, false);
});
test('a stale ID before editing gives clear feedback without opening an empty form', async () => {
  const data = makeData();
  await ready(data);
  const editor = makeTeamEditor(data);
  teams = [];
  await editor.openEditForm(firstId);
  assert.equal(editor.isFormOpen.value, false);
  assert.ok(editor.feedbackErrors.value.length > 0);
  assert.ok(!data.teams.value.some((record) => record.id === firstId));
});
test('canceling deletion sends no request, including no preliminary GET', async () => {
  const data = makeData();
  await ready(data);
  const editor = makeTeamEditor(data);
  requests = [];
  let confirmedName = '';
  const result = await editor.deleteRecord(firstId, async (name) => {
    confirmedName = name;
    return false;
  });
  assert.deepEqual(result, { success: true, data: false });
  assert.equal(confirmedName, 'First Backend Team');
  assert.equal(requests.length, 0);
  assert.equal(data.teams.value.length, 2);
});
test('confirmed team deletion reloads actual detached player relationships', async () => {
  const data = makeData();
  await ready(data);
  const editor = makeTeamEditor(data);
  const result = await editor.deleteRecord(firstId, async () => true);
  assert.deepEqual(result, { success: true, data: true });
  assert.equal(data.players.value[0]?.teamId, null);
  assert.ok(!data.teams.value.some((record) => record.id === firstId));
  const reread = makeData();
  await ready(reread);
  assert.equal(reread.players.value[0]?.teamId, null);
});
test('a backend match conflict never removes a team or detaches players locally', async () => {
  const data = makeData();
  await ready(data);
  const editor = makeTeamEditor(data);
  handler = (request, response) =>
    request.method === 'DELETE'
      ? failure(response, 409, 'This team has recorded matches.')
      : defaultHandler(request, response);
  const result = await editor.deleteRecord(firstId, async () => true);
  assert.ok(!result.success);
  assert.equal(result.statusCode, 409);
  assert.equal(data.teams.value.length, 2);
  assert.equal(data.players.value[0]?.teamId, firstId);
});
test('successful player mutation uses normalized response and a new page reads persisted data', async () => {
  const data = makeData();
  await ready(data);
  const editor = makePlayerEditor(data);
  editor.openCreateForm();
  await editor.save({ ...playerPayload, name: '  Added ' });
  assert.equal(editor.isFormOpen.value, false);
  assert.equal(data.players.value.find((record) => record.id === createdId)?.name, 'Added');
  const reread = makeData();
  await ready(reread);
  assert.equal(reread.players.value.find((record) => record.id === createdId)?.name, 'Added');
});
test('partial load failures show error and retry instead of misleading zero counts', async () => {
  handler = (request, response) =>
    request.url === '/api/players'
      ? failure(response, 500, 'Private SQL body')
      : defaultHandler(request, response);
  const data = makeData();
  assert.equal(data.isLoading.value, true);
  await ready(data);
  assert.equal(data.hasLoaded.value, false);
  assert.equal(data.isReady.value, false);
  assert.equal(data.teams.value.length, 0);
  assert.ok(!data.loadErrors.value.join().includes('SQL'));
  handler = defaultHandler;
  await data.loadData();
  assert.equal(data.isReady.value, true);
  assert.equal(data.teams.value.length, 2);
});
test('an empty database has an explicit successfully loaded empty state', async () => {
  teams = [];
  players = [];
  const data = makeData();
  await ready(data);
  assert.equal(data.isReady.value, true);
  assert.deepEqual(data.teams.value, []);
  assert.deepEqual(data.players.value, []);
  assert.deepEqual(data.loadErrors.value, []);
});
test('guests on Home do not call authenticated APIs or see fictional seeded counts', async () => {
  auth.AuthService.logout();
  const data = makeData(true);
  await nextTick();
  assert.equal(requests.length, 0);
  assert.equal(data.isReady.value, false);
  assert.deepEqual(data.teams.value, []);
});
test('a protected 401 clears the session and presentation snapshot', async () => {
  const data = makeData();
  await ready(data);
  handler = (_request, response) => failure(response, 401, 'Private token');
  await data.loadData();
  await nextTick();
  assert.equal(stores.useAuthStore().accessToken, null);
  assert.equal(data.teams.value.length, 0);
  assert.equal(data.isReady.value, false);
});
test('a database role change on 403 refreshes current navigation from auth/me', async () => {
  actorRole = 'user';
  const result = await teamService.TeamService.createTeam(teamPayload);
  assert.ok(!result.success);
  assert.equal(result.statusCode, 403);
  assert.equal(auth.AuthService.isAdmin(), false);
  assert.ok(requests.some((request) => request.url === '/api/auth/me'));
});
test('a late load cannot replace newer data', async () => {
  let release: (() => void) | undefined;
  handler = (request, response) =>
    request.url === '/api/teams' && !release
      ? ((release = () => json(response, 200, [team(firstId, 'Old')])), undefined)
      : defaultHandler(request, response);
  const data = makeData();
  for (let count = 0; !release && count < 100; count++) await delay(2);
  assert.ok(release);
  teams = [team(secondId, 'New')];
  players = [player(secondId)];
  await data.loadData();
  release();
  await delay(10);
  assert.equal(data.teams.value[0]?.name, 'New');
});
test('a late response from a previous session cannot reveal its records', async () => {
  let release: (() => void) | undefined;
  handler = (request, response) =>
    request.url === '/api/teams'
      ? ((release = () => json(response, 200, teams)), undefined)
      : defaultHandler(request, response);
  const data = makeData();
  for (let count = 0; !release && count < 100; count++) await delay(2);
  assert.ok(release);
  auth.AuthService.logout();
  await nextTick();
  release();
  await delay(10);
  assert.deepEqual(data.teams.value, []);
  assert.equal(data.isReady.value, false);
});
test('confirmation from an old session cannot delete for a new session', async () => {
  const data = makeData();
  await ready(data);
  const editor = makeTeamEditor(data);
  let resolveConfirmation: ((value: boolean) => void) | undefined;
  const operation = editor.deleteRecord(
    firstId,
    () =>
      new Promise<boolean>((resolve) => {
        resolveConfirmation = resolve;
      }),
  );
  assert.ok(resolveConfirmation);
  startSession('admin', 'new');
  await nextTick();
  resolveConfirmation(true);
  await operation;
  assert.ok(!requests.some((request) => request.method === 'DELETE'));
  await ready(data);
});
test('duplicate submissions are blocked while the first save is pending', async () => {
  const data = makeData();
  await ready(data);
  const editor = makeTeamEditor(data);
  editor.openCreateForm();
  let release: (() => void) | undefined;
  handler = (request, response) =>
    request.method === 'POST'
      ? ((release = () => json(response, 201, team(createdId))), undefined)
      : defaultHandler(request, response);
  const operation = editor.save(teamPayload);
  for (let count = 0; !release && count < 100; count++) await delay(2);
  assert.ok(release);
  await editor.save(teamPayload);
  assert.equal(requests.filter((request) => request.method === 'POST').length, 1);
  release();
  await operation;
});
test('comparison joins backend teams, players and matches through normalized IDs', async () => {
  const data = makeData(true);
  await ready(data);
  const first = data.teams.value[0];
  assert.ok(first);
  const indicators = comparison.calculateTeamComparisonIndicators(
    first,
    data.players.value,
    data.matchStats.value,
  );
  assert.equal(indicators.playerCount, 1);
  assert.equal(indicators.playerGoals, 3);
  assert.equal(indicators.playerAssists, 2);
  assert.equal(indicators.matchesPlayed, 1);
  assert.equal(indicators.wins, 1);
  assert.equal(indicators.goalsFor, 2);
  assert.equal(indicators.averageAttendance, 120);
  assert.ok(requests.some((request) => request.url === '/api/match-stats'));
});
for (const invalid of [
  { team: { id: firstId }, teamId: undefined },
  { status: 'invalid' },
  { goals: -1 },
  { assists: '2' },
  { teamId: 'missing-id' },
]) {
  test(`malformed player response is rejected: ${JSON.stringify(invalid)}`, async () => {
    handler = (_request, response) => json(response, 200, [{ ...player(), ...invalid }]);
    const result = await playerService.PlayerService.getPlayers();
    assert.equal(result.success, false);
  });
}
test('extra embedded teams and sensitive fields are discarded from public response data', async () => {
  handler = (_request, response) =>
    json(response, 200, [{ ...player(), team: team(firstId), passwordHash: 'hidden' }]);
  const result = await playerService.PlayerService.getPlayers();
  assert.ok(result.success);
  assert.equal(Object.keys(result.data[0] ?? {}).length, 9);
  assert.ok(!JSON.stringify(result).includes('hidden'));
});
for (const [form, label] of [
  ['team', 'Team'],
  ['player', 'Player'],
] as const) {
  test(`${label} form displays backend errors while retaining its editable record`, async () => {
    const html = await renderToString(
      h(
        form === 'team' ? teamForm : playerForm,
        form === 'team'
          ? {
              editingTeam: team(firstId, 'Retained Draft'),
              errors: ['Backend validation rejected the change.'],
            }
          : { editingPlayer: player(), teams, errors: ['Backend validation rejected the change.'] },
      ),
    );
    assert.ok(html.includes('Backend validation rejected the change.'));
    assert.ok(html.includes(form === 'team' ? 'Retained Draft' : 'Backend Player'));
  });
  test(`${label} form disables stale and pending submissions`, async () => {
    const html = await renderToString(
      h(
        form === 'team' ? teamForm : playerForm,
        form === 'team'
          ? { editingTeam: team(firstId), isStale: true, isSubmitting: true }
          : { editingPlayer: player(), teams, isStale: true, isSubmitting: true },
      ),
    );
    assert.ok(html.includes('This record no longer exists'));
    assert.match(html, /type="submit"[^>]*disabled/);
    assert.ok(html.includes('aria-busy="true"'));
  });
}
test('a missing player team stays visible as an unavailable choice instead of silently becoming null', async () => {
  const html = await renderToString(h(playerForm, { editingPlayer: player(firstId), teams: [] }));
  assert.ok(html.includes('Selected team is unavailable'));
  assert.ok(html.includes(firstId));
  assert.ok(html.includes('Free agent (no team)'));
});
test('loading/error/retry/empty feedback is accessible', async () => {
  const loading = await renderToString(
    h(loadState, { isLoading: true, errors: [], hasLoaded: false }),
  );
  assert.ok(loading.includes('role="status"'));
  assert.ok(loading.includes('aria-busy="true"'));
  const error = await renderToString(
    h(loadState, { isLoading: false, errors: ['Unable to load.'], hasLoaded: false }),
  );
  assert.ok(error.includes('Retry loading data'));
  assert.ok(error.includes('Unable to load.'));
  const empty = await renderToString(
    h(loadState, { isLoading: false, errors: [], hasLoaded: true, isEmpty: true }),
  );
  assert.ok(empty.includes('No records yet.'));
});

test('a role downgrade closes an open write form while keeping read-only catalog access', async () => {
  const data = makeData();
  await ready(data);
  const editor = makeTeamEditor(data);
  editor.openCreateForm();
  actorRole = 'user';
  await editor.save(teamPayload);
  await nextTick();
  assert.equal(editor.isFormOpen.value, false);
  assert.equal(auth.AuthService.isAdmin(), false);
  assert.ok(editor.feedbackErrors.value.length > 0);
  assert.equal(data.isReady.value, true);
});
test('legacy domain snapshots cannot hydrate an API page after REST migration', async () => {
  const persistence = (await vite.ssrLoadModule(
    '/src/PiniaConfig.ts',
  )) as typeof import('../src/PiniaConfig.js');
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
  const scope = effectScope();
  scopes.push(scope);
  try {
    storage.setItem(
      'piniaState',
      JSON.stringify({
        teams: { teams: [{ id: 'old-local-team' }] },
        players: { players: [{ invalid: 'old-local-player' }] },
        matchStats: { matchStats: [match] },
      }),
    );
    const pinia = createPinia();
    setActivePinia(pinia);
    scope.run(() => persistence.configurePinia(pinia));
    assert.equal(pinia.state.value.teams, undefined);
    assert.equal(pinia.state.value.players, undefined);
    assert.equal(pinia.state.value.matchStats, undefined);
    assert.ok(!storage.getItem('piniaState')?.includes('old-local-team'));
    assert.ok(!storage.getItem('piniaState')?.includes('old-local-player'));
  } finally {
    scope.stop();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
