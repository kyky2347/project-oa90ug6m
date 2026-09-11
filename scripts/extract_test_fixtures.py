"""Extract small, attributed parser samples from verified raw snapshots. Never used by the app."""

import csv
import io
import json
from zipfile import ZipFile

import openpyxl
import osmium

from pipeline.db import ROOT, rows

out = ROOT / "data/fixtures"
out.mkdir(exist_ok=True)
sources = {
    r["source_id"]: r
    for r in rows(
        "SELECT DISTINCT ON(source_id) * FROM dataset_snapshots WHERE status='verified' ORDER BY source_id,retrieved_at DESC"
    )
}


def raw(source):
    return ROOT / sources[source]["raw_path"]


w = openpyxl.load_workbook(raw("ons") / "population.xlsx", read_only=True, data_only=True)
it = w["Mid-2024 LSOA 2021"].iter_rows(values_only=True, max_col=5)
for r in it:
    if r[0] == "LAD 2023 Code":
        header = r
        break
pop = []
for r in it:
    if r[0] and str(r[0]).startswith("E09"):
        pop.append(dict(zip(header, r)))
        if len(pop) == 2:
            break
w.close()
(out / "ons.json").write_text(json.dumps(pop, indent=2))
w = openpyxl.load_workbook(raw("tfl") / "weekday.xlsx", read_only=True, data_only=True)
small = openpyxl.Workbook()
small.remove(small.active)
for name in ["Station_Entries", "Station_Exits"]:
    ws = small.create_sheet(name)
    it = w[name].iter_rows(values_only=True)
    for r in it:
        if r[0] == "NLC":
            ws.append(r)
            break
    for r in it:
        if r[0] and r[1] and isinstance(r[2], str):
            ws.append(r)
            break
w.close()
small.save(out / "tfl.xlsx")
z = ZipFile(raw("voa") / "bands.zip")
reader = csv.DictReader(io.StringIO(z.read("SOP_SCAT_LA_counts_0_12000.csv").decode("utf-8-sig")))
records = [r for r in reader if r["area_code"].startswith("E09")][:2]
with (out / "voa.csv").open("w") as f:
    writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
    writer.writeheader()
    writer.writerows(records)
records = []
for p in sorted(raw("police").glob("*.json")):
    if p.name.endswith("receipt.json") or p.name == "metadata.json":
        continue
    rs = json.loads(p.read_text())
    if isinstance(rs, list):
        records.extend(r for r in rs if r.get("location"))
    if len(records) > 2:
        break
# Retain only fields required by parser, excluding outcomes and street descriptions.
(out / "police.json").write_text(
    json.dumps([{k: r[k] for k in ("id", "month", "category", "location")} for r in records[:2]], indent=2)
)
features = []
for table, source in [("geo_lsoa", "geography"), ("geo_high_streets", "gla")]:
    r = rows(
        f"SELECT name,ST_AsGeoJSON(geom) geom FROM {table} WHERE snapshot_id=:s LIMIT 1",
        {"s": sources[source]["id"]},
    )[0]
    features.append(
        {
            "type": "Feature",
            "geometry": json.loads(r["geom"]),
            "properties": {"source": source, "name": r["name"]},
        }
    )
(out / "polygons.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": features}))


class Done(Exception):
    pass


class FirstCoffee(osmium.SimpleHandler):
    def node(self, n):
        if n.tags.get("amenity") == "cafe" and n.location.valid():
            (out / "osm.json").write_text(
                json.dumps(
                    {
                        "id": f"n{n.id}",
                        "tags": dict(n.tags),
                        "longitude": n.location.lon,
                        "latitude": n.location.lat,
                    },
                    indent=2,
                )
            )
            raise Done


try:
    FirstCoffee().apply_file(str(raw("osm") / "london.osm.pbf"))
except Done:
    pass
(out / "README.md").write_text(
    "# Parser fixtures\n\nSmall real excerpts from the verified snapshots listed below. These files are exclusively test inputs; production never loads them. Geometries retain original precision. ONS sample uses all-person totals only. TfL retains one station and 96 quarter-hours from each of entries and exits. VOA retains two London rows. OSM retains one cafe node and its public tags. Police coordinates remain approximate.\n\n"
    + "\n".join(f"- {k}: `{v['id']}`. {v['license']}. Source: {v['source_url']}" for k, v in sources.items())
)
