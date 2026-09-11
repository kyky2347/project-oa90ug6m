"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { useProfiles } from "@/lib/api";
import { componentKeys, labels } from "@/lib/types";
import { Button } from "@/components/ui/button";
const sections = [
  ["purpose", "A signal to investigate"],
  ["sources", "The evidence"],
  ["space", "One spatial language"],
  ["components", "Six components"],
  ["white-space", "The supply gap"],
  ["confidence", "Confidence & uncertainty"],
  ["weights", "Your business profile"],
  ["time", "Time & catchments"],
  ["limits", "Limits & responsible use"],
];
export default function Methodology() {
  const { t } = useI18n();

  const profiles = useProfiles();
  return (
    <main className="content-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <BookOpen size={13} />
            {t(" OPEN METHODOLOGY")}
          </div>
          <h1>
            {t("No black box.")}
            <br />
            <span>{t("Just a better lens.")}</span>
          </h1>
          <p>
            {t(
              "Understand exactly what an Opportunity Score measures, how it is calculated, and where the evidence ends.",
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/explore">
            {t("Put it into perspective")}
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <div className="methodology-layout">
        <nav className="methodology-toc" aria-label={t("Methodology contents")}>
          {sections.map(([id, label]) => (
            <a key={id} href={"#" + id}>
              {t(label)}
            </a>
          ))}
        </nav>
        <div className="methodology-copy">
          <section id="purpose">
            <h2>{t("A signal to investigate.")}</h2>
            <p>
              {t(
                "PULSE screens areas for further commercial investigation. It brings together area-level public evidence about residents, mapped businesses, transport access and the commercial environment. It does not predict revenue, estimate actual rent, measure live footfall, or guarantee a successful business.",
              )}
            </p>
            <p>
              {t(
                "An Opportunity Score is a relative London screening index under a chosen business profile. A higher score means the combination of measured proxies is more favourable under that profile, with uncertainty shrinking scores toward neutral.",
              )}
            </p>
          </section>
          <section id="sources">
            <h2>{t("Real evidence. Different perspectives.")}</h2>
            <p>
              <a
                href="https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/lowersuperoutputareamidyearpopulationestimates"
                target="_blank"
                rel="noreferrer"
              >
                {t("ONS mid-year population estimates")}
              </a>{" "}
              {t(
                "provide all-person LSOA totals. Census 2021 household counts complement the more recent resident estimates. No protected demographic characteristics enter the scoring model.",
              )}
            </p>
            <p>
              <a
                href="https://download.geofabrik.de/europe/united-kingdom/england/greater-london.html"
                target="_blank"
                rel="noreferrer"
              >
                {t("OpenStreetMap via Geofabrik")}
              </a>{" "}
              {t(
                "provides mapped competitors and complementary venues. A single canonical taxonomy prevents multi-tag double counting. Named colocated representations are deduplicated conservatively. Mapped businesses are an incomplete sample of actual businesses.",
              )}
            </p>
            <p>
              <a
                href="https://tfl.gov.uk/info-for/open-data-users/our-open-data"
                target="_blank"
                rel="noreferrer"
              >
                {t("TfL NUMBAT")}
              </a>{" "}
              {t("provides typical autumn station entries and exits.")}{" "}
              <a
                href="https://data.police.uk/docs/method/crime-street/"
                target="_blank"
                rel="noreferrer"
              >
                {t("UK Police")}
              </a>{" "}
              {t(
                "provides three months of reported incident locations, which are anonymised and approximate.",
              )}{" "}
              <a
                href="https://www.gov.uk/government/collections/non-domestic-rating-stock-of-properties-collection"
                target="_blank"
                rel="noreferrer"
              >
                {t("HMRC/VOA rating stock")}
              </a>{" "}
              {t("provides rateable-value bands, while")}{" "}
              <a
                href="https://data.london.gov.uk/dataset/gla-high-street-boundaries"
                target="_blank"
                rel="noreferrer"
              >
                {t("GLA high-street boundaries")}
              </a>{" "}
              {t("provide commercial context.")}
            </p>
            <p>
              {t(
                "Every download has a recorded resolved URL, licence, checksum, parser version, retrieval timestamp, publication/reference date where supplied, row count and validation status.",
              )}{" "}
              <Link href="/data">{t("Inspect the active snapshots.")}</Link>
            </p>
          </section>
          <section id="space">
            <h2>{t("One spatial language.")}</h2>
            <p>
              {t(
                "H3 resolution 8 provides the city overview and rankings; resolution 9 provides detailed exploration. Every cell intersects the official London LSOA footprint. All 32 boroughs plus the City of London are validated at both resolutions.",
              )}
            </p>
            <p>
              {t(
                "Population is allocated from each LSOA to intersecting hexagons in proportion to their shared area, calculated in British National Grid (EPSG:27700). Allocation conserves the London population total. This assumes uniform population within each LSOA; it is an area-level resident proxy, not a building or household count. Population displayed to users is rounded to the nearest 100.",
              )}
            </p>
            <p>
              {t(
                "Venue counts in the local ecosystem use a 600-metre radius. Station influence, intersections, incident aggregates and transport time series are precomputed. PostgreSQL/PostGIS is the canonical warehouse; Redis caches versioned results.",
              )}
            </p>
          </section>
          <section id="components">
            <h2>{t("Six components, made explicit.")}</h2>
            <p>
              {t(
                "Numeric features are winsorised at the 1st and 99th percentiles, transformed with signed log(1 + |x|) where appropriate, and converted to within-London percentiles separately at each resolution. Tied values receive average ranks. Missing values receive a neutral 50 and reduce confidence.",
              )}
            </p>
            <h3>{t("Demand Potential")}</h3>
            <p>
              {t(
                "Coffee shops, restaurants and coworking use 35% resident intensity, 45% station demand influence and 20% high-street proximity. Bakery, gym and convenience profiles use 60%, 25% and 15% respectively. These are transparent product assumptions about proxy relevance, not measurements of customers or buying intent.",
              )}
            </p>
            <div className="equation">
              {t("Transit influenceᵢ = Σ demandₛ · exp(−dᵢₛ / 600 m)")}
            </div>
            <p>
              {t(
                "The decay length is 600 metres, about 7.5 minutes at the radial proxy’s assumed walking speed. Influence is truncated at 3 km. Counts combine station entries and exits; summing overlapping station influence does not count unique people.",
              )}
            </p>
            <h3>{t("Access")}</h3>
            <p>
              {t(
                "80% nearest-station proximity percentile and 20% mapped transport-venue availability percentile. Station demand volume is excluded here to reduce duplication with Demand Potential. Correlations still exist between access and demand.",
              )}
            </p>
            <h3>{t("Ecosystem")}</h3>
            <p>
              {t(
                "The percentile of complementary venues within 600 metres. Coffee benefits in the default profile from offices, university/college venues, transport, coworking, hotels and retail. Restaurant uses retail, hotels, entertainment, pubs/bars, offices and transport. Coworking uses offices, coffee, transport, hotels and retail. The target category is excluded from its own model predictors.",
              )}
            </p>
            <h3>{t("Cost Efficiency")}</h3>
            <p>
              {t(
                "The inverse London percentile of a borough-wide grouped median rateable value. The median is interpolated within the published value band, assuming a uniform distribution inside that band. The broad bands and borough scale create significant uncertainty. This is an Occupancy Cost Pressure Proxy, not market rent, a lease quote or an assessment of an individual property. Missing or suppressed bands never receive a perfect score.",
              )}
            </p>
            <h3>{t("Operational Context")}</h3>
            <p>
              {t(
                "The inverse percentile of reported incident intensity per square kilometre per month over three months. It is a reported incident environment proxy, not a safety assessment or resident victimisation rate. Its default weight is 5%. Anonymised coordinates, differences in reporting and activity concentration all affect this measure.",
              )}
            </p>
          </section>
          <section id="white-space">
            <h2>{t("Low supply is not automatically opportunity.")}</h2>
            <p>
              {t(
                "A place with few competitors may also have very little demand. PULSE estimates the mapped supply expected under surrounding commercial conditions, then compares that estimate with observed supply in the cell.",
              )}
            </p>
            <div className="equation">
              {t("log(E[supplyᵢ]) = β₀ + Σ βₖ · standardised log(1 + xᵢₖ)")}
              <br />
              {t("Gapᵢ = (expectedᵢ − observedᵢ) / √(varianceᵢ + 1)")}
            </div>
            <p>
              {t(
                "Predictors are population density, station proximity, complementary venues, high-street proximity and the occupancy cost proxy. We fit a Poisson GLM, switching to Negative Binomial when Pearson overdispersion exceeds 1.5. The Negative Binomial dispersion parameter uses a moments estimate from the Poisson residuals.",
              )}
            </p>
            <p>
              {t(
                "Validation holds out H3 resolution-5 geographic groups with an 800-metre exclusion buffer. Four folds report absolute error against a mean-supply baseline. Coefficients, error metrics, dispersion and prediction quantiles are recorded with every model. Small samples fall back to an explicitly labelled shrunken exposure ratio.",
              )}
            </p>
            <p>
              {t(
                "The final White Space component is the within-London percentile of the standardised gap. A positive gap means less mapped supply than the model expects. It is not proof of unmet demand. At resolution 9 the current coworking model does not outperform the simple mean baseline; its model-quality factor remains at the conservative floor. New developments, destination venues, planning constraints and uneven OSM coverage can all mislead this signal.",
              )}
            </p>
          </section>
          <section id="confidence">
            <h2>{t("Uncertainty pulls scores toward neutral.")}</h2>
            <div className="equation">
              {t("Raw opportunityᵢ = Σ wₖ · componentᵢₖ")}
              <br />
              {t("Final opportunityᵢ = 50 + cᵢ · (raw opportunityᵢ − 50)")}
            </div>
            <p>
              {t(
                "Weights are explicitly normalised to sum to 1. Each component is between 0 and 100; c is between 0 and 1. When confidence falls, the score moves toward 50 rather than retaining an extreme ranking.",
              )}
            </p>
            <p>
              {t(
                "Confidence is a geometric mean of four documented factors: source coverage, source recency, spatial matching and model quality. It is a quality index. It has not been calibrated as a statistical probability or an interval for commercial success.",
              )}
            </p>
            <ul>
              <li>
                {t(
                  "Coverage measures source availability, cost missingness and a limited surrounding-POI coverage proxy. It cannot establish a complete business census.",
                )}
              </li>
              <li>
                {t(
                  "Recency decays by source: OSM and Police have a one-year half-life, TfL and VOA three years, population six years, and structural boundaries much longer. Unknown publication dates are explicitly discounted.",
                )}
              </li>
              <li>
                {t(
                  "Spatial quality accounts for population area allocation, coarse borough-level cost data and station name matching.",
                )}
              </li>
              <li>
                {t(
                  "Model quality uses spatial validation skill relative to a mean-supply baseline, with lower confidence for extrapolated high predictions and sparse fallback models.",
                )}
              </li>
            </ul>
            <p>
              {t(
                "Default rankings exclude cells below 60% quality confidence. This threshold is adjustable and is a screening choice, not a statistical significance test.",
              )}
            </p>
          </section>
          <section id="weights">
            <h2>{t("Your priorities are part of the model.")}</h2>
            <p>
              {t(
                "These are the PULSE default business profiles. They are practical starting assumptions, not universal truths. Changing a weight can change the map and rankings; all canonical scores are calculated by the API from the same versioned components.",
              )}
            </p>
            <div className="table-scroll">
              <table className="weights-table">
                <thead>
                  <tr>
                    <th>{t("Profile")}</th>
                    {componentKeys.map((k) => (
                      <th key={k}>{t(labels[k])}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {profiles.data?.profiles.map((p) => (
                    <tr key={p.id}>
                      <td>{t(p.name)}</td>
                      {componentKeys.map((k) => (
                        <td key={k}>{Math.round(p.weights[k] * 100)}%</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section id="time">
            <h2>{t("A typical day. A transparent catchment.")}</h2>
            <p>
              {t(
                "City Pulse animates official TfL quarter-hour station entries and exits. Weekday represents Tuesday–Thursday; Saturday and Sunday use their respective profiles. Only the transport influence layer changes with time. Structural population and opportunity scores are not rewritten during playback.",
              )}
            </p>
            <p>
              {t(
                "Catchments are explicitly labelled radial walking-time proxies: 5, 10 or 15 minutes at 80 metres per minute, giving radii of 400, 800 and 1,200 metres. They do not follow the street network and can cross the Thames, railways or private land. Population at the catchment edge is area-allocated from resolution-9 cells. These are not network isochrones.",
              )}
            </p>
          </section>
          <section id="limits">
            <h2>{t("Bring local knowledge to the final decision.")}</h2>
            <p>
              {t(
                "PULSE does not include actual rents, vacancies, planning permissions, lease terms, business turnover, pedestrian counts, customer preferences or property condition. Areas may score well while having no suitable premises. Public data can be delayed, incomplete or unevenly mapped.",
              )}
            </p>
            <p>
              {t(
                "Opportunity is a function of the selected profile, geography and available proxies. The current research model is not calibrated against store openings, survival or revenue. Category mapping and statistical family choices are inspectable but still simplify a complex city.",
              )}
            </p>
            <p>
              {t(
                "No individual profiles or sensitive demographic characteristics are used. School proximity is only a broad land-use context for bakeries. Reported incidents have a deliberately small default weight and must not be used to stigmatise residents or neighbourhoods.",
              )}
            </p>
            <p>
              {t(
                "Refreshes stage new evidence, validate coverage and drift, and activate a new version atomically. Failed refreshes preserve the last working version. OSM checks weekly; population, transport, Police and rating stock monthly; structural boundaries quarterly.",
              )}
            </p>
            <p>
              <strong>
                {t(
                  "PULSE identifies areas worth investigating. It does not guarantee commercial success.",
                )}
              </strong>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
