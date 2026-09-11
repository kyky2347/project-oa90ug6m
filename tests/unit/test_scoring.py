import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st

from packages.scoring.core import (
    COMPONENTS,
    PROFILES,
    TARGET_CATEGORY,
    explain,
    normalize_weights,
    opportunity,
    percentile,
    weights_hash,
)


@given(st.lists(st.floats(0, 100, allow_nan=False), min_size=6, max_size=6), st.floats(0, 1))
def test_score_is_bounded_and_shrinks_toward_neutral(values, confidence):
    raw, final = opportunity(values, confidence, PROFILES["coffee"]["weights"])
    assert 0 <= final <= 100
    assert abs(final - 50) <= abs(raw - 50) + 1e-10
    assert min(raw, 50) - 1e-10 <= final <= max(raw, 50) + 1e-10


@given(st.lists(st.floats(0.1, 10), min_size=6, max_size=6))
def test_weights_scale_invariant(values):
    w = dict(zip(COMPONENTS, values))
    assert weights_hash(w) == weights_hash({k: v * 2 for k, v in w.items()})
    assert sum(normalize_weights(w).values()) == pytest.approx(1)


def test_missing_constant_and_inverse_normalization():
    assert percentile([np.nan, 0, 0, 0]).tolist() == [50] * 4
    assert percentile([1]).tolist() == [50]
    a = percentile([0, 1, 2, np.nan, 1e30])
    assert np.isfinite(a).all() and a[3] == 50
    np.testing.assert_allclose(percentile([1, 2, 3], inverse=True), [100, 50, 0])


@pytest.mark.parametrize(
    "weights",
    [{}, {k: 0 for k in COMPONENTS}, {k: float("nan") for k in COMPONENTS}, {k: -1 for k in COMPONENTS}],
)
def test_invalid_weights_rejected(weights):
    with pytest.raises(ValueError):
        normalize_weights(weights)


def test_explanation_reconciles_to_final():
    components = dict(zip(COMPONENTS, [92, 70, 88, 60, 15, 30]))
    w = PROFILES["coffee"]["weights"]
    _, final = opportunity(list(components.values()), 0.73, w)
    result = explain(components, 0.73, w)
    assert 50 + sum(c["contribution"] for c in result["contributions"]) == pytest.approx(final)
    assert "cost efficiency" in result["summary"]


def test_profiles_exclude_own_target_and_low_incident_weight():
    assert len(PROFILES) == 6
    for key, profile in PROFILES.items():
        assert sum(profile["weights"].values()) == pytest.approx(1)
        assert TARGET_CATEGORY[key] not in profile["complements"]
        assert profile["weights"]["operational_context"] == 0.05
