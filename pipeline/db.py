from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT / '.env'), extra='ignore')
    database_url: str = 'postgresql+psycopg://pulse:pulse_local_only@localhost:55433/pulse'
    redis_url: str = 'redis://localhost:56380/0'
    admin_token: str = ''
    cors_origins: str = 'http://localhost:3000,http://127.0.0.1:3000'


settings = Settings()


@lru_cache
def engine():
    return create_engine(settings.database_url, pool_pre_ping=True, pool_size=8, max_overflow=8)


def migrate():
    with engine().begin() as conn:
        conn.exec_driver_sql((ROOT / 'infra/postgres/001_schema.sql').read_text())


def rows(sql, params=None):
    with engine().connect() as conn:
        return [dict(r) for r in conn.execute(text(sql), params or {}).mappings()]


def execute(sql, params=None):
    with engine().begin() as conn:
        return conn.execute(text(sql), params or {})
