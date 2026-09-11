# Refresh and recovery

For the Docker-only installation, use `./scripts/pulse refresh`, `./scripts/pulse data-status` and `./scripts/pulse validate`. The `make` / `uv` commands below are the equivalent host-development workflow. See [quickstart](quickstart.md).

`make bootstrap` starts local PostGIS/Redis, migrates the schema, registers adapters, acquires due data, builds H3 features and models, validates them, and activates the candidate atomically. The first acquisition requires network access and can take several minutes, particularly the multi-tile Police API. It produces real analysis immediately after completion.

`make refresh` repeats the cadence-aware pipeline. `uv run pulse-data refresh --source osm` checks one source. `--force` requests a rebuild and source checks even before cadence; recently acquired byte-identical downloads may be reused from the checksum-verified asset cache. `make status` and `make validate` report source/model health.

Cadence is seven days for OSM, 90 for structural boundaries/high streets, and 30 for ONS, TfL, VOA and Police. A daily worker evaluates which sources are due. Discovery resolves official publisher assets; URL/reference changes, ETag and Last-Modified identify updates. Without upstream validators, cadence is the fallback. No repeated Overpass queries are used.

## Safety sequence

Discover → atomic raw download → size/type/checksum contract → parse → transactional snapshot rows → H3 features → count models → score/coverage/drift tests → atomic active-version switch. Raw files live under `data/raw/<source>/<snapshot>/`. Receipts and manifests retain resolved URLs and hashes. Source failure is recorded and the previous verified snapshot is returned if available. Critical sources without a prior snapshot stop bootstrap. Feature failure leaves the previous active version intact.

The ingestion job report records unchanged, verified and retained-previous sources, failures, activated version, models and QA. Never delete the previous version before validating a replacement. Score gates include 0–100 bounds, all six profiles/twelve models, both grids/all 33 boroughs, population conservation, source missingness, confidence collapse, median score drift, top-20 retention and large category-supply drops.

`make worker` runs the stoppable local daily loop; `docker compose --profile refresh up -d worker` runs its container. `.github/workflows/refresh.yml` is scheduled daily but deliberately opt-in through repository variable `PULSE_REFRESH_ENABLED=true` and a persistent self-hosted runner labelled `pulse-data`, using database/Redis secrets. This prevents nightly multi-hundred-MB downloads into disposable CI. The local worker works without GitHub credentials.

Token-protected `POST /admin/refresh/all` returns a job ID; `GET /admin/jobs/<id>` returns the report. Administrative endpoints are disabled if ADMIN_TOKEN is empty. FastAPI background jobs do not survive process termination; use the worker or scheduled CLI for durable operations. A crashed job can retain a running status until operator reconciliation; PostgreSQL releases its lock when the process disconnects.

## Reproduction and rollback

Retain raw snapshots and database backups. `uv run python scripts/rebuild_version.py <version>` uses recorded source IDs and original confidence reference time to create a new candidate. Run against the recorded code revision and lockfiles. Compare QA, then `uv run pulse-data activate <candidate>`. To restore a retired version, verify its QA, set its status to validated through an authorised database maintenance session, then activate; application clients cannot mutate versions.

Data Health also flags older reference periods: OSM beyond 30 days, Police beyond 120 days, TfL beyond three years, ONS beyond four years and VOA beyond two years. These operational warnings are separate from continuous source-specific confidence decay; structural boundaries have no automatic expiry. Scheduled self-hosted checkout preserves raw files (`clean: false`).
