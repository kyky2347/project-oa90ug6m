import json

from pipeline.db import ROOT, rows

v = rows("SELECT * FROM feature_versions WHERE status='active'")[0]
sources = rows(
    "SELECT d.*,s.publisher FROM dataset_snapshots d JOIN dataset_sources s ON s.id=d.source_id WHERE d.id=ANY(:ids) ORDER BY d.source_id",
    {"ids": list(v["snapshots"].values())},
)
models = rows(
    "SELECT * FROM model_versions WHERE feature_version=:v ORDER BY resolution,business_type", {"v": v["id"]}
)
report = {"feature_version": v, "sources": sources, "models": models}
(ROOT / "docs/release-data.json").write_text(json.dumps(report, indent=2, default=str))
text = "# Verified London sources\n\nAcquired automatically from official publishers and the Geofabrik regional OSM extract. These are the actual active snapshots, not sample data. `published_at` records a reference/observation date when no separate publication timestamp is exposed; resolved release metadata is retained per asset.\n\n| Source | Reference date | Retrieved UTC | Validated rows | Snapshot |\n|---|---|---|---:|---|\n"
for s in sources:
    text += f"| [{s['dataset_name']}]({s['source_url']}) | {s['published_at'] or 'Unknown'} | {s['retrieved_at'].strftime('%Y-%m-%d %H:%M')} | {s['row_count']:,} | `{s['id']}` |\n"
text += """\n## Acquisition and interpretation\n\n- Geography: official GLA LSOA2021 ZIP contains 33 borough shapefile layers. All 4,994 LSOAs were loaded and reprojected from BNG.\n- ONS: latest linked workbook, latest mid-year sheet, all-person totals only. Households come separately from Nomis Census2021 TS041. Population is mid-2024 and households 2021.\n- OSM: discover Greater London extract, choose the latest linked dated PBF and verify its MD5 in addition to internal SHA-256. Parse nodes/areas with osmium, classify once and deduplicate representations within H3-12 when names/categories match. Canonical POIs retain extraction-bounding-box coverage; feature construction uses the actual London union.\n- TfL: enumerate the official NUMBAT bucket, choose the latest common year and parse entries/exits for Tuesday–Thursday, Saturday and Sunday. NUMBAT2025 files were published in 2026. Match official StopPoint coordinates by normalised name; record rejected names and lower confidence for fuzzy matches.\n- Police: discover the latest three available months, request tiles intersecting London, recursively subdivide requests exceeding the official result-size limit, deduplicate incident ID plus month, aggregate to H3. Recent coverage is May–July2026. Raw approximate coordinates remain in public-source files; the warehouse uses H3 counts.\n- VOA/HMRC: discover the latest rating-stock release and local-authority rateable-value count bands. Interpolate the median band across all commercial stock in each London borough. No market-rent estimate.\n- GLA high streets: discover the publicly linked geopackage and validate 640 polygons. No restricted HSDS mobility or spending data is used. Publication date is unknown and discounted.\n\nAll seven adapter contracts reject empty/schema-incompatible extracts and preserve previously verified data after failure. Initial failed attempts remain visible in snapshot history. Source-specific notes, checksums, full URLs and raw-file receipts are in `data/manifests` and `docs/release-data.json`.\n\n## OSM taxonomy\n\nFirst matching rule wins: cafe/shop coffee → coffee; shop bakery → bakery; restaurant/fast_food → respective category; pub/bar/biergarten → pub_bar; supermarket/convenience → respective category; fitness_centre/fitness_station/sports_centre → gym_fitness; coworking_space/office coworking → coworking; other occupied office → office; hotel/hostel/guest_house/motel → hotel; school → school; university/college → university; station/halt/bus_station → transport; park/garden → park; cinema/theatre/arts/bowling/arcade → entertainment; remaining occupied shops → retail; attraction/museum/gallery/viewpoint → tourism.\n\nBroad gym tags include some facilities that are not membership gyms, and cafe tags include venues whose commercial offering is broader than coffee. The UI calls these mapped venues.\n"""
(ROOT / "docs/data-sources.md").write_text(text)
print(v["id"])
print(
    [
        (m["business_type"], m["resolution"], m["metrics"]["cv_mae"], m["metrics"]["cv_baseline_mae"])
        for m in models
    ]
)
