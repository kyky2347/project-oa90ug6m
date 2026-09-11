"use client";
import { useI18n } from "@/lib/i18n";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Compass,
  Coffee,
  Croissant,
  Utensils,
  Dumbbell,
  ShoppingBasket,
  BriefcaseBusiness,
  MoveUpRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMap, useSources } from "@/lib/api";
import { businesses } from "@/lib/types";
import { usePulseStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
const CityMap = dynamic(
  () => import("@/components/city-map").then((m) => m.CityMap),
  { ssr: false },
);
const icons = [
  Coffee,
  Croissant,
  Utensils,
  Dumbbell,
  ShoppingBasket,
  BriefcaseBusiness,
];
export default function Landing() {
  const { t } = useI18n();

  const business = usePulseStore((s) => s.business),
    set = usePulseStore((s) => s.set);
  const data = useMap(business, null, 8);
  const sources = useSources();
  return (
    <main className="landing">
      <div className="hero-map">
        <CityMap cells={data.data?.cells || []} hero />
        <div className="hero-map-shade" />
      </div>
      <div className="hero-coordinate">
        <span className="crosshair">+</span>
        {t("51°30′26.4″N")}
        <br />
        <span className="coord-indent">{t("0°07′39.6″W")}</span>
      </div>
      <motion.section
        className="hero-copy"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="eyebrow">
          <span className="status-dot" />
          {t("A NEW PERSPECTIVE ON LONDON")}
        </div>
        <h1>
          {t("The city")}
          <br />
          {t("already ")}
          <span>{t("knows.")}</span>
        </h1>
        <p className="hero-subtitle">
          {t("Where your next store should be.")}
          <br />
          {t("Ask the map.")}
        </p>
        <p className="hero-description">
          {t("Turn the city’s open data into your next opportunity.")}
          <br />
          {t("Six business profiles. Every signal explained.")}
        </p>
        <div className="hero-actions">
          <Button asChild size="lg">
            <Link href={`/explore?business=${business}`}>
              {t("EXPLORE LONDON")}
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
          <Link className="quiet-link" href="/methodology">
            {t("How it works")}
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="hero-proof">
          <Compass size={13} />
          <span>
            {t(
              "Real public data. No upload. No guesswork disguised as certainty.",
            )}
          </span>
        </div>
      </motion.section>
      <div className="hero-map-caption">
        <div className="caption-line" />
        <span>{t("THE OPPORTUNITY LANDSCAPE")}</span>
        <small>
          {t(businesses.find((b) => b.id === business)?.name)}
          {t(" · Greater London")}
        </small>
        <p>{t("Column height represents opportunity score")}</p>
      </div>
      <div className="hero-category">
        <div>
          <span className="eyebrow">{t("YOUR NEXT CHAPTER")}</span>
          <p>{t("What are you opening?")}</p>
        </div>
        <ToggleGroup
          type="single"
          value={business}
          onValueChange={(v) => {
            if (v) set({ business: v as typeof business, weights: null });
          }}
          aria-label={t("Choose business type")}
          spacing={1}
        >
          {businesses.map((b, i) => {
            const Icon = icons[i];
            return (
              <ToggleGroupItem key={b.id} value={b.id}>
                <Icon />
                {t(b.name)}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
      <footer className="landing-footer">
        <div>
          <span className="status-dot" />
          {t(
            sources.data?.active_version
              ? "VERIFIED LONDON MODEL"
              : data.error
                ? "CITY MODEL UNAVAILABLE"
                : "CONNECTING TO LONDON MODEL",
          )}
        </div>
        <span>{t("OpenStreetMap · ONS · TfL · GLA · UK Police · HMRC")}</span>
        <Link href="/about">
          {t("A clearer view of what’s possible")}
          <MoveUpRight size={12} />
        </Link>
      </footer>
      <section className="landing-below">
        <div className="eyebrow">
          <ArrowDown size={14} />
          {t(" EVIDENCE BEFORE INTUITION")}
        </div>
        <h2>
          {t("Find the places")}
          <br />
          {t("worth a closer look.")}
        </h2>
        <div className="story-columns">
          <article>
            <span>{t("01 / EXPLORE")}</span>
            <h3>{t("Read the city.")}</h3>
            <p>
              {t(
                "See how demand proxies, access, mapped supply and the commercial environment fit together, one area at a time.",
              )}
            </p>
          </article>
          <article>
            <span>{t("02 / UNDERSTAND")}</span>
            <h3>{t("Look beneath the score.")}</h3>
            <p>
              {t(
                "Inspect the raw evidence, source dates and model limitations behind every component. Adjust the profile to reflect your priorities.",
              )}
            </p>
          </article>
          <article>
            <span>{t("03 / INVESTIGATE")}</span>
            <h3>{t("Make your next move.")}</h3>
            <p>
              {t(
                "Compare locations, explore walking-time proxies and build a shortlist for an on-the-ground investigation.",
              )}
            </p>
          </article>
        </div>
        <p className="product-disclaimer">
          {t(
            "PULSE identifies areas worth investigating. It does not guarantee commercial success.",
          )}
        </p>
      </section>
    </main>
  );
}
