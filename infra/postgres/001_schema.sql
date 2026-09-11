CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE TABLE IF NOT EXISTS dataset_sources (
 id text PRIMARY KEY, name text NOT NULL, publisher text NOT NULL, url text NOT NULL,
 license text NOT NULL, cadence_days integer NOT NULL, critical boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS dataset_snapshots (
 id text PRIMARY KEY, source_id text NOT NULL REFERENCES dataset_sources(id), dataset_name text NOT NULL,
 source_url text NOT NULL, retrieved_at timestamptz NOT NULL DEFAULT now(), published_at text,
 license text NOT NULL, checksum text NOT NULL, row_count integer NOT NULL DEFAULT 0,
 status text NOT NULL, parser_version text NOT NULL, schema_version text NOT NULL,
 raw_path text NOT NULL, metadata jsonb NOT NULL DEFAULT '{}', error text
);
CREATE INDEX IF NOT EXISTS snapshots_source ON dataset_snapshots(source_id,retrieved_at DESC);
CREATE TABLE IF NOT EXISTS ingestion_jobs (
 id text PRIMARY KEY, source text, started_at timestamptz DEFAULT now(), finished_at timestamptz,
 status text NOT NULL, report jsonb DEFAULT '{}', error text
);
CREATE TABLE IF NOT EXISTS geo_lsoa (
 snapshot_id text REFERENCES dataset_snapshots(id), code text, name text, borough text,
 geom geometry(MultiPolygon,4326) NOT NULL, PRIMARY KEY(snapshot_id,code)
);
CREATE INDEX IF NOT EXISTS lsoa_geom ON geo_lsoa USING gist(geom);
CREATE INDEX IF NOT EXISTS lsoa_borough ON geo_lsoa(borough);
CREATE TABLE IF NOT EXISTS population (
 snapshot_id text REFERENCES dataset_snapshots(id), code text, population double precision NOT NULL,
 households double precision, year integer NOT NULL, PRIMARY KEY(snapshot_id,code)
);
CREATE TABLE IF NOT EXISTS geo_high_streets (
 snapshot_id text REFERENCES dataset_snapshots(id), id text, name text,
 geom geometry(MultiPolygon,4326) NOT NULL, PRIMARY KEY(snapshot_id,id)
);
CREATE INDEX IF NOT EXISTS high_streets_geom ON geo_high_streets USING gist(geom);
CREATE TABLE IF NOT EXISTS pois (
 snapshot_id text REFERENCES dataset_snapshots(id), id text, name text, category text NOT NULL,
 geom geometry(Point,4326) NOT NULL, h3_8 text, h3_9 text, PRIMARY KEY(snapshot_id,id)
);
CREATE INDEX IF NOT EXISTS pois_geom ON pois USING gist(geom);
CREATE INDEX IF NOT EXISTS pois_category ON pois(snapshot_id,category);
CREATE INDEX IF NOT EXISTS pois_h3 ON pois(h3_9);
CREATE TABLE IF NOT EXISTS transport_stations (
 snapshot_id text REFERENCES dataset_snapshots(id), id text, name text NOT NULL,
 geom geometry(Point,4326) NOT NULL, daily_demand double precision, match_quality double precision,
 PRIMARY KEY(snapshot_id,id)
);
CREATE INDEX IF NOT EXISTS stations_geom ON transport_stations USING gist(geom);
CREATE TABLE IF NOT EXISTS transport_profiles (
 snapshot_id text, station_id text, day_type text, values double precision[] NOT NULL,
 PRIMARY KEY(snapshot_id,station_id,day_type),
 FOREIGN KEY(snapshot_id,station_id) REFERENCES transport_stations(snapshot_id,id)
);
CREATE TABLE IF NOT EXISTS reported_incidents_agg (
 snapshot_id text REFERENCES dataset_snapshots(id), h3_id text, month text, incident_count integer NOT NULL,
 PRIMARY KEY(snapshot_id,h3_id,month)
);
CREATE TABLE IF NOT EXISTS property_cost_proxy (
 snapshot_id text REFERENCES dataset_snapshots(id), code text, sector text, property_count double precision,
 pressure double precision, method text NOT NULL, PRIMARY KEY(snapshot_id,code,sector)
);
CREATE TABLE IF NOT EXISTS feature_versions (
 id text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL,
 snapshots jsonb NOT NULL, code_version text NOT NULL, parameters jsonb NOT NULL,
 qa jsonb NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_version ON feature_versions(status) WHERE status='active';
CREATE TABLE IF NOT EXISTS geo_h3_cells (
 h3_id text PRIMARY KEY, resolution integer NOT NULL CHECK(resolution IN (8,9)),
 geom geometry(Polygon,4326) NOT NULL, centroid geometry(Point,4326) NOT NULL,
 area_m2 double precision NOT NULL, borough text NOT NULL, lsoa_code text,
 is_london boolean DEFAULT true, active boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS h3_geom ON geo_h3_cells USING gist(geom);
CREATE INDEX IF NOT EXISTS h3_centroid ON geo_h3_cells USING gist(centroid);
CREATE INDEX IF NOT EXISTS h3_borough ON geo_h3_cells(borough);
CREATE TABLE IF NOT EXISTS h3_features (
 feature_version text REFERENCES feature_versions(id), h3_id text REFERENCES geo_h3_cells(h3_id),
 resolution integer NOT NULL, population double precision, population_density double precision,
 households double precision, transit_demand double precision, transit_access double precision,
 nearest_station text, station_distance_m double precision, high_street_flag boolean,
 high_street_distance double precision, high_street_name text,
 reported_incident_rate_proxy double precision, incident_count double precision,
 occupancy_cost_pressure double precision, poi_counts jsonb NOT NULL,
 source_coverage jsonb NOT NULL, recency_confidence double precision,
 spatial_confidence double precision, PRIMARY KEY(feature_version,h3_id)
);
CREATE TABLE IF NOT EXISTS model_versions (
 id text PRIMARY KEY, feature_version text REFERENCES feature_versions(id), business_type text,
 resolution integer, family text, parameters jsonb, metrics jsonb, created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS h3_component_scores (
 feature_version text, h3_id text, business_type text, model_version text REFERENCES model_versions(id),
 demand double precision, access double precision, white_space double precision,
 ecosystem double precision, cost_efficiency double precision, operational_context double precision,
 confidence double precision, coverage_confidence double precision, model_confidence double precision,
 expected_supply double precision, observed_supply double precision, supply_gap double precision,
 PRIMARY KEY(feature_version,h3_id,business_type),
 FOREIGN KEY(feature_version,h3_id) REFERENCES h3_features(feature_version,h3_id)
);
CREATE TABLE IF NOT EXISTS h3_opportunity_scores (
 feature_version text, h3_id text, business_type text, score double precision NOT NULL,
 raw_score double precision NOT NULL, rank integer NOT NULL,
 PRIMARY KEY(feature_version,h3_id,business_type),
 FOREIGN KEY(feature_version,h3_id,business_type) REFERENCES h3_component_scores(feature_version,h3_id,business_type)
);
CREATE INDEX IF NOT EXISTS score_rank ON h3_opportunity_scores(feature_version,business_type,rank);
CREATE TABLE IF NOT EXISTS h3_transport_time_profile (
 feature_version text, h3_id text, day_type text, values double precision[] NOT NULL,
 PRIMARY KEY(feature_version,h3_id,day_type),
 FOREIGN KEY(feature_version,h3_id) REFERENCES h3_features(feature_version,h3_id)
);
CREATE TABLE IF NOT EXISTS business_profiles (
 id text PRIMARY KEY, name text NOT NULL, weights jsonb NOT NULL, complements jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS pois_geography_idx ON pois USING gist ((geom::geography));
