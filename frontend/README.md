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

The global font-weight reset remains unchanged in this phase to avoid an application-wide visual
change; it should be reviewed as part of the next visual consistency phase.

## Recommended editor

Use [Visual Studio Code](https://code.visualstudio.com/) with the
[Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) and
[Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extensions.
