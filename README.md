# Gnome Share

Gnome Share is a small self-hosted file sharing application for personal use. It
lets you upload files, create expiring share links, protect shares with passwords
or view limits, and optionally notify recipients by email.

This project is a fork of
[Pingvin Share](https://github.com/stonith404/pingvin-share) by
[stonith404](https://github.com/stonith404). It has been simplified for one
English-language deployment and intentionally does not include LDAP, S3 storage,
or permanent shares.

## Features

- Local-disk file storage for a single VM/container.
- Expiring share links with optional password and maximum-view protection.
- Reverse shares for collecting files from other people.
- Admin UI for users, shares, and configuration.
- Optional SMTP notifications.
- Optional OAuth/OIDC login and TOTP two-factor authentication.
- Optional ClamAV scanning when configured.

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
npm run test:unit
```

Frontend:

```sh
cd frontend
npm ci
npm run build
```

Regenerate the example config after changing config defaults or descriptions:

```sh
cd scripts
npm ci
npm run generate-example-config
```

## Testing and CI

CI builds the backend and frontend, runs high-severity npm audits, and verifies
that `config.example.yaml` matches the generated config defaults.

Backend unit tests are additive and live in `backend/test/*.spec.ts`. Existing
Newman system tests remain in `backend/test/newman-system-tests.json`.

## Migrating from Pingvin Share

If you are upgrading from a Pingvin Share installation, the database file
`pingvin-share.db` will be automatically renamed to `gnome-share.db` on first
startup as long as `DATABASE_URL` is not explicitly set.

If the automatic rename did not work for any reason, manually rename the file
before starting the application:

```sh
mv data/pingvin-share.db data/gnome-share.db
# Also rename auxiliary database files if they exist:
mv data/pingvin-share.db-wal data/gnome-share.db-wal 2>/dev/null || true
mv data/pingvin-share.db-shm data/gnome-share.db-shm 2>/dev/null || true
mv data/pingvin-share.db-journal data/gnome-share.db-journal 2>/dev/null || true
```

## License

See `LICENSE`.
