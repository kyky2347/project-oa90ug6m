# Confidence as data quality

`c = (coverage × recency × spatial × model_quality)^(1/4)`

Coverage begins with the share of the six analytical sources available. Multiply by `0.85 + 0.15 × min(mapped_nearby_POIs/30,1)` as a weak OSM activity/coverage proxy; missing cost applies a 0.8 penalty. This cannot distinguish an unmapped business from an absent business and is not a completeness audit.

Recency averages source-specific exponential half-life factors `2^(−age_days/half_life_days)`: OSM and Police one year; TfL and VOA three years; population six years; GLA high streets fifteen years; geography twenty years. These are explicit stability assumptions. Unknown publication/reference date uses 0.8, never an invented date. The exact UTC reference time is stored with feature parameters so replay does not change confidence with the wall clock.

Spatial confidence is 0.8 × nearest station name-match quality, reflecting area-allocated population and coarse borough cost. Exact normalised station-name matches use 1.0; conservative fuzzy matches use 0.8. No station evidence uses 0.5 before the 0.8 factor.

Model confidence reflects buffered spatial MAE improvement and extrapolation; see the model document. Quality factors are visible in the site panel. Sparse categories get a declared 0.4 model-quality factor.

The index is **not a probability of success**, a standard error or a Bayesian posterior. It explicitly reduces the distance of the final opportunity score from neutral 50. Users can filter lower-confidence results and inspect all component evidence and dates.
