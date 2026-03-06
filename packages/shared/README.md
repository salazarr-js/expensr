# @slzr/expensr-shared

Shared TypeScript types, utilities, and tsconfig presets used by all packages.

## tsconfig Presets

Replaces external packages (`@vue/tsconfig`, `@tsconfig/node24`) with local presets:

| Preset | Used By | Description |
|--------|---------|-------------|
| `tsconfig.base.json` | `packages/api` | ESNext, bundler resolution, strict mode |
| `tsconfig.vue.json` | `packages/web` (app) | Extends base + DOM libs, Vue JSX |
| `tsconfig.node.json` | `packages/web` (node, worker) | Extends base + Node types |

Usage in package tsconfig:

```json
{
  "extends": "@slzr/expensr-shared/tsconfig.base.json"
}
```

## Exports

- `.` — shared types and utilities (`src/index.ts`)
- `./tsconfig.base.json` — base TypeScript config
- `./tsconfig.vue.json` — Vue/DOM TypeScript config
- `./tsconfig.node.json` — Node TypeScript config
