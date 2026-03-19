# JustCooked

JustCooked is a desktop-first recipe manager built with Tauri, React, TypeScript, and Rust. It combines recipe import, pantry tracking, meal planning, shopping list generation, and a focused cooking mode in a single local-first application.

## What It Does

- Import recipes from supported cooking sites
- Parse ingredients with the `ingredient` crate and project-specific fallbacks
- Store recipes, pantry data, meal plans, and related metadata locally in SQLite
- Manage batch imports and queued import jobs
- Track pantry items, product mappings, and barcode-based product workflows
- Generate shopping lists from planned meals
- Run a distraction-light cooking mode for individual recipes
- Provide local logging and database management tools in the app

## Stack

- Frontend: React 19, TypeScript, Vite, Material UI, Redux Toolkit, React Router
- Desktop shell: Tauri v2
- Backend: Rust, Tokio, SQLx, Reqwest, Scraper
- Testing: Vitest, React Testing Library, Storybook, Rust unit/integration/property tests

## Prerequisites

- Node.js with npm
- Rust toolchain
- Tauri system prerequisites for your OS

Install the platform dependencies from the [official Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) before running the desktop app.

## Getting Started

This repository is currently set up around `npm` and `package-lock.json`.

```bash
npm install
```

### Run the web frontend

```bash
npm run dev
```

### Run the Tauri desktop app

```bash
npm run tauri -- dev
```

### Build

```bash
# Frontend build
npm run build

# Desktop bundle
npm run tauri -- build
```

## Testing

### Frontend

```bash
npm run test
npm run test:watch
npm run test:coverage
```

### Rust backend

```bash
npm run test:rust
npm run test:rust:unit
npm run test:rust:integration
npm run test:rust:property
```

### Full suite

```bash
npm run test:all
npm run test:all:coverage
```

Rust-specific testing notes live in [`src-tauri/TESTING.md`](./src-tauri/TESTING.md). Frontend test commands are defined in [`package.json`](./package.json) and [`vitest.config.ts`](./vitest.config.ts).

## Storybook

```bash
npm run storybook
npm run build-storybook
```

## Project Layout

```text
.
├── src/                 # React app, routes, components, services, store
├── src-tauri/           # Rust backend, database, import pipeline, Tauri config
├── LICENSE              # MIT license
├── src-tauri/TESTING.md # Rust-specific testing guide
├── vitest.config.ts     # Frontend test configuration
└── package.json         # Scripts and frontend dependencies
```

Key frontend areas:

- `src/pages`: app routes such as Dashboard, Cookbook, Planner, Pantry, Settings, Recipe View, and Cooking Mode
- `src/components`: reusable UI including batch import, pantry, shopping list, and logging/database controls
- `src/services`: local storage, import, queue, image, mapping, and logging services
- `src/store`: Redux store and slices

Key backend areas:

- `src-tauri/src/database.rs`: SQLite access and migrations
- `src-tauri/src/recipe_import.rs`: single-recipe import pipeline
- `src-tauri/src/batch_import.rs`: batch import and sitemap-driven flows
- `src-tauri/src/import_queue.rs`: queued import coordination
- `src-tauri/src/image_storage.rs`: local image handling
- `src-tauri/src/logging.rs`: log initialization and maintenance

## Data and Storage

- App data is stored locally
- The desktop bundle includes resources from `src-tauri/resources/`
- On startup, the app attempts to migrate legacy JSON recipe data into the database

## License

JustCooked is licensed under the MIT License. See [`LICENSE`](./LICENSE).

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri VS Code extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
