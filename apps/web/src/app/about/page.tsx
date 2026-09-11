"use client";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function About() {
  const { t } = useI18n();

  return (
    <main className="content-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Compass size={13} />
            {t(" ABOUT PULSE")}
          </div>
          <h1>
            {t("A city’s complexity.")}
            <br />
            <span>{t("A clearer next move.")}</span>
          </h1>
          <p>
            {t(
              "Urban opportunity intelligence for the people deciding where businesses go next.",
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/explore">
            {t("Explore London")}
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <p className="about-statement">
        {t("The city already knows where your next store should be.")}
        <br />
        {t("Ask the map.")}
      </p>
      <div className="about-grid">
        <article>
          <h2>{t("Built for the first investigation.")}</h2>
          <p>
            {t(
              "Retail expansion teams, franchise planners, independent operators and commercial strategists face a city of competing possibilities. PULSE brings that decision into focus through a transparent model of area-level public data.",
            )}
          </p>
          <p>
            {t(
              "Explore London, understand the evidence, compare tradeoffs and make a shortlist for a site visit. Every insight is generated from structured score contributions. No LLM or private data connection is required.",
            )}
          </p>
        </article>
        <article>
          <h2>{t("A model with visible boundaries.")}</h2>
          <p>
            {t(
              "PULSE is a decision-support research product. It is not a property valuation service, revenue predictor or live activity tracker. The model has not been validated against business outcomes.",
            )}
          </p>
          <p>
            {t(
              "Real-world decisions still need local investigation, actual premises and lease costs, planning review, and commercial judgement. The methodology and source provenance are part of the product.",
            )}
          </p>
        </article>
      </div>
      <p className="product-disclaimer">
        {t(
          "PULSE identifies areas worth investigating. It does not guarantee commercial success.",
        )}{" "}
        <Link href="/methodology">{t("Read the full methodology →")}</Link>
      </p>
    </main>
  );
}
