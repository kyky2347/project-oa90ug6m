# Run and deploy

## One-command local app

Run `make start` from the repository, or `pulse` from any directory after installing the shortcut described in the README. Only Docker with Compose is needed. The launcher can open OrbStack or Docker Desktop on macOS, builds missing application images, waits for PostGIS/Redis, applies the schema, and bootstraps real data only when there is no active feature version. It then starts the API, website and daily worker, checks the frontend/API health, and opens http://localhost:3000. Existing active data is reused; the worker performs cadence-aware refreshes in the background.

`pulse stop` (or `make stop`) stops this project's containers without removing volumes or downloaded files. `pulse status` lists services; `pulse logs` follows their logs. `pulse --build` rebuilds application images after code changes. `pulse --no-open` skips opening the browser. Startup errors leave existing data intact and can be retried. Keep the terminal open through an initial bootstrap; after the success message, all five services run in the background.

## Local development

Prerequisites: Docker Engine/Desktop, Node 22+, pnpm 11.19.0 and uv with Python 3.12. From the repository root:

```sh
cp .env.example .env
make install
make bootstrap
make dev
```

Open http://localhost:3000; API documentation is http://localhost:8000/docs. If the Docker app is already running, stop its API and web containers before `make dev` so ports are free. PostGIS binds only to loopback port 55433; Redis uses 56380. The dev launcher refuses occupied application ports and only stops its own child processes on Ctrl-C. `make test`, `make integration` after bootstrap, and `make build` verify the installation.

## Container deployment

```sh
make infra
docker compose --profile app build
PULSE_UID=$(id -u) PULSE_GID=$(id -g) docker compose run --rm api /app/.venv/bin/pulse-data bootstrap
make docker-up
```

The API and web images run as non-root users. Compose uses the host UID/GID for the API/worker so immutable raw files and manifests can be written to the local `data` bind mount. Images bundle locked dependencies and self-hosted fonts. The web image uses Next standalone output. `API_INTERNAL_URL` is a web **build argument** because Next rewrites are baked at build time; Compose defaults to `http://api:8000`. For a remote API, rebuild with its internal URL.

Use `docker compose --profile refresh up -d worker` for daily checks, supplying PULSE_UID/PULSE_GID on platforms whose user differs from 1000. Keep Postgres volumes and raw files on persistent storage. Configure backups, authenticated administration, TLS termination, ingress rate limits and resource monitoring before exposing a production service. Keep ADMIN_TOKEN and database URLs in secret environment configuration. Do not expose Redis publicly.

Cloud credentials are optional. A container host with PostgreSQL/PostGIS and Redis can run this stack. No cloud deployment or public service URL is implied by the checked-in configuration. Vercel can host the frontend if an externally reachable FastAPI URL is set at build time, but cannot execute this long-running acquisition pipeline. Optional integrations are documented in the completion report.

## CI

Push/PR workflow runs parser/scoring/frontend tests, PostGIS extension/schema smoke, lint/typecheck, production build and a browser smoke test. It uses small attributed fixtures and makes no official source downloads. Full real-London E2E and database tests run after bootstrap with `PULSE_E2E_REAL=1 pnpm --filter @pulse/web exec playwright test --project=real-london` and `PULSE_INTEGRATION=1 uv run pytest`. CI results and locally executed results are reported separately.
