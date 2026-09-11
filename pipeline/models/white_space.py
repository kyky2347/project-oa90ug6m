"""Interpretable count models with buffered, grouped spatial validation."""

import warnings

import numpy as np
import statsmodels.api as sm
from scipy.spatial import cKDTree
from sklearn.metrics import mean_absolute_error, mean_poisson_deviance
from sklearn.model_selection import GroupKFold


def fit_white_space(x, observed, groups, coordinates):
    x = np.asarray(x, dtype=float)
    y = np.asarray(observed, dtype=float)
    # Scaling is deterministic; target category is excluded from all predictors upstream.
    transformed = np.log1p(np.maximum(x, 0))
    mean, scale = transformed.mean(axis=0), transformed.std(axis=0)
    scale = np.where(scale < 1e-9, 1, scale)
    design = sm.add_constant((transformed - mean) / scale, has_constant="add")
    if np.count_nonzero(y) < 40 or y.sum() < 100:
        # Empirical-Bayes prior: observed supply per population/activity exposure, no target leakage.
        exposure = 1 + x[:, 0] / max(x[:, 0].mean(), 1)
        expected = (y.sum() + 2) / (exposure.sum() + 2) * exposure
        return (
            expected,
            np.full(len(y), 0.4),
            {
                "family": "shrunken_exposure_ratio",
                "coefficients": [],
                "observations": len(y),
                "positive_cells": int(np.count_nonzero(y)),
                "validation": "Sparse category fallback; predictive fit not claimed",
                "cv_mae": None,
                "overdispersion": None,
                "parameters": {"prior_count": 2, "prior_exposure": 2},
            },
            (expected - y) / np.sqrt(expected + 1),
        )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        poisson = sm.GLM(y, design, family=sm.families.Poisson()).fit(maxiter=100)
    mu = np.maximum(poisson.predict(design), 0.001)
    dispersion = float(np.sum((y - mu) ** 2 / mu) / max(len(y) - design.shape[1], 1))
    alpha = max(float(np.sum((y - mu) ** 2 - mu) / max(np.sum(mu**2), 1e-9)), 0.01)
    family_name = "Negative Binomial" if dispersion > 1.5 else "Poisson"

    def family():
        return sm.families.NegativeBinomial(alpha=alpha) if dispersion > 1.5 else sm.families.Poisson()

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = sm.GLM(y, design, family=family()).fit(maxiter=100)
    expected = np.maximum(model.predict(design), 0.001)
    oof = np.full(len(y), np.nan)
    folds = []
    baseline = np.full(len(y), np.nan)
    # LSOA/H3 neighbors cannot freely leak between folds: hold out geographic groups plus an 800m buffer.
    for train, test in GroupKFold(n_splits=min(4, len(set(groups)))).split(design, y, groups):
        distance, _ = cKDTree(coordinates[test]).query(coordinates[train], k=1)
        train = train[distance > 800]
        if len(train) < 100 or y[train].sum() < 30:
            continue
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                fold_mean = transformed[train].mean(axis=0)
                fold_scale = transformed[train].std(axis=0)
                fold_scale = np.where(fold_scale < 1e-9, 1, fold_scale)
                fold_design = sm.add_constant((transformed - fold_mean) / fold_scale, has_constant="add")
                initial = sm.GLM(y[train], fold_design[train], family=sm.families.Poisson()).fit(maxiter=100)
                train_mu = np.maximum(initial.predict(fold_design[train]), 0.001)
                fold_dispersion = np.sum((y[train] - train_mu) ** 2 / train_mu) / max(
                    len(train) - fold_design.shape[1], 1
                )
                fold_alpha = max(
                    float(np.sum((y[train] - train_mu) ** 2 - train_mu) / max(np.sum(train_mu**2), 1e-9)),
                    0.01,
                )
                fold_family = (
                    sm.families.NegativeBinomial(alpha=fold_alpha)
                    if fold_dispersion > 1.5
                    else sm.families.Poisson()
                )
                fit = sm.GLM(y[train], fold_design[train], family=fold_family).fit(maxiter=100)
            pred = np.clip(fit.predict(fold_design[test]), 0.001, max(y[train].max() * 10, 10))
            baseline[test] = y[train].mean()
            oof[test] = pred
            folds.append(
                {
                    "train": len(train),
                    "test": len(test),
                    "minimum_separation_m": float(distance[distance > 800].min()),
                    "mae": float(mean_absolute_error(y[test], pred)),
                    "poisson_deviance": float(mean_poisson_deviance(y[test], pred)),
                }
            )
        except (ValueError, np.linalg.LinAlgError):
            continue
    valid = np.isfinite(oof)
    mae = float(mean_absolute_error(y[valid], oof[valid])) if valid.any() else None
    baseline_mae = float(mean_absolute_error(y[valid], baseline[valid])) if valid.any() else None
    skill = max(0, 1 - mae / max(baseline_mae, 0.001)) if mae is not None else 0
    # A quality index, not a calibrated probability or confidence interval.
    quality = 0.45 + 0.30 * skill
    confidence = np.clip(
        quality
        / (1 + np.maximum(expected - np.quantile(expected, 0.95), 0) / max(np.quantile(expected, 0.95), 1)),
        0.25,
        0.8,
    )
    variance = expected + (alpha * expected**2 if dispersion > 1.5 else 0)
    residual = (expected - y) / np.sqrt(variance + 1)
    metrics = {
        "family": family_name,
        "coefficients": model.params.tolist(),
        "observations": len(y),
        "positive_cells": int(np.count_nonzero(y)),
        "overdispersion": dispersion,
        "alpha": alpha if dispersion > 1.5 else None,
        "cv_mae": mae,
        "cv_baseline_mae": baseline_mae,
        "cv_coverage": float(valid.mean()),
        "folds": folds,
        "validation": "4-fold H3 resolution-5 groups with 800m exclusion buffer; fold-specific scaling, family, dispersion and baseline",
        "prediction_quantiles": np.quantile(expected, [0, 0.25, 0.5, 0.75, 0.95, 1]).tolist(),
        "parameters": {
            "means": mean.tolist(),
            "scales": scale.tolist(),
            "alpha": alpha,
            "predictors": [
                "population_density",
                "station_proximity",
                "complementary_venues",
                "high_street_proximity",
                "occupancy_cost_pressure",
            ],
        },
    }
    return expected, confidence, metrics, residual
