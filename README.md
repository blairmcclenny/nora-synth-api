# Nora Synth API

A standalone Hono API for saving and recalling synth presets, built one step at a time.

## Start here

Requires Node.js 24 or newer and npm.

```sh
npm install
npm run dev
```

In another terminal:

```sh
curl -i http://localhost:3000/health
```

Expect HTTP 200 and `{"status":"ok"}`. Stop the server with Ctrl+C.

## How this first step works

1. `src/server.ts` starts a local HTTP server on port 3000 and passes requests to Hono.
2. `src/app.ts` defines the routes. `app.get('/health', ...)` matches a GET request to that path.
3. Hono passes a context, named `c`, to the handler. `c.json(...)` builds a JSON response.

The health route confirms the server responds. It does not check a database yet.
The `.js` import in `server.ts` is intentional: TypeScript resolves the source file and retains the correct extension for compiled JavaScript.

## First exercise

Add `service: 'nora-synth-api'` to the health response in `src/app.ts`. Save the file and run curl again. The development command watches files and restarts the server for you.

Then run `npm run typecheck` to check your TypeScript without generating files.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the server and restart when source files change |
| `npm run typecheck` | Check TypeScript types |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm start` | Run the compiled server after building |

## Learning roadmap

- [x] Start Hono and respond to a health request.
- [ ] Define a preset and learn request validation.
- [ ] Connect PostgreSQL and write the first migration.
- [ ] Save a preset with POST and retrieve it with GET.
- [ ] List, update, and delete presets.
- [ ] Add focused tests for validation and persistence.

Each step should leave a working application and a small concept to practice.

## Agreed design

- Hono with TypeScript; this starter uses Node.js and npm.
- PostgreSQL persistence with a separate numeric column for each parameter.
- Parameters: filter, mood, movement, space, expression, attack, decay, sustain, release.
- JSON requests can group values in a `parameters` object; storage uses individual columns.
- Parameter ranges are provisionally 0–1. Confirm envelope units before implementing validation and database constraints.
- SQLite is a future exploration.

Database setup, authentication, and preset endpoints are upcoming lessons. See [the project specification](docs/project-spec.md) for the draft contract; it describes planned behavior beyond the current scaffold.

Reference: [Hono on Node.js](https://hono.dev/docs/getting-started/nodejs).
