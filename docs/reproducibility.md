# Reproducing PULSE

[Project home](../README.md) · [Quickstart](quickstart.md) · [Verification evidence](completion-report.md)

There are three different things a reader may want to reproduce. They require different inputs.

| Goal                               | Required inputs                                                                                  | What to expect                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Run the product and pipeline       | Source release, lockfiles, Docker and access to publishers                                       | A working London warehouse using discoverable source releases.                                      |
| Verify the code offline            | Source release and development dependencies                                                      | Attributed fixture tests, scoring invariants and interface tests; no full-city download.            |
| Rebuild a recorded feature version | Recorded code, lockfiles, retained snapshot data/database and original confidence reference time | A new candidate using the same recorded inputs; compare numerical outputs and QA before activation. |

## What the repository contains

Code, dependency lockfiles, a container configuration, small attributed test fixtures, source manifests, a recorded model report, measured benchmarks and screenshots. Full raw downloads, cached source assets and the PostGIS database are excluded. A source ZIP is a code release, not a database archive.

The September edition records feature version `ldn-20260911T130817-f16e80`, recipe `1.0.0`, pipeline revision/content hash `bb045720703f61f4b6b451ab2557c273ecbed6d6:f16e80b757178318` and confidence reference time `2026-09-11T13:08:17.462644+00:00`. Inspect [release-data.json](release-data.json) for source snapshots and fitted model parameters.

Publisher URLs and checksums document provenance but do not guarantee indefinite upstream availability. Historical source bytes are not bundled in this public repository. A fresh download cannot be represented as an exact replay of the recorded edition.

## Verify an installation

After [startup](quickstart.md):

```sh
./scripts/pulse data-status
./scripts/pulse validate
curl --fail http://localhost:8000/health
```

The health response should report `healthy` with a nonempty feature version. Validate reports geometry, coverage, conservation, score and model checks. Version IDs include run time and code content, so compare inputs and outputs rather than expecting a new run to reuse an old ID.

With development dependencies installed:

```sh
make test
make integration
PULSE_E2E_REAL=1 pnpm --filter @pulse/web exec playwright test --project=real-london
```

Install Chromium first using the command in [CONTRIBUTING.md](../CONTRIBUTING.md). Browser tests write screenshots and measured artifacts; retain the version/environment alongside any new performance claim.

## Preserve your own edition

Record the Git revision and copy the locked environment, manifests and release report. For a consistent backup, first stop API/worker writers while leaving Postgres running. Run from the checkout root:

```sh
mkdir -p backups
docker compose --profile app --profile refresh stop api worker
docker compose exec -T postgres pg_dump -U pulse -d pulse -Fc > backups/pulse.dump
tar -czf backups/pulse-snapshots.tar.gz data/raw data/manifests
git rev-parse HEAD > backups/code-revision.txt
cp uv.lock pnpm-lock.yaml backups/
./scripts/pulse
```

Keep backups outside Git and in durable storage. Source terms still apply to copied data. Check command exit codes, inspect the dump using `pg_restore --list`, and test restoration into a **separate empty database** before relying on a backup. This guide does not claim an automated cross-machine restore test.

## Rebuild from retained snapshots

Restore your retained source tables and feature-version metadata to an isolated warehouse, check out the code recorded for that edition, install its lockfiles, and configure its database/Redis URLs. Then:

```sh
uv run python scripts/rebuild_version.py ldn-20260911T130817-f16e80
```

The script reuses the original source IDs and confidence reference time and creates a candidate; it does not silently activate it. Inspect its validation and compare components, model metrics and coverage. When satisfied, activate the returned candidate ID using `uv run pulse-data activate <candidate-id>`.

Floating-point libraries, processor architecture and container base-image updates may affect numerical details. Lockfiles pin application dependencies, while container base tags and OS packages are not a bit-for-bit environment archive. No bitwise identity across arbitrary machines is claimed.

## Refresh is a different operation

`./scripts/pulse refresh` evaluates due sources and can create a new edition. The daily worker does the same. Preserve the old inputs before updating if historical comparisons matter. [Refresh and recovery](data-refresh.md) documents atomic activation, retained versions and failure handling.
