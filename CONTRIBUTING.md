# Contributing to PULSE

PULSE combines a data pipeline, statistical models and a product interface. A useful contribution makes an investigation more reliable or easier to understand.

## Development setup

Use Python 3.12 with uv, Node 22+ and pnpm 11.19.0. Docker provides PostGIS and Redis. From the repository root:

```sh
cp .env.example .env
make install
make infra
```

For the full product, run `make bootstrap` once and `make dev`. Stop the container application with `./scripts/pulse stop` before host development so API/web ports are free. For offline code work, the small fixtures are sufficient; do not download London just to run unit tests.

## Checks

```sh
uv run ruff check .
uv run pytest -m 'not integration'
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
uv run python scripts/check_docs.py
pnpm --filter @pulse/web exec playwright install chromium
pnpm --filter @pulse/web exec playwright test --project=smoke
```

After bootstrap, run `make integration` and the real-London browser project described in [reproducibility](docs/reproducibility.md). CI runs independently from a clean checkout and retains browser reports. Tests that require the actual warehouse must not silently switch to fixtures.

Use `uv run ruff format <changed-python-files>` and `pnpm exec prettier --write <changed-frontend-files>` for formatting. `pnpm format:docs` formats the public Markdown documentation. Keep formatting changes scoped to the work.

## Engineering agreements

- Never fabricate public data, benchmarks or API evidence. Synthetic values belong only in labelled tests.
- A source adapter needs attribution, provenance and fixture tests, including missing or changed upstream fields.
- Scoring changes require tests and methodology/version updates. Keep canonical calculations in the backend.
- PostGIS is canonical storage; H3 is the analysis grid; Redis can be discarded.
- Preserve active data on failure and record the inputs and code for every feature version.
- Treat rateable value, typical-day transport, approximate crime coordinates and radial catchments according to their documented limits.
- Do not use protected demographic attributes in scoring.
- Update both English and Chinese UI copy for interface changes. Keep source identifiers and geographic names intact.
- Inspect substantial interface changes in a browser at desktop and mobile sizes. Attach relevant screenshots and describe the state shown.

## Pull requests

Explain the concrete problem, the resulting behaviour and the checks you actually ran. For analytical changes, include the feature/source version and explain any changed assumptions. Link the issue when relevant and keep the PR focused enough to review.

Report source failures with the adapter, retrieval time and redacted error. Include steps, expected behaviour and actual behaviour for product bugs. Do not include tokens, personal information, full raw datasets or database backups.

[Security reporting](SECURITY.md) · [Data licences](docs/data-licenses.md) · [Architecture](docs/architecture.md)
