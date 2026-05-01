This is a fork of [Pingvin Share](https://github.com/stonith404/pingvin-share) by [stonith404](https://github.com/stonith404)

This is for my own use, as such features are removed and changes made to suit me

## Quick start with Docker

```sh
docker compose up -d
```

The default compose file exposes the application on <http://localhost:3000> and
stores data in `./data`.

If you run Gnome Share behind a reverse proxy, set:

```yaml
environment:
  - TRUST_PROXY=true
```

If the reverse proxy terminates HTTPS, also enable secure cookies in the admin
configuration or `config.yaml`:

```yaml
general:
  secureCookies: "true"
```

## Configuration

Most settings can be changed in the admin UI. You can also mount a `config.yaml`
file into `/opt/app/config.yaml`; see `config.example.yaml` for the supported
keys and defaults.

When a config file is present, UI editing is disabled for those settings.

## Development

Requirements:

- Node.js 20 or newer (CI uses Node.js 24)
- npm

Backend:

```sh
cd backend
npm ci
DATABASE_URL='file:./data/gnome-share.db?connection_limit=1' npx prisma generate
npm run build
```

Frontend:

```sh
cd frontend
npm ci
npm run build
```

### Config example generation

`scripts/generate-example-config.ts` regenerates `config.example.yaml` from the
static config metadata in `backend/prisma/seed/config-variables.ts`.

Regenerate the example config after changing config defaults or descriptions:

```sh
cd scripts
npm ci
npm run generate-example-config
```

**Important:** The `scripts` CI job installs only the `scripts` package
dependencies — it does **not** run `backend npm ci`, build the backend, or run
`prisma generate`. This means `backend/src/generated/prisma/client` is not
present when the script runs.

To keep `scripts/generate-example-config.ts` importable from that environment,
`backend/prisma/seed/config-variables.ts` must stay safe to import without any
generated backend artifacts. Specifically it must only contain:

- Static config metadata (`configVariables` export)
- Local structural type definitions
- Standard-library imports (e.g. `crypto`)

Do **not** add any of the following to `config-variables.ts`:

- `import … from "../../src/generated/prisma/client"` (generated, requires
  `prisma generate`)
- Instantiate `PrismaClient` or read from the database
- Run seed or backend startup side effects

Executable seed logic (database writes, migrations) belongs in
`backend/prisma/seed/config.seed.ts`, which is not imported by the scripts job.

## Testing and CI

CI builds the backend and frontend, runs high-severity npm audits, and verifies
that `config.example.yaml` matches the generated config defaults.

## Migrating from Pingvin Share

If you are upgrading from a Pingvin Share installation, the database file
`pingvin-share.db` will be automatically renamed to `gnome-share.db` on first
startup (as long as `DATABASE_URL` is not explicitly set).

If the automatic rename did not work for any reason, manually rename the file
before starting the application:

```sh
mv data/pingvin-share.db data/gnome-share.db
# Also rename auxiliary database files if they exist:
mv data/pingvin-share.db-wal data/gnome-share.db-wal 2>/dev/null || true
mv data/pingvin-share.db-shm data/gnome-share.db-shm 2>/dev/null || true
mv data/pingvin-share.db-journal data/gnome-share.db-journal 2>/dev/null || true
```
