# Data model

All geometry uses EPSG:4326 in PostGIS. Distances and overlay calculations use EPSG:27700 or PostGIS geography metres. H3 identifiers are text; no h3-pg extension is required.

| Table                     | Grain and purpose                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- |
| dataset_sources           | One adapter, publisher, licence and cadence                                                                   |
| dataset_snapshots         | Immutable ingestion attempt and provenance, checksum, reference date, parser/schema version, raw path, health |
| ingestion_jobs            | Refresh job status, start/finish, machine-readable report and errors                                          |
| geo_lsoa                  | Snapshot × LSOA 2021 polygon and borough                                                                      |
| population                | Snapshot × LSOA; all-person population, households and reference year                                         |
| geo_high_streets          | Snapshot × official GLA high-street polygon                                                                   |
| pois                      | Snapshot × deduplicated OSM object; one canonical category and two H3 indices                                 |
| transport_stations        | Snapshot × matched NUMBAT station; geometry, typical daily demand, match quality                              |
| transport_profiles        | Snapshot × station × day type; 96 quarter-hours                                                               |
| reported_incidents_agg    | Snapshot × H3 × month; approximate incident count                                                             |
| property_cost_proxy       | Snapshot × borough × sector; grouped median rateable-value pressure                                           |
| geo_h3_cells              | H3 polygon, centroid, area, dominant borough and LSOA                                                         |
| feature_versions          | Snapshot map, code hash, parameters, validation report and activation status                                  |
| h3_features               | Feature version × H3; all raw explanatory inputs and source coverage                                          |
| model_versions            | Feature version × business × resolution; family, coefficients, preprocessing and spatial CV metrics           |
| h3_component_scores       | Feature version × business × H3; six components, confidence factors and supply estimates                      |
| h3_opportunity_scores     | Feature version × business × H3; default weighted raw/final score and deterministic rank                      |
| h3_transport_time_profile | Feature version × H3 × day; 96 precomputed influence values                                                   |
| business_profiles         | Six transparent defaults and complementary taxonomy lists                                                     |

Primary keys prevent duplicates; foreign keys connect snapshots and model versions. GiST indexes support geometry bounding boxes, nearby POIs and geography-distance queries. B-tree indexes support feature versions, business categories, boroughs and ranking. The initial schema can be run repeatedly without deleting user data.

Population is fractional internally after overlay; UI rounds to the nearest 100. Incident count is an area aggregation and not a person-level or address-level risk label. POI names are public OSM labels and are not guaranteed current trading names.
