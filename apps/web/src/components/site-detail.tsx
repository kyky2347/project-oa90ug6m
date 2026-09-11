"use client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Footprints,
  Info,
  Layers3,
  Scale,
  TrainFront,
  X,
} from "lucide-react";
import { api, qs, useDetail, useSources } from "@/lib/api";
import {
  businesses,
  componentKeys,
  labels,
  type Catchment,
  type Detail,
} from "@/lib/types";
import { usePulseStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Separator } from "./ui/separator";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Skeleton } from "./ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "./ui/alert";

export function ScoreBars({ detail }: { detail: Detail }) {
  const { t } = useI18n();

  return (
    <div className="component-bars">
      {componentKeys.map((k) => (
        <div className="component-row" key={k}>
          <div>
            <span>{t(labels[k])}</span>
            <strong>{Math.round(detail.components[k])}</strong>
          </div>
          <div className="component-track">
            <span style={{ width: `${detail.components[k]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
export function SiteDetail({
  h3,
  onClose,
  onCatchment,
  debug = false,
}: {
  h3: string;
  onClose: () => void;
  onCatchment: (c: Catchment | null) => void;
  debug?: boolean;
}) {
  const { t, number, population } = useI18n();

  const state = usePulseStore();
  const sourceInfo = useSources();
  const query = useDetail(h3, state.business, state.weights);
  const [minutes, setMinutes] = useState<5 | 10 | 15 | null>(null);
  const d = query.data;
  const catchQuery = useQuery({
    queryKey: ["catchment", h3, state.business, state.weights, minutes],
    enabled: minutes !== null,
    queryFn: () =>
      api<Catchment>(
        `/cells/${h3}/catchment?` +
          qs({
            business: state.business,
            minutes,
            weights: state.weights ? JSON.stringify(state.weights) : undefined,
          }),
      ),
    staleTime: 60000,
  });
  const catchmentComparison = useQueries({
    queries: [5, 10, 15].map((n) => ({
      queryKey: ["catchment", h3, state.business, state.weights, n],
      enabled: minutes !== null,
      queryFn: () =>
        api<Catchment>(
          `/cells/${h3}/catchment?` +
            qs({
              business: state.business,
              minutes: n,
              weights: state.weights
                ? JSON.stringify(state.weights)
                : undefined,
            }),
        ),
      staleTime: 60000,
    })),
  });
  useEffect(() => {
    onCatchment(catchQuery.data || null);
  }, [catchQuery.data, onCatchment]);
  const saved = state.shortlist.some(
      (s) => s.h3 === h3 && s.business === state.business,
    ),
    battle = state.battle.includes(h3);
  return (
    <aside className="detail-panel glass" aria-label={t("Site details")}>
      <div className="panel-kicker">
        <span>
          <span className="status-dot" />
          {t(" LOCATION INTELLIGENCE")}
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("Close site details")}
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      {query.isPending && (
        <div className="detail-loading">
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}
      {query.error && (
        <Alert variant="destructive">
          <AlertTitle>{t("Site unavailable")}</AlertTitle>
          <AlertDescription>{t(query.error.message)}</AlertDescription>
        </Alert>
      )}
      {d && (
        <>
          <div className="detail-heading">
            <p>
              {d.borough}
              {t(" / LONDON")}
            </p>
            <h2>{t(d.label)}</h2>
            <span>
              {t(businesses.find((b) => b.id === state.business)?.name)} ·{" "}
              {t(d.raw.resolution === 9 ? "Detailed area" : "Overview area")}
            </span>
          </div>
          <div className="score-hero">
            <div>
              <span className="eyebrow">{t("OPPORTUNITY SCORE")}</span>
              <strong data-testid="selected-score">
                {Math.round(d.score)}
                <small>/100</small>
              </strong>
            </div>
            <div className="confidence-pill">
              <Check size={13} />
              <b>{Math.round(d.confidence * 100)}%</b>
              <span>{t("Data confidence")}</span>
            </div>
          </div>
          <div className="detail-actions">
            <Button
              variant={saved ? "secondary" : "outline"}
              size="sm"
              onClick={() => state.save(d)}
            >
              <Bookmark data-icon="inline-start" />
              {t(saved ? "Shortlisted" : "Shortlist")}
            </Button>
            <Button
              variant={battle ? "secondary" : "outline"}
              size="sm"
              onClick={() => state.compare(h3)}
            >
              <Scale data-icon="inline-start" />
              {t(battle ? "Added to battle" : "Compare site")}
            </Button>
          </div>
          {state.battle.length === 2 && (
            <Link className="battle-ready" href="/compare">
              {t("Both sites ready. Open Site Battle")}
              <ArrowUpRight size={14} />
            </Link>
          )}
          <Separator />
          <div className="panel-section">
            <div className="section-label">
              {t("WHY THIS AREA?")}
              <Info size={13} />
            </div>
            <p className="evidence-summary">{t(d.explanation.summary)}</p>
            <ScoreBars detail={d} />
          </div>
          <details className="explain-details">
            <summary>
              {t("Explain the score")}
              <ChevronDown size={14} />
            </summary>
            <p>
              {t(
                "Neutral baseline: 50. Each contribution includes the selected weight and confidence shrinkage.",
              )}
            </p>
            <div className="waterfall">
              {d.explanation.contributions.map((c) => (
                <div key={c.component}>
                  <span>{t(c.label)}</span>
                  <div className="waterfall-track">
                    <i
                      style={{
                        left:
                          c.contribution < 0
                            ? `${50 - Math.abs(c.contribution) * 3}%`
                            : "50%",
                        width: `${Math.abs(c.contribution) * 3}%`,
                        background:
                          c.contribution < 0
                            ? "var(--warning)"
                            : "var(--primary)",
                      }}
                    />
                  </div>
                  <b>
                    {t(c.contribution >= 0 ? "+" : "")}
                    {c.contribution.toFixed(1)}
                  </b>
                </div>
              ))}
            </div>
            <div className="detail-equation">
              {t("50 + contributions = ")}
              {d.score.toFixed(2)}
            </div>
            <p>
              {t(
                state.weights
                  ? "Custom weights"
                  : "PULSE default business profile",
              )}{" "}
              ·{" "}
              <button onClick={() => state.set({ panel: "weights" })}>
                {t("Adjust weights")}
              </button>
            </p>
          </details>
          <Separator />
          <div className="panel-section">
            <div className="section-label">
              {t("THE EVIDENCE")}
              <Layers3 size={13} />
            </div>
            <dl className="evidence-grid">
              <div>
                <dt>{t("Resident population proxy")}</dt>
                <dd>{population(d.raw.population)}</dd>
              </div>
              <div>
                <dt>{t("Observed supply in cell")}</dt>
                <dd>
                  {number(d.raw.observed_supply)}
                  <small>{t(" mapped venues")}</small>
                </dd>
              </div>
              <div>
                <dt>{t("Model expected supply")}</dt>
                <dd>{number(d.raw.expected_supply, 1)}</dd>
              </div>
              <div>
                <dt>{t("Supply gap signal")}</dt>
                <dd>{number(d.raw.supply_gap, 1)}</dd>
              </div>
              <div>
                <dt>{t("Occupancy Cost Pressure Proxy")}</dt>
                <dd>
                  {t(
                    d.raw.occupancy_cost_pressure
                      ? `£${number(d.raw.occupancy_cost_pressure)}`
                      : "Unavailable",
                  )}
                  <small>{t(" borough median band estimate · not rent")}</small>
                </dd>
              </div>
            </dl>
            <div className="transit-evidence">
              <TrainFront size={17} />
              <div>
                <strong>
                  {d.raw.nearest_station || t("Station data unavailable")}
                </strong>
                <span>
                  {number(d.raw.station_distance_m)}
                  {t("m from cell centre ·")} {number(d.raw.transit_demand)}
                  {t(" typical entries/exits, distance weighted")}
                </span>
              </div>
            </div>
          </div>
          <details className="explain-details">
            <summary>
              {t("Mapped venues within 600m")}
              <ChevronDown size={14} />
            </summary>
            <p>
              {t(
                "OSM coverage varies. Observed supply above uses the H3 cell, while this list describes its surroundings.",
              )}
            </p>
            <div className="poi-list">
              {d.nearby_pois.slice(0, 25).map((p) => (
                <div key={p.id}>
                  <span>
                    {p.name || t(p.category.replaceAll("_", " "))}
                    <small>{t(p.category.replaceAll("_", " "))}</small>
                  </span>
                  <b>
                    {Math.round(p.distance_m)}
                    {t("m")}
                  </b>
                </div>
              ))}
            </div>
          </details>
          <Separator />
          <div className="panel-section">
            <div className="section-label">
              {t("LOOK A LITTLE FURTHER")}
              <Footprints size={13} />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMinutes(minutes ? null : 10)}
            >
              <Footprints data-icon="inline-start" />
              {t(minutes ? "Close catchment" : "Analyse catchment")}
            </Button>
            {minutes && (
              <div className="catchment-result">
                <ToggleGroup
                  type="single"
                  value={String(minutes)}
                  onValueChange={(v) => {
                    if (v) setMinutes(Number(v) as 5 | 10 | 15);
                  }}
                  aria-label={t("Walking catchment minutes")}
                >
                  {[5, 10, 15].map((n) => (
                    <ToggleGroupItem key={n} value={String(n)}>
                      {n}
                      {t(" min")}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Badge variant="secondary">
                  {t("Radial walking-time proxy")}
                </Badge>
                {catchQuery.isPending && (
                  <p>{t("Intersecting the London evidence…")}</p>
                )}
                {catchQuery.error && (
                  <p role="alert">{t(catchQuery.error.message)}</p>
                )}
                {catchQuery.data && (
                  <>
                    <dl className="catchment-metrics">
                      <div>
                        <dt>{t("Residents")}</dt>
                        <dd>{number(catchQuery.data.metrics.population)}</dd>
                      </div>
                      <div>
                        <dt>{t("Competitors")}</dt>
                        <dd>{catchQuery.data.competitors}</dd>
                      </div>
                      <div>
                        <dt>{t("Complementary venues")}</dt>
                        <dd>{catchQuery.data.complementary_venues}</dd>
                      </div>
                    </dl>
                    <dl className="catchment-metrics">
                      <div>
                        <dt>{t("Station proximity index")}</dt>
                        <dd>
                          {number(catchQuery.data.metrics.transit_access, 2)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("High street intersects")}</dt>
                        <dd>
                          {t(
                            catchQuery.data.metrics.high_street_intersection
                              ? "Yes"
                              : "No",
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("Cost pressure · borough proxy")}</dt>
                        <dd>
                          £
                          {number(
                            catchQuery.data.metrics.occupancy_cost_pressure,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>{t("Approx. reported incidents · 3 months")}</dt>
                        <dd>{number(catchQuery.data.metrics.incidents)}</dd>
                      </div>
                    </dl>
                    <p>
                      {t("Opportunity P10 / median / P90:")}{" "}
                      {catchQuery.data.opportunity_distribution
                        .map((n) => Math.round(n))
                        .join(" / ")}
                    </p>
                    <table
                      className="catchment-table"
                      aria-label={t("Catchment size comparison")}
                    >
                      <thead>
                        <tr>
                          <th>{t("Radial proxy")}</th>
                          <th>{t("Residents")}</th>
                          <th>{t("Competitors")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catchmentComparison.map((q, i) => (
                          <tr key={i}>
                            <td>
                              {[5, 10, 15][i]}
                              {t(" minutes")}
                            </td>
                            <td>
                              {t(
                                q.data
                                  ? number(q.data.metrics.population)
                                  : q.error
                                    ? "Unavailable"
                                    : "Calculating",
                              )}
                            </td>
                            <td>
                              {t(q.data ? number(q.data.competitors) : "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>{t(catchQuery.data.methodology)}</p>
                  </>
                )}
              </div>
            )}
          </div>
          <details className="explain-details">
            <summary>
              {t("Confidence & source provenance")}
              <ChevronDown size={14} />
            </summary>
            <p>{t(d.confidence_note)}</p>
            {sourceInfo.data?.sources.map((s) => (
              <p key={s.id}>
                {t(s.publisher)}
                {t(": reference")}{" "}
                {s.latest_snapshot?.published_at || t("date not supplied")}
                {t(" · retrieved")}{" "}
                {s.latest_snapshot?.retrieved_at.slice(0, 10) ||
                  t("Unavailable")}
              </p>
            ))}
            {Object.entries(d.confidence_factors).map(([k, v]) => (
              <div className="confidence-factor" key={k}>
                <span>{t(k)}</span>
                <b>{Math.round(v * 100)}%</b>
              </div>
            ))}
            <p>
              {t("Supply model: ")}
              {d.model.family}. {t(d.model.metrics.validation)}
              {t(". Held-out MAE: ")}
              {number(d.model.metrics.cv_mae, 3)}
              {t(" mapped venues per cell.")}
            </p>
            <p>
              {t(
                "Reported incidents are approximate geographic aggregates. Rateable-value bands do not measure lease costs.",
              )}
            </p>
            <code>{d.feature_version}</code>
            <Link className="quiet-link" href="/data">
              {t("View source dates & snapshots")}
              <ArrowUpRight size={13} />
            </Link>
          </details>
          <Link
            className="detail-deep-link"
            href={`/site/${h3}?business=${state.business}`}
          >
            {t("Open full site view")}
            <ArrowUpRight size={14} />
          </Link>
          {debug && (
            <pre className="debug-panel">
              {JSON.stringify(
                {
                  h3,
                  feature_version: d.feature_version,
                  raw: d.raw,
                  confidence_factors: d.confidence_factors,
                  client_round_trip_ms: d.client_round_trip_ms,
                  response_received_at: new Date(
                    query.dataUpdatedAt,
                  ).toISOString(),
                },
                null,
                2,
              )}
            </pre>
          )}
        </>
      )}
    </aside>
  );
}
