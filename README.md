# TypeSafe Cloud Project

A TypeScript project with strict type safety, set up for Claude Code on the web.

## Setup

```bash
npm install
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-check without emitting files (`tsc --noEmit`) |
| `npm run build` | Compile `src/` to `dist/` |
| `npm start` | Run the compiled output |
| `npm test` | Currently an alias for `typecheck` |

## What "type safe" means here

`tsconfig.json` turns on `strict` plus these extra checks:

- `noUncheckedIndexedAccess` — array/object index access yields `T | undefined`
- `exactOptionalPropertyTypes` — `?:` properties can't be explicitly set to `undefined`
- `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- `noUnusedLocals`, `noUnusedParameters`

Errors are caught at `npm run typecheck` time, for example:

```
error TS2345: Argument of type '"deleted"' is not assignable to parameter of type 'ResourceState'.
error TS2532: Object is possibly 'undefined'.
error TS2322: Type 'number' is not assignable to type 'string'.
```

## Layout

```
src/index.ts    source
dist/           build output (gitignored)
tsconfig.json   compiler settings
.claude/        SessionStart hook that runs `npm install`
```
