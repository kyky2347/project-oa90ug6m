import numpy as np
import redis

from apps.api import cache
from pipeline.models.white_space import fit_white_space


def test_sparse_model_is_explicit_and_finite():
    x = np.zeros((100, 5))
    y = np.zeros(100)
    y[0] = 2
    expected, confidence, metrics, residual = fit_white_space(
        x, y, np.arange(100) // 10, np.c_[np.arange(100) * 1000, np.zeros(100)]
    )
    assert metrics["family"] == "shrunken_exposure_ratio"
    assert metrics["cv_mae"] is None
    assert (expected > 0).all() and np.isfinite(residual).all()
    assert np.all(confidence == 0.4)


def test_spatial_validation_buffer_and_negative_gap_direction():
    rng = np.random.default_rng(4)
    x = rng.uniform(0, 20, (500, 5))
    y = rng.poisson(np.exp(0.7 + 0.05 * x[:, 0]))
    xy = np.c_[np.arange(500) * 1000, np.zeros(500)]
    expected, c, metrics, gap = fit_white_space(x, y, np.arange(500) // 50, xy)
    assert len(metrics["folds"]) == 4
    assert metrics["cv_coverage"] == 1
    assert all(f["minimum_separation_m"] > 800 for f in metrics["folds"])
    assert metrics["cv_mae"] is not None and metrics["cv_baseline_mae"] is not None
    assert ((gap < 0) == (y > expected)).all()
    assert ((c >= 0.25) & (c <= 0.8)).all()


def test_cache_keys_are_version_and_parameter_specific():
    assert cache.cache_key("map", "v1", bbox="a", w=1) == cache.cache_key("map", "v1", w=1, bbox="a")
    assert cache.cache_key("map", "v1") != cache.cache_key("map", "v2")


def test_redis_outage_falls_back_to_canonical_factory(monkeypatch):
    class Offline:
        def get(self, *a):
            raise redis.ConnectionError()

        def setex(self, *a):
            raise redis.ConnectionError()

        def eval(self, *a):
            raise redis.ConnectionError()

    monkeypatch.setattr(cache, "client", Offline())
    assert cache.cached("test", lambda: {"actual": 42}) == ({"actual": 42}, False)
    assert cache.rate_allowed("test") is True
