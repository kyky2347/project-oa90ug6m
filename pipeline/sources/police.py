import hashlib
import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict
from urllib.parse import urlencode

import h3
import httpx
import numpy as np
from shapely import box, from_wkt

from pipeline.db import rows
from pipeline.sources.base import Asset, Source, request


def parse_incidents(data):
    if not isinstance(data, list):
        raise ValueError("Police response must be an array")
    records = []
    for r in data:
        if not {"id", "month", "category", "location"} <= r.keys():
            raise ValueError("Police incident schema changed")
        loc = r["location"]
        if loc is None:
            continue
        if not {"latitude", "longitude"} <= loc.keys():
            raise ValueError("Police location schema changed")
        lat, lon = float(loc["latitude"]), float(loc["longitude"])
        if not (-0.8 < lon < 0.5 and 51.1 < lat < 51.9):
            raise ValueError("Police point outside plausible London bounds")
        records.append((str(r["id"]), r["month"], lat, lon))
    return records


class PoliceSource(Source):
    id = "police"
    name = "Street-level reported incidents: rolling three-month window"
    publisher = "UK Police / data.police.uk"
    url = "https://data.police.uk/docs/method/crime-street/"

    def discover(self):
        dates_url = "https://data.police.uk/api/crimes-street-dates"
        months = sorted([r["date"] for r in request(dates_url).json()], reverse=True)[:3]
        geography = rows(
            "SELECT ST_AsText(ST_UnaryUnion(ST_Collect(geom))) AS geom FROM geo_lsoa "
            "WHERE snapshot_id=(SELECT id FROM dataset_snapshots WHERE source_id='geography' "
            "AND status='verified' ORDER BY retrieved_at DESC LIMIT 1)"
        )
        if not geography or not geography[0]["geom"]:
            raise ValueError("Load official London geography before Police ingestion")
        london = from_wkt(geography[0]["geom"])
        x0, y0, x1, y1 = london.bounds
        assets = []
        for ix, x in enumerate(np.arange(x0, x1, 0.12)):
            for iy, y in enumerate(np.arange(y0, y1, 0.07)):
                tile = box(x, y, min(x + 0.12, x1), min(y + 0.07, y1))
                if not tile.intersects(london):
                    continue
                coords = list(tile.exterior.coords)[:-1]
                poly = ":".join(f"{lat:.6f},{lon:.6f}" for lon, lat in coords)
                for month in months:
                    url = "https://data.police.uk/api/crimes-street/all-crime?" + urlencode(
                        {"poly": poly, "date": month}
                    )
                    assets.append(
                        Asset(
                            url,
                            f"{month}-{ix}-{iy}.json",
                            month + "-01",
                            {
                                "month": month,
                                "tile": [
                                    float(x),
                                    float(y),
                                    min(float(x + 0.12), x1),
                                    min(float(y + 0.07), y1),
                                ],
                            },
                        )
                    )
        self.notes = [
            f"Complete spatial tile requests for {', '.join(months)}. Cross-tile incidents deduplicated by ID + month.",
            "Coordinates are anonymised approximate locations. Warehouse stores H3 aggregates only.",
            "Incident intensity uses area and month exposure, not a resident victimisation or safety rate.",
        ]
        return assets

    def download(self, assets, directory):
        # Two concurrent requests keeps pressure on the public API low. Failed tiles invalidate the snapshot.
        def one(a, depth=0):
            try:
                return super(PoliceSource, self).download([a], directory)[0]
            except httpx.HTTPStatusError as exc:
                # Police documents 503 for queries with more than 10,000 incidents.
                if exc.response.status_code != 503 or depth >= 3:
                    raise
                x0, y0, x1, y1 = a.extra["tile"]
                mx, my = (x0 + x1) / 2, (y0 + y1) / 2
                children, combined = [], []
                for i, bounds in enumerate(
                    [(x0, y0, mx, my), (mx, y0, x1, my), (x0, my, mx, y1), (mx, my, x1, y1)]
                ):
                    tile = box(*bounds)
                    poly = ":".join(f"{lat:.6f},{lon:.6f}" for lon, lat in list(tile.exterior.coords)[:-1])
                    url = "https://data.police.uk/api/crimes-street/all-crime?" + urlencode(
                        {"poly": poly, "date": a.extra["month"]}
                    )
                    child = Asset(
                        url,
                        a.filename.replace(".json", f"-split{i}.json"),
                        a.published_at,
                        {"month": a.extra["month"], "tile": list(bounds)},
                    )
                    children.append(one(child, depth + 1))
                    combined.extend(json.loads((directory / child.filename).read_text()))
                content = json.dumps(combined).encode()
                (directory / a.filename).write_bytes(content)
                info = asdict(a)
                info["extra"]["actual_requests"] = children
                info["download"] = {
                    "sha256": hashlib.sha256(content).hexdigest(),
                    "bytes": len(content),
                    "resolved_url": a.url,
                    "content_type": "application/json",
                    "note": "Concatenated raw child responses after official API result-size limit",
                }
                return info

        with ThreadPoolExecutor(max_workers=2) as pool:
            return list(pool.map(one, assets))

    def transform(self, directory, assets):
        seen, counts = set(), Counter()
        for a in assets:
            incidents = parse_incidents(json.loads((directory / a.filename).read_text()))
            for identifier, month, lat, lon in incidents:
                key = (identifier, month)
                if key in seen:
                    continue
                seen.add(key)
                for res in (8, 9):
                    counts[(h3.latlng_to_cell(lat, lon, res), month)] += 1
        if len(seen) < 100000:
            raise ValueError(f"Unexpectedly few incidents for London / three months: {len(seen)}")
        return {
            "reported_incidents_agg": [
                dict(h3_id=k[0], month=k[1], incident_count=v) for k, v in counts.items()
            ]
        }
