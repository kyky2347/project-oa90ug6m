"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  ChevronDown,
  Download,
  Scale,
  Check,
} from "lucide-react";
import { api, download, useRankings } from "@/lib/api";
import {
  businesses,
  componentKeys,
  labels,
  type Business,
  type Comparison,
} from "@/lib/types";
import { usePulseStore } from "@/lib/store";
import { ScoreBars } from "@/components/site-detail";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
export default function ComparePage() {
  const { t } = useI18n();

  const state = usePulseStore(),
    ranking = useRankings(state.business, state.weights);
  const sites =
    state.battle.length === 2
      ? state.battle
      : ranking.data?.sites.slice(0, 2).map((s) => s.h3) || [];
  const query = useQuery({
    queryKey: ["comparison", sites, state.business, state.weights],
    enabled: sites.length === 2,
    queryFn: () =>
      api<Comparison>("/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sites,
          business: state.business,
          weights: state.weights,
        }),
      }),
  });
  const d = query.data;
  const csv = () => {
    if (!d) return;
    const esc = (v: string | number) =>
      '"' +
      String(v)
        .replace(/^[=+\-@]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    const rows = [
      [t("Metric"), d.sites[0].label, d.sites[1].label],
      ["H3", ...d.sites.map((s) => s.h3)],
      [t("Feature version"), d.feature_version, d.feature_version],
      [t("Business"), state.business, state.business],
      [t("Opportunity"), ...d.sites.map((s) => s.score)],
      [t("Confidence quality index"), ...d.sites.map((s) => s.confidence)],
      ...componentKeys.map((k) => [
        t(labels[k]),
        ...d.sites.map((s) => s.components[k]),
      ]),
      ...componentKeys.map((k) => [
        t(labels[k] + " weight"),
        d.weights[k],
        d.weights[k],
      ]),
    ];
    download(
      "pulse-site-battle.csv",
      rows.map((r) => r.map(esc).join(",")).join("\n"),
      "text/csv",
    );
  };
  return (
    <main className="content-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Scale size={13} />
            {t(" SITE BATTLE")}
          </div>
          <h1>
            {t("Two places.")}
            <br />
            <span>{t("One informed decision.")}</span>
          </h1>
          <p>
            {t(
              "Compare the signals, understand the tradeoffs, and see what changes under your current business profile.",
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/explore">
            {t("Back to London")}
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <div className="compare-toolbar">
        <label>
          {t("BUSINESS PROFILE")}
          <select
            aria-label={t("Comparison business type")}
            value={state.business}
            onChange={(e) =>
              state.set({ business: e.target.value as Business, weights: null })
            }
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {t(b.name)}
              </option>
            ))}
          </select>
        </label>
        <div className="compare-export">
          <Button variant="outline" size="sm" onClick={csv} disabled={!d}>
            <Download data-icon="inline-start" />
            {t("Export CSV")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              d &&
              download("pulse-site-battle.json", JSON.stringify(d, null, 2))
            }
            disabled={!d}
          >
            {t("Export JSON")}
          </Button>
        </div>
      </div>
      {query.error && (
        <Alert variant="destructive">
          <AlertTitle>{t("Comparison unavailable")}</AlertTitle>
          <AlertDescription>{t(query.error.message)}</AlertDescription>
        </Alert>
      )}
      {!d && !query.error && (
        <div className="battle-grid">
          <Skeleton className="h-[480px]" />
          <Skeleton className="h-[480px]" />
        </div>
      )}
      {d && (
        <>
          <div className="battle-grid">
            <span className="battle-versus">{t("VS")}</span>
            {d.sites.map((s, i) => (
              <article className="battle-site" key={s.h3}>
                <div className="site-letter">
                  <span className="status-dot" />
                  {t("SITE ")}
                  {t(i ? "B" : "A")}
                </div>
                <div className="site-selector">
                  <select
                    aria-label={t(`Choose site ${i ? "B" : "A"}`)}
                    value={sites[i]}
                    onChange={(e) => {
                      const next = [...sites];
                      next[i] = e.target.value;
                      if (next[0] !== next[1]) state.set({ battle: next });
                    }}
                  >
                    {!ranking.data?.sites.some((x) => x.h3 === s.h3) && (
                      <option value={s.h3}>{t(s.label)}</option>
                    )}
                    {ranking.data?.sites
                      .filter((c) => c.h3 !== sites[1 - i])
                      .map((c) => (
                        <option key={c.h3} value={c.h3}>
                          {t(c.label)} · {c.borough}
                        </option>
                      ))}
                  </select>
                  <ChevronDown size={13} />
                </div>
                <h2>{t(s.label)}</h2>
                <p className="borough-label">
                  {s.borough}
                  {t(", London")}
                </p>
                <div className="score-hero">
                  <div>
                    <span className="eyebrow">
                      {t("CURRENT-WEIGHT OPPORTUNITY")}
                    </span>
                    <strong>
                      {Math.round(s.score)}
                      <small>/100</small>
                    </strong>
                  </div>
                  <div className="confidence-pill">
                    <Check size={13} />
                    <b>{Math.round(s.confidence * 100)}%</b>
                    <span>{t("Data confidence")}</span>
                  </div>
                </div>
                <ScoreBars detail={s} />
                <Link href={`/site/${s.h3}?business=${state.business}`}>
                  {t("Investigate this location")}
                  <ArrowUpRight size={14} />
                </Link>
              </article>
            ))}
          </div>
          <div className="tradeoff">
            <Scale size={22} />
            <div>
              <h3>{t("The tradeoff is the insight.")}</h3>
              <p>{t(d.tradeoff)}</p>
              <small>
                {t(d.note)}
                {t(
                  " Confidence is a data-quality index, not a success probability.",
                )}
              </small>
            </div>
          </div>
          <div className="content-topline" style={{ marginTop: 30 }}>
            <span>
              {t(
                state.weights
                  ? "CUSTOM WEIGHTS"
                  : "PULSE DEFAULT BUSINESS PROFILE",
              )}
            </span>
            <span>{d.feature_version}</span>
          </div>
          <p className="research-note">
            {t(
              "The initial comparison uses your two selected sites, or the two highest-ranked qualifying areas if you have not selected any. Choose another candidate above or add a site from the map. Population is a residential allocation proxy; commercial suitability requires local investigation.",
            )}
          </p>
        </>
      )}
    </main>
  );
}
