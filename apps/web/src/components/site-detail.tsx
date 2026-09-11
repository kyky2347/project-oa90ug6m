"use client";
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
import { api, number, population, qs, useDetail, useSources } from "@/lib/api";
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
  return (
    <div className="component-bars">
      {componentKeys.map((k) => (
        <div className="component-row" key={k}>
          <div>
            <span>{labels[k]}</span>
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
    <aside className="detail-panel glass" aria-label="Site details">
      <div className="panel-kicker">
        <span>
          <span className="status-dot" /> LOCATION INTELLIGENCE
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close site details"
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
          <AlertTitle>Site unavailable</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
        </Alert>
      )}
      {d && (
        <>
          <div className="detail-heading">
            <p>{d.borough} / LONDON</p>
            <h2>{d.label}</h2>
            <span>
              {businesses.find((b) => b.id === state.business)?.name} ·{" "}
              {d.raw.resolution === 9 ? "Detailed area" : "Overview area"}
            </span>
          </div>
          <div className="score-hero">
            <div>
              <span className="eyebrow">OPPORTUNITY SCORE</span>
              <strong data-testid="selected-score">
                {Math.round(d.score)}
                <small>/100</small>
              </strong>
            </div>
            <div className="confidence-pill">
              <Check size={13} />
              <b>{Math.round(d.confidence * 100)}%</b>
              <span>Data confidence</span>
            </div>
          </div>
          <div className="detail-actions">
            <Button
              variant={saved ? "secondary" : "outline"}
              size="sm"
              onClick={() => state.save(d)}
            >
              <Bookmark data-icon="inline-start" />
              {saved ? "Shortlisted" : "Shortlist"}
            </Button>
            <Button
              variant={battle ? "secondary" : "outline"}
              size="sm"
              onClick={() => state.compare(h3)}
            >
              <Scale data-icon="inline-start" />
              {battle ? "Added to battle" : "Compare site"}
            </Button>
          </div>
          {state.battle.length === 2 && (
            <Link className="battle-ready" href="/compare">
              Both sites ready. Open Site Battle
              <ArrowUpRight size={14} />
            </Link>
          )}
          <Separator />
          <div className="panel-section">
            <div className="section-label">
              WHY THIS AREA?
              <Info size={13} />
            </div>
            <p className="evidence-summary">{d.explanation.summary}</p>
            <ScoreBars detail={d} />
          </div>
          <details className="explain-details">
            <summary>
              Explain the score
              <ChevronDown size={14} />
            </summary>
            <p>
              Neutral baseline: 50. Each contribution includes the selected
              weight and confidence shrinkage.
            </p>
            <div className="waterfall">
              {d.explanation.contributions.map((c) => (
                <div key={c.component}>
                  <span>{c.label}</span>
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
                    {c.contribution >= 0 ? "+" : ""}
                    {c.contribution.toFixed(1)}
                  </b>
                </div>
              ))}
            </div>
            <div className="detail-equation">
              50 + contributions = {d.score.toFixed(2)}
            </div>
            <p>
              {state.weights
                ? "Custom weights"
                : "PULSE default business profile"}{" "}
              ·{" "}
              <button onClick={() => state.set({ panel: "weights" })}>
                Adjust weights
              </button>
            </p>
          </details>
          <Separator />
          <div className="panel-section">
            <div className="section-label">
              THE EVIDENCE
              <Layers3 size={13} />
            </div>
            <dl className="evidence-grid">
              <div>
                <dt>Resident population proxy</dt>
                <dd>{population(d.raw.population)}</dd>
              </div>
              <div>
                <dt>Observed supply in cell</dt>
                <dd>
                  {number(d.raw.observed_supply)}
                  <small> mapped venues</small>
                </dd>
              </div>
              <div>
                <dt>Model expected supply</dt>
                <dd>{number(d.raw.expected_supply, 1)}</dd>
              </div>
              <div>
                <dt>Supply gap signal</dt>
                <dd>{number(d.raw.supply_gap, 1)}</dd>
              </div>
              <div>
                <dt>Occupancy Cost Pressure Proxy</dt>
                <dd>
                  {d.raw.occupancy_cost_pressure
                    ? `£${number(d.raw.occupancy_cost_pressure)}`
                    : "Unavailable"}
                  <small> borough median band estimate · not rent</small>
                </dd>
              </div>
            </dl>
            <div className="transit-evidence">
              <TrainFront size={17} />
              <div>
                <strong>
                  {d.raw.nearest_station || "Station data unavailable"}
                </strong>
                <span>
                  {number(d.raw.station_distance_m)}m from cell centre ·{" "}
                  {number(d.raw.transit_demand)} typical entries/exits, distance
                  weighted
                </span>
              </div>
            </div>
          </div>
          <details className="explain-details">
            <summary>
              Mapped venues within 600m
              <ChevronDown size={14} />
            </summary>
            <p>
              OSM coverage varies. Observed supply above uses the H3 cell, while
              this list describes its surroundings.
            </p>
            <div className="poi-list">
              {d.nearby_pois.slice(0, 25).map((p) => (
                <div key={p.id}>
                  <span>
                    {p.name || p.category.replaceAll("_", " ")}
                    <small>{p.category.replaceAll("_", " ")}</small>
                  </span>
                  <b>{Math.round(p.distance_m)}m</b>
                </div>
              ))}
            </div>
          </details>
          <Separator />
          <div className="panel-section">
            <div className="section-label">
              LOOK A LITTLE FURTHER
              <Footprints size={13} />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setMinutes(minutes ? null : 10)}
            >
              <Footprints data-icon="inline-start" />
              {minutes ? "Close catchment" : "Analyse catchment"}
            </Button>
            {minutes && (
              <div className="catchment-result">
                <ToggleGroup
                  type="single"
                  value={String(minutes)}
                  onValueChange={(v) => {
                    if (v) setMinutes(Number(v) as 5 | 10 | 15);
                  }}
                  aria-label="Walking catchment minutes"
                >
                  {[5, 10, 15].map((n) => (
                    <ToggleGroupItem key={n} value={String(n)}>
                      {n} min
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <Badge variant="secondary">Radial walking-time proxy</Badge>
                {catchQuery.isPending && (
                  <p>Intersecting the London evidence…</p>
                )}
                {catchQuery.error && (
                  <p role="alert">{catchQuery.error.message}</p>
                )}
                {catchQuery.data && (
                  <>
                    <dl className="catchment-metrics">
                      <div>
                        <dt>Residents</dt>
                        <dd>{number(catchQuery.data.metrics.population)}</dd>
                      </div>
                      <div>
                        <dt>Competitors</dt>
                        <dd>{catchQuery.data.competitors}</dd>
                      </div>
                      <div>
                        <dt>Complementary venues</dt>
                        <dd>{catchQuery.data.complementary_venues}</dd>
                      </div>
                    </dl>
                    <dl className="catchment-metrics">
                      <div>
                        <dt>Station proximity index</dt>
                        <dd>
                          {number(catchQuery.data.metrics.transit_access, 2)}
                        </dd>
                      </div>
                      <div>
                        <dt>High street intersects</dt>
                        <dd>
                          {catchQuery.data.metrics.high_street_intersection
                            ? "Yes"
                            : "No"}
                        </dd>
                      </div>
                      <div>
                        <dt>Cost pressure · borough proxy</dt>
                        <dd>
                          £
                          {number(
                            catchQuery.data.metrics.occupancy_cost_pressure,
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt>Approx. reported incidents · 3 months</dt>
                        <dd>{number(catchQuery.data.metrics.incidents)}</dd>
                      </div>
                    </dl>
                    <p>
                      Opportunity P10 / median / P90:{" "}
                      {catchQuery.data.opportunity_distribution
                        .map((n) => Math.round(n))
                        .join(" / ")}
                    </p>
                    <table
                      className="catchment-table"
                      aria-label="Catchment size comparison"
                    >
                      <thead>
                        <tr>
                          <th>Radial proxy</th>
                          <th>Residents</th>
                          <th>Competitors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catchmentComparison.map((q, i) => (
                          <tr key={i}>
                            <td>{[5, 10, 15][i]} minutes</td>
                            <td>
                              {q.data
                                ? number(q.data.metrics.population)
                                : q.error
                                  ? "Unavailable"
                                  : "Calculating"}
                            </td>
                            <td>{q.data ? number(q.data.competitors) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p>{catchQuery.data.methodology}</p>
                  </>
                )}
              </div>
            )}
          </div>
          <details className="explain-details">
            <summary>
              Confidence & source provenance
              <ChevronDown size={14} />
            </summary>
            <p>{d.confidence_note}</p>
            {sourceInfo.data?.sources.map((s) => (
              <p key={s.id}>
                {s.publisher}: reference{" "}
                {s.latest_snapshot?.published_at || "date not supplied"} ·
                retrieved{" "}
                {s.latest_snapshot?.retrieved_at.slice(0, 10) || "unavailable"}
              </p>
            ))}
            {Object.entries(d.confidence_factors).map(([k, v]) => (
              <div className="confidence-factor" key={k}>
                <span>{k}</span>
                <b>{Math.round(v * 100)}%</b>
              </div>
            ))}
            <p>
              Supply model: {d.model.family}. {d.model.metrics.validation}.
              Held-out MAE: {number(d.model.metrics.cv_mae, 3)} mapped venues
              per cell.
            </p>
            <p>
              Reported incidents are approximate geographic aggregates.
              Rateable-value bands do not measure lease costs.
            </p>
            <code>{d.feature_version}</code>
            <Link className="quiet-link" href="/data">
              View source dates & snapshots
              <ArrowUpRight size={13} />
            </Link>
          </details>
          <Link
            className="detail-deep-link"
            href={`/site/${h3}?business=${state.business}`}
          >
            Open full site view
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
