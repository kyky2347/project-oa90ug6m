# Interpretation and limitations

PULSE identifies areas worth investigating. It does not guarantee commercial success.

- Population and households describe residents, not shoppers, workers or purchasing power. H3 area allocation assumes uniform density within LSOAs. No protected-characteristic or person-level features enter scoring.
- OSM contains mapped businesses and other venues, not a complete or continuously verified business register. Closed or missing venues and taxonomy ambiguity affect both competitors and complementary context. A cafe node and building representation are only deduplicated when name/category and fine H3 cell match.
- TfL NUMBAT supplies historical typical station entries and exits. Decayed influence is not unique passengers, pedestrian counts or live footfall. The model misses station-free walking, cycling and many bus movements. Not every NUMBAT station could be matched to official coordinates.
- Police coordinates are deliberately approximate. Counts use reported incidents, police recording practices and a three-month window. Intensity per area differs from victimisation risk; it is labelled Operational Context and receives 5% default weight.
- VOA/HMRC values are interpolated medians of published rateable-value bands across all commercial stock in a borough. Broad bands, mixed property sizes/uses and assumed uniformity limit precision. They measure an Occupancy Cost Pressure Proxy, never actual rent or a lease quote.
- GLA high-street polygons are structural context. An unknown publication date is displayed as unknown and confidence-discounted. Restricted HSDS spend/mobility data is not used.
- H3 cells contain mixed uses, water, parks and roads and are not available premises. A score cannot establish planning permission, suitable floor area, frontage, accessibility, licence or lease availability.
- Count-model coefficients are associations with existing mapped supply. They are not causal determinants of commercial outcomes. Geographic validation reduces immediate-neighbour leakage but cannot remove all spatial dependence or mapping bias.
- Confidence is a transparent quality index with chosen half-lives and factors, not a calibrated success probability or predictive uncertainty interval. Default scoring profiles are transparent assumptions, not commercial truths.
- Catchments are explicitly **radial walking-time proxies** at 80m/minute: 400, 800 and 1,200m. They do not follow the street network, crossings or barriers and can cross the Thames. Catchment population and incidents are fractionally allocated from resolution-9 cells; transit access is the maximum proximity index, cost is a mean of borough proxy values among intersected cells, and opportunity distribution uses cell centroids inside the radius.

Next research priorities: external business-register completeness audit; land-use/availability masks; walking-network catchments; property-sector-specific cost comparisons; sensitivity to scale and decay assumptions; temporal holdout validation against openings/closures; calibrated model intervals. These are limitations and research extensions, not hidden implemented features.
