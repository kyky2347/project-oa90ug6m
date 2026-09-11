"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Database,
  FileCheck2,
  Map,
  RefreshCw,
  TrainFront,
  Building2,
  Users,
  ShieldCheck,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";
import { useSources } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
const icons: Record<string, typeof Database> = {
  geography: Map,
  gla: Building2,
  ons: Users,
  osm: Map,
  police: ShieldCheck,
  tfl: TrainFront,
  voa: Building2,
};
export default function DataPage() {
  const { t, date, number } = useI18n();

  const q = useSources(),
    data = q.data;
  return (
    <main className="content-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Database size={13} />
            {t(" EVIDENCE, WITH A PAPER TRAIL")}
          </div>
          <h1>
            {t("Trust begins")}
            <br />
            <span>{t("at the source.")}</span>
          </h1>
          <p>
            {t(
              "Every score starts with traceable public data. See what was acquired, when it was observed, and which snapshot powers the active London model.",
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => q.refetch()}
          disabled={q.isFetching}
        >
          <RefreshCw data-icon="inline-start" />
          {t("Check source health")}
        </Button>
      </div>
      <div className="content-topline">
        <span>
          <span className="status-dot" />
          {data?.sources.filter((s) => s.latest_snapshot).length || "—"}{" "}
          {t("VERIFIED SOURCES")}
        </span>
        <span>
          {data?.active_version?.id || t("No active feature version")}
        </span>
        <span>
          {t("Last model build · ")}
          {date(data?.active_version?.created_at)}
        </span>
      </div>
      {q.error && (
        <Alert variant="destructive">
          <AlertTitle>{t("Data service unavailable")}</AlertTitle>
          <AlertDescription>{t(q.error.message)}</AlertDescription>
        </Alert>
      )}
      <div className="source-grid">
        {q.isPending &&
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-72" />)}
        {data?.sources.map((s) => {
          const snapshot = s.latest_snapshot,
            Icon = icons[s.id] || Database;
          const used = data.active_version?.snapshots[s.id];
          return (
            <article key={s.id} className="source-card">
              <div className="source-card-top">
                <div className="source-icon">
                  <Icon size={18} />
                </div>
                <Badge
                  variant={s.status === "verified" ? "secondary" : "outline"}
                >
                  {s.status === "verified" ? <Check /> : <TriangleAlert />}
                  {t(
                    s.status === "verified"
                      ? "Verified"
                      : s.status === "refresh_failed"
                        ? "Refresh failed · previous retained"
                        : "Unavailable",
                  )}
                </Badge>
              </div>
              <h2>
                {t(s.name)}
                <small>{t(s.publisher)}</small>
              </h2>
              <dl className="source-meta">
                <div>
                  <dt>{t("Observation / reference date")}</dt>
                  <dd>{date(snapshot?.published_at)}</dd>
                </div>
                <div>
                  <dt>{t("Retrieved")}</dt>
                  <dd>{date(snapshot?.retrieved_at)}</dd>
                </div>
                <div>
                  <dt>{t("Validated warehouse rows")}</dt>
                  <dd>{number(snapshot?.row_count)}</dd>
                </div>
                <div>
                  <dt>{t("Check cadence")}</dt>
                  <dd>
                    {t("Every ")}
                    {s.cadence_days}
                    {t(" days")}
                  </dd>
                </div>
              </dl>
              {s.reference_stale && (
                <Alert>
                  <AlertTitle>{t("Older reference period")}</AlertTitle>
                  <AlertDescription>
                    {t(
                      "The publisher’s observations are outside the freshness window for this source. Confidence includes source-age decay; verify recent local changes before shortlisting.",
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <details>
                <summary>{t("Provenance & methodology notes")}</summary>
                <p className="source-original-note">
                  {t("Source notes (original text)")}
                </p>
                <p>
                  {snapshot?.metadata.notes?.join(" ") ||
                    t(
                      "Publication date is not separately supplied by this structural dataset. Retrieval time does not imply the observations are new.",
                    )}
                </p>
                <p>
                  {t("Active snapshot:")}{" "}
                  <code>{used || t("Not used in active model")}</code>
                </p>
                <p>
                  {t("Latest verified: ")}
                  <code>{snapshot?.id || t("None")}</code>
                  {t("Parser")} {snapshot?.parser_version || "—"}
                </p>
                <p>
                  {t("SHA-256 snapshot checksum:")}
                  <code>{snapshot?.checksum || t("Unavailable")}</code>
                </p>
                {snapshot?.metadata.assets.slice(0, 8).map((a) => (
                  <p key={a.filename}>
                    <a target="_blank" rel="noreferrer" href={a.url}>
                      {a.filename}{" "}
                      <ExternalLink size={9} style={{ display: "inline" }} />
                    </a>
                    {a.published_at && ` · ${date(a.published_at)}`}
                  </p>
                ))}
                {s.latest_attempt?.status === "failed" && (
                  <p>
                    {t("Latest failed attempt: ")}
                    {date(s.latest_attempt.retrieved_at)}.{" "}
                    {s.latest_attempt.error}
                  </p>
                )}
              </details>
              <div className="source-card-bottom">
                <span>{t(s.license)}</span>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {t("Official source")}
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </article>
          );
        })}
      </div>
      <div className="tradeoff">
        <FileCheck2 size={21} />
        <div>
          <h3>{t("Freshness has more than one date.")}</h3>
          <p>
            {t(
              "Retrieval tells you when PULSE acquired a file. The reference date tells you when the evidence describes the city. Annual transport profiles, monthly reported incidents and structural boundaries have different update cycles.",
            )}
          </p>
          <small>
            {t(
              "A failed refresh retains the last verified snapshot. New feature versions become active only after validation. Unknown source dates lower the confidence index.",
            )}
          </small>
        </div>
      </div>
      <p className="research-note">
        {t(
          "All source data remains attributable. © OpenStreetMap contributors, ODbL 1.0. Contains public sector information licensed under the Open Government Licence v3.0. TfL data is subject to its transport data terms. ",
        )}
        <Link href="/methodology">{t("Read the methodology →")}</Link>
      </p>
    </main>
  );
}
