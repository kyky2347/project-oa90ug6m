import hashlib
import json
import logging
import subprocess
from datetime import UTC, datetime

import geopandas as gpd
import h3
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree, distance
from shapely import Polygon, intersects
from sqlalchemy import text

from packages.scoring.core import COMPONENTS, PROFILES, TARGET_CATEGORY, opportunity, percentile
from pipeline.db import ROOT, engine, execute, rows
from pipeline.models.white_space import fit_white_space
from pipeline.sources.geography import LONDON_BOROUGHS

log = logging.getLogger("pulse.features")
PARAMETERS = {
    "version": "1.0.0",
    "station_decay_m": 600,
    "station_cutoff_m": 3000,
    "venue_catchment_m": 600,
    "crime_months": 3,
    "normalization": "1/99 winsorized London midrank percentile",
    "population_allocation": "LSOA area weighted, EPSG:27700",
    "confidence": "geometric quality index",
}


def active_snapshots():
    return {
        r["source_id"]: r["id"]
        for r in rows("""SELECT DISTINCT ON(source_id) id,source_id
        FROM dataset_snapshots WHERE status='verified' ORDER BY source_id,retrieved_at DESC""")
    }


def geo_table(table, snapshot):
    return gpd.read_postgis(
        text(f"SELECT * FROM {table} WHERE snapshot_id=:s"), engine(), params={"s": snapshot}, geom_col="geom"
    ).to_crs(27700)


def grid(lsoas, resolution):
    london = lsoas.to_crs(4326).geometry.union_all()
    inner = h3.geo_to_cells(london.__geo_interface__, resolution)
    candidates = sorted({n for c in inner for n in h3.grid_disk(c, 1)})
    polygons = np.array([Polygon([(lon, lat) for lat, lon in h3.cell_to_boundary(c)]) for c in candidates])
    keep = intersects(polygons, london)
    ids = np.array(candidates)[keep]
    frame = gpd.GeoDataFrame({"h3_id": ids}, geometry=polygons[keep], crs=4326).to_crs(27700)
    frame["resolution"] = resolution
    frame["area_m2"] = frame.area
    frame["x"], frame["y"] = frame.centroid.x, frame.centroid.y
    return frame


def recency(snapshots, reference_time=None):
    reference_time = reference_time or datetime.now(UTC)
    half_lives = {
        "ons": 365 * 6,
        "geography": 365 * 20,
        "osm": 365,
        "tfl": 365 * 3,
        "police": 365,
        "voa": 365 * 3,
        "gla": 365 * 15,
    }
    result = {}
    for source, sid in snapshots.items():
        r = rows("SELECT published_at,retrieved_at FROM dataset_snapshots WHERE id=:s", {"s": sid})[0]
        value = r["published_at"]
        try:
            date = pd.to_datetime(value, utc=True).to_pydatetime() if value else r["retrieved_at"]
            age = max(0, (reference_time - date).days)
            # Unknown publication dates are explicitly discounted, never asserted as fresh observations.
            result[source] = float(2 ** (-age / half_lives[source])) if value else 0.8
        except (ValueError, TypeError):
            result[source] = 0.7
    return result


def build_features(snapshots=None, reference_time=None):
    reference_time = reference_time or datetime.now(UTC)
    snapshots = snapshots or active_snapshots()
    required = {"geography", "ons", "osm"}
    if not required <= snapshots.keys():
        raise ValueError(f"Critical snapshots missing: {required - snapshots.keys()}")
    try:
        sha = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], stderr=subprocess.DEVNULL, text=True
        ).strip()
    except subprocess.CalledProcessError:
        sha = "uncommitted"
    # Include source code hashes so a feature version identifies the actual build implementation.
    digest = hashlib.sha256()
    for p in sorted((ROOT / "pipeline").rglob("*.py")) + sorted((ROOT / "packages").rglob("*.py")):
        digest.update(p.read_bytes())
    code = sha + ":" + digest.hexdigest()[:16]
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S")
    version = f"ldn-{stamp}-{digest.hexdigest()[:6]}"
    execute(
        """INSERT INTO feature_versions(id,status,snapshots,code_version,parameters)
        VALUES(:id,'building',CAST(:snapshots AS jsonb),:code,CAST(:parameters AS jsonb))""",
        {
            "id": version,
            "snapshots": json.dumps(snapshots),
            "code": code,
            "parameters": json.dumps({**PARAMETERS, "reference_time": reference_time.isoformat()}),
        },
    )
    try:
        lsoas = geo_table("geo_lsoa", snapshots["geography"]).rename_geometry("geometry")
        pop = pd.DataFrame(
            rows(
                "SELECT code,population,households FROM population WHERE snapshot_id=:s",
                {"s": snapshots["ons"]},
            )
        )
        lsoas = lsoas.merge(pop, on="code", how="left")
        if lsoas.population.isna().mean() > 0.01:
            raise ValueError("ONS and geometry coverage mismatch >1%")
        lsoas["lsoa_area"] = lsoas.area
        pois = geo_table("pois", snapshots["osm"])
        london = lsoas.geometry.union_all()
        pois = pois[pois.geom.intersects(london)].copy()
        stations = geo_table("transport_stations", snapshots["tfl"]) if "tfl" in snapshots else None
        streets = geo_table("geo_high_streets", snapshots["gla"]) if "gla" in snapshots else None
        cost = {
            r["code"]: r["pressure"]
            for r in rows(
                "SELECT code,pressure FROM property_cost_proxy WHERE snapshot_id=:s",
                {"s": snapshots.get("voa", "")},
            )
        }
        incidents = {
            r["h3_id"]: r["n"]
            for r in rows(
                """SELECT h3_id,sum(incident_count) n FROM reported_incidents_agg
            WHERE snapshot_id=:s GROUP BY h3_id""",
                {"s": snapshots.get("police", "")},
            )
        }
        recency_values = recency(snapshots, reference_time)
        for res in (8, 9):
            log.info("Building H3 resolution %s", res)
            cells = grid(lsoas, res)
            cells["feature_version"] = version
            xy = cells[["x", "y"]].to_numpy()
            log.info("Allocating %s LSOAs onto %s cells", len(lsoas), len(cells))
            overlay = gpd.overlay(
                cells[["h3_id", "geometry"]],
                lsoas[["code", "borough", "population", "households", "lsoa_area", "geometry"]],
                how="intersection",
                keep_geom_type=True,
            )
            overlay["intersection_area"] = overlay.area
            overlay["fraction"] = overlay.intersection_area / overlay.lsoa_area
            overlay["population_part"] = overlay.population * overlay.fraction
            overlay["household_part"] = overlay.households * overlay.fraction
            allocated = overlay.groupby("h3_id")[
                ["population_part", "household_part", "intersection_area"]
            ].sum()
            main = (
                overlay.sort_values("intersection_area", ascending=False)
                .drop_duplicates("h3_id")
                .set_index("h3_id")
            )
            cells = cells.join(allocated, on="h3_id").join(main[["code", "borough"]], on="h3_id")
            cells["population"] = cells.population_part.fillna(0)
            cells["households"] = cells.household_part
            cells["population_density"] = cells.population / np.maximum(cells.intersection_area, 1) * 1e6
            if abs(cells.population.sum() / lsoas.population.sum() - 1) > 0.001:
                raise ValueError("Population allocation failed mass conservation")
            if set(cells.borough) != LONDON_BOROUGHS:
                raise ValueError("Borough disappears in H3 coverage")
            poi_xy = np.c_[pois.geom.x, pois.geom.y]
            neighbors = cKDTree(poi_xy).query_ball_point(xy, PARAMETERS["venue_catchment_m"])
            categories = sorted(pois.category.unique())
            cat_idx = {c: i for i, c in enumerate(categories)}
            codes = pois.category.map(cat_idx).to_numpy()
            counts = np.stack([np.bincount(codes[n], minlength=len(categories)) for n in neighbors])
            counts_by_cat = {c: counts[:, i] for c, i in cat_idx.items()}
            cells["poi_counts"] = [
                {c: int(counts[i, j]) for c, j in cat_idx.items() if counts[i, j]} for i in range(len(cells))
            ]
            if stations is not None and not stations.empty:
                station_xy = np.c_[stations.geom.x, stations.geom.y]
                dist = distance.cdist(xy, station_xy)
                nearest = dist.argmin(axis=1)
                cells["station_distance_m"] = dist[np.arange(len(cells)), nearest]
                cells["nearest_station"] = stations.name.to_numpy()[nearest]
                influence = np.exp(-dist / PARAMETERS["station_decay_m"])
                influence[dist > PARAMETERS["station_cutoff_m"]] = 0
                cells["transit_demand"] = influence @ stations.daily_demand.to_numpy()
                cells["transit_access"] = np.exp(-cells.station_distance_m / 600)
                matching = stations.match_quality.to_numpy()[nearest]
            else:
                influence = None
                cells["station_distance_m"] = np.nan
                cells["nearest_station"] = None
                cells["transit_demand"] = np.nan
                cells["transit_access"] = np.nan
                matching = 0.5
            if streets is not None:
                pairs = streets.sindex.nearest(cells.geometry, return_all=False, return_distance=True)
                si = pairs[0][1]
                cells["high_street_distance"] = pairs[1]
                cells["high_street_flag"] = pairs[1] < 1
                cells["high_street_name"] = streets.name.to_numpy()[si]
            else:
                cells["high_street_distance"] = np.nan
                cells["high_street_flag"] = False
                cells["high_street_name"] = None
            cells["occupancy_cost_pressure"] = cells.borough.map(cost).astype(float)
            cells["incident_count"] = (
                cells.h3_id.map(incidents).fillna(0) if "police" in snapshots else np.nan
            )
            cells["reported_incident_rate_proxy"] = cells.incident_count / cells.area_m2 * 1e6 / 3
            cells["recency_confidence"] = float(np.mean(list(recency_values.values())))
            cells["spatial_confidence"] = (
                0.8 * matching
            )  # Population area allocation + borough-level cost context.
            cells["source_coverage"] = [
                {k: k in snapshots for k in ["ons", "osm", "tfl", "police", "voa", "gla"]}
                for _ in range(len(cells))
            ]
            persist_features(cells, version)
            log.info("Fitting six spatial supply models at resolution %s", res)
            build_models(cells, counts_by_cat, version)
            if influence is not None:
                profile_rows = rows(
                    "SELECT station_id,day_type,values FROM transport_profiles WHERE snapshot_id=:s",
                    {"s": snapshots["tfl"]},
                )
                by_day = {
                    day: {r["station_id"]: r["values"] for r in profile_rows if r["day_type"] == day}
                    for day in sorted({r["day_type"] for r in profile_rows})
                }
                with engine().begin() as conn:
                    for day, profiles in by_day.items():
                        mat = np.array([profiles.get(s, np.zeros(96)) for s in stations.id])
                        temporal = influence @ mat
                        data = [
                            dict(v=version, h=c, d=day, values=np.round(temporal[i], 3).tolist())
                            for i, c in enumerate(cells.h3_id)
                        ]
                        conn.execute(
                            text(
                                "INSERT INTO h3_transport_time_profile(feature_version,h3_id,day_type,values) "
                                "VALUES(:v,:h,:d,:values)"
                            ),
                            data,
                        )
        qa = validate_version(version)
        execute(
            "UPDATE feature_versions SET status='validated',qa=CAST(:qa AS jsonb) WHERE id=:v",
            {"v": version, "qa": json.dumps(qa, default=float)},
        )
        return version
    except Exception:
        execute("UPDATE feature_versions SET status='failed' WHERE id=:v", {"v": version})
        raise


def persist_features(cells, version):
    geographic = cells.to_crs(4326)
    geo_records = []
    features = []
    fields = [
        "resolution",
        "population",
        "population_density",
        "households",
        "transit_demand",
        "transit_access",
        "nearest_station",
        "station_distance_m",
        "high_street_flag",
        "high_street_distance",
        "high_street_name",
        "reported_incident_rate_proxy",
        "incident_count",
        "occupancy_cost_pressure",
        "recency_confidence",
        "spatial_confidence",
    ]
    for (_, r), (_, g) in zip(cells.iterrows(), geographic.iterrows(), strict=True):
        lat, lon = h3.cell_to_latlng(r.h3_id)
        geo_records.append(
            dict(
                h=r.h3_id,
                res=int(r.resolution),
                geom=g.geometry.wkt,
                centroid=f"POINT({lon} {lat})",
                area=float(r.area_m2),
                borough=r.borough,
                lsoa=r.code,
            )
        )
        item = {"feature_version": version, "h3_id": r.h3_id}
        for f in fields:
            v = r[f]
            item[f] = None if pd.isna(v) else v.item() if isinstance(v, np.generic) else v
        item.update(poi_counts=json.dumps(r.poi_counts), source_coverage=json.dumps(r.source_coverage))
        features.append(item)
    keys = ["feature_version", "h3_id"] + fields + ["poi_counts", "source_coverage"]
    values = ",".join(
        f"CAST(:{k} AS jsonb)" if k in ("poi_counts", "source_coverage") else ":" + k for k in keys
    )
    with engine().begin() as conn:
        conn.execute(
            text("""INSERT INTO geo_h3_cells(h3_id,resolution,geom,centroid,area_m2,borough,lsoa_code)
            VALUES(:h,:res,ST_GeomFromText(:geom,4326),ST_GeomFromText(:centroid,4326),:area,:borough,:lsoa)
            ON CONFLICT(h3_id) DO NOTHING"""),
            geo_records,
        )
        conn.execute(text(f"INSERT INTO h3_features({','.join(keys)}) VALUES({values})"), features)


def build_models(cells, counts, version):
    groups = np.array([h3.cell_to_parent(c, 5) for c in cells.h3_id])
    xy = cells[["x", "y"]].to_numpy()
    pop = percentile(cells.population_density)
    transport = percentile(cells.transit_demand)
    high = np.exp(-cells.high_street_distance.fillna(100000).to_numpy() / 300)
    high_n = percentile(high)
    access = 0.8 * percentile(cells.transit_access) + 0.2 * percentile(
        counts.get("transport", np.zeros(len(cells)))
    )
    cost = percentile(cells.occupancy_cost_pressure, inverse=True)
    operational = percentile(cells.reported_incident_rate_proxy, inverse=True)
    for business, profile in PROFILES.items():
        log.info("Model: %s / H3-%s", business, cells.resolution.iloc[0])
        complementary = sum((counts.get(c, np.zeros(len(cells))) for c in profile["complements"]))
        ecosystem = percentile(complementary)
        target = TARGET_CATEGORY[business]
        # Observed supply is mapped venues inside the cell; predictors use surrounding complementary venues only.
        # Counts in the feature's 600m catchment are evidence; target below is independently assigned to H3.
        observed_rows = rows(
            """SELECT h3_8,h3_9,count(*) n FROM pois WHERE snapshot_id=(
            SELECT snapshots->>'osm' FROM feature_versions WHERE id=:v) AND category=:cat GROUP BY h3_8,h3_9""",
            {"v": version, "cat": target},
        )
        hfield = "h3_" + str(cells.resolution.iloc[0])
        by_cell = {}
        for r in observed_rows:
            by_cell[r[hfield]] = by_cell.get(r[hfield], 0) + r["n"]
        observed = np.array([by_cell.get(c, 0) for c in cells.h3_id], dtype=float)
        x = np.c_[
            cells.population_density.fillna(0),
            cells.transit_access.fillna(0),
            complementary,
            high,
            cells.occupancy_cost_pressure.fillna(cells.occupancy_cost_pressure.median()).fillna(0),
        ]
        expected, model_confidence, metrics, residual = fit_white_space(x, observed, groups, xy)
        model_id = f"{version}-{business}-r{cells.resolution.iloc[0]}"
        execute(
            """INSERT INTO model_versions(id,feature_version,business_type,resolution,family,parameters,metrics)
            VALUES(:id,:v,:b,:r,:f,CAST(:p AS jsonb),CAST(:m AS jsonb))""",
            {
                "id": model_id,
                "v": version,
                "b": business,
                "r": int(cells.resolution.iloc[0]),
                "f": metrics["family"],
                "p": json.dumps(metrics["parameters"]),
                "m": json.dumps(metrics),
            },
        )
        white = percentile(residual, log_transform=False)
        residential = business in ("bakery", "gym", "convenience")
        demand = (
            (0.6 * pop + 0.25 * transport + 0.15 * high_n)
            if residential
            else (0.35 * pop + 0.45 * transport + 0.20 * high_n)
        )
        coverage = np.array([sum(r.values()) / 6 for r in cells.source_coverage])
        # A POI coverage proxy, not verified business-register completeness.
        coverage *= 0.85 + 0.15 * np.minimum(np.array([sum(r.values()) for r in cells.poi_counts]) / 30, 1)
        coverage *= np.where(cells.occupancy_cost_pressure.isna(), 0.8, 1)
        confidence = np.power(
            coverage
            * cells.recency_confidence.to_numpy()
            * cells.spatial_confidence.to_numpy()
            * model_confidence,
            0.25,
        )
        matrix = np.c_[demand, access, white, ecosystem, cost, operational]
        raw, final = opportunity(matrix, confidence, profile["weights"])
        # Deterministic score ties use H3 lexical order.
        order = np.lexsort((cells.h3_id.to_numpy(), -final))
        ranks = np.empty(len(final), dtype=int)
        ranks[order] = np.arange(1, len(final) + 1)
        components, scores = [], []
        for i, cell in enumerate(cells.h3_id):
            d = dict(
                v=version,
                h=cell,
                b=business,
                m=model_id,
                confidence=float(confidence[i]),
                coverage_confidence=float(coverage[i]),
                model_confidence=float(model_confidence[i]),
                expected_supply=float(expected[i]),
                observed_supply=float(observed[i]),
                supply_gap=float(expected[i] - observed[i]),
            )
            d.update({key: float(matrix[i, j]) for j, key in enumerate(COMPONENTS)})
            components.append(d)
            scores.append(
                dict(
                    v=version,
                    h=cell,
                    b=business,
                    score=float(final[i]),
                    raw=float(raw[i]),
                    rank=int(ranks[i]),
                )
            )
        fields = list(COMPONENTS) + [
            "confidence",
            "coverage_confidence",
            "model_confidence",
            "expected_supply",
            "observed_supply",
            "supply_gap",
        ]
        with engine().begin() as conn:
            conn.execute(
                text(
                    "INSERT INTO h3_component_scores(feature_version,h3_id,business_type,model_version,"
                    + ",".join(fields)
                    + ") VALUES(:v,:h,:b,:m,"
                    + ",".join(":" + f for f in fields)
                    + ")"
                ),
                components,
            )
            conn.execute(
                text("""INSERT INTO h3_opportunity_scores(feature_version,h3_id,business_type,score,raw_score,rank)
                VALUES(:v,:h,:b,:score,:raw,:rank)"""),
                scores,
            )
            conn.execute(
                text("""INSERT INTO business_profiles(id,name,weights,complements) VALUES(:id,:name,CAST(:w AS jsonb),CAST(:c AS jsonb))
                ON CONFLICT(id) DO UPDATE SET weights=excluded.weights,complements=excluded.complements"""),
                {
                    "id": business,
                    "name": profile["name"],
                    "w": json.dumps(profile["weights"]),
                    "c": json.dumps(profile["complements"]),
                },
            )


def validate_version(version):
    r = rows(
        """SELECT count(*) n,min(score) lo,max(score) hi,percentile_cont(.5) WITHIN GROUP(ORDER BY score) median
        FROM h3_opportunity_scores WHERE feature_version=:v""",
        {"v": version},
    )[0]
    if r["n"] < 10000 or r["lo"] < 0 or r["hi"] > 100:
        raise ValueError("Score range/coverage validation failed")
    coverage = rows(
        """SELECT f.resolution,count(DISTINCT g.borough) boroughs,count(*) cells FROM h3_features f
        JOIN geo_h3_cells g USING(h3_id) WHERE feature_version=:v GROUP BY f.resolution""",
        {"v": version},
    )
    if len(coverage) != 2 or any(c["boroughs"] != 33 for c in coverage):
        raise ValueError("London borough / resolution coverage failed")
    integrity = rows(
        """SELECT count(*) FILTER(WHERE c.confidence NOT BETWEEN 0 AND 1 OR
        c.demand NOT BETWEEN 0 AND 100 OR c.access NOT BETWEEN 0 AND 100 OR c.white_space NOT BETWEEN 0 AND 100
        OR c.ecosystem NOT BETWEEN 0 AND 100 OR c.cost_efficiency NOT BETWEEN 0 AND 100
        OR c.operational_context NOT BETWEEN 0 AND 100 OR c.expected_supply<0) invalid,
        count(DISTINCT c.business_type) profiles,count(DISTINCT c.model_version) models
        FROM h3_component_scores c WHERE feature_version=:v""",
        {"v": version},
    )[0]
    if integrity["invalid"] or integrity["profiles"] != 6 or integrity["models"] != 12:
        raise ValueError(f"Component/model completeness failed: {integrity}")
    if r["n"] != sum(c["cells"] for c in coverage) * 6:
        raise ValueError("Missing business profile scores for H3 cells")
    summaries = rows(
        """SELECT c.business_type,f.resolution,count(*) cells,
        avg(c.confidence) confidence,avg(c.observed_supply) supply,
        avg(CASE WHEN f.occupancy_cost_pressure IS NULL THEN 1.0 ELSE 0 END) missing_cost,
        avg(CASE WHEN f.transit_demand IS NULL THEN 1.0 ELSE 0 END) missing_transit
        FROM h3_component_scores c JOIN h3_features f USING(feature_version,h3_id)
        WHERE c.feature_version=:v GROUP BY c.business_type,f.resolution""",
        {"v": version},
    )
    if any(s["confidence"] < 0.4 or s["missing_cost"] > 0.5 or s["missing_transit"] > 0.5 for s in summaries):
        raise ValueError("Confidence or source coverage collapsed")
    old = rows("SELECT id FROM feature_versions WHERE status='active'")
    warnings = []
    if old:
        drift = rows(
            """SELECT percentile_cont(.5) WITHIN GROUP(ORDER BY abs(a.score-b.score)) shift,
            avg(CASE WHEN a.rank<=20 AND b.rank<=20 THEN 1.0 ELSE 0 END) FILTER(WHERE a.rank<=20) retention
            FROM h3_opportunity_scores a JOIN h3_opportunity_scores b USING(h3_id,business_type)
            WHERE a.feature_version=:v AND b.feature_version=:old""",
            {"v": version, "old": old[0]["id"]},
        )[0]
        if drift["shift"] is None or drift["shift"] > 10 or (drift["retention"] or 0) < 0.25:
            raise ValueError(f"Score drift gate failed: {drift}")
        warnings.append({"score_drift": drift})
        previous = rows(
            """SELECT c.business_type,f.resolution,avg(c.confidence) confidence,avg(c.observed_supply) supply
            FROM h3_component_scores c JOIN h3_features f USING(feature_version,h3_id)
            WHERE c.feature_version=:v GROUP BY c.business_type,f.resolution""",
            {"v": old[0]["id"]},
        )
        for item in summaries:
            prior = next(
                p
                for p in previous
                if (p["business_type"], p["resolution"]) == (item["business_type"], item["resolution"])
            )
            if item["confidence"] < prior["confidence"] - 0.15 or item["supply"] < prior["supply"] * 0.6:
                raise ValueError(
                    f"Category supply/confidence drift failed: {item['business_type']} / {item['resolution']}"
                )
    return {
        "scores": r,
        "coverage": coverage,
        "warnings": warnings,
        "integrity": integrity,
        "profiles": summaries,
        "passed": True,
    }


def activate(version):
    validate_version(version)
    with engine().begin() as conn:
        conn.execute(text("SELECT pg_advisory_xact_lock(8808001)"))
        candidate = conn.execute(
            text("SELECT status FROM feature_versions WHERE id=:v FOR UPDATE"), {"v": version}
        ).scalar()
        if candidate not in ("validated", "active"):
            raise ValueError("Only a fully validated feature version can be activated")
        conn.execute(
            text("UPDATE feature_versions SET status='retired' WHERE status='active' AND id<>:v"),
            {"v": version},
        )
        conn.execute(text("UPDATE feature_versions SET status='active' WHERE id=:v"), {"v": version})
    log.info("Activated %s", version)
