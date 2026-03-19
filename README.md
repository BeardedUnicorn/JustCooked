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

- Node.js with Yarn
- Rust toolchain
- Tauri system prerequisites for your OS

Install the platform dependencies from the [official Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/) before running the desktop app.

## Getting Started

This repository uses Yarn for JavaScript dependency management.

```bash
yarn install
```

### Run the web frontend

```bash
yarn dev
```

### Run the Tauri desktop app

```bash
yarn tauri dev
```

### Build

```bash
# Frontend build
yarn build

# Desktop bundle
yarn tauri build
```

## Testing

### Frontend

```bash
yarn test
yarn test:watch
yarn test:coverage
```

### Rust backend

```bash
yarn test:rust
yarn test:rust:unit
yarn test:rust:integration
yarn test:rust:property
```

### Full suite

```bash
yarn test:all
yarn test:all:coverage
```

Rust-specific testing notes live in [`src-tauri/TESTING.md`](./src-tauri/TESTING.md). Frontend test commands are defined in [`package.json`](./package.json) and [`vitest.config.ts`](./vitest.config.ts).

## Storybook

```bash
yarn storybook
yarn build-storybook
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
