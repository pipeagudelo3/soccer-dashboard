# Soccer Dashboard

Soccer Dashboard is an academic web application for managing and analyzing teams, players, match
results, and season statistics. It is built with Vue 3, TypeScript, Pinia, Vue Router, Chart.js,
SweetAlert2, and Vite.

Chart.js provides the data visualizations. SweetAlert2 provides centralized deletion dialogs and
operation notifications, replacing native confirmations with consistent feedback. A second charting
library is intentionally unnecessary because Chart.js already covers every visualization required by
the project.

## Requirements

- Node.js 22.18.x or Node.js 24.12 or newer
- npm

## Project setup

```sh
npm ci
```

## Development

Start the Vite development server:

```sh
npm run dev
```

Create and preview a production build:

```sh
npm run build
npm run preview
```

## Code quality

```sh
npm run lint          # Check Vue and TypeScript files with ESLint
npm run lint:fix      # Apply safe ESLint fixes
npm run format        # Format the entire project with Prettier
npm run format:check  # Verify formatting without changing files
npm run type-check    # Check Vue and TypeScript types
npm run verify        # Run lint, formatting, app/test type checks, tests, and a production build
```

Run `npm run verify` before opening a pull request.

## Backend API configuration — #50

From `frontend/`, install the lockfile dependencies with `npm ci`. For a new local installation, copy
`.env.example` to `.env.local` and configure the public backend address:

```dotenv
VITE_API_BASE_URL=http://localhost:3000/api
```

On PowerShell, use `Copy-Item .env.example .env.local` only if `.env.local` does not exist yet. Preserve
any existing variables from #35, including `VITE_APP_NAME` when that requirement is integrated. Restart
Vite after editing the file. The example URL belongs to configuration; services never embed a host.

`VITE_API_BASE_URL` must include the API prefix. It accepts an HTTP(S) URL or a same-origin path such
as `/api` when the deployment proxy routes that path to NestJS. A separate backend origin must be
allowed by the backend's `CORS_ORIGIN`. Vite variables are public build-time values, not secrets.
Production builds must receive the deployed API address when they are built; changing an environment
variable after the build does not rewrite the bundle. `.env` and local/mode files are ignored by Git.

### Shared HTTP service

Domain services call the typed `ApiService.request<T>()` and receive the existing
`ServiceResult<T>` (`success/data` or `success/errors`). Axios stays inside the transport services,
not in views or components. For example, TeamService reads through the shared client:

```ts
const result = await ApiService.request<TeamInterface[]>({ url: '/teams' });
```

Use relative endpoints, and pass query values through `params`. The shared Axios instance supplies
JSON headers, a ten-second timeout and the configured base URL. It does not send cookies or XSRF
headers, retry failed requests or allow endpoints to escape the API path. Missing/invalid API
configuration produces a safe failure; there is no silent localhost fallback.

The request interceptor reads `useAuthStore().accessToken` for each request. AuthService establishes
the token, minimal profile and expiry after a successful backend login. The complete auth state is
kept only in memory. The retired `piniaState` key is deleted at startup. Logout clears the session. Reloading
does not restore a token or a persisted identity.
Public authentication requests must use `requiresAuth: false`, so invalid login credentials cannot
invalidate an existing session.

A protected 401 clears the matching current session. Concurrent failures do not retry or navigate;
a late response carrying an older token cannot clear a newer session. The existing router guards
handle subsequent protected navigation. The session/navigation bridge also handles the active
page's transition to login. The HTTP client imports no router and creates no redirect loop.

Validation (400/422) and conflict (409) errors preserve string messages from the documented backend
error envelope. Network failures, timeouts, cancellations, 401, 403, 404 and server errors receive
predictable presentation messages. Raw Axios errors, request bodies, tokens and server diagnostics
are never logged or returned by these services. Server errors remain generic.

The shared transport layer is implemented in #50, backend login/session handling in #51 and Users
administration in #52. Teams and Players reads/CRUD use the backend in #53. Charts, comparison and
match-statistics browsing read recorded backend matches to join the same UUID relationships.
MatchStats administration and analytical consumers now use the same backend in #54. Runtime login requires backend
JWT (#47, PR #63); the client uses the approved #39 contract.

### HTTP client tests

```sh
npm test             # Node's built-in runner, Vite-loaded TypeScript and an isolated HTTP server
npm run verify       # Also checks test types and runs the HTTP tests
npm audit            # Audit all frontend dependencies, including development tools
```

Tests cover real request serialization, headers, token changes, public login, concurrent/stale 401s,
validation/status errors, network failures, cancellation, unsafe endpoints, environment validation
and memory-only token handling. No additional test dependency is required.

## Backend login and session — #51

Start the backend with the #47 authentication module and configure the frontend API address as
described above. Run `npm run seed` in `backend/` to create the public academic accounts:

| Role          | Email                | Academic password |
| ------------- | -------------------- | ----------------- |
| Administrator | admin@soccer.example | AdminDemo123      |
| Regular user  | user@soccer.example  | UserDemo123       |

The seed is idempotent and preserves previously modified credentials. These accounts are for local
evaluation only. Credentials from the old frontend fictional store no longer authenticate users.

AuthService sends `POST /auth/login` through ApiService with `requiresAuth: false`, normalizes email,
preserves the submitted password and returns generic invalid-credential feedback. It accepts the
documented Bearer response, reconstructs only id/name/email/role and bounds the memory expiry timer
by both `expiresIn` and the token's `exp`. Decoding exp is for local timing only; NestJS validates JWT
signatures and applies the real authorization checks. No token role or local user record supplies
the authenticated identity.

Reconciliation calls `GET /auth/me`, updates the current database profile and role, and coalesces
simultaneous checks. The router waits before allowing protected routes; App hides protected content
and displays session loading while validation is pending. A 401, local expiry or account deletion
clears the session. A temporary network/server failure blocks protected content and keeps only the
in-memory session candidate for a later validation attempt. Late login/me responses cannot restore
an account after logout or replace a newer login.

### Refresh and the approved memory-only contract

A full browser reload discards the token. The frontend removes the retired backend-owned domain
snapshot and returns to login when a protected page is requested. It does not recreate a session
from a saved profile, LocalStorage or SessionStorage. This interprets the issue's refresh criterion
under the approved #39 decision: there is no persistent login across a full reload. If an in-memory
token is available during SPA navigation/reconciliation, it is accepted only after `/auth/me`.
Persistent restoration would require a separately approved contract change; no refresh tokens or
authentication cookies are added here.

The expiry timer and API request interceptor both enforce the deadline. Logout is local and does
not revoke an already copied access token on the server before its expiration. A session/navigation
bridge replaces the active protected route after invalidation or a role downgrade, with one redirect
in flight to avoid loops. Login redirect parameters accept only known internal routes and never
point back to login. UI route guards are UX protection; backend guards remain authoritative.

The LoginView awaits the backend result, disables duplicate submission and clears its password
field. Backend Users CRUD (#52) reconciles the current profile after a successful self-update and
logs out after a successful self-delete. Old local profiles cannot change backend credentials.

The tests include backend-contract HTTP fixtures and memory-history router navigation: valid/invalid
login, safe profiles, loading/coalescing, current roles, invalid/deleted/expired sessions, transient
failures, late responses, automatic expiry, storage exclusion and loop-free navigation. JWT signature
verification is exercised separately against the actual NestJS backend, not emulated by the fixtures.

## Backend user administration — #52

`/admin/users` loads `GET /users` asynchronously through UserService and the shared ApiService.
Opening an edit form fetches `GET /users/:id` again, so the form starts from a current database
record. Creation uses POST, updates use PATCH and deletion accepts the backend's empty 204 response.
All five Users endpoints require an administrator in NestJS. Frontend route/service checks only
provide UX protection and never replace backend authorization.

UserInterface now represents the six-property public DTO: id, name, email, role, createdAt and
updatedAt. Password exists only in the write DTO and the temporary form. Unexpected response fields,
including passwords/hashes, are discarded. An empty password field on edit is omitted from PATCH;
it never overwrites the existing password with an empty value. DTO fields are explicitly selected
before sending, so IDs, timestamps and arbitrary properties are not writable.

The page uses the `useUserAdministration` composable for ephemeral loading, list, form and feedback
state. It never reads a local domain store or browser storage. Pinia is used only for the
in-memory authentication state. Obsolete domain stores, seeders and persistence have been removed;
the old `piniaState` key is deleted at startup without loading its contents.

Initial loading, empty results, errors and explicit retry/reload states are visible. During writes,
form fields and duplicate submission are blocked; validation/conflict errors stay inline and keep
the form open. Successful operations use the server response to update displayed rows without a
full page reload. Reload fetches fresh database data; failed reloads label any previous list as
potentially outdated. Older list/edit responses cannot repopulate the page after logout or a newer
request. Stale 404 records are removed from the list; an already-open draft stays visible but cannot
be resubmitted until the user cancels or explicitly reloads its record.

SweetAlert2 still confirms deletion and displays its result. The backend owns email uniqueness,
password rules and protection of the last administrator; a potentially outdated frontend list does
not make those decisions. 400/422 validation and 409 conflict messages are displayed, while 401,
403, 404, network failures and 5xx use the shared safe presentation messages. ServiceResult retains
success/data or success/errors and adds optional numeric statusCode metadata on HTTP failures, so
stale-record handling does not parse translated/displayed messages or expose Axios internals.

After a successful self-update, AuthService refreshes `/auth/me` in the background, updates the
current database role/profile and the existing navigation bridge leaves admin routes after a role
downgrade. Background checks preserve the active form when the role remains valid. A failed session
check still blocks unverified access. A successful self-delete logs out locally; a rejected deletion
never does. Late responses from a previous account cannot log out a newer session. A 403 rechecks
identity once, preserving an explicit retry state if the backend still reports an admin profile.
A successful write is not reported as failed merely because a later profile check cannot complete.

### Validation and manual evaluation

`npm run verify` includes transport, authentication/navigation, Users administration and
Teams/Players integration tests. The 33 Users service, page-state and form-rendering tests cover DTO serialization, safe responses, permissions,
validation/conflicts, loading/retry/empty states, stale records, races, self-update/self-delete,
API contract isolation and preservation of inline form feedback. Test Vite servers disable
HMR/WebSocket because no browser hot reload is needed; parallel files no longer compete for port 24678. No dependency was added for this requirement.

A separate check uses the actual NestJS backend and isolated SQLite data to verify CRUD, normalized
responses, password-free profiles, validation, duplicate email, last-admin protection, self-profile
refresh, role downgrade, direct API 403, missing records and self-delete logout. HTTP fixtures do not
claim to emulate cryptographic JWT verification or transactional database integrity.

For manual evaluation, start the configured backend containing #43 and #47 and run its seed if
needed, then start Vite with `npm run dev`. Login as admin, open `/admin/users`, create/edit/delete a
regular account and verify the changes after reloading the list and signing in again. Try a duplicate
email and an invalid password: feedback must stay in the open form. With at least two admins, edit
your own name/role or delete your account and check the header/navigation. With only one admin, the
backend must reject demotion/deletion. Sign in as a regular user and verify direct `/admin/users`
navigation is blocked. Keep the memory-only token rule from #39: a full reload requires login.
These manual steps are provided for the contributor; automated and real API checks are recorded
separately and do not claim a desktop-browser session was performed.

## Backend Teams and Players — #53

TeamsView and PlayersView use asynchronous TeamService and PlayerService operations through the
same ApiService. GET collection/detail endpoints accept authenticated users; POST/PATCH/DELETE
require an administrator in NestJS. Frontend checks keep the UI read-only for regular users and
never replace backend guards. Opening an edit form fetches a fresh record; cancellation of the
SweetAlert2 deletion dialog performs no HTTP request, including no preliminary GET.

Team responses preserve eight public properties, and player responses preserve the normalized
nine-property contract. Players keep only nullable `teamId`, never an embedded Team. Display names,
filter options, squad counts, scorer charts and comparison results derive from server snapshots.
The transport selects only writable DTO fields and reconstructs validated public responses,
discarding unexpected fields. Uniqueness, approved status values, numbers, team existence and
transactional deletion rules are enforced by the backend; local seeders and domain stores are not
used to supply migrated features.

`useTeamPlayerData` owns disposable page snapshots with atomic loading, empty/error/retry states.
It does not persist an API cache. All required reads must succeed before charts/tables are shown,
so a failed players request cannot masquerade as a zero-sized squad. Later loads supersede earlier
ones; logout, a session switch or leaving the view prevents old responses from revealing data.
Home remains accessible to guests and asks them to log in before displaying private API data.
Dashboard, Statistics, MatchStats browsing and TeamComparison use asynchronous data as well.

`useResourceAdministration` shares the two editors' pending/confirmation/save lifecycle. Validation
and conflict feedback stays inside the open form without resetting its draft. Duplicate actions
are blocked. Successful create/update uses normalized server responses without a page reload.
404 removes a stale row; an open stale draft remains visible, blocks resubmission and can be
canceled. A 403 refreshes the active role through `/auth/me`; a role downgrade closes write forms.
401 relies on the existing session/navigation bridge. Network, 5xx and other status responses retain
the common safe ServiceResult feedback.

Deleting a team refetches both collections. NestJS may set associated players' `teamId` to null or
reject deletion with 409 when recorded matches reference that team. No local team/player store is
mutated to predict those outcomes. A successful DELETE remains successful even if its subsequent
read fails; the loading error and retry action show that the refreshed snapshot is unavailable.
Reloading and signing in again fetches the persisted database records.

### Shared match data after #54

The temporary separation introduced in #53 is removed in #54: both administration and analytical
pages use MatchStatsService and the database records. The unused RecordedMatchService compatibility
alias was removed in #55; no consumer reads local match stores.

### Verification and evaluation

Node 24.19.0 was used with `npm ci` and `npm run verify`. Automated tests cover real HTTP requests,
public DTOs, permissions, nullable relationships, validation/conflicts, stale IDs, canceled deletes,
loading/empty/retry, racing responses, role changes, duplicate actions, comparison joins and rendered
form feedback. The previous #50–#52 tests remain in the verification suite. No package dependency,
backend schema, migration or token-persistence policy changes in #53.

A separate smoke check uses the actual NestJS application and isolated SQLite data to verify
Teams/Players CRUD, normalization, validation 400, duplicate/conflict 409, 404, database player
detachment, protected match relationships, comparison, regular-user direct API 403 and guest 401.
It does not use fixtures to claim database integrity or cryptographic JWT verification.

For manual evaluation, start the seeded backend and Vite. Login as admin, filter Teams by country
and Players by team/free-agent, position, status and name; inspect both charts and comparison.
Create/update a player and team, submit invalid values, cancel deletion, try deleting a team with
recorded matches, and delete a newly created unreferenced team with a player. The player must become
unassigned after the server operation. Reload/sign in again and confirm persisted data. With a
regular account, both pages must be read-only. Stop the backend to inspect error/retry states and
resume it before retrying. Automated checks do not claim a manual desktop-browser evaluation.

## Backend MatchStats and analytical views — #54

MatchStatsService uses GET collection/detail, POST, PATCH and DELETE of `/match-stats` through the
existing typed REST resource and ApiService. Public responses preserve ten properties: id, date,
homeTeamId, awayTeamId, goalsHomeTeam, goalsAwayTeam, stadium, attendance, createdAt and updatedAt.
Only the seven editable DTO fields are sent; embedded Team objects, IDs and timestamps are never
submitted as writable data. The backend owns real/non-future dates, distinct existing teams,
non-negative integer values, stadium normalization and duplicate date/home/away combinations.
Frontend response readers reject malformed payloads before formatting dates or plotting values.

AdminMatchStatsView uses the shared asynchronous editor, current-record GET before editing,
normalized server responses after save, SweetAlert2 confirmation before DELETE, and dependency
reload after deletion. Backend 400/409 feedback stays in the open form without resetting its draft.
The form remains mounted during reload/error states. A stale 404 draft remains visible and disabled
until canceled. Duplicate actions and responses from an earlier session cannot mutate current data.
Regular users have read-only access; real authorization remains in NestJS. 401 clears the matching
session and 403 refreshes the current role through `/auth/me`.

MatchStats browsing and administration require Teams and MatchStats, not Players. Dashboard,
Statistics, TeamComparison and Home wait for all three relevant collections. Requests may execute
in parallel, but labels, tables, counts and charts appear only after every required response is
successful and its relationship IDs exist in the loaded team snapshot. A missing dependency or
cross-request relationship race produces error/retry feedback instead of guessed names or false
zero counts. Reload failures hide previous analytical results until a complete retry succeeds.
Empty collections remain valid data; zero goals and attendance remain valid values.

`matchAnalytics.ts` centralizes match filters, standings, result distributions, match goals and
roster goals. Standings reuse the same pure calculation as TeamComparison, including home/away
results and attendance. Player season totals remain distinct from goals recorded in matches.
Computed filters update charts without a page reload. No Statistics entity, persisted analytical
cache, schema change, new HTTP client or dependency is introduced. The retired domain snapshot
is deleted at startup; there are no browser persistence subscriptions. Unrelated storage keys are untouched.
Legacy domain stores and seeders have been removed. Analytical views use disposable API snapshots.

### Verification

With Node 24.19.0 and npm 11.9.0, `npm ci` and `npm run verify` pass: ESLint, Prettier, application and
test types, 146 tests and the production build. The 118 previous tests remain, with persistence
expectations updated for MatchStats migration and a race fixture adjusted to use consistent IDs.
Twenty-eight added tests cover transport/DTOs, errors, form/stale-record behavior, partial loads,
retry, normalized relationships, filters, independent calculation expectations, zero/empty charts
and rendered form feedback. The real NestJS/SQLite check verifies CRUD, unchanged duplicate keys on
edit, duplicate 409, invalid dates/teams/numbers/stadium 400, missing IDs 404, team deletion conflicts,
admin versus regular-user direct API authorization and guest 401. HTTP fixtures do not replace
cryptographic or database checks. Manual browser testing remains a contributor step.

### Run locally and test in the browser

Use Node 24 compatible with both packages. In a terminal at `soccer-dashboard/backend`, run `npm ci`.
Copy `.env.example` to `.env` only if `.env` does not exist. Set a private random `JWT_SECRET` in that
local file before starting NestJS, preserve your SQLite path, and allow the exact Vite origin in
`CORS_ORIGIN` (the example allows localhost:5173 and 127.0.0.1:5173). Do not commit `.env` or secrets.
Run `npm run seed` if demo accounts are needed, then `npm run start:dev`. Seed is idempotent and does
not reset modified existing accounts; no clean/reset seed is required for this frontend change.

In a second terminal at `soccer-dashboard/frontend`, run `npm ci`, preserve or create `.env.local`
from `.env.example`, set `VITE_API_BASE_URL=http://localhost:3000/api`, and run `npm run dev`.
Open the URL Vite prints, normally http://localhost:5173. If Vite chooses another port, add that exact
origin to backend CORS configuration and restart the backend. Restart Vite after changing its env.

1. Login with `admin@soccer.example` / `AdminDemo123` (unless that seeded account was modified).
2. Create two uniquely named teams with no previous matches. In match administration, create a
   past-date home 3–away 1 match with attendance 120. Open MatchStats, Statistics, Dashboard and Team
   Comparison: the new record must appear with the correct team names. The selected pair's results
   are home W=1/GF=3/GA=1 and away L=1/GF=1/GA=3; attendance is 120 for each team's match result.
   Season player goals are independent and should not increase merely from creating a match.
3. Change the match to 0–0 and attendance 0. Match charts/comparison must show a draw and real zeros.
   Try a duplicate with the same date/home/away: the server error stays inline and the draft remains.
4. Test team/stadium/date filters, table captions and charts. Filters with no matches show empty
   results. Cancel a delete and inspect Network: no DELETE or preliminary GET is sent. Confirm
   deletion and verify the record disappears from match browsing and analytical pages.
5. Stop the backend while navigating to an analytical page: it must show loading then error/retry,
   without charts built from partial data. Restart the backend and retry to recover the snapshot.
6. Login as `user@soccer.example` / `UserDemo123`: reads work and direct `/admin/match-stats` navigation
   is blocked. The backend also rejects regular-user mutations even if the UI is bypassed.
7. Reload the browser, login again, and confirm database persistence. The memory-only token is
   intentionally lost on a full reload; losing login is not losing SQLite records.

### Dependency audit at implementation time

The production audit (`npm audit --omit=dev`) reports zero vulnerabilities. The full audit continues
to report four high findings in the development chain
`@vue/eslint-config-typescript → fast-glob → micromatch → braces`. No dependencies changed in #54.
The proposed incompatible `npm audit fix --force` downgrade was not applied. Full audit is recorded
with these findings rather than reported as clean; the toolchain update remains separate work.

The global font-weight reset remains unchanged in this phase to avoid an application-wide visual
change; it should be reviewed as part of the next visual consistency phase.

## Recommended editor

Use [Visual Studio Code](https://code.visualstudio.com/) with the
[Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) and
[Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions.

## Obsolete domain persistence cleanup — issue #55

NestJS and SQLite are the only persisted domain source. The four frontend domain stores, four
seeders, local ID generator and `PiniaConfig.ts` have been removed. Interfaces and DTOs remain
because they define the typed API contracts. Pinia remains useful only for the shared, in-memory
authentication state; page data and filters use Vue reactive state.

`LegacyStorageService.clearObsoleteState()` runs once per application startup, before session
reconciliation. It removes only the old `piniaState` key, without reading, parsing, migrating or
backing up its contents. Unrelated storage keys are untouched. Repeated cleanup is idempotent and
handles returning users of older deployments. If browser storage is blocked, a generic warning is
logged and the application continues with the API; old state is never consumed as a fallback.
No token, profile, fixture, domain record or UI preference is persisted by the application.

Reloading starts a guest session under the approved memory-only token policy. After logging in,
pages retrieve current backend records; they never recreate fictional frontend records. Backend
seed commands remain available only for deliberate database setup. Full-stack smoke verification
uses an isolated SQLite database, real NestJS login/CRUD, browser storage cleanup, and a new Pinia
instance to model reload. The complete frontend `npm run verify` passes with 149 tests on Node 24.19.0.
Production audit reports zero vulnerabilities; the full audit still reports four pre-existing high
severity development dependency findings. No dependency or lockfile change was made in #55.
Manual browser checks remain required before final team approval.
