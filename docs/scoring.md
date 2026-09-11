# Transparent opportunity scoring

All six components lie on a within-London 0–100 scale, separately for each H3 resolution. Winsorise finite feature values at the 1st and 99th percentiles, apply signed log1p where applicable, and use average-tie percentile ranks. Constant features and missing values are neutral 50. Missing sources separately reduce confidence. Ranks are relative signals, not calibrated commercial outcomes.

| Profile | Demand | Access | White space | Ecosystem | Cost | Operational |
|---|---:|---:|---:|---:|---:|---:|
| Coffee | 27 | 18 | 25 | 13 | 12 | 5 |
| Bakery | 29 | 16 | 24 | 14 | 12 | 5 |
| Restaurant | 26 | 17 | 22 | 18 | 12 | 5 |
| Gym | 24 | 15 | 26 | 10 | 20 | 5 |
| Convenience | 30 | 18 | 25 | 8 | 14 | 5 |
| Coworking | 25 | 22 | 20 | 17 | 11 | 5 |

These are **PULSE default business profiles**, not empirically proven optimal weights. API accepts exactly six finite, non-negative weights, each at most 100, with positive total; divides by their sum and hashes the normalised values. The frontend never recomputes canonical scores.

`Raw = Σ weight[k] × component[k]`

`Final = 50 + confidence × (Raw − 50)`

`Contribution[k] = confidence × weight[k] × (component[k] − 50)`

The six contributions plus baseline 50 reconcile to final score; only display rounding can differ. Shrinkage pulls both overly positive and overly negative scores toward neutral. Ties use lexical H3 ID for reproducibility. Default rankings exclude confidence below 0.60 and display 20 qualifying areas.

## Components

Demand combines population-density percentile, decayed typical station demand and proximity to a GLA high street. Bakery, gym and convenience use 60/25/15; coffee, restaurant and coworking use 35/45/20. These are transparent residential/visitor assumptions.

Access is 80% nearest-station proximity percentile and 20% nearby transport POI percentile. Station influence is `Σ entries_and_exits × exp(−distance/600m)` with a 3km cutoff. Proximity is `exp(−distance/600m)`. The 600m scale is an explicit approximate 7.5-minute radial walk assumption at 80m/min, not an estimated causal coefficient.

White Space is the percentile of the variance-standardised expected-minus-observed count residual. Details are in [white-space-model.md](white-space-model.md).

Ecosystem counts complementary venues within 600m, using category-specific lists in `packages/scoring/core.py`. The target category is excluded from its own predictor list. Cost efficiency is the inverse percentile of borough grouped-median rateable-value bands. Operational context is the inverse percentile of reported incident intensity per square kilometre per month over three months, deliberately only 5% by default.

Competitive gravity is a separate visual overlay: each mapped competitor contributes `exp(−distance/300m)` within 1,500m; displayed as a London percentile. Zero pressure remains zero. It does not replace the count model or enter opportunity as a second penalty.
