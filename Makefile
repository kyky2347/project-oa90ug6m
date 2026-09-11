.PHONY: install infra bootstrap dev refresh status validate test integration build worker docker-up
install:
	uv sync --frozen
	pnpm install --frozen-lockfile
infra:
	docker compose up -d --wait postgres redis
bootstrap: infra
	uv run pulse-data bootstrap

dev: infra
	uv run python scripts/dev.py
refresh:
	uv run pulse-data refresh
status:
	uv run pulse-data status
validate:
	uv run pulse-data validate
worker:
	uv run python -m pipeline.worker
test:
	uv run pytest -m 'not integration'
	pnpm test
	pnpm lint
	pnpm typecheck
integration:
	PULSE_INTEGRATION=1 uv run pytest tests/integration
build:
	pnpm build
docker-up:
	PULSE_UID=$$(id -u) PULSE_GID=$$(id -g) docker compose --profile app up -d --build
