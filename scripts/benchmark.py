"""Measured local API benchmark. Clears only PULSE response-cache keys, never source data."""

import json
import platform
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import httpx
import numpy as np

from apps.api.cache import client as redis
from pipeline.db import ROOT, rows

base = "http://127.0.0.1:8000"
with httpx.Client(base_url=base, timeout=120, headers={"Accept-Encoding": "gzip"}) as c:
    health = c.get("/health").json()
    v = health["feature_version"]
    sites = c.get("/rankings").json()["sites"][:2]
    h = sites[0]["h3"]
    endpoints = [
        ("overview", "/map/opportunity?resolution=8"),
        ("detail viewport", "/map/opportunity?resolution=9&bbox=-0.17,51.49,-0.10,51.53"),
        ("full res9", "/map/opportunity?resolution=9"),
        ("rankings", "/rankings"),
        ("cell", f"/cells/{h}"),
        ("catchment", f"/cells/{h}/catchment?minutes=10"),
        ("pulse", "/pulse/time-profile?resolution=8"),
        ("competitive gravity", "/map/competition?resolution=8"),
        (
            "custom weights",
            "/map/opportunity?resolution=8&weights="
            + httpx.QueryParams(
                {
                    "x": json.dumps(
                        {
                            "demand": 40,
                            "access": 20,
                            "white_space": 20,
                            "ecosystem": 10,
                            "cost_efficiency": 5,
                            "operational_context": 5,
                        }
                    )
                }
            )["x"],
        ),
    ]
    # Use httpx params encoding for JSON weights.
    endpoints[-1] = (
        endpoints[-1][0],
        str(
            httpx.URL("/map/opportunity")
            .copy_add_param("resolution", 8)
            .copy_add_param(
                "weights",
                json.dumps(
                    {
                        "demand": 40,
                        "access": 20,
                        "white_space": 20,
                        "ecosystem": 10,
                        "cost_efficiency": 5,
                        "operational_context": 5,
                    }
                ),
            )
        ),
    )
    result = []
    for name, url in endpoints:
        keys = list(redis.scan_iter(match=f"pulse:v1:*:{v}:*"))
        if keys:
            redis.delete(*keys)
        start = time.perf_counter()
        r = c.get(url)
        r.raise_for_status()
        cold = (time.perf_counter() - start) * 1000
        assert r.headers.get("x-cache") == "MISS"
        times = []
        for _ in range(15):
            start = time.perf_counter()
            r = c.get(url)
            r.raise_for_status()
            times.append((time.perf_counter() - start) * 1000)
        result.append(
            {
                "operation": name,
                "cold_cache_ms": round(cold, 2),
                "warm_p50_ms": round(float(np.median(times)), 2),
                "warm_p95_ms": round(float(np.quantile(times, 0.95)), 2),
                "decoded_json_bytes": len(r.content),
                "wire_bytes": int(r.headers.get("content-length", 0)) or None,
                "warm_samples": len(times),
            }
        )
        print(result[-1], flush=True)

    def fetch(_):
        start = time.perf_counter()
        r = c.get("/rankings")
        r.raise_for_status()
        return (time.perf_counter() - start) * 1000

    with ThreadPoolExecutor(max_workers=8) as pool:
        concurrent = list(pool.map(fetch, range(40)))
    report = {
        "measured_at": datetime.now(UTC).isoformat(),
        "platform": platform.platform(),
        "processor": platform.machine(),
        "feature_version": v,
        "notes": "Local loopback into Docker FastAPI, PostGIS + Redis. One cold response cache sample per endpoint; DB pages were warm. 15 sequential warm samples. These are development-machine observations, not production SLAs. Gzip requested.",
        "endpoints": result,
        "ranking_concurrency_8": {
            "requests": 40,
            "p50_ms": float(np.median(concurrent)),
            "p95_ms": float(np.quantile(concurrent, 0.95)),
        },
    }
    (ROOT / "docs/benchmark.json").write_text(json.dumps(report, indent=2))
    plan = rows(
        "EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON) SELECT id FROM pois WHERE ST_DWithin(geom::geography,ST_SetSRID(ST_Point(-.1,51.5),4326)::geography,600)"
    )
    (ROOT / "docs/spatial-query-plan.json").write_text(json.dumps(plan, indent=2, default=str))
