# Verified London sources

Acquired automatically from official publishers and the Geofabrik regional OSM extract. These are the actual active snapshots, not sample data. `published_at` records a reference/observation date when no separate publication timestamp is exposed; resolved release metadata is retained per asset.

| Source | Reference date | Retrieved UTC | Validated rows | Snapshot |
|---|---|---|---:|---|
| [London LSOA 2021 boundaries](https://data.london.gov.uk/download/20od9/2a5e50ac-c22e-4d68-89e2-85f1e0ff9057/LB_LSOA2021_shp.zip) | 2021 | 2026-09-11 11:48 | 4,994 | `geography-20260911T114826-780394` |
| [GLA High Street boundaries](https://data.london.gov.uk/download/2rq4w/894c1d85-774b-487e-9c5a-30c71d41a104/GLA_High_Street_boundaries_2.gpkg) | Unknown | 2026-09-11 11:48 | 640 | `gla-20260911T114826-861d22` |
| [ONS mid-year LSOA population estimates and Census households](https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/lowersuperoutputareamidyearpopulationestimates/mid2022revisednov2025tomid2024/sapelsoasyoa20222024.xlsx) | 2024-06-30 | 2026-09-11 13:05 | 4,994 | `ons-20260911T130505-86d4aa` |
| [Greater London OpenStreetMap regional extract](https://download.geofabrik.de/europe/united-kingdom/england/greater-london-260910.osm.pbf) | 2026-09-10T20:21:06Z | 2026-09-11 11:51 | 113,342 | `osm-20260911T115017-a687db` |
| [Street-level reported incidents: rolling three-month window](https://data.police.uk/api/crimes-street/all-crime?poly=51.356760%2C-0.390377%3A51.426760%2C-0.390377%3A51.426760%2C-0.510377%3A51.356760%2C-0.510377&date=2026-07) | 2026-07-01 | 2026-09-11 11:58 | 46,079 | `police-20260911T115653-36bba7` |
| [NUMBAT typical station entries and exits](https://crowding.data.tfl.gov.uk/NUMBAT/NUMBAT%202025/NBT25SAT_Outputs.xlsx) | 2025-11-01 | 2026-09-11 11:49 | 1,656 | `tfl-20260911T114826-f8995c` |
| [Non-domestic rating stock: rateable value bands](https://assets.publishing.service.gov.uk/media/69f9bdf98f3213f7384ecae4/ndr_stock_scat_la_2026.zip) | 2026-03-31 | 2026-09-11 11:48 | 33 | `voa-20260911T114826-1ca71a` |

## Acquisition and interpretation

- Geography: official GLA LSOA2021 ZIP contains 33 borough shapefile layers. All 4,994 LSOAs were loaded and reprojected from BNG.
- ONS: latest linked workbook, latest mid-year sheet, all-person totals only. Households come separately from Nomis Census2021 TS041. Population is mid-2024 and households 2021.
- OSM: discover Greater London extract, choose the latest linked dated PBF and verify its MD5 in addition to internal SHA-256. Parse nodes/areas with osmium, classify once and deduplicate representations within H3-12 when names/categories match. Canonical POIs retain extraction-bounding-box coverage; feature construction uses the actual London union.
- TfL: enumerate the official NUMBAT bucket, choose the latest common year and parse entries/exits for Tuesday–Thursday, Saturday and Sunday. NUMBAT2025 files were published in 2026. Match official StopPoint coordinates by normalised name; record rejected names and lower confidence for fuzzy matches.
- Police: discover the latest three available months, request tiles intersecting London, recursively subdivide requests exceeding the official result-size limit, deduplicate incident ID plus month, aggregate to H3. Recent coverage is May–July2026. Raw approximate coordinates remain in public-source files; the warehouse uses H3 counts.
- VOA/HMRC: discover the latest rating-stock release and local-authority rateable-value count bands. Interpolate the median band across all commercial stock in each London borough. No market-rent estimate.
- GLA high streets: discover the publicly linked geopackage and validate 640 polygons. No restricted HSDS mobility or spending data is used. Publication date is unknown and discounted.

All seven adapter contracts reject empty/schema-incompatible extracts and preserve previously verified data after failure. Initial failed attempts remain visible in snapshot history. Source-specific notes, checksums, full URLs and raw-file receipts are in `data/manifests` and `docs/release-data.json`.

## OSM taxonomy

First matching rule wins: cafe/shop coffee → coffee; shop bakery → bakery; restaurant/fast_food → respective category; pub/bar/biergarten → pub_bar; supermarket/convenience → respective category; fitness_centre/fitness_station/sports_centre → gym_fitness; coworking_space/office coworking → coworking; other occupied office → office; hotel/hostel/guest_house/motel → hotel; school → school; university/college → university; station/halt/bus_station → transport; park/garden → park; cinema/theatre/arts/bowling/arcade → entertainment; remaining occupied shops → retail; attraction/museum/gallery/viewpoint → tourism.

Broad gym tags include some facilities that are not membership gyms, and cafe tags include venues whose commercial offering is broader than coffee. The UI calls these mapped venues.

Period anchors: Police `2026-07-01` identifies the latest monthly file, not a single incident day. TfL `2025-11-01` is an autumn reference anchor used for freshness calculations; the underlying data describes typical autumn days. Structural geography `2021` is a boundary vintage.
