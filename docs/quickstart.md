# Run PULSE

[Project home](../README.md) · [Documentation](README.md) · [简体中文](../README.zh-CN.md)

## Requirements

- Git, or an extracted source ZIP from the releases page.
- Docker with the Compose plugin. OrbStack and Docker Desktop work with the macOS launcher. Linux requires an already running Docker Engine. Windows requires a WSL2 terminal and Docker integration; that combination has not been verified for this release.
- Internet access for container images, public source acquisition and map tiles.
- Available loopback ports 3000, 8000, 55433 and 56380.

Allow several GB of free disk space for containers, database and retained downloads. The recorded local raw-data folder was approximately 810 MB; this includes retained acquisition history and is not a minimum requirement or a promise about future publisher sizes. Keep old snapshots when exact replay matters.

## First launch

```sh
git clone https://github.com/kyky2347/project-oa90ug6m.git pulse
cd pulse
./scripts/pulse
```

From a downloaded ZIP, run `bash scripts/pulse` in the extracted root. You do not need host Python, Node, pnpm or uv for the container route. No `.env` file is needed for the supplied local defaults.

The launcher uses the Compose project name `pulse`, independent of the checkout directory name. Run one local PULSE stack at a time. Stop an existing checkout before launching a different checkout; both use the same ports and persistent project volume.

| Stage          | What happens                                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Images         | Missing API, website and worker images are built from the lockfiles.                                                                          |
| Infrastructure | PostGIS and Redis start and pass their health checks; the schema is applied.                                                                  |
| Real data      | An empty warehouse triggers discovery, download, source validation, H3 features, models and activation. An existing active version is reused. |
| Application    | API, website and daily worker start. Website and API health must pass before the browser opens.                                               |

Acquisition time depends on publishers, connection and available CPU. Police acquisition is tiled and can be slow. Keep the terminal open until startup succeeds. A failed attempt can be retried; verified snapshots and the active working dataset are retained. The daily worker starts after initial bootstrap.

Open [the app](http://localhost:3000) or [API documentation](http://localhost:8000/docs). Use the header's **EN / 中文** control to switch language. The preference persists on your browser; filters and selected sites remain unchanged.

## Everyday commands

```sh
./scripts/pulse              # start, verify and open
./scripts/pulse --no-open    # start without opening a browser
./scripts/pulse stop         # keep volumes and downloaded files
./scripts/pulse status       # list containers
./scripts/pulse data-status  # show source and feature versions
./scripts/pulse validate     # validate the active dataset
./scripts/pulse refresh      # cadence-aware refresh
./scripts/pulse logs         # Ctrl-C exits logs only
```

To update code, stop the app, pull the desired revision and rebuild:

```sh
./scripts/pulse stop
git pull --ff-only
./scripts/pulse --build
```

The launcher reuses existing images by default. Use `--build` after changing or downloading a different code version. See [reproducibility](reproducibility.md) before expecting an old data edition to match current code.

## Install the global shortcut

From the checkout root on macOS or Linux:

```sh
mkdir -p "$HOME/.local/bin"
ln -s "$PWD/scripts/pulse" "$HOME/.local/bin/pulse"
```

Ensure `$HOME/.local/bin` is in your shell's PATH, then run `pulse` from any directory. If needed, add `export PATH="$HOME/.local/bin:$PATH"` to your shell configuration and open a new terminal. An existing shortcut is not overwritten: inspect it before replacing it. Moving the checkout requires updating the link.

`make start` and `make stop` are repository-local aliases.

## Troubleshooting

| Symptom                                 | Check and recovery                                                                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker not found                        | Install OrbStack/Docker Desktop or Docker Engine with Compose, then retry.                                                                               |
| Docker engine unavailable               | The macOS launcher opens the app associated with the current context. For other contexts, start the corresponding engine. Inspect `docker context show`. |
| Port already allocated                  | Stop the other process or old PULSE checkout using that port. The launcher does not terminate unrelated processes.                                       |
| First download is slow                  | Read the terminal output; source sizes and tiled requests vary. Do not delete verified snapshots to accelerate a retry.                                  |
| Publisher timeout or changed schema     | Retry after checking the reported source. If it persists, report the source ID and a redacted error. The app does not substitute fabricated data.        |
| No active feature version               | Bootstrap has not succeeded. Run `./scripts/pulse` again and inspect its first failing stage.                                                            |
| API/website not ready                   | Run `./scripts/pulse logs`. Confirm the four ports are available and rebuild images after code changes.                                                  |
| Data mount permission error             | Run as your normal user. The launcher passes your UID/GID to API and worker containers.                                                                  |
| Map is slow or blank                    | Use a WebGL-capable browser with hardware acceleration; try 2D and check access to CARTO/OSM tiles.                                                      |
| Local development conflicts with Docker | Run `./scripts/pulse stop` before starting host API/web processes.                                                                                       |

Deleting a volume is not a repair step. [Refresh and recovery](data-refresh.md) explains retention and [reproducibility](reproducibility.md) describes backups.
