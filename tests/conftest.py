import os

import pytest


def pytest_collection_modifyitems(items):
    for item in items:
        if "integration" in item.keywords and not os.getenv("PULSE_INTEGRATION"):
            item.add_marker(pytest.mark.skip(reason="Set PULSE_INTEGRATION=1 after real London bootstrap"))
