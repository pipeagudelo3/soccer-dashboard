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
npm install
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
not in views or components. For example, a future Teams service can request:

```ts
const result = await ApiService.request<TeamInterface[]>({ url: '/teams' });
```

Use relative endpoints, and pass query values through `params`. The shared Axios instance supplies
JSON headers, a ten-second timeout and the configured base URL. It does not send cookies or XSRF
headers, retry failed requests or allow endpoints to escape the API path. Missing/invalid API
configuration produces a safe failure; there is no silent localhost fallback.

The request interceptor reads `useAuthStore().accessToken` for each request. AuthService establishes
the token, minimal profile and expiry after a successful backend login. The complete auth state is
kept in memory and excluded from both saving and loading `piniaState`. Logout clears it. Reloading
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
administration in #52. Teams, Players and MatchStats CRUD remain local until their integration
requirements are completed. Users administration reads and writes only the backend database. The runtime login requires the backend
JWT module (#47, PR #63); the client uses the approved #39 contract.

### HTTP client tests

```sh
npm test             # Node's built-in runner, Vite-loaded TypeScript and an isolated HTTP server
npm run verify       # Also checks test types and runs the HTTP tests
npm audit            # Audit all frontend dependencies, including development tools
```

Tests cover real request serialization, headers, token changes, public login, concurrent/stale 401s,
validation/status errors, network failures, cancellation, unsafe endpoints, environment validation
and token exclusion from Pinia persistence. No additional test dependency is required.

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

A full browser reload discards the token. The frontend ignores all persisted auth fields, preserves
domain data and returns to login when a protected page is requested. It does not recreate a session
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
state. It never reads the local user domain store or browser storage. Pinia configuration ignores
and excludes both auth and users from active persisted snapshots, preserves the remaining local
domains, and no longer runs the local user seeder. The old user store/seeder files remain only for
legacy compatibility; they are not used by backend administration, and the fictional seeder no
longer contains password fields. Existing legacy migration backups are not used as a Users database.

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

`npm run verify` includes 80 tests: 24 transport, 23 authentication/navigation and 33 Users service,
page-state and form-rendering tests. They cover DTO serialization, safe responses, permissions,
validation/conflicts, loading/retry/empty states, stale records, races, self-update/self-delete,
legacy snapshot exclusion and preservation of inline form feedback. Test Vite servers disable
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

### Dependency audit at implementation time

On 2026-10-08 UTC (2026-10-07 in Colombia), compatible lockfile updates resolved the findings in Vue,
source-map-js and shell-quote. The production audit (`npm audit --omit=dev`) reports zero
vulnerabilities. The full audit still reports four high findings in the existing development chain
`@vue/eslint-config-typescript → fast-glob → micromatch → braces`.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) has no published patched
version of braces. npm proposes an incompatible downgrade of the Vue ESLint configuration via
`npm audit fix --force`; it was not applied. The full-audit acceptance criterion therefore remains
pending a reviewed toolchain change or an explicit team decision. This is separate from the HTTP
client tests and does not mean the full audit passed.

The global font-weight reset remains unchanged in this phase to avoid an application-wide visual
change; it should be reviewed as part of the next visual consistency phase.

## Recommended editor

Use [Visual Studio Code](https://code.visualstudio.com/) with the
[Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) and
[Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions.
