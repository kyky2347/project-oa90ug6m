FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 PYTHONUNBUFFERED=1
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY pipeline ./pipeline
COPY packages ./packages
COPY apps/__init__.py ./apps/__init__.py
COPY apps/api ./apps/api
COPY infra/postgres ./infra/postgres
RUN uv sync --frozen --no-dev && mkdir -p data/raw data/manifests data/cache && useradd --uid 10001 --create-home pulse && chown -R pulse:pulse /app
USER pulse
EXPOSE 8000
CMD ["/app/.venv/bin/uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--log-config", "apps/api/logging.json"]
