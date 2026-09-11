# PULSE · Urban Opportunity Intelligence

**The city already knows where your next store should be. Ask the map.**

London commercial location screening from real, automatically acquired public data. Explore 3D H3 opportunities for coffee shops, bakeries, restaurants, gyms, convenience stores and coworking spaces. Inspect the evidence, adjust the profile, compare two areas and investigate a shortlist.

![PULSE London landing](docs/screenshots/landing-1440.png)

PULSE identifies areas worth investigating. It does not guarantee commercial success.

## Start locally

Requires Docker, Node 22+, pnpm 11.19.0 and uv/Python 3.12. No cloud account, API key, file upload or proprietary data is required.

```sh
cp .env.example .env
make install
make bootstrap
make dev
```

Open [PULSE](http://localhost:3000) and [API documentation](http://localhost:8000/docs). Bootstrap acquires the real sources, validates them and activates the London model; initial download time depends on the publishers. Raw files are retained locally and ignored by Git. Rerunning bootstrap preserves and reuses verified snapshots.

```sh
make status       # active version and source snapshots
make refresh      # cadence-aware source checks and safe activation
make worker       # optional daily local refresh loop
make test         # offline parser/scoring/frontend tests + lint/types
make integration  # actual PostGIS and API tests after bootstrap
make build        # Next production build
make docker-up    # complete API + web + PostGIS + Redis stack
```

For full browser regression, run the app, then:

```sh
PULSE_E2E_REAL=1 pnpm --filter @pulse/web exec playwright test --project=real-london
```

## The experience

- A cinematic London map with extruded H3 cells, hover, camera focus, 2D/3D, zoom and component layers.
- Six **PULSE default business profiles**, editable weights, confidence filtering and deterministic top opportunities.
- Site evidence: six scores, reconciled contribution waterfall, expected versus mapped supply, surrounding venues, transport, cost pressure, dates and confidence factors.
- Site Battle with current-weight totals, component comparisons, tradeoff explanations and CSV/JSON export.
- City Pulse from official TfL quarter-hour typical-day estimates, with weekday, Saturday and Sunday playback. Only transport influence changes over time.
- Explicit radial walking-time proxies at 5/10/15 minutes, population, mapped competition, complementary venues, operational/cost context and score distributions.
- Separate competitive-gravity and complementary-venue layers. Persistent device shortlist and shareable location/view links.
- Data Health, Methodology and About pages, responsive layouts and accessible controls.

![PULSE 3D London map and selected-site evidence](docs/screenshots/selected-site-1440.png)

## Actual London data

Seven verified adapters: ONS/GLA LSOA2021 geography, ONS mid-2024 population and Census2021 households, Geofabrik/OpenStreetMap September2026 extract, TfL NUMBAT2025 released in 2026, Police May–July2026 incidents, VOA/HMRC2026 rateable-value bands and GLA high-street boundaries.

The warehouse covers all **33 London boroughs**, **4,994 LSOAs**, **2,579 H3-8 cells** and **17,340 H3-9 cells**. Twelve count models produce 119,514 business/cell opportunity scores. Exact source IDs, timestamps, licences, checksums and model metrics are in [verified sources](docs/data-sources.md) and [release-data.json](docs/release-data.json).

No synthetic data enters production. Small real excerpts and explicitly test-only values exercise parser and UI contracts.

## How the model works

```mermaid
flowchart LR
  A[Official source discovery] --> B[Guarded downloads and checksums]
  B --> C[Versioned PostGIS snapshots]
  C --> D[H3 area allocation and spatial features]
  D --> E[Spatially validated supply models]
  E --> F[Six components and confidence shrinkage]
  F --> G[Validation gates and atomic activation]
  G --> H[FastAPI and Redis]
  H --> I[MapLibre and deck.gl]
```

`Opportunity = 50 + confidence × (Σ weight × component − 50)`.

White space compares model-expected supply with mapped supply using a variance-standardised residual. Poisson/Negative Binomial models use four geographic folds with an 800m exclusion buffer and training-only preprocessing. Explanations are deterministic decompositions of the actual calculation. Confidence is a data-quality index, not a probability of success.

## Repository

```text
apps/web          Next.js, TypeScript, Tailwind, shadcn, MapLibre/deck.gl
apps/api          FastAPI, query validation, caching and spatial evidence
pipeline/sources  Discovery, download contracts and seven source adapters
pipeline/features H3, area allocation, features and activation gates
pipeline/models   Interpretable count models and spatial validation
packages/scoring  Canonical profiles, normalisation and score explanations
infra/postgres    PostGIS schema and indexes
scripts           Launch, fixtures, replay, reporting and real benchmarks
tests             Python unit, parser and real-warehouse integration tests
data/manifests    Download provenance and refresh reports
docs              Methodology, runbooks and verification evidence
```

## Verification and limits

Actual timings, test outcomes and browser screenshots are in [the completion report](docs/completion-report.md) and [performance measurements](docs/performance.md). CI validates offline fixtures, the PostGIS schema, frontend logic, a production build and a browser smoke test; full London journeys use the local bootstrapped warehouse.

Mapped supply is incomplete; demand is a proxy; rateable value is not rent; police locations are approximate; catchments are radial, not street-network isochrones. H3 cells may contain water, parks and mixed land uses. The detailed coworking model did not outperform its simple spatial-validation baseline. [Read all limitations](docs/methodology-limitations.md).

## Documentation

[Architecture](docs/architecture.md) · [Data model](docs/data-model.md) · [H3](docs/h3.md) · [Scoring](docs/scoring.md) · [White space](docs/white-space-model.md) · [Confidence](docs/confidence.md) · [Caching](docs/caching.md) · [Refresh and recovery](docs/data-refresh.md) · [Deployment](docs/deployment.md) · [Data licences](docs/data-licenses.md)

Code: MIT. Data: original publisher terms. © OpenStreetMap contributors. Contains public sector information licensed under the Open Government Licence v3.0. TfL data subject to its transport data terms.
