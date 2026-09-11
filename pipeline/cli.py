import json
import logging
import uuid
from datetime import UTC, datetime

import typer
from rich.console import Console
from rich.table import Table
from sqlalchemy import text

from apps.api.cache import client
from pipeline.db import ROOT, engine, execute, migrate, rows
from pipeline.features.build import activate as activate_version
from pipeline.features.build import active_snapshots, build_features, validate_version
from pipeline.sources.registry import SOURCES

app = typer.Typer(no_args_is_help=True, help="PULSE · reproducible London public-data pipeline")
console = Console()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)


def refresh_pipeline(source="all", force=False, job_id=None):
    migrate()
    job_id = job_id or uuid.uuid4().hex
    execute(
        "INSERT INTO ingestion_jobs(id,source,status) VALUES(:id,:s,'running') ON CONFLICT(id) DO UPDATE SET status='running'",
        {"id": job_id, "s": source},
    )
    report = {
        "job_id": job_id,
        "source_updates": {},
        "failures": [],
        "started_at": datetime.now(UTC).isoformat(),
    }
    lock = None
    # PostgreSQL provides the authoritative refresh lock; Redis is a fast coordination aid.
    with engine().connect() as guard:
        acquired = guard.execute(text("SELECT pg_try_advisory_lock(8808002)")).scalar()
        if not acquired:
            execute(
                "UPDATE ingestion_jobs SET status='failed',finished_at=now(),error='Another refresh is running' WHERE id=:id",
                {"id": job_id},
            )
            raise RuntimeError("Another refresh is already running")
        try:
            try:
                lock = client.lock("pulse:refresh-lock", timeout=7200, blocking_timeout=1)
                lock.acquire()
            except Exception:
                lock = None
            before = active_snapshots()
            for sid, adapter in SOURCES.items():
                if source not in ("all", sid):
                    continue
                previous = adapter.previous()
                if (
                    previous
                    and not force
                    and (datetime.now(UTC) - previous["retrieved_at"]).days < adapter.cadence_days
                ):
                    report["source_updates"][sid] = {"status": "not_due", "snapshot": previous["id"]}
                    continue
                try:
                    result = adapter.ingest(force)
                    latest = rows(
                        "SELECT status,error FROM dataset_snapshots WHERE source_id=:s ORDER BY retrieved_at DESC LIMIT 1",
                        {"s": sid},
                    )[0]
                    report["source_updates"][sid] = {
                        "status": "retained_previous" if latest["status"] == "failed" else "verified",
                        "snapshot": result,
                    }
                    if latest["status"] == "failed":
                        report["failures"].append({"source": sid, "error": latest["error"]})
                except Exception as exc:
                    report["failures"].append({"source": sid, "error": str(exc)})
                    if adapter.critical:
                        raise
            after = active_snapshots()
            active = rows("SELECT id FROM feature_versions WHERE status='active'")
            if before != after or not active or force:
                v = build_features(after)
                activate_version(v)
            else:
                v = active[0]["id"]
            report.update(
                feature_version=v,
                active_snapshots=after,
                status="success_with_warnings" if report["failures"] else "success",
                models=rows("SELECT id,family FROM model_versions WHERE feature_version=:v", {"v": v}),
                qa=validate_version(v),
            )
        except Exception as exc:
            report.update(status="failed", error=str(exc))
            raise
        finally:
            report["finished_at"] = datetime.now(UTC).isoformat()
            execute(
                """UPDATE ingestion_jobs SET finished_at=now(),status=:status,report=CAST(:r AS jsonb),error=:e WHERE id=:id""",
                {
                    "id": job_id,
                    "status": report.get("status", "failed"),
                    "r": json.dumps(report, default=str),
                    "e": report.get("error"),
                },
            )
            (ROOT / "data/manifests" / f"refresh-{job_id}.json").write_text(
                json.dumps(report, indent=2, default=str)
            )
            guard.execute(text("SELECT pg_advisory_unlock(8808002)"))
            if lock:
                try:
                    lock.release()
                except Exception:
                    pass
    return report


@app.command()
def discover(source: str = "all"):
    for sid, adapter in SOURCES.items():
        if source in ("all", sid):
            console.print(f"[bold]{sid}[/bold] {adapter.name}")
            for a in adapter.discover():
                console.print(a.url)


@app.command()
def bootstrap():
    """Acquire sources, validate, build features/models, activate, and report."""
    console.print_json(data=refresh_pipeline())


@app.command()
def refresh(source: str = "all", force: bool = False):
    if source != "all" and source not in SOURCES:
        raise typer.BadParameter("Unknown source")
    console.print_json(data=refresh_pipeline(source, force))


@app.command()
def status():
    migrate()
    table = Table("Source", "Latest verified snapshot", "Rows", "Observation date")
    for sid, adapter in SOURCES.items():
        p = adapter.previous()
        table.add_row(
            sid,
            p["id"] if p else "unavailable",
            str(p["row_count"]) if p else "—",
            p["published_at"] or "not supplied" if p else "—",
        )
    console.print(table)
    console.print(rows("SELECT id,status FROM feature_versions ORDER BY created_at DESC LIMIT 5"))


@app.command()
def validate():
    for r in rows("SELECT id FROM feature_versions WHERE status IN ('validated','active')"):
        console.print_json(data=validate_version(r["id"]))


@app.command("build-features")
def feature_command():
    console.print(build_features())


@app.command("build-models")
def model_command():
    """Rebuild a reproducible feature+model candidate from verified snapshots."""
    console.print(build_features())


@app.command()
def activate(version: str):
    activate_version(version)


@app.command("migrate")
def migrate_command():
    migrate()
    console.print("PostGIS schema ready")


if __name__ == "__main__":
    app()
