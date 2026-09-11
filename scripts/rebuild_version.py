"""Rebuild from exactly the retained source snapshots and original confidence reference time."""

import sys
from datetime import datetime

from pipeline.db import rows
from pipeline.features.build import build_features

old = rows("SELECT * FROM feature_versions WHERE id=:v", {"v": sys.argv[1]})[0]
reference = datetime.fromisoformat(old["parameters"]["reference_time"])
new = build_features(old["snapshots"], reference_time=reference)
print(f"Rebuilt candidate {new}; inspect validation before activation")
