import hashlib
import json
import logging
import secrets
import time
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

import h3
import numpy as np
import orjson
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse, Response
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, field_validator
from sqlalchemy.exc import SQLAlchemyError

from apps.api.cache import cache_key, cached, client, rate_allowed
from packages.scoring.core import (
    COMPONENTS,
    LABELS,
    PROFILES,
    TARGET_CATEGORY,
    explain,
    normalize_weights,
    weights_hash,
)
from pipeline.db import execute, rows, settings

app = FastAPI(
    title="PULSE · Urban Opportunity Intelligence", version="0.1.0", default_response_class=ORJSONResponse
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1200)
log = logging.getLogger("pulse.api")
Business = Literal["coffee", "bakery", "restaurant", "gym", "convenience", "coworking"]
Day = Literal["weekday", "saturday", "sunday"]
Resolution = Annotated[Literal[8, 9], BeforeValidator(int)]
Minutes = Annotated[Literal[5, 10, 15], BeforeValidator(int)]


@app.middleware("http")
async def observe(request: Request, call_next):
    request.state.request_id = uuid.uuid4().hex[:12]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except SQLAlchemyError:
        response = ORJSONResponse(
            {"detail": "The London data service is temporarily unavailable."}, status_code=503
        )
    ms = (time.perf_counter() - start) * 1000
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["Server-Timing"] = f"api;dur={ms:.2f}"
    log.info(
        json.dumps(
            {
                "request_id": request.state.request_id,
                "path": request.url.path,
                "query_ms": round(ms, 2),
                "status": response.status_code,
                "feature_version": getattr(request.state, "feature_version", None),
                "business_type": request.query_params.get("business"),
                "cache_hit": response.headers.get("X-Cache") == "HIT",
            }
        )
    )
    return response


def version():
    r = rows("SELECT * FROM feature_versions WHERE status='active'")
    if not r:
        raise HTTPException(503, "No validated London version is active. Run make bootstrap.")
    return r[0]


def weights_for(business, weights):
    if not weights:
        return PROFILES[business]["weights"]
    try:
        return normalize_weights(json.loads(weights))
    except (ValueError, TypeError, json.JSONDecodeError):
        raise HTTPException(
            422, "Weights must contain all six finite non-negative components with a positive sum."
        ) from None


def bbox_filter(bbox, params):
    if not bbox:
        return ""
    try:
        x0, y0, x1, y1 = [float(v) for v in bbox.split(",")]
        if not np.all(np.isfinite([x0, y0, x1, y1])) or not (
            -0.8 <= x0 < x1 <= 0.5 and 51.1 <= y0 < y1 <= 51.9
        ):
            raise ValueError
        params.update(x0=x0, y0=y0, x1=x1, y1=y1)
        return " AND g.geom && ST_MakeEnvelope(:x0,:y0,:x1,:y1,4326)"
    except (ValueError, TypeError):
        raise HTTPException(422, "Use a London bounding box: west,south,east,north.") from None


def query_scores(
    v,
    business,
    weights=None,
    resolution=8,
    bbox=None,
    h3_id=None,
    minimum=0,
    min_confidence=0,
    limit=None,
    ranked=False,
):
    p = {"v": v, "b": business, "r": resolution, "floor": minimum, "conf": min_confidence}
    if weights:
        for k, w in weights.items():
            p["w_" + k] = w
        raw = "(" + "+".join(f":w_{k}*c.{k}" for k in COMPONENTS) + ")"
        total = f"(50+c.confidence*({raw}-50))"
    else:
        total, raw = "o.score", "o.raw_score"
    where = "f.feature_version=:v AND c.business_type=:b AND f.resolution=:r"
    if h3_id:
        p["h"] = h3_id
        where = "f.feature_version=:v AND c.business_type=:b AND f.h3_id=:h"
    where += bbox_filter(bbox, p)
    where += f" AND c.confidence>=:conf AND {total}>=:floor"
    order = f"ORDER BY {total} DESC,g.h3_id" if ranked else "ORDER BY g.h3_id"
    tail = ""
    if limit:
        p["limit"] = limit
        tail = " LIMIT :limit"
    return rows(
        f"""SELECT f.*,g.borough,g.lsoa_code,ST_X(g.centroid) longitude,ST_Y(g.centroid) latitude,
        {",".join("c." + k for k in COMPONENTS)},c.confidence,c.coverage_confidence,c.model_confidence,
        c.model_version,c.expected_supply,c.observed_supply,c.supply_gap,{total} score,{raw} raw_score,o.rank
        FROM h3_features f JOIN geo_h3_cells g USING(h3_id)
        JOIN h3_component_scores c ON c.feature_version=f.feature_version AND c.h3_id=f.h3_id
        JOIN h3_opportunity_scores o ON o.feature_version=c.feature_version AND o.h3_id=c.h3_id AND o.business_type=c.business_type
        WHERE {where} {order}{tail}""",
        p,
    )


def label(r):
    if r.get("high_street_name") and (r.get("high_street_distance") or 0) < 250:
        return r["high_street_name"]
    if r.get("nearest_station") and (r.get("station_distance_m") or 1e9) < 1200:
        return "Near " + r["nearest_station"]
    return f"{r['borough']} · {r['latitude']:.3f}, {r['longitude']:.3f}"


def pack(r):
    return {
        "h3": r["h3_id"],
        "score": round(r["score"], 2),
        "confidence": round(r["confidence"], 4),
        "components": {k: round(r[k], 2) for k in COMPONENTS},
        "label": label(r),
        "borough": r["borough"],
        "longitude": r["longitude"],
        "latitude": r["latitude"],
        "rank": r["rank"],
    }


def serve(request, namespace, v, business, params, factory, ttl=3600):
    request.state.feature_version = v
    result, hit = cached(cache_key(namespace, v, business, **params), factory, ttl)
    content = orjson.dumps(result)
    etag = '"' + hashlib.sha256(content).hexdigest()[:24] + '"'
    headers = {
        "ETag": etag,
        "Cache-Control": "public,max-age=30,stale-while-revalidate=30",
        "X-Cache": "HIT" if hit else "MISS",
    }
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304, headers=headers)
    return Response(content, media_type="application/json", headers=headers)


@app.get("/health")
def health():
    try:
        db = bool(rows("SELECT 1 AS ok"))
        active = rows("SELECT id FROM feature_versions WHERE status='active'")
        return {
            "status": "healthy" if active else "awaiting_bootstrap",
            "database": db,
            "feature_version": active[0]["id"] if active else None,
            "api_version": app.version,
        }
    except SQLAlchemyError:
        raise HTTPException(503, "Database unavailable") from None


@app.get("/diagnostics")
def diagnostics():
    state = health()
    try:
        state["redis"] = "available" if client.ping() else "unavailable"
    except Exception:
        state["redis"] = "unavailable; API operates uncached"
    state["snapshots"] = rows(
        "SELECT source_id,id,row_count,published_at FROM dataset_snapshots WHERE status='verified'"
    )
    state["models"] = rows(
        "SELECT id,family FROM model_versions WHERE feature_version=:v", {"v": state["feature_version"]}
    )
    return state


@app.get("/sources")
def sources():
    output = []
    for s in rows("SELECT * FROM dataset_sources ORDER BY id"):
        attempts = rows(
            "SELECT * FROM dataset_snapshots WHERE source_id=:id ORDER BY retrieved_at DESC", {"id": s["id"]}
        )
        successful = next((a for a in attempts if a["status"] == "verified"), None)
        latest = attempts[0] if attempts else None
        reference = successful.get("published_at") if successful else None
        age = None
        if reference:
            try:
                date = datetime.fromisoformat(str(reference) + ("-01-01" if len(str(reference)) == 4 else ""))
                age = max(0, (datetime.now(UTC).date() - date.date()).days)
            except ValueError:
                pass
        # Observation age is separate from retrieval time; structural layers have no expiry.
        threshold = {"osm": 30, "police": 120, "tfl": 1095, "ons": 1460, "voa": 730}.get(s["id"])
        s.update(
            reference_age_days=age,
            reference_stale=age is not None and threshold is not None and age > threshold,
            latest_snapshot=successful,
            latest_attempt=latest,
            status="failed"
            if not successful
            else "refresh_failed"
            if latest and latest["status"] == "failed"
            else "verified",
        )
        for obj in [s.get("latest_snapshot"), s.get("latest_attempt")]:
            if obj:
                obj.pop("raw_path", None)
        output.append(s)
    active = rows("SELECT id,snapshots,created_at FROM feature_versions WHERE status='active'")
    return {
        "sources": output,
        "active_version": active[0] if active else None,
        "note": "Verified means the ingestion contract passed. Observation date and retrieval date are different.",
    }


@app.get("/sources/{source}")
def source_details(source: str):
    item = next((s for s in sources()["sources"] if s["id"] == source), None)
    if not item:
        raise HTTPException(404, "Unknown source")
    return item


@app.get("/business-types")
def businesses():
    return {"profiles": list(PROFILES.values()), "components": LABELS}


@app.get("/map/opportunity")
def map_opportunity(
    request: Request,
    business: Business = "coffee",
    resolution: Resolution = 8,
    bbox: str | None = None,
    weights: str | None = None,
    minimum: Annotated[float, Query(ge=0, le=100)] = 0,
    min_confidence: Annotated[float, Query(ge=0, le=1)] = 0,
):
    v = version()["id"]
    w = weights_for(business, weights)
    bbox_filter(bbox, {})
    if weights and not rate_allowed(request.client.host + ":weights", 120):
        raise HTTPException(429, "Please wait before rescoring London again")
    return serve(
        request,
        "map",
        v,
        business,
        dict(r=resolution, bbox=bbox, w=weights_hash(w), minimum=minimum, confidence=min_confidence),
        lambda: {
            "feature_version": v,
            "business": business,
            "resolution": resolution,
            "weights": w,
            "cells": [
                pack(r)
                for r in query_scores(
                    v,
                    business,
                    w if weights else None,
                    resolution,
                    bbox,
                    minimum=minimum,
                    min_confidence=min_confidence,
                )
            ],
            "attribution": "© OpenStreetMap contributors · ONS · TfL · GLA · UK Police · HMRC/VOA",
        },
    )


@app.get("/map/component/{component}")
def map_component(
    component: str,
    request: Request,
    business: Business = "coffee",
    resolution: Resolution = 8,
    bbox: str | None = None,
):
    if component not in COMPONENTS and component != "confidence":
        raise HTTPException(422, "Unknown component")
    return map_opportunity(request, business, resolution, bbox)


@app.get("/rankings")
def rankings(
    request: Request,
    business: Business = "coffee",
    weights: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    min_confidence: Annotated[float, Query(ge=0, le=1)] = 0.6,
    resolution: Resolution = 8,
):
    v = version()["id"]
    w = weights_for(business, weights)

    def result():
        data = query_scores(
            v,
            business,
            w if weights else None,
            resolution,
            min_confidence=min_confidence,
            limit=limit,
            ranked=True,
        )
        return {
            "feature_version": v,
            "weights": w,
            "sites": [
                dict(
                    pack(r),
                    rank=i + 1,
                    reason=explain({k: r[k] for k in COMPONENTS}, r["confidence"], w)["summary"],
                )
                for i, r in enumerate(data)
            ],
        }

    return serve(
        request,
        "ranking",
        v,
        business,
        dict(w=weights_hash(w), limit=limit, conf=min_confidence, r=resolution),
        result,
    )


def cell_data(h3_id, business, weights=None):
    if not h3.is_valid_cell(h3_id) or h3.get_resolution(h3_id) not in (8, 9):
        raise HTTPException(422, "Expected a valid H3 resolution 8 or 9 cell")
    v = version()
    w = weights_for(business, weights)
    result = query_scores(v["id"], business, w if weights else None, h3_id=h3_id)
    if not result:
        raise HTTPException(404, "This cell is outside the active London study area")
    r = result[0]
    nearby = rows(
        """SELECT p.id,p.name,p.category,ST_X(p.geom) longitude,ST_Y(p.geom) latitude,
        ST_Distance(p.geom::geography,g.centroid::geography) distance_m FROM pois p,geo_h3_cells g
        WHERE g.h3_id=:h AND p.snapshot_id=:s AND ST_DWithin(p.geom::geography,g.centroid::geography,600)
        ORDER BY distance_m,p.id LIMIT 120""",
        {"h": h3_id, "s": v["snapshots"]["osm"]},
    )
    model = rows("SELECT family,metrics FROM model_versions WHERE id=:m", {"m": r["model_version"]})[0]
    return dict(
        pack(r),
        feature_version=v["id"],
        business=business,
        weights=w,
        raw=r,
        explanation=explain({k: r[k] for k in COMPONENTS}, r["confidence"], w),
        nearby_pois=nearby,
        model=model,
        source_snapshots=v["snapshots"],
        confidence_factors={
            "coverage": r["coverage_confidence"],
            "recency": r["recency_confidence"],
            "spatial": r["spatial_confidence"],
            "model": r["model_confidence"],
        },
        confidence_note="Data quality index, not a probability of business success.",
    )


@app.get("/cells/{h3_id}")
def cell(h3_id: str, request: Request, business: Business = "coffee", weights: str | None = None):
    v = version()["id"]
    w = weights_for(business, weights)
    return serve(
        request,
        "cell",
        v,
        business,
        dict(h=h3_id, w=weights_hash(w)),
        lambda: cell_data(h3_id, business, weights),
    )


@app.get("/cells/{h3_id}/explain")
def cell_explain(h3_id: str, business: Business = "coffee", weights: str | None = None):
    d = cell_data(h3_id, business, weights)
    return dict(
        d["explanation"], feature_version=d["feature_version"], score=d["score"], confidence=d["confidence"]
    )


@app.get("/cells/{h3_id}/catchment")
def catchment(
    h3_id: str,
    request: Request,
    business: Business = "coffee",
    minutes: Minutes = 10,
    weights: str | None = None,
):
    if not rate_allowed(request.client.host + ":catchment", 60):
        raise HTTPException(429, "Catchment request limit reached; please retry shortly")
    base = cell_data(h3_id, business, weights)
    v = base["feature_version"]
    w = base["weights"]

    def compute():
        radius = minutes * 80
        shape = rows(
            """SELECT ST_AsGeoJSON(ST_Transform(ST_Buffer(ST_Transform(centroid,27700),:r),4326)) geometry
            FROM geo_h3_cells WHERE h3_id=:h""",
            {"r": radius, "h": h3_id},
        )[0]["geometry"]
        # Intersect precomputed H3 geometry and area-allocate population at the catchment edge.
        metrics = rows(
            """WITH area AS(SELECT ST_Transform(ST_Buffer(ST_Transform(centroid,27700),:r),4326) geom
            FROM geo_h3_cells WHERE h3_id=:h), intersected AS (
            SELECT f.*,ST_Area(ST_Intersection(g.geom,a.geom)::geography)/g.area_m2 fraction
            FROM h3_features f JOIN geo_h3_cells g USING(h3_id),area a
            WHERE f.feature_version=:v AND f.resolution=9 AND ST_Intersects(g.geom,a.geom))
            SELECT sum(population*fraction) population,sum(incident_count*fraction) incidents,
            avg(occupancy_cost_pressure) occupancy_cost_pressure,max(transit_access) transit_access,
            bool_or(high_street_flag) high_street_intersection FROM intersected""",
            {"h": h3_id, "r": radius, "v": v},
        )[0]
        pois = rows(
            """SELECT category,count(*) count FROM pois p,geo_h3_cells g
            WHERE g.h3_id=:h AND p.snapshot_id=:s AND ST_DWithin(p.geom::geography,g.centroid::geography,:r)
            GROUP BY category""",
            {"h": h3_id, "r": radius, "s": base["source_snapshots"]["osm"]},
        )
        counts = {r["category"]: r["count"] for r in pois}
        nearby_scores = query_scores(
            v,
            business,
            w,
            resolution=9,
            bbox=f"{base['longitude'] - 0.025},{base['latitude'] - 0.015},{base['longitude'] + 0.025},{base['latitude'] + 0.015}",
        )
        distances = [
            h3.great_circle_distance(
                (base["latitude"], base["longitude"]), (r["latitude"], r["longitude"]), unit="m"
            )
            for r in nearby_scores
        ]
        within = [r["score"] for r, d in zip(nearby_scores, distances, strict=True) if d <= radius]
        metrics["population"] = round((metrics["population"] or 0) / 100) * 100
        return {
            "h3": h3_id,
            "minutes": minutes,
            "radius_m": radius,
            "method": "Radial walking-time proxy",
            "methodology": "80 metres/minute straight-line distance. Does not account for street paths, barriers, crossings or the Thames.",
            "feature_version": v,
            "geometry": json.loads(shape),
            "metrics": metrics,
            "poi_counts": counts,
            "competitors": counts.get(TARGET_CATEGORY[business], 0),
            "complementary_venues": sum(counts.get(c, 0) for c in PROFILES[business]["complements"]),
            "opportunity_distribution": np.quantile(within, [0.1, 0.5, 0.9]).tolist() if within else [],
            "weights": w,
        }

    return serve(request, "catchment", v, business, dict(h=h3_id, m=minutes, w=weights_hash(w)), compute)


class CompareInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    sites: list[str] = Field(min_length=2, max_length=2)
    business: Business = "coffee"
    weights: dict[str, float] | None = None

    @field_validator("sites")
    @classmethod
    def distinct(cls, v):
        if len(set(v)) != 2:
            raise ValueError("Choose two different cells")
        return v


@app.post("/compare")
def compare(body: CompareInput, request: Request):
    weights = json.dumps(body.weights) if body.weights else None
    w = weights_for(body.business, weights)
    v = version()["id"]

    def result():
        a, b = [cell_data(h, body.business, weights) for h in body.sites]
        deltas = [
            {
                "component": k,
                "label": LABELS[k],
                "difference": round(a["components"][k] - b["components"][k], 2),
            }
            for k in COMPONENTS
        ]
        ahead = [d["label"].lower() for d in deltas if d["difference"] > 2]
        behind = [d["label"].lower() for d in deltas if d["difference"] < -2]
        return {
            "feature_version": v,
            "sites": [a, b],
            "weights": w,
            "deltas": deltas,
            "tradeoff": f"Site A has stronger {', '.join(ahead) or 'broadly similar signals'}. Site B has stronger {', '.join(behind) or 'broadly similar signals'}.",
            "note": "Totals reflect the current weights. Similar scores do not justify declaring a winner.",
        }

    return serve(request, "compare", v, body.business, dict(sites=body.sites, w=weights_hash(w)), result)


@app.get("/pulse/time-profile")
def pulse(
    request: Request,
    day: Day = "weekday",
    resolution: Resolution = 8,
    bbox: str | None = None,
    h3_id: str | None = None,
):
    v = version()["id"]
    params = {"v": v, "day": day, "res": resolution}
    spatial = bbox_filter(bbox, params)
    if h3_id:
        params["h"] = h3_id
        spatial += " AND g.h3_id=:h"

    def result():
        data = rows(
            """SELECT p.h3_id,p.values FROM h3_transport_time_profile p JOIN geo_h3_cells g USING(h3_id)
            WHERE p.feature_version=:v AND p.day_type=:day AND g.resolution=:res"""
            + spatial,
            params,
        )
        if not data:
            raise HTTPException(404, "No verified transport profile available for this selection")
        total = np.sum([r["values"] for r in data], axis=0)
        scale = float(np.quantile([v for r in data for v in r["values"] if v > 0], 0.99))
        return {
            "feature_version": v,
            "day": day,
            "label": "Typical transport demand profile",
            "live": False,
            "times": [f"{i // 4:02d}:{i % 4 * 15:02d}" for i in range(96)],
            "total_influence": total.tolist(),
            "display_scale": scale,
            "cells": [{"h3": r["h3_id"], "values": r["values"]} for r in data],
            "note": "Sum of decayed station entries/exits. Influence is not a unique passenger count.",
        }

    return serve(request, "pulse", v, "", dict(day=day, res=resolution, bbox=bbox, h=h3_id), result)


@app.get("/map/context")
def context(
    request: Request,
    kind: Literal["high_streets", "stations", "competitors", "complements"] = "stations",
    business: Business = "coffee",
    bbox: str | None = None,
):
    v = version()
    p = {"s": v["snapshots"].get("gla" if kind == "high_streets" else "tfl" if kind == "stations" else "osm")}
    if not p["s"]:
        raise HTTPException(404, "Source unavailable")
    table = (
        "geo_high_streets"
        if kind == "high_streets"
        else "transport_stations"
        if kind == "stations"
        else "pois"
    )
    where = "snapshot_id=:s"
    if kind == "competitors":
        p["category"] = TARGET_CATEGORY[business]
        where += " AND category=:category"
    if kind == "complements":
        p["categories"] = PROFILES[business]["complements"]
        where += " AND category=ANY(:categories)"
    spatial = bbox_filter(bbox, p).replace("g.geom", "geom")

    def result():
        rs = rows(
            f"SELECT id,name,ST_AsGeoJSON(geom) geometry FROM {table} WHERE {where}{spatial} LIMIT 10000", p
        )
        return {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "geometry": json.loads(r["geometry"]),
                    "properties": {"id": r["id"], "name": r["name"]},
                }
                for r in rs
            ],
        }

    return serve(request, "context", v["id"], business, dict(kind=kind, bbox=bbox), result)


@app.get("/map/competition")
def competitive_gravity(request: Request, business: Business = "coffee", resolution: Resolution = 8):
    v = version()

    def compute():
        records = rows(
            """WITH pressure AS (
            SELECT g.h3_id,COALESCE(sum(exp(-ST_Distance(p.geom::geography,g.centroid::geography)/300.0)),0) pressure
            FROM geo_h3_cells g JOIN h3_features f USING(h3_id)
            LEFT JOIN pois p ON p.snapshot_id=:s AND p.category=:cat
              AND ST_DWithin(p.geom::geography,g.centroid::geography,1500)
            WHERE f.feature_version=:v AND g.resolution=:res GROUP BY g.h3_id)
            SELECT h3_id h3,pressure,CASE WHEN pressure=0 THEN 0 ELSE percent_rank() OVER(ORDER BY pressure)*100 END intensity
            FROM pressure ORDER BY h3_id""",
            {"v": v["id"], "s": v["snapshots"]["osm"], "cat": TARGET_CATEGORY[business], "res": resolution},
        )
        return {
            "feature_version": v["id"],
            "cells": records,
            "method": "Each mapped competitor contributes exp(-distance/300m), cutoff 1500m. London percentile display; separate from white space.",
        }

    return serve(request, "gravity", v["id"], business, dict(res=resolution), compute)


@app.get("/methodology")
def methodology():
    return {
        "components": LABELS,
        "profiles": list(PROFILES.values()),
        "weighted_score": "Raw = Σ weight × component",
        "confidence_shrinkage": "Final = 50 + c × (Raw − 50)",
        "spatial_decay": "Transit influence = Σ station entries/exits × exp(−distance/600m), cutoff 3km",
        "white_space": "Within-London percentile of (expected − observed) / sqrt(model variance + 1)",
        "confidence": "Geometric mean of coverage, recency, spatial matching and model-quality factors; not a calibrated probability.",
        "limitations": [
            "Area-level screening only",
            "OSM coverage varies",
            "Transport is typical-day proxy demand",
            "Rateable value is not rent",
            "Crime locations are approximate",
            "Profiles are defaults, not empirically proven commercial optima",
        ],
    }


def authorize(token):
    if not settings.admin_token:
        raise HTTPException(404, "Administrative endpoints are disabled")
    if not token or not secrets.compare_digest(token, settings.admin_token):
        raise HTTPException(401, "Invalid administrative token")


@app.post("/admin/refresh/{source}")
def refresh(source: str, background: BackgroundTasks, x_admin_token: Annotated[str | None, Header()] = None):
    authorize(x_admin_token)
    from pipeline.cli import refresh_pipeline
    from pipeline.sources.registry import SOURCES

    if source not in SOURCES and source != "all":
        raise HTTPException(404, "Unknown source")
    job = uuid.uuid4().hex
    execute("INSERT INTO ingestion_jobs(id,source,status) VALUES(:id,:s,'queued')", {"id": job, "s": source})
    background.add_task(refresh_pipeline, source, False, job)
    return {"job_id": job, "status": "queued"}


@app.get("/admin/jobs/{job_id}")
def job_status(job_id: str, x_admin_token: Annotated[str | None, Header()] = None):
    authorize(x_admin_token)
    found = rows("SELECT * FROM ingestion_jobs WHERE id=:id", {"id": job_id})
    if not found:
        raise HTTPException(404, "Unknown job")
    return found[0]
