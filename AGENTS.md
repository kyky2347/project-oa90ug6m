# PULSE engineering rules

- Never fabricate public data or benchmarks. Synthetic fixtures are test-only.
- Never silently change scoring formulas; every scoring change requires tests.
- Every source adapter needs fixture tests and provenance.
- Never treat rateable value as rent, TfL typical-day data as live footfall, or approximate crime coordinates as exact locations.
- Do not use sensitive/protected demographic attributes in scoring.
- Frontend must not calculate canonical scores independently.
- PostGIS is canonical spatial storage; H3 is the canonical analysis lattice; Redis is never the source of truth.
- Every active feature version must be reproducible from recorded snapshots and code.
- A failed refresh must not destroy the active working dataset.
- Every major visual change must be browser inspected.
- No placeholder user flows. Clearly show unavailable evidence.
