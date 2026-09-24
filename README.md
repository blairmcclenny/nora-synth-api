# Nora Synth API

A standalone Hono API for saving, listing, recalling, and deleting synth presets, built with TypeScript, Node.js, Zod, and PostgreSQL.

## Local setup

Requires Node.js 24 or newer, npm, a running PostgreSQL database, and the `psql` client to apply the migration.

```sh
npm install
```

Create a database and a PostgreSQL user with permission to create tables and read and write data. Create a `.env` file in the project root with your connection string:

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nora_synth
```

Replace the placeholder credentials and database name with your own. `.env` is ignored by Git. There is no migration runner yet; apply the initial migration once to a fresh database using the same connection string:

```sh
psql 'postgresql://USER:PASSWORD@localhost:5432/nora_synth' \
  -v ON_ERROR_STOP=1 -f src/db/migrations/001_create_presets.sql
```

Start the development server:

```sh
npm run dev
```

This command loads `.env`, watches source files, and restarts the server when they change. The server listens on `127.0.0.1:3000`. Stop it with Ctrl+C.

In another terminal:

```sh
curl -i "http://localhost:3000/health"
```

Expect HTTP 200 and `{"service":"nora-synth-api","status":"ok"}`. The health route reports service liveness; it does not query the database. `DATABASE_URL` is still required at application startup.

## Available endpoints

| Method | Route | Behavior | Success |
| --- | --- | --- | --- |
| GET | `/health` | Report service liveness | 200 |
| POST | `/v1/presets` | Save a complete preset | 201, full preset and `Location` header |
| GET | `/v1/presets` | List presets with pagination | 200, `{ items, limit, offset, total }` |
| GET | `/v1/presets/:id` | Retrieve a preset by UUID | 200, full preset |
| DELETE | `/v1/presets/:id` | Delete a preset by UUID | 204, no response body |

The update endpoint is not implemented yet. The current prototype has a single shared preset library and no authentication.

### Save a preset

```sh
curl -i "http://localhost:3000/v1/presets" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Soft Motion",
    "schemaVersion": 1,
    "parameters": {
      "filter": 0.45,
      "mood": 0.65,
      "movement": 0.3,
      "space": 0.55,
      "expression": 0.7,
      "attack": 0.2,
      "decay": 0.35,
      "sustain": 0.8,
      "release": 0.5
    }
  }'
```

The response includes a server-generated UUID, `createdAt`, and `updatedAt`. Duplicate names are allowed.

Names are trimmed and must contain 1–100 characters. `schemaVersion` must be `1`. All nine parameters are required and must be numbers from 0 to 1 inclusive. Unknown fields are rejected. PostgreSQL stores each parameter in its own column with a range constraint; JSON groups the values inside `parameters`.

### List and recall presets

```sh
curl -i -G "http://localhost:3000/v1/presets" \
  --data-urlencode "limit=1" \
  --data-urlencode "offset=0"
```

`limit` defaults to 50 and must be an integer from 1 to 100. `offset` defaults to 0 and must be a nonnegative integer. Query values are converted to numbers and validated by Zod middleware.

Results are ordered by `updated_at` descending, then `id` ascending. `total` counts all saved presets, independently of the requested page. An empty page returns `items: []`.

To recall a preset, replace `PRESET_ID` with the UUID returned when saving or listing:

```sh
curl -i "http://localhost:3000/v1/presets/PRESET_ID"
```

Invalid preset data, IDs, or pagination values return HTTP 400 with a `VALIDATION_ERROR` JSON error envelope. Malformed JSON returns 400 with `INVALID_JSON`; a valid but missing preset ID returns 404 with `NOT_FOUND`. Unexpected server errors return 500 with `INTERNAL_ERROR` without exposing internal details.

### Delete a preset

Replace `PRESET_ID` with the UUID of a preset you want to delete:

```sh
curl -i -X DELETE "http://localhost:3000/v1/presets/PRESET_ID"
```

A successful deletion returns HTTP 204 with no response body. Recalling that preset or deleting the same ID again returns 404 with `NOT_FOUND`. An invalid UUID returns 400 with `VALIDATION_ERROR`. Errors use the same `{ "error": { "code": "...", "message": "..." } }` envelope as the other routes.

## Commands and checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Load `.env` and start the server with automatic restarts |
| `npm run typecheck` | Check TypeScript types without generating files |
| `npm run build` | Compile TypeScript into `dist/` |
| `npm start` | Run the compiled server; requires `DATABASE_URL` in the environment |

To run the compiled server with your local `.env`:

```sh
npm run build
node --env-file=.env dist/server.js
```

Check database connectivity with:

```sh
npx tsx --env-file=.env src/db/check.ts
```

`src/db/check-create.ts` is a manual script that inserts a sample preset. `src/db/check-read.ts` reads a hard-coded UUID; edit that ID before using it.

To check the repository's delete behavior directly, with PostgreSQL running:

```sh
npx tsx --env-file=.env src/db/check-delete.ts
```

This script creates a disposable preset, asserts that deletion succeeds, confirms the preset can no longer be retrieved, and asserts that deleting it again returns `false`. It prints `Delete checks passed` when all assertions pass. It calls the repository directly, so the HTTP server does not need to be running.

These are development checks, not an automated test suite. There is no `npm test` command yet.

## Project structure

```text
src/
  app.ts                  Routes, validation middleware, and error responses
  server.ts               HTTP server startup and shutdown
  schemas/preset.ts       Zod schemas for preset data and pagination
  types/preset.ts         Inferred input types and preset result types
  repositories/presets.ts SQL queries and database-to-JSON mapping
  db/
    pool.ts               PostgreSQL connection pool
    migrations/           SQL migrations applied manually
    check*.ts             Manual database checks
```

## Learning roadmap

- [x] Start Hono and respond to a health request.
- [x] Define a preset and validate requests with Zod.
- [x] Connect PostgreSQL and write the first migration.
- [x] Save a preset with POST and retrieve it with GET.
- [x] List presets with validated pagination and a total count.
- [x] Delete presets by ID with validation and missing-preset handling.
- [ ] Update presets.
- [ ] Add focused automated tests for validation and persistence.
- [ ] Connect the synth's save, list, and recall controls.
- [ ] Decide authentication, ownership, and deployment before remote hosting.

The API currently enforces normalized 0–1 values, including the envelope controls. Document how those values map to the synth engine before client integration. SQLite remains a future exploration.

See [the project specification](docs/project-spec.md) for the broader draft contract, including planned behavior that is not implemented yet.
