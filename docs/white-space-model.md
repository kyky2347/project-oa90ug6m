# Expected supply and white space

The response is mapped OSM target-category venues inside the cell. Predictors are population density, station proximity, complementary venues within 600m, high-street proximity and borough cost pressure. No target count, competitor gravity or outcome-derived ranking is a predictor. All-person area population is the only demographic input.

Fit a Poisson GLM with log link after non-negative log1p transforms and standardisation. If Pearson dispersion exceeds 1.5, refit a Negative Binomial GLM using a moment estimate of alpha (floor 0.01). Store coefficients, means, scales, family, alpha, dispersion, sample size and prediction quantiles.

`mu[i] = exp(beta[0] + Σ beta[k] × standardised_log_feature[i,k])`

`variance[i] = mu[i]` for Poisson; `mu[i] + alpha × mu[i]^2` for Negative Binomial.

`gap[i] = expected[i] − observed[i]`

`white_space_signal[i] = gap[i] / sqrt(variance[i] + 1)`

Rank that signal within London and resolution. More expected-than-mapped supply raises white space; sparse mapped supply alone does not establish an opportunity. The full-data model is used for explanatory expected counts after evaluating generalisation.

## Spatial evaluation

Four GroupKFold splits use H3 resolution-5 parent groups. Exclude training cells within 800m of any held-out centroid. Every fold fits its own scaling, Poisson dispersion, family, alpha and constant-mean baseline from training data only. Predictions are capped at 10 × maximum training count, with a floor of 0.001. Record MAE, Poisson deviance, training/test counts, minimum separation and validation coverage. This is geographic validation, not a random split. It does not establish causal effects or future business success.

If fewer than 40 cells contain a target venue or fewer than 100 venues are mapped, use a shrunken exposure-rate fallback: exposure `1 + population_density / mean_density`; expected `(total_count+2)/(total_exposure+2) × exposure`. Such models explicitly report that no predictive validation is claimed. All six current London categories exceeded the fallback threshold.

Model quality starts at 0.45 and adds up to 0.30 for MAE improvement over the fold-specific mean baseline. Predictions above the 95th percentile receive additional extrapolation discount. It is a quality factor, not a calibrated predictive interval. Current model metrics are recorded in [release-data.json](release-data.json).

## Limitations

OSM under-mapping can look like white space. Borough cost is coarse and mixes property uses. Venue clustering and complementary-category overlap leave residual spatial dependence even with buffered folds. Supply is a behavioural equilibrium affected by unobserved rents, planning, availability, competition and historic selection. No business revenues, openings/closures or commercial success labels are used. A category can fail to beat the held-out baseline; the UI and model report retain that result rather than manufacturing a stronger fit.
