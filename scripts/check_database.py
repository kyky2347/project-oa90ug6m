from sqlalchemy import text

from pipeline.db import engine, migrate

migrate()
with engine().begin() as c:
    assert c.execute(
        text("SELECT ST_IsValid(ST_Buffer(ST_SetSRID(ST_Point(-0.1,51.5),4326)::geography,500)::geometry)")
    ).scalar()
    tables = set(
        c.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'")
        ).scalars()
    )
    assert {"dataset_snapshots", "h3_features", "model_versions", "h3_opportunity_scores"} <= tables
print("PostGIS extension, projected buffering and schema verified")
