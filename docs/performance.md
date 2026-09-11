# Measured performance

Local loopback into Docker FastAPI, PostGIS + Redis. One cold response cache sample per endpoint; DB pages were warm. 15 sequential warm samples. These are development-machine observations, not production SLAs. Gzip requested.

Measured UTC: 2026-09-11T13:10:17.437832+00:00; macOS-26.5.2-arm64-arm-64bit. Active version: `ldn-20260911T130817-f16e80`.

| API operation | Cold response cache ms | Warm p50 ms | Warm p95 ms | Gzip bytes |
|---|---:|---:|---:|---:|
| overview | 193.14 | 26.15 | 28.21 | 152,468 |
| detail viewport | 21.32 | 4.87 | 5.21 | 14,920 |
| full res9 | 608.34 | 148.79 | 181.4 | 916,406 |
| rankings | 47.48 | 2.29 | 2.61 | 2,020 |
| cell | 63.99 | 3.24 | 3.47 | 6,907 |
| catchment | 98.77 | 6.57 | 7.55 | 1,033 |
| pulse | 154.52 | 83.53 | 93.71 | 493,965 |
| competitive gravity | 1204.36 | 13.32 | 14.25 | 49,806 |
| custom weights | 185.08 | 26.6 | 28.74 | 152,521 |

Eight concurrent ranking clients, 40 requests: p50 17.65ms, p95 240.86ms.

Competitive gravity takes about 1.2 seconds with a cold response cache because it sums real POI distances. Full resolution-9 London JSON is 5.69 MB decoded and 0.92 MB gzipped; ordinary high-zoom use requests a viewport, measured at approximately 86 KB decoded. The [raw benchmark](benchmark.json) retains the environment, sample count and payload sizes. These loopback measurements include Docker forwarding and do not establish production capacity.

[The PostGIS plan](spatial-query-plan.json) verifies the geography GiST index for proximity queries. Request logs record timing, version, business, cache state and status. Rerun with `uv run python scripts/benchmark.py`; this clears only the active version’s PULSE response-cache keys, retaining canonical data.

## Feature build

The final feature/model build ran from 13:08:17 UTC to successful activation around 13:09:09 UTC on 11 September 2026, approximately 52 seconds with verified snapshots already loaded. Source acquisition is excluded. A preceding validation join used a poor plan after bulk insertion; refreshing planner statistics made the same join take approximately 124ms. Builds now run ANALYZE before validation. The cancelled candidate was recorded as failed, the previous version remained available, and the next ordinary refresh safely rebuilt the unapplied verified snapshots.

Next.js production build, API/worker image and web image were built locally. Runtime dependency testing includes the osmium native XML library; API and refresh worker run in Linux containers, not only the host Python environment.

## Frontend measurement

Browser measurements and their software-rendering environment are retained in [frontend-performance.json](frontend-performance.json). The test times navigation through loaded H3 data and two animation frames, then selected-site focus and detail, and samples animation-frame callbacks during City Pulse. These measure browser readiness and scheduling, not GPU-completed frames or physical mobile-device performance.

Latest software-rendered sample: 2,579 overview cells ready in 1616ms; selected-site/resolution-9 focus 2927ms; 6.12 animation-frame callbacks/second during playback, p95 interval 183.3ms. The previous forced-polygon sample recorded 6,825ms overview readiness and 983.3ms p95 callback interval. These are single instrumented samples with software WebGL, not a controlled GPU comparison or a 60fps claim. Instanced columns are now the ordinary renderer; exact polygons are retained in debug mode.
