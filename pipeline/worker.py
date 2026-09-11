"""Daily source-cadence-aware worker. Run under a process supervisor or Compose."""

import logging
import os
import signal
import threading

from pipeline.cli import refresh_pipeline
from pipeline.db import migrate

stopped = threading.Event()


def main():
    logging.basicConfig(level=logging.INFO)
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopped.set())
    migrate()
    interval = max(60, int(os.environ.get("PULSE_REFRESH_INTERVAL_SECONDS", "86400")))
    while not stopped.is_set():
        try:
            refresh_pipeline()
        except Exception:
            logging.exception("Scheduled refresh failed; previous active model retained")
        stopped.wait(interval)


if __name__ == "__main__":
    main()
