"""Launch local API and web; stop only child processes created by this command."""

import signal
import socket
import subprocess
import time

from pipeline.db import ROOT


def open_port(port):
    with socket.socket() as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def main():
    children = []
    if open_port(8000) or open_port(3000):
        raise SystemExit("Ports 8000 and 3000 must be free. Existing processes were left running.")
    try:
        children.append(
            subprocess.Popen(
                [
                    "uv",
                    "run",
                    "uvicorn",
                    "apps.api.main:app",
                    "--reload",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "8000",
                    "--log-config",
                    "apps/api/logging.json",
                ],
                cwd=ROOT,
                start_new_session=True,
            )
        )
        children.append(
            subprocess.Popen(["pnpm", "--filter", "@pulse/web", "dev"], cwd=ROOT, start_new_session=True)
        )
        print("PULSE → http://localhost:3000 · API → http://localhost:8000/docs", flush=True)
        while all(p.poll() is None for p in children):
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        import os

        for p in children:
            if p.poll() is None:
                os.killpg(p.pid, signal.SIGTERM)
        for p in children:
            try:
                p.wait(timeout=10)
            except subprocess.TimeoutExpired:
                os.killpg(p.pid, signal.SIGKILL)


if __name__ == "__main__":
    main()
