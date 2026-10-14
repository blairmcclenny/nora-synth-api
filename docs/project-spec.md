# Synth Preset API

Status: draft specification · Updated October 13, 2026

## Goal

Build a standalone backend API using Hono that lets a synth save and recall presets. A preset is a named snapshot of all nine synth parameters. The synth client handles audio generation and applies the saved values; the API validates and persists them.

The main learning goal is to complete this standalone API. Frontend construction
and synth integration are deferred until the API lessons are finished.

## Confirmed requirements

- Hono backend, independently deployable from the synth interface.
- PostgreSQL for preset persistence.
- Saving presets is the primary feature.
- Parameters: filter, mood, movement, space, expression, attack, decay, sustain, release.

## Proposed MVP decisions

These are starting assumptions, open to revision:

- TypeScript with Hono on Node.js, using npm.
- JSON REST API under `/v1`.
- A single shared preset library in the current local prototype. The next phase is a private MVP with authentication and a stable owner identity, designed for eventual multiple users. Decide the credential mechanism and migrate existing records to an explicit owner before remote deployment.
- Every parameter is a normalized number from `0` to `1`, inclusive. The synth maps these values to its audio engine. Attack, decay, and release are normalized controls rather than seconds in this draft.
- No implicit parameter defaults when saving: the client must supply a complete snapshot.

## Parameter contract

| Parameter | Type / range | Intended role, pending synth design |
| --- | --- | --- |
| `filter` | number, 0–1 | Filter control; exact mapping to be defined |
| `mood` | number, 0–1 | Tonal character macro |
| `movement` | number, 0–1 | Modulation or motion macro |
| `space` | number, 0–1 | Spatial effects macro |
| `expression` | number, 0–1 | Expressive response macro |
| `attack` | number, 0–1 | Envelope attack control |
| `decay` | number, 0–1 | Envelope decay control |
| `sustain` | number, 0–1 | Envelope sustain level |
| `release` | number, 0–1 | Envelope release control |

The API stores values without interpreting their sound. Before implementing the client integration, document each control's mapping and endpoints. Preserve those meanings within a parameter schema version; introduce a new version if they change incompatibly.

## Preset model

```json
{
  "id": "5d02b735-1d40-4c88-84c1-252b1f9c8c43",
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
  },
  "createdAt": "2026-09-14T12:00:00.000Z",
  "updatedAt": "2026-09-14T12:00:00.000Z"
}
```

- Server generates UUID identifiers and UTC timestamps.
- Names are trimmed, nonempty, and limited to 100 characters. Duplicate names are allowed; IDs identify presets.
- `schemaVersion` describes the parameter contract, independently of the `/v1` API version. Initially only `1` is accepted.
- Reject unknown fields, missing parameters, numeric strings, nulls, and out-of-range values. Do not silently clamp or coerce values.
- Creation and replacement requests contain only `name`, `schemaVersion`, and `parameters`.

## API contract

| Method | Route | Behavior | Success |
| --- | --- | --- | --- |
| POST | `/v1/presets` | Save a new complete preset | 201, full preset |
| GET | `/v1/presets` | List saved presets | 200, list envelope |
| GET | `/v1/presets/:id` | Recall one preset | 200, full preset |
| PUT | `/v1/presets/:id` | Replace name and complete parameter snapshot | 200, full preset |
| DELETE | `/v1/presets/:id` | Delete one preset | 204, no body |
| GET | `/health` | Report service liveness | 200, `{"status":"ok"}` |

POST returns a `Location` header pointing to the created resource. PUT preserves `id` and `createdAt`, and advances `updatedAt`; it does not create missing resources. Initial update behavior is last successful write wins.

List query parameters: `limit` (default 50, range 1–100) and `offset` (default 0, nonnegative integer). Return `{"items": [...], "limit": 50, "offset": 0, "total": 1}` with full preset objects, ordered by `updatedAt` descending and then `id` ascending.

### Save request

`POST /v1/presets` with `Content-Type: application/json`:

```json
{
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
}
```

### Errors

Use a consistent JSON error envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Preset contains invalid values.",
    "details": [
      { "path": "parameters.filter", "message": "Must be a number between 0 and 1." }
    ]
  }
}
```

Return 400 for malformed JSON, invalid IDs, invalid query parameters, or invalid preset data; 404 for missing resources; 415 for unsupported request content types; and 500 for unexpected server errors. Omit internal error details from responses. Failed validation must never change stored data.

## Backend structure

```text
src/
  app.ts                  Hono app and shared error handling
  server.ts               Runtime-specific startup
  routes/presets.ts       HTTP endpoints
  schemas/preset.ts       Request validation and shared types
  repositories/presets.ts Database reads and writes
  db/                     Connection and migrations
```

Use one validation schema as the source for request validation and TypeScript types. Hono supports validation middleware, including integration with Zod. See [Hono validation](https://hono.dev/docs/guides/validation) and [routing](https://hono.dev/docs/api/routing).

Persist each preset in PostgreSQL in a `presets` table with these columns:

| Columns | PostgreSQL type | Constraints |
| --- | --- | --- |
| `id` | UUID | Primary key |
| `name` | text | NOT NULL |
| `schema_version` | integer | NOT NULL |
| `filter`, `mood`, `movement`, `space`, `expression` | double precision, one column per parameter | NOT NULL; each value between 0 and 1 |
| `attack`, `decay`, `sustain`, `release` | double precision, one column per parameter | NOT NULL; each value between 0 and 1 |
| `created_at`, `updated_at` | timestamp with time zone | NOT NULL |

Use a separate numeric column for each of the nine parameters, with a database CHECK constraint enforcing its range in addition to API validation. The 0–1 ranges remain provisional until parameter units are confirmed.

The API continues to group these values inside the `parameters` object in JSON requests and responses. The repository maps that object to and from the individual database columns.

Store the complete parameter snapshot atomically. Keep PostgreSQL migrations in source control. A successful save response must follow a committed database write.

Configure the database connection through `DATABASE_URL`. Select the PostgreSQL driver and connection pooling approach in the database lesson, considering the deployment environment.

## Main user flow

1. The user adjusts the synth and enters a preset name.
2. The client sends all nine current values to POST.
3. The API validates, commits, and returns the stored preset.
4. The client displays confirmation only after success and retains current settings if saving fails.
5. On recall, the client fetches the preset and applies all nine values together.
6. Saving changes to an existing preset uses PUT; “Save as new” uses POST.

## Acceptance criteria

- Save and retrieve a preset with all nine values unchanged.
- Restart the service and retrieve previously saved presets.
- List, replace, and delete presets by ID.
- Accept boundary values 0 and 1; reject incomplete or invalid snapshots without writing.
- Return consistent errors for malformed requests and missing presets.
- Preserve creation timestamps during replacement.
- Keep separate presets even when their names match.

## Scope after MVP

User accounts and private libraries, tags and search, favorites, public sharing, import/export, revision history, and audio previews can follow the core save-and-recall workflow.

Explore SQLite separately at a later point; PostgreSQL is the database for this project.

## Decisions to resolve next

Prioritize authentication, ownership, and hosting. The private MVP should preserve
a path to multiple users: derive owner identity from verified credentials and
scope every preset operation to that owner. Engine mappings remain deferred until
frontend integration.

1. Are all nine controls continuous 0–1 values, or do any need physical units or discrete options?
2. Which deployment environment will host the Node.js service?
3. Is the preset library personal, shared, or private per user?
4. What do the macro controls mean, and which synth engine version defines their mapping?

## Implementation sequence

1. Confirm parameter units and library ownership.
2. Scaffold Hono and implement schema validation.
3. Add PostgreSQL connectivity, migrations, and preset CRUD endpoints.
4. Verify persistence, round-trip values, and error behavior.
5. Finish missing-resource, rejected-update persistence, and safe server-error tests.
6. Add tracked migrations and document the implemented contract with OpenAPI.
7. Validate configuration, distinguish readiness from liveness, and verify shutdown
   and persistence across service restarts.
8. Resolve authentication, ownership, and hosting before remote deployment; document
   and verify the chosen deployment workflow.
9. Later, build the synth client and connect its save, list, and recall controls.
