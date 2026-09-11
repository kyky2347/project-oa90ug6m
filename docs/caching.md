# Caching and performance architecture

PostGIS is the only canonical store. Redis holds serialised response bodies, ranking/detail/catchment/comparison results, competitive gravity, time profiles, refresh locks and minute-window rate counters. Missing Redis falls back to database computation; tests exercise this path.

Keys have the form `pulse:v1:<namespace>:<feature_version>:<business>:<parameter_hash>`. Parameters include resolution, viewport, normalised weights, confidence floor, site IDs, catchment minutes and day type as applicable. Parameter objects are sorted before hashing. Cache lifetime defaults to one hour. Activation changes the version in future keys; old keys expire without an unsafe database-wide flush.

Responses include SHA-256-derived ETag, `Cache-Control: public,max-age=30,stale-while-revalidate=30`, `X-Cache`, request ID and Server-Timing. Gzip is enabled for payloads over 1,200 bytes. HTTP revalidation returns 304 when the entity is unchanged. Browser TanStack Query caches per parameter set, with precomputed quarter-hour arrays reused for animation.

Overview sends compact H3 IDs, coordinates, six components, score, confidence and labels. Detail fetches evidence only when selected. High zoom bounds resolution-9 map and transport queries to the viewport. Optional vector tiles are not implemented because the measured JSON path is suitable for this city-sized model; actual measurements are in [performance.md](performance.md).

Rate limits protect frequent custom map rescoring (120/minute/client) and catchment requests (60/minute/client); counters and expiry are atomic Lua. Redis outage degrades rate limiting open for local continuity, so a public deployment should also enforce ingress quotas. Proxies should configure trustworthy client addressing.
