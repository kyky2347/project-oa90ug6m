"""Canonical, deterministic scoring; missing evidence is neutral and lowers confidence."""
import hashlib
import json
from collections.abc import Mapping

import numpy as np
from scipy.stats import rankdata

COMPONENTS = ('demand', 'access', 'white_space', 'ecosystem', 'cost_efficiency', 'operational_context')
LABELS = dict(zip(COMPONENTS, ['Demand Potential', 'Access', 'White Space', 'Ecosystem',
                             'Cost Efficiency', 'Operational Context'], strict=True))
PROFILE_ROWS = [
    ('coffee', 'Coffee Shop', [.27, .18, .25, .13, .12, .05], ['office', 'university', 'transport', 'coworking', 'hotel', 'retail']),
    ('bakery', 'Bakery', [.29, .16, .24, .14, .12, .05], ['transport', 'school', 'coffee', 'retail']),
    ('restaurant', 'Restaurant', [.26, .17, .22, .18, .12, .05], ['retail', 'hotel', 'entertainment', 'pub_bar', 'office', 'transport']),
    ('gym', 'Gym', [.24, .15, .26, .10, .20, .05], ['office', 'transport', 'retail']),
    ('convenience', 'Convenience Store', [.30, .18, .25, .08, .14, .05], ['transport', 'retail', 'office', 'hotel']),
    ('coworking', 'Coworking Space', [.25, .22, .20, .17, .11, .05], ['office', 'coffee', 'transport', 'hotel', 'retail']),
]
PROFILES = {key: {'id': key, 'name': name, 'weights': dict(zip(COMPONENTS, weights, strict=True)),
                  'complements': complements, 'label': 'PULSE default business profiles'}
            for key, name, weights, complements in PROFILE_ROWS}
TARGET_CATEGORY = {'gym': 'gym_fitness', **{k: k for k in PROFILES if k != 'gym'}}


def normalize_weights(weights: Mapping):
    if set(weights) != set(COMPONENTS):
        raise ValueError('Provide exactly the six score components')
    values = np.array([weights[k] for k in COMPONENTS], dtype=float)
    if not np.all(np.isfinite(values)) or np.any(values < 0) or np.any(values > 100):
        raise ValueError('Weights must be finite non-negative numbers between 0 and 100')
    if values.sum() <= 0:
        raise ValueError('At least one weight must be positive')
    values /= values.sum()
    return dict(zip(COMPONENTS, values.tolist(), strict=True))


def weights_hash(weights):
    normalized = normalize_weights(weights)
    canonical = {k: round(normalized[k], 10) for k in COMPONENTS}
    return hashlib.sha256(json.dumps(canonical, sort_keys=True).encode()).hexdigest()[:16]


def percentile(values, inverse=False, log_transform=True):
    x = np.asarray(values, dtype=float)
    good = np.isfinite(x)
    out = np.full(x.shape, 50.0)
    if good.sum() <= 1:
        return out
    a = x[good]
    a = np.clip(a, *np.quantile(a, [.01, .99]))
    if log_transform:
        a = np.sign(a) * np.log1p(np.abs(a))
    # Average ties: constant or all-zero variables stay neutral.
    r = (rankdata(a, method='average') - 1) / (len(a) - 1) * 100
    out[good] = 100 - r if inverse else r
    return np.clip(out, 0, 100)


def opportunity(components, confidence, weights):
    w = normalize_weights(weights)
    matrix = np.asarray(components, dtype=float)
    c = np.asarray(confidence, dtype=float)
    if matrix.shape[-1] != 6 or not np.all(np.isfinite(matrix)) or np.any((matrix < 0) | (matrix > 100)):
        raise ValueError('Components must be six finite 0–100 values')
    if not np.all(np.isfinite(c)) or np.any((c < 0) | (c > 1)):
        raise ValueError('Confidence must be finite and between zero and one')
    raw = matrix @ np.array([w[k] for k in COMPONENTS])
    final = 50 + c * (raw - 50)
    return raw, final


def explain(components, confidence, weights):
    w = normalize_weights(weights)
    contributions = [{'component': k, 'label': LABELS[k], 'value': components[k], 'weight': w[k],
                      'contribution': confidence * w[k] * (components[k] - 50)} for k in COMPONENTS]
    positives = sorted((r for r in contributions if r['contribution'] > 0),
                       key=lambda r: r['contribution'], reverse=True)
    constraints = sorted((r for r in contributions if r['contribution'] < 0), key=lambda r: r['contribution'])
    drivers = ', '.join(r['label'].lower() for r in positives[:2]) or 'a balanced mix of signals'
    limitation = constraints[0]['label'].lower() if constraints else 'source and model uncertainty'
    return {'baseline': 50, 'contributions': contributions,
            'summary': f'This area is supported by {drivers}. The main constraint is {limitation}.',
            'note': 'Contributions include confidence shrinkage and sum with the neutral baseline to the final score.'}
