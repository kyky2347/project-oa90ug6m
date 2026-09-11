"""One network boundary, immutable raw snapshots, and transactional source loads."""

import hashlib
import json
import logging
import os
import shutil
import time
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import text

from pipeline.db import ROOT, engine, execute, rows

log = logging.getLogger("pulse.ingest")
USER_AGENT = "PULSE/0.1 (London open-data research; reproducible source snapshots)"


def client():
    return httpx.Client(
        timeout=httpx.Timeout(120, connect=20), follow_redirects=True, headers={"User-Agent": USER_AGENT}
    )


def request(url, *, method="GET", **kwargs):
    for attempt in range(4):
        try:
            with client() as c:
                r = c.request(method, url, **kwargs)
                r.raise_for_status()
                return r
        except (httpx.TransportError, httpx.HTTPStatusError) as exc:
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code < 429:
                raise
            if attempt == 3:
                raise
            time.sleep(min(2**attempt, 8))


def links(url):
    r = request(url)
    soup = BeautifulSoup(r.text, "html.parser")
    return [
        (a.get_text(" ", strip=True), urljoin(str(r.url), a["href"])) for a in soup.find_all("a", href=True)
    ]


@dataclass
class Asset:
    url: str
    filename: str
    published_at: str | None = None
    extra: dict = field(default_factory=dict)


def download_asset(asset: Asset, target: Path, max_bytes=600_000_000):
    """Stream to a temporary file. Reject HTML error pages and oversize responses."""
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".part")
    for attempt in range(4):
        try:
            with client() as c, c.stream("GET", asset.url) as r:
                r.raise_for_status()
                ctype = r.headers.get("content-type", "").lower()
                if "text/html" in ctype and not target.suffix == ".html":
                    raise ValueError(f"Unexpected HTML content for {asset.filename}")
                if int(r.headers.get("content-length", "0")) > max_bytes:
                    raise ValueError("Download exceeds configured size limit")
                size = 0
                digest = hashlib.sha256()
                with tmp.open("wb") as f:
                    for chunk in r.iter_bytes(1024 * 1024):
                        size += len(chunk)
                        if size > max_bytes:
                            raise ValueError("Download exceeds configured size limit")
                        digest.update(chunk)
                        f.write(chunk)
                if size == 0:
                    raise ValueError("Empty download")
                checksum = digest.hexdigest()
                if asset.extra.get("sha256") and asset.extra["sha256"] != checksum:
                    raise ValueError("Checksum mismatch")
                if asset.extra.get("md5"):
                    if hashlib.md5(tmp.read_bytes(), usedforsecurity=False).hexdigest() != asset.extra["md5"]:
                        raise ValueError("Checksum mismatch")
                os.replace(tmp, target)
                return {
                    "sha256": checksum,
                    "bytes": size,
                    "resolved_url": str(r.url),
                    "etag": r.headers.get("etag"),
                    "last_modified": r.headers.get("last-modified"),
                    "content_type": ctype,
                }
        except (httpx.TransportError, httpx.HTTPStatusError):
            tmp.unlink(missing_ok=True)
            if attempt == 3:
                raise
            time.sleep(2**attempt)
        except Exception:
            tmp.unlink(missing_ok=True)
            raise


class Source:
    id = ""
    name = ""
    publisher = ""
    url = ""
    license = "Open Government Licence v3.0"
    cadence_days = 30
    critical = False
    parser_version = "1.0.0"
    schema_version = "1"

    def discover(self) -> list[Asset]:
        raise NotImplementedError

    def metadata(self):
        return {
            k: getattr(self, k)
            for k in ["id", "name", "publisher", "url", "license", "cadence_days", "critical"]
        }

    def register(self):
        execute(
            """INSERT INTO dataset_sources(id,name,publisher,url,license,cadence_days,critical)
            VALUES (:id,:name,:publisher,:url,:license,:cadence_days,:critical)
            ON CONFLICT(id) DO UPDATE SET name=excluded.name,url=excluded.url""",
            self.metadata(),
        )

    def previous(self):
        found = rows(
            "SELECT * FROM dataset_snapshots WHERE source_id=:id AND status='verified' "
            "ORDER BY retrieved_at DESC LIMIT 1",
            {"id": self.id},
        )
        return found[0] if found else None

    def check_for_update(self, assets, previous):
        if not previous or previous["parser_version"] != self.parser_version:
            return True
        old = previous["metadata"].get("assets", [])
        if [(a.url, a.published_at) for a in assets] != [(a["url"], a.get("published_at")) for a in old]:
            return True
        for asset, prior in zip(assets, old, strict=True):
            try:
                try:
                    h = request(asset.url, method="HEAD").headers
                except httpx.HTTPError:
                    h = {}
                recorded = prior.get("download", {})
                if h.get("etag") and h["etag"] != recorded.get("etag"):
                    return True
                if h.get("last-modified") and h["last-modified"] != recorded.get("last_modified"):
                    return True
                # Without upstream validators, refresh at the declared cadence.
                if not h.get("etag") and not h.get("last-modified"):
                    if (datetime.now(UTC) - previous["retrieved_at"]).days >= self.cadence_days:
                        return True
            except httpx.HTTPError:
                return (datetime.now(UTC) - previous["retrieved_at"]).days >= self.cadence_days
        return False

    def download(self, assets, directory):
        result = []
        for asset in assets:
            log.info("Downloading %s: %s", self.id, asset.filename)
            info = asdict(asset)
            cache = ROOT / "data/cache/assets" / hashlib.sha256(asset.url.encode()).hexdigest()
            receipt = cache.with_suffix(".json")
            reused = False
            if cache.exists() and receipt.exists():
                prior = json.loads(receipt.read_text())
                try:
                    h = (
                        request(asset.url, method="HEAD").headers
                        if time.time() - cache.stat().st_mtime > 3600
                        else {}
                    )
                except httpx.HTTPError:
                    h = {}
                same = (h.get("etag") and h["etag"] == prior.get("etag")) or (
                    h.get("last-modified") and h["last-modified"] == prior.get("last_modified")
                )
                same = same or time.time() - cache.stat().st_mtime < 3600
                if same and hashlib.sha256(cache.read_bytes()).hexdigest() == prior["sha256"]:
                    directory.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(cache, directory / asset.filename)
                    info["download"] = prior
                    reused = True
            if not reused:
                info["download"] = download_asset(asset, directory / asset.filename)
                cache.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(directory / asset.filename, cache)
                receipt.write_text(json.dumps(info["download"]))
            (directory / (asset.filename + ".receipt.json")).write_text(json.dumps(info))
            result.append(info)
        return result

    def validate_raw(self, directory, assets):
        for a in assets:
            path = directory / a.filename
            if not path.exists() or path.stat().st_size < 2:
                raise ValueError(f"Empty {a.filename}")

    def transform(self, directory, assets):
        raise NotImplementedError

    def load(self, tables, snapshot_id, conn):
        """Input is explicit table -> list of typed rows; geometry is WKT."""
        count = 0
        for table, records in tables.items():
            if not records:
                continue
            keys = list(records[0])
            expressions = [("ST_GeomFromText(:geom,4326)" if k == "geom" else ":" + k) for k in keys]
            stmt = text(
                f"INSERT INTO {table}(snapshot_id,{','.join(keys)}) "
                f"VALUES (:snapshot_id,{','.join(expressions)}) ON CONFLICT DO NOTHING"
            )
            for start in range(0, len(records), 2000):
                conn.execute(stmt, [dict(r, snapshot_id=snapshot_id) for r in records[start : start + 2000]])
            count += len(records)
        if count == 0:
            raise ValueError("No valid records after transformation")
        return count

    def ingest(self, force=False):
        self.register()
        previous = self.previous()
        sid = f"{self.id}-{datetime.now(UTC):%Y%m%dT%H%M%S}-{uuid.uuid4().hex[:6]}"
        directory = ROOT / "data/raw" / self.id / sid
        assets = []
        try:
            assets = self.discover()
            if not assets:
                raise ValueError("Discovery returned no assets")
            if not force and not self.check_for_update(assets, previous):
                log.info("%s: verified snapshot unchanged (%s)", self.id, previous["id"])
                return previous["id"]
            downloaded = self.download(assets, directory)
            self.validate_raw(directory, assets)
            log.info("Transforming %s", self.id)
            tables = self.transform(directory, assets)
            # Parsers can resolve a more precise reference period from the actual workbook.
            for asset, info in zip(assets, downloaded, strict=True):
                info["published_at"] = asset.published_at
                info["extra"] = asset.extra
                (directory / (asset.filename + ".receipt.json")).write_text(json.dumps(info))
            manifest = {
                "assets": downloaded,
                "notes": getattr(self, "notes", []),
                "retrieved_at": datetime.now(UTC).isoformat(),
            }
            checksum = hashlib.sha256(
                json.dumps([a["download"]["sha256"] for a in downloaded]).encode()
            ).hexdigest()
            meta = dict(
                id=sid,
                source=self.id,
                name=self.name,
                url=assets[0].url,
                published=assets[0].published_at,
                license=self.license,
                checksum=checksum,
                parser=self.parser_version,
                schema=self.schema_version,
                path=str(directory.relative_to(ROOT)),
                metadata=json.dumps(manifest),
            )
            with engine().begin() as conn:
                conn.execute(
                    text("""INSERT INTO dataset_snapshots
                    (id,source_id,dataset_name,source_url,published_at,license,checksum,status,
                     parser_version,schema_version,raw_path,metadata)
                    VALUES(:id,:source,:name,:url,:published,:license,:checksum,'staging',
                     :parser,:schema,:path,CAST(:metadata AS jsonb))"""),
                    meta,
                )
                count = self.load(tables, sid, conn)
                conn.execute(
                    text("UPDATE dataset_snapshots SET status='verified',row_count=:n WHERE id=:id"),
                    {"n": count, "id": sid},
                )
            manifest.update(
                snapshot_id=sid, checksum=checksum, row_count=count, status="verified", **self.metadata()
            )
            (directory / "metadata.json").write_text(json.dumps(manifest, indent=2))
            (ROOT / "data/manifests" / f"{sid}.json").write_text(json.dumps(manifest, indent=2))
            log.info("%s: verified %s records (%s)", self.id, count, sid)
            return sid
        except Exception as exc:
            log.exception("%s refresh failed; previous verified snapshot retained", self.id)
            execute(
                """INSERT INTO dataset_snapshots
                (id,source_id,dataset_name,source_url,license,checksum,status,parser_version,
                 schema_version,raw_path,error) VALUES(:id,:source,:name,:url,:license,'','failed',
                 :parser,:schema,:path,:error)""",
                dict(
                    id=sid,
                    source=self.id,
                    name=self.name,
                    url=assets[0].url if assets else self.url,
                    license=self.license,
                    parser=self.parser_version,
                    schema=self.schema_version,
                    path=str(directory.relative_to(ROOT)),
                    error=str(exc)[:2000],
                ),
            )
            if previous:
                return previous["id"]
            raise
