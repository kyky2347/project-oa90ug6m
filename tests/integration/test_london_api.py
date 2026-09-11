import json

import h3
import numpy as np
import pytest
from fastapi.testclient import TestClient

from apps.api.main import app
from packages.scoring.core import COMPONENTS, PROFILES
from pipeline.db import rows
from pipeline.features.build import validate_version

pytestmark = pytest.mark.integration
client = TestClient(app)


@pytest.fixture(scope="module")
def sites():
    response = client.get("/rankings")
    assert response.status_code == 200, response.text
    return response.json()["sites"][:2]


def test_real_london_spatial_database_and_version():
    v = client.get("/health").json()["feature_version"]
    assert v and validate_version(v)["passed"]
    checks = rows(
        "SELECT count(*) n,count(DISTINCT borough) boroughs,bool_and(ST_IsValid(geom)) valid FROM geo_h3_cells"
    )[0]
    assert checks["boroughs"] == 33 and checks["valid"] and checks["n"] > 19000
    total = rows(
        "SELECT sum(population) n FROM population WHERE snapshot_id=(SELECT snapshots->>'ons' FROM feature_versions WHERE id=:v)",
        {"v": v},
    )[0]["n"]
    for r in rows(
        "SELECT resolution,sum(population) n FROM h3_features WHERE feature_version=:v GROUP BY resolution",
        {"v": v},
    ):
        assert r["n"] == pytest.approx(total, rel=0.001)


@pytest.mark.parametrize("resolution", [8, 9])
def test_numeric_query_resolution_map_cache_and_geometry(resolution):
    url = f"/map/opportunity?resolution={resolution}&bbox=-0.17,51.49,-0.10,51.53"
    first = client.get(url)
    assert first.status_code == 200, first.text
    d = first.json()
    assert d["cells"] and all(h3.get_resolution(c["h3"]) == resolution for c in d["cells"])
    second = client.get(url)
    assert second.json() == d
    etag = client.get(url, headers={"If-None-Match": first.headers["etag"]})
    assert etag.status_code == 304


@pytest.mark.parametrize("business", list(PROFILES))
def test_rankings_deterministic_exclude_low_confidence(business):
    result = client.get("/rankings", params={"business": business, "min_confidence": 0.75}).json()["sites"]
    assert len(result) == 20 and all(c["confidence"] >= 0.75 for c in result)
    assert [c["score"] for c in result] == sorted([c["score"] for c in result], reverse=True)
    assert (
        result
        == client.get("/rankings", params={"business": business, "min_confidence": 0.75}).json()["sites"]
    )


def test_cell_explanation_custom_weights_and_context(sites):
    h = sites[0]["h3"]
    d = client.get(f"/cells/{h}").json()
    assert d["nearby_pois"] and d["raw"]["population"] > 0 and d["source_snapshots"]
    assert 50 + sum(c["contribution"] for c in d["explanation"]["contributions"]) == pytest.approx(
        d["score"], abs=0.0051
    )
    w = {k: 100 if k == "demand" else 0 for k in COMPONENTS}
    custom = client.get(f"/cells/{h}", params={"weights": json.dumps(w)}).json()
    assert custom["score"] == pytest.approx(
        50 + custom["confidence"] * (custom["components"]["demand"] - 50), abs=0.02
    )
    for kind in ["high_streets", "stations", "competitors"]:
        r = client.get("/map/context", params={"kind": kind, "bbox": "-0.17,51.49,-0.10,51.53"})
        assert r.status_code == 200 and r.json()["type"] == "FeatureCollection"


@pytest.mark.parametrize("minutes", [5, 10, 15])
def test_radial_catchment(sites, minutes):
    r = client.get(f"/cells/{sites[0]['h3']}/catchment", params={"minutes": minutes})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["radius_m"] == minutes * 80 and d["metrics"]["population"] > 0
    assert d["geometry"]["type"] == "Polygon" and "Radial" in d["method"]
    assert len(d["opportunity_distribution"]) == 3


def test_comparison_and_time_profiles(sites):
    r = client.post("/compare", json={"sites": [s["h3"] for s in sites]})
    assert r.status_code == 200, r.text
    assert len(r.json()["deltas"]) == 6 and len(r.json()["sites"]) == 2
    for day in ["weekday", "saturday", "sunday"]:
        p = client.get(
            "/pulse/time-profile", params={"day": day, "resolution": 8, "bbox": "-0.17,51.49,-0.10,51.53"}
        ).json()
        assert p["live"] is False and len(p["times"]) == 96 and len(p["cells"][0]["values"]) == 96
        assert np.ptp(p["total_influence"]) > 0


@pytest.mark.parametrize(
    "path",
    [
        "/map/opportunity?resolution=7",
        "/map/opportunity?bbox=0,0,1,1",
        "/rankings?business=casino",
        "/cells/not-h3",
        "/map/opportunity?weights=%7B%7D",
        "/cells/88195da49bfffff/catchment?minutes=17",
    ],
)
def test_bad_input_is_rejected(path):
    assert client.get(path).status_code == 422


def test_source_health_and_admin_disabled():
    sources = client.get("/sources").json()["sources"]
    assert len(sources) == 7 and all(s["latest_snapshot"]["checksum"] for s in sources)
    assert all(s["latest_snapshot"]["status"] == "verified" for s in sources)
    assert client.post("/admin/refresh/all").status_code in (401, 404)
