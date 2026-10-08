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
npm run verify        # Run lint, formatting, type checking, and a production build
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

The request interceptor reads `useAuthStore().accessToken` for each request. `setAccessToken()` is the
integration point for #51 after a successful backend login. The token is kept in memory and excluded
from both saving and loading `piniaState`. Logout clears it. Reloading does not restore a token.
Public authentication requests must use `requiresAuth: false`, so invalid login credentials cannot
invalidate an existing session.

A protected 401 clears the matching current session. Concurrent failures do not retry or navigate;
a late response carrying an older token cannot clear a newer session. The existing router guards
handle subsequent protected navigation. The frontend auth integration in #51 will handle the active
page's transition to login. The HTTP client imports no router and creates no redirect loop.

Validation (400/422) and conflict (409) errors preserve string messages from the documented backend
error envelope. Network failures, timeouts, cancellations, 401, 403, 404 and server errors receive
predictable presentation messages. Raw Axios errors, request bodies, tokens and server diagnostics
are never logged or returned by these services. Server errors remain generic.

This requirement prepares the transport layer. Existing local domain services and login continue
working; migrating login and CRUD to backend calls belongs to #51 and the following integration
requirements. It uses the approved #39 contract and can be reviewed independently of the #63 merge.

### HTTP client tests

```sh
npm test             # Node's built-in runner, Vite-loaded TypeScript and an isolated HTTP server
npm run verify       # Also checks test types and runs the HTTP tests
npm audit            # Audit all frontend dependencies, including development tools
```

Tests cover real request serialization, headers, token changes, public login, concurrent/stale 401s,
validation/status errors, network failures, cancellation, unsafe endpoints, environment validation
and token exclusion from Pinia persistence. No additional test dependency is required.

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
