# PULSE completion and verification report

London release, 11 September 2026. The application runs at [localhost:3000](http://localhost:3000) with [FastAPI documentation](http://localhost:8000/docs). Repository: [kyky2347/project-oa90ug6m](https://github.com/kyky2347/project-oa90ug6m), public. No public cloud deployment is claimed.

## What was built

A working London site-investigation application using Next.js/React/TypeScript, Tailwind/shadcn, Zustand, TanStack Query, Zod, Recharts and Framer Motion. MapLibre and interleaved deck.gl render the H3 opportunity landscape. FastAPI serves canonical scores and spatial evidence from PostGIS, with Redis response caching, locks and rate limits. Python/uv manages acquisition, validation, features, count models and scheduled refresh.

The product includes the cinematic landing, six business profiles, 3D/2D and component layers, hover/click, top opportunities, confidence filters, custom weights, score contributions and raw evidence, shortlist persistence, shareable views, Site Battle with exports, City Pulse with weekday/Saturday/Sunday transport profiles, 5/10/15-minute radial catchments, Data Health, Methodology and About. The default experience needs no upload, account, external AI key or user-owned data.

[Architecture](architecture.md) and [README](../README.md) document the monorepo, spatial warehouse, API and refresh sequence.

## Verified sources and versions

All seven source adapters successfully ingested real public data; no production analytics use synthetic fixtures. Geography contains 4,994 LSOAs across all 33 London boroughs. OSM extracted 113,342 classified POIs before exact London feature clipping. TfL matched 414 stations with 1,242 day profiles; GLA loaded 640 high-street polygons. Police produced 46,079 H3/month aggregates; VOA produced 33 borough cost proxies.

- Geography: 2021 LSOA boundaries, retrieved 11 September 2026.
- ONS: mid-2024 population; Census 2021 households. Corrected snapshot `ons-20260911T130505-86d4aa`, parser 1.1.0. The adapter now separates workbook reference year from the later revision date in its URL.
- OSM/Geofabrik: extract timestamp 10 September 2026, retrieved 11 September.
- TfL NUMBAT: typical autumn 2025, released in 2026; three day types and 96 quarter-hours. These are historical typical-day flows.
- Police: May–July 2026; approximate public locations, aggregated.
- VOA/HMRC: 31 March 2026 rating-stock bands; borough grouped medians.
- GLA high streets: reference date not supplied; retrieved 11 September 2026 and confidence-discounted.

Exact snapshot IDs, URLs, dates, licences, row counts and checksums appear in [data-sources.md](data-sources.md), [release-data.json](release-data.json) and the committed [manifests](../data/manifests).

**Active feature version:** `ldn-20260911T130817-f16e80`. **Feature/scoring recipe:** `1.0.0`. **Recorded pipeline revision and content hash:** `bb045720703f61f4b6b451ab2557c273ecbed6d6:f16e80b757178318`. **Confidence reference time:** `2026-09-11T13:08:17.462644+00:00`.

The active model covers 2,579 resolution-8 cells and 17,340 resolution-9 cells, producing 119,514 scores across six businesses. Every candidate passes geometry, population-conservation, component-range, source-coverage, borough-coverage and score-drift gates before atomic activation.

### Active supply models

MAE is held-out mapped venues per cell, using four geographic folds and an 800m training exclusion buffer. Each fold fits its preprocessing, dispersion and baseline only on training observations.

| Model version                               | Family            | Spatial CV MAE | Mean-supply baseline MAE |
| ------------------------------------------- | ----------------- | -------------: | -----------------------: |
| `ldn-20260911T130817-f16e80-bakery-r8`      | Poisson           |         0.3006 |                   0.5204 |
| `ldn-20260911T130817-f16e80-coffee-r8`      | Negative Binomial |         1.4991 |                   3.4979 |
| `ldn-20260911T130817-f16e80-convenience-r8` | Poisson           |         1.1534 |                   2.4398 |
| `ldn-20260911T130817-f16e80-coworking-r8`   | Poisson           |         0.0911 |                   0.1215 |
| `ldn-20260911T130817-f16e80-gym-r8`         | Negative Binomial |         0.8920 |                   1.1526 |
| `ldn-20260911T130817-f16e80-restaurant-r8`  | Negative Binomial |         1.7754 |                   4.8958 |
| `ldn-20260911T130817-f16e80-bakery-r9`      | Poisson           |         0.0760 |                   0.0879 |
| `ldn-20260911T130817-f16e80-coffee-r9`      | Negative Binomial |         0.4512 |                   0.6684 |
| `ldn-20260911T130817-f16e80-convenience-r9` | Negative Binomial |         0.3833 |                   0.5274 |
| `ldn-20260911T130817-f16e80-coworking-r9`   | Poisson           |         0.0197 |                   0.0184 |
| `ldn-20260911T130817-f16e80-gym-r9`         | Negative Binomial |         0.2359 |                   0.2583 |
| `ldn-20260911T130817-f16e80-restaurant-r9`  | Negative Binomial |         0.5686 |                   0.8889 |

The detailed coworking model performs worse than its simple baseline. Its sparse mapped supply and weak predictive evidence are explicitly documented; confidence is a quality index, not a calibrated success probability.

## Run and refresh

Fresh checkout:

```sh
git clone https://github.com/kyky2347/project-oa90ug6m.git pulse
cd pulse
./scripts/pulse
```

The complete container route requires Docker with Compose. Host development additionally needs Node 22+, pnpm 11.19.0 and uv/Python 3.12. PostGIS uses loopback 55433, Redis 56380, API 8000 and web 3000. `make docker-up` launches the containerised application after bootstrap. Do not start host development servers on ports already occupied by the Docker app.

```sh
make refresh
make status
make validate
make worker
```

The delivered Docker refresh worker is running and completed a successful cadence-aware check at 13:12:28 UTC, job `e7660e16ffe64f0e930b414013e272a0`. It checks again after 24 hours. Docker bootstrap also completed successfully from the Linux image, retaining all verified snapshots and the active feature version. GitHub's scheduled refresh workflow is provided but requires an explicitly configured persistent runner; ordinary CI does not download the city.

Refresh failure and recovery were exercised during the build: a cancelled slow validation query left the old active model intact, and an ordinary retry rebuilt from the already verified corrected ONS snapshot. Bulk builds now refresh planner statistics before validation joins. Linux runtime testing caught and fixed the native XML dependency needed by osmium.

## Executed verification

- **56 Python tests passed:** 35 unit/parser/scoring/cache/model cases and 21 real PostGIS/API integration cases. This includes 22 source-adapter/reference-year cases and Hypothesis scoring checks. Four upstream deprecation warnings remain; no test failures.
- **7 frontend unit tests passed:** validation boundaries, weights, accessible sliders, shortlist and comparison state.
- **4 real-London browser tests passed** in 2.1 minutes: all seven required journeys and shared-state restoration; mobile filters/comparison; responsive artifacts; map/playback profiling. Journey tests reported no uncaught page errors.
- **Browser smoke passed** for warehouse-independent Methodology/About pages.
- Python Ruff, ESLint and TypeScript checks passed. Next.js production build passed. API, web and worker Docker images built; container bootstrap succeeded; API/web health and worker job success were checked.
- GitHub Actions executes Python checks, small attributed fixtures, PostGIS schema checks, frontend lint/types/tests/build and Chromium smoke. The public repository exposes [current verification runs](https://github.com/kyky2347/project-oa90ug6m/actions/workflows/ci.yml). The test and benchmark counts in this report describe the recorded September edition; subsequent interface changes have their own CI results.

Tests are source-backed where they exercise the production warehouse. Small fixtures and explicitly labelled test-only values never feed production scores. There is no claim of every possible source change or every target device being tested.

## Measured performance

Loopback into Docker FastAPI/PostGIS/Redis, one cold response-cache request and 15 warm requests per endpoint, database pages warm. The city overview measured **28.21ms warm p95**; rankings **2.61ms**; selected-site detail **3.47ms**; catchment **7.55ms**. Full resolution-9 London payload is about 0.92MB gzipped. Cold competitive gravity is about 1.2 seconds.

Software-rendered Chromium loaded 2,579 overview cells and two animation frames in **1.616s**, then selected-site detail/resolution-9 focus in **2.927s**. During playback, animation-frame callbacks averaged **6.12/s**, with p95 interval **183.3ms**. This is SwiftShader software WebGL, not a physical-device GPU benchmark, and does not establish smooth 60fps performance. Instancing reduced the observed long frame stalls versus forced individual polygon rendering; further target-device profiling is warranted.

Full timings, payload sizes, concurrency results, SQL plan and caveats are in [performance.md](performance.md), [benchmark.json](benchmark.json), [frontend-performance.json](frontend-performance.json) and the retained [pre-optimisation sample](frontend-performance-before.json).

## Visual QA and screenshots

Inspected the live product in the in-app browser and reviewed headless Chromium screenshots at **1440×900**, **1280×720** and **390×844**. Covered landing, Explore/tilted 3D map, selected site, contribution waterfall, City Pulse, Site Battle, catchments, Data Health, Methodology and About. Full-page screenshots can be taller than the viewport. Mobile root-width checks passed; evidence panels scroll, filters open as a drawer, and City Pulse temporarily replaces the detail panel at narrow widths.

Fixed during QA: numeric API query parsing, dynamic map-control references, deep-link camera interruption, hidden City Pulse day controls, accessible slider names, UTC date display, small-screen attribution/hero contrast, and default link-button foreground contrast. No brittle animated pixel-diff baseline is claimed.

[All screenshots](screenshots) are committed. The map and site images show actual scores from the active feature version, not mockups.

## Integrations and limits

The delivered runtime is a local container stack. It does not depend on a paid model service, private data connector or cloud account. No public analytics backend is claimed. The public repository includes the product tour and complete source for local operation.

OSM coverage is incomplete; resident population is not customers; TfL flow is not live footfall; crime locations are approximate; rateable value is not rent; catchments are radial and can cross barriers. Cells include mixed land uses and unavailable premises. Default profiles, distance decay and confidence factors are transparent assumptions. The model predicts mapped supply patterns, not openings, revenue or commercial success. No protected demographic inputs are used.

The local system is ready for investigation and demonstration. Public operations still require a suitable host, TLS/ingress, backups, operational monitoring and publisher-term compliance. Read [methodology limitations](methodology-limitations.md) and [deployment](deployment.md) for the practical boundaries.
