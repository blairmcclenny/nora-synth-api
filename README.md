# Nora Synth API

A standalone Hono API for saving, listing, recalling, renaming, and deleting synth presets, built with TypeScript, Node.js, Drizzle ORM, Zod OpenAPI, and PostgreSQL.

The private API is deployed at <https://nora-synth-api.onrender.com>.
For operation with Render Free and Neon Free, follow the
[deployment guide](docs/deployment.md). The root `render.yaml` defines the API
service; migrations run separately before manual releases.

## Local setup

Requires Node.js 24 or newer, npm, and Docker Desktop. Local PostgreSQL runs
in the existing `nora-postgres` container (`postgres:18`); use its bundled
administrative clients rather than installing host `psql`/`createdb` or starting
host PostgreSQL services. Node's `pg` driver runs on the host and connects through
the container's published `127.0.0.1:5432` port.

```sh
npm install
docker info --format '{{.ServerVersion}}'
docker inspect nora-postgres --format 'image={{.Config.Image}} status={{.State.Status}} ports={{json .NetworkSettings.Ports}}'
```

If `docker info` cannot reach the daemon, open Docker Desktop and wait until its
engine is running. If the existing container is stopped, run
`docker start nora-postgres`, then check readiness:

```sh
docker exec nora-postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d postgres'
```

Reuse this container; do not recreate it or reset its databases. Inspect only the
selected fields above, since a full container inspection can expose credentials.

### Databases and migrations

The established databases are `nora_synth` for development and `nora_synth_test`
for persistence tests. Keep their separate connection strings in the ignored
project-root `.env` (the following values are placeholders):

```dotenv
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nora_synth
TEST_DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/nora_synth_test
AUTH_SECRET=REPLACE_WITH_A_LONG_RANDOM_SECRET
AUTH_OWNER_ID=private-mvp-owner
```

Preserve existing credentials; never print or commit `.env` or actual connection
URLs. The application reads `DATABASE_URL`; persistence tests use
`TEST_DATABASE_URL` and require its database name to be `nora_synth_test`.
Each test creates disposable records and deletes them in a `finally` block.
Database tests must never clean up development data.

Check which databases already exist with the container's `psql`:

```sh
docker exec nora-postgres sh -c 'psql -X -U "$POSTGRES_USER" -d postgres -v ON_ERROR_STOP=1 -c "SELECT datname FROM pg_database WHERE datname IN ('"'"'nora_synth'"'"', '"'"'nora_synth_test'"'"') ORDER BY datname;"'
```

Only if a database is missing, create that database using the container's
configured role. For example, to create a missing test database:

```sh
docker exec nora-postgres sh -c 'createdb -U "$POSTGRES_USER" nora_synth_test'
```

Use `nora_synth` instead to create a missing development database.

### Tracked migrations

Drizzle ORM runs preset queries through the existing `pg` pool.
`src/db/schema.ts` maps the existing table, constraints, and index for typed queries.
The numbered SQL migrations and their existing runner remain the authority for
schema changes; keep the Drizzle table definition in sync when adding a migration.
Drizzle Kit is not configured.

The migration runner records filenames and application times in
`schema_migrations`, applies pending `.sql` files in filename order, and skips
applied files. Each migration and its history entry run in one transaction. A
failure rolls back that migration and stops; prior successes remain committed.
A database advisory lock prevents concurrent runners from applying the same file.

Inspect the existing tables before running migrations:

```sh
docker exec nora-postgres sh -c 'psql -X -U "$POSTGRES_USER" -d nora_synth -c "\dt"'
docker exec nora-postgres sh -c 'psql -X -U "$POSTGRES_USER" -d nora_synth_test -c "\dt"'
```

For a fresh database, or one already using tracked migrations:

```sh
npm run db:migrate
npm run db:migrate:test
```

The development command uses `DATABASE_URL`. The test command uses
`TEST_DATABASE_URL` and requires the database name `nora_synth_test`.

For an existing
database that has `presets` but no history, use explicit adoption once:

```sh
npm run db:migrate -- --adopt-existing
npm run db:migrate:test -- --adopt-existing
```

Adoption compares columns, types, nullability, defaults, the primary key, and
constraints with a temporary reference created from the initial migration. Only
an exact match is recorded as applied; existing preset data is preserved. A
mismatch stops for investigation. The temporary reference is dropped, and the
initial migration is never rerun against the existing table. Subsequent pending
migrations still execute normally.

The ownership migration (`002_add_preset_owners.sql`) adds a required owner ID
and an index for owner-scoped listing. Before applying it to a database with
existing presets, set `AUTH_OWNER_ID` to the stable identity that should own
those records. The runner passes this value into the migration transaction.
Without an explicit identity, migration of existing records rolls back. Fresh,
empty databases can apply it without a backfill identity. No owner default is
retained: new presets must always have an explicit server-supplied owner.

Keep applied SQL files unchanged and add a new numbered migration for each
schema change. The runner rejects missing applied files but does not checksum
file contents. Migration files must contain SQL without their own transaction
commands. For the compiled runner, `npm run build` copies SQL into
`dist/db/migrations`; run `node --env-file=.env dist/db/migrate.js` locally.

Set `AUTH_SECRET` and `AUTH_OWNER_ID` in your ignored `.env` before starting the server. The secret must be nonempty and contain no whitespace; the owner ID must be nonempty with no surrounding whitespace. Startup rejects invalid configuration. Never commit real secrets.

Start the development server:

```sh
npm run dev
```

This command loads `.env`, watches source files, and restarts the server when they change. The server listens on `127.0.0.1:3000`. Stop it with Ctrl+C.

On SIGINT (Ctrl+C) or SIGTERM, the server stops accepting new connections,
lets active HTTP requests finish, then closes the PostgreSQL pool and exits with
code 0. Repeated signals share the same shutdown sequence. Listener or pool
cleanup failures exit with code 1. A 10-second deadline covers both request
draining and pool cleanup; if it expires, remaining HTTP connections are closed
and the process exits with code 1. Give the process more than 10 seconds before
an external supervisor forcibly terminates it. A forced exit may interrupt work.

Presets live in PostgreSQL and survive API process restarts. `npm run test:db`
verifies this by saving a disposable preset through a real HTTP server, sending
SIGTERM, restarting on the same port, and comparing the full recalled preset.
It also checks a clean SIGINT exit and removes only its own fixture. PostgreSQL
itself stays running during this check.

In another terminal:

```sh
curl -i "http://localhost:3000/health"
```

Expect HTTP 200 and `{"service":"nora-synth-api","status":"ok"}`. The health route reports service liveness; it does not query the database. `DATABASE_URL` is still required at application startup.

`GET /ready` is also public and requires no authorization header. It runs
`SELECT 1` and returns HTTP 200 with
`{"service":"nora-synth-api","status":"ready"}` when PostgreSQL responds.
Connection or query failures return HTTP 503 with a generic `NOT_READY` error;
subsequent probes can recover. Connection acquisition and queries each have a
3-second timeout (a probe can take both intervals). Readiness checks connectivity,
not migration state. `/health` continues returning 200 during database outages.

Startup validates `DATABASE_URL` as a PostgreSQL URL with a host and database
name, plus the authentication settings. Optional `HOST` defaults to `127.0.0.1`
and accepts a hostname or IPv4 address; optional `PORT` defaults to `3000` and
must be an integer from 1 to 65535. Invalid settings stop startup before listening.
For hosting, set `HOST=0.0.0.0` when external connections are required. The shared
pool applies 3-second connection, client query, and server statement timeouts
to all database operations. No migration runs automatically at startup.

The [OpenAPI 3.1 specification](docs/openapi.json) documents all implemented
endpoints, request and response schemas, authentication, and errors. Import it
into an OpenAPI viewer or API client to explore the contract. Validate it locally
with `npm run openapi:validate` (no server or database required).

The specification is generated from `src/openapi.ts` and the shared Zod schemas
in `src/schemas/preset.ts`. Edit those sources, then run
`npm run openapi:generate`; do not edit the JSON artifact by hand. Validation
checks both OpenAPI structure and whether the artifact matches the sources.
`OpenAPIHono` uses these same route definitions for request validation. For
PATCH and PUT, rejection order is authentication, Content-Type, UUID, then body.
When both UUID and body are invalid, the UUID error takes precedence.

## Available endpoints

| Method | Route | Behavior | Success |
| --- | --- | --- | --- |
| GET | `/health` | Report service liveness | 200 |
| GET | `/ready` | Check database connectivity | 200 or 503 |
| POST | `/v1/presets` | Save a complete preset | 201, full preset and `Location` header |
| GET | `/v1/presets` | List presets with pagination | 200, `{ items, limit, offset, total }` |
| GET | `/v1/presets/:id` | Retrieve a preset by UUID | 200, full preset |
| PATCH | `/v1/presets/:id` | Rename a preset by UUID | 200, full preset |
| PUT | `/v1/presets/:id` | Replace a complete preset | 200, full preset |
| DELETE | `/v1/presets/:id` | Delete a preset by UUID | 204, no response body |

Renaming and complete preset replacement with PUT are supported. PUT accepts the same complete body as POST and returns 200, or 404 for a missing preset. Every preset endpoint requires `Authorization: Bearer <AUTH_SECRET>`. The server maps this secret to the stable `AUTH_OWNER_ID`; keep that ID unchanged when rotating the secret. Missing or invalid credentials return a generic JSON 401 with `UNAUTHORIZED` before validation or database access. `/health` remains public. Every preset operation, including listing and its total count, is scoped to the trusted owner ID; ownership never comes from the request body. Inaccessible presets return 404.

### Ownership and secret rotation

`AUTH_OWNER_ID` identifies the owner in storage. Keep it stable: changing it makes
the server access a different library; it does not transfer existing presets.
To rotate credentials, replace only `AUTH_SECRET` and restart the server. The old
secret then returns 401, while the new secret retains access to the same presets.
The current server supports one configured identity at a time; two-identity tests
use separate app instances sharing the same test database.

POST, PUT, and PATCH reject caller-supplied `ownerId` fields. Preset responses
keep the existing public shape, without exposing an owner field. Reads and writes
for another owner's preset return the same 404 envelope as a missing preset.
Listing and its total count include only the authenticated owner's records.

### Save a preset

The curl examples assume `AUTH_SECRET` is exported in your shell. The server
reads `.env`, but curl does not load it automatically. Headers are supplied through
standard input to keep the expanded secret out of curl process arguments. Never
paste a literal secret into these examples, enable shell tracing, or use verbose
HTTP logging with credentials. Use HTTPS for the hosted API; the HTTP examples
below target only the local loopback server.

```sh
curl -i "http://localhost:3000/v1/presets" \
  -H @- \
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
  }' <<EOF
Authorization: Bearer $AUTH_SECRET
EOF
```

The response includes a server-generated UUID, `createdAt`, and `updatedAt`. Duplicate names are allowed.

Names are trimmed and must contain 1–100 characters. `schemaVersion` must be `1`. All nine parameters are required and must be numbers from 0 to 1 inclusive. Unknown fields are rejected. PostgreSQL stores each parameter in its own column with a range constraint; JSON groups the values inside `parameters`.

### List and recall presets

```sh
curl -i -G "http://localhost:3000/v1/presets" \
  -H @- \
  --data-urlencode "limit=1" \
  --data-urlencode "offset=0" <<EOF
Authorization: Bearer $AUTH_SECRET
EOF
```

`limit` defaults to 50 and must be an integer from 1 to 100. `offset` defaults to 0 and must be a nonnegative integer. Query values are converted to numbers and validated by Zod middleware.

Results are ordered by `updated_at` descending, then `id` ascending. `total` counts all saved presets, independently of the requested page. An empty page returns `items: []`.

To recall a preset, replace `PRESET_ID` with the UUID returned when saving or listing:

```sh
curl -i "http://localhost:3000/v1/presets/PRESET_ID" \
  -H @- <<EOF
Authorization: Bearer $AUTH_SECRET
EOF
```

Invalid preset data, IDs, or pagination values return HTTP 400 with a `VALIDATION_ERROR` JSON error envelope. Malformed JSON returns 400 with `INVALID_JSON`; a valid but missing preset ID returns 404 with `NOT_FOUND`. Unexpected server errors return 500 with `INTERNAL_ERROR` without exposing internal details.

### Rename a preset

Replace `PRESET_ID` with an existing preset's UUID:

```sh
curl -i -X PATCH "http://localhost:3000/v1/presets/PRESET_ID" \
  -H @- \
  -H "Content-Type: application/json" \
  -d '{"name":"Soft Motion II"}' <<EOF
Authorization: Bearer $AUTH_SECRET
EOF
```

The body must contain only `name`, which is trimmed and must contain 1–100 characters. A successful rename returns HTTP 200 with the full preset and updates `updatedAt`. The ID, creation timestamp, schema version, and synth parameters remain unchanged.

Invalid names, extra fields, or invalid UUIDs return 400 with `VALIDATION_ERROR`. Body validation errors include a `details` array with field paths and messages. Malformed JSON returns 400 with `INVALID_JSON`. A valid but missing preset ID returns 404 with `NOT_FOUND`; renaming does not create a preset.

### Delete a preset

Replace `PRESET_ID` with the UUID of a preset you want to delete:

```sh
curl -i -X DELETE "http://localhost:3000/v1/presets/PRESET_ID" \
  -H @- <<EOF
Authorization: Bearer $AUTH_SECRET
EOF
```

A successful deletion returns HTTP 204 with no response body. Recalling that preset or deleting the same ID again returns 404 with `NOT_FOUND`. An invalid UUID returns 400 with `VALIDATION_ERROR`. Errors use the same `{ "error": { "code": "...", "message": "..." } }` envelope as the other routes.

## Commands and checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Load `.env` and start the server with automatic restarts |
| `npm test` | Run schema validation and HTTP rejection tests without PostgreSQL |
| `npm run test:db` | Load `.env` and run repository and HTTP persistence tests against `nora_synth_test` |
| `npm run db:migrate` | Apply pending development database migrations |
| `npm run db:migrate:test` | Apply pending test database migrations |
| `npm run openapi:generate` | Regenerate the OpenAPI JSON artifact from route schemas |
| `npm run openapi:validate` | Validate OpenAPI structure and check the artifact is current |
| `npm run typecheck` | Check TypeScript types without generating files |
| `npm run build` | Compile TypeScript and copy SQL migrations into `dist/` |
| `npm start` | Run the compiled server; requires `DATABASE_URL`, `AUTH_SECRET`, and `AUTH_OWNER_ID` in the environment |

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

These database scripts are manual development checks. Automated tests run separately:

```sh
npm test
npm run test:db
npm run typecheck
```

`npm test` covers schema validation, health, and HTTP rejection behavior without
querying PostgreSQL. The shutdown test opens an ephemeral loopback HTTP port. `npm run test:db` requires the Docker
database to be running, `TEST_DATABASE_URL` in `.env`, and all tracked migrations
applied to `nora_synth_test`. It verifies create/read, complete replacement, and
delete behavior through the repository, including cleanup of disposable records.
HTTP persistence tests in `src/app.persistence.test.ts` also verify POST creation
with its `Location` header, GET recall, and PATCH rename followed by GET. The
rename test checks that ID, creation timestamp, schema version, and parameters
remain unchanged, then compares the full recalled preset with the PATCH response.
HTTP persistence tests also cover complete PUT replacement with preserved ID and
creation timestamp, list defaults and pagination, total counts and empty pages,
and ordering by update timestamp with the UUID tie-breaker. Dedicated deletion
coverage checks HTTP 204 with no body, followed by GET and repeated DELETE
returning 404 with the error envelope. Every test cleans up only its disposable
records in `finally`. Database test files run sequentially so their writes do not
interfere with list totals. Neither test command requires the development server
to run.

## Project structure

```text
src/
  app.ts                  Typed route handlers and shared error responses
  openapi.ts              Route contracts and OpenAPI generation
  server.ts               HTTP server startup and shutdown
  schemas/preset.ts       Zod schemas for preset data and pagination
  types/preset.ts         Inferred input types and preset result types
  repositories/presets.ts Drizzle queries and database-to-JSON mapping
  db/
    pool.ts               PostgreSQL connection pool
    client.ts             Drizzle client using the existing pool
    schema.ts             Typed table, constraints, and index
    migrations/           Numbered SQL migrations
    migrate.ts            Migration command
    migration-runner.ts   Transactional migration execution and adoption
    check*.ts             Manual database checks
```

## Roadmap

Complete a standalone preset API with authentication and ownership designed for
eventual multiple users. The initial MVP supports one configured identity.
The private API is deployed and verified; synth client integration is future work.

- [x] Start Hono and respond to a health request.
- [x] Define a preset and validate requests with Zod.
- [x] Connect PostgreSQL and write the first migration.
- [x] Save a preset with POST and retrieve it with GET.
- [x] List presets with validated pagination and a total count.
- [x] Delete presets by ID with validation and missing-preset handling.
- [x] Rename presets with PATCH, validation, and missing-preset handling.
- [x] Update complete preset parameter snapshots with PUT.
- [x] Add focused automated tests for validation and repository persistence.
- [x] Test successful HTTP preset creation and recall against the test database.
- [x] Test successful HTTP rename, preserved fields, and persisted recall.
- [x] Test successful HTTP replacement, listing, and deletion behavior.
- [x] Test missing-resource GET, PATCH, and PUT responses.
- [x] Verify rejected updates leave persisted presets unchanged.
- [x] Test safe HTTP 500 responses without exposing internal error details.
- [x] Add a migration runner that tracks and applies pending SQL migrations.
- [x] Choose MVP authentication and implement verified caller identity.
- [x] Add the ownership migration and scope every operation to the authenticated owner.
- [x] Verify two identities cannot access each other's presets.
- [x] Document requests, responses, and errors in an OpenAPI specification.
- [x] Validate startup configuration and distinguish database readiness from liveness.
- [x] Verify graceful shutdown and persistence across service restarts.
- [x] Choose API hosting and managed PostgreSQL; configure HTTPS, secrets, and backups.
- [x] Document and verify the chosen deployment workflow.

Authentication and ownership are complete, including both local database migrations.
Startup validation, database readiness, graceful shutdown, and restart persistence
are verified. Hosted deployment, idle recovery, and backup restoration are also
verified; see the deployment guide for the dated results and ongoing operations.

Frontend work comes later: map synth controls to normalized values, then connect
save, list, and recall to the completed API.

The API currently enforces normalized 0–1 values, including the envelope controls. Document how those values map to the synth engine before client integration. SQLite remains a future exploration.

See [implementation status and next steps](docs/next-task.md) for completed
capabilities and future work.

See [the project specification](docs/project-spec.md) for the broader draft contract, and planned client integration.
