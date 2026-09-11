"use client";
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
        <span className="crosshair">+</span>51°30′26.4″N
        <br />
        <span className="coord-indent">0°07′39.6″W</span>
      </div>
      <motion.section
        className="hero-copy"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
      >
        <div className="eyebrow">
          <span className="status-dot" />A NEW PERSPECTIVE ON LONDON
        </div>
        <h1>
          The city
          <br />
          already <span>knows.</span>
        </h1>
        <p className="hero-subtitle">
          Where your next store should be.
          <br />
          Ask the map.
        </p>
        <p className="hero-description">
          Turn the city’s open data into your next opportunity.
          <br />
          Six business profiles. Every signal explained.
        </p>
        <div className="hero-actions">
          <Button asChild size="lg">
            <Link href={`/explore?business=${business}`}>
              EXPLORE LONDON
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
          <Link className="quiet-link" href="/methodology">
            How it works
            <ArrowUpRight size={15} />
          </Link>
        </div>
        <div className="hero-proof">
          <Compass size={13} />
          <span>
            Real public data. No upload. No guesswork disguised as certainty.
          </span>
        </div>
      </motion.section>
      <div className="hero-map-caption">
        <div className="caption-line" />
        <span>THE OPPORTUNITY LANDSCAPE</span>
        <small>
          {businesses.find((b) => b.id === business)?.name} · Greater London
        </small>
        <p>Column height represents opportunity score</p>
      </div>
      <div className="hero-category">
        <div>
          <span className="eyebrow">YOUR NEXT CHAPTER</span>
          <p>What are you opening?</p>
        </div>
        <ToggleGroup
          type="single"
          value={business}
          onValueChange={(v) => {
            if (v) set({ business: v as typeof business, weights: null });
          }}
          aria-label="Choose business type"
          spacing={1}
        >
          {businesses.map((b, i) => {
            const Icon = icons[i];
            return (
              <ToggleGroupItem key={b.id} value={b.id}>
                <Icon />
                {b.name}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>
      <footer className="landing-footer">
        <div>
          <span className="status-dot" />
          {sources.data?.active_version
            ? "VERIFIED LONDON MODEL"
            : data.error
              ? "CITY MODEL UNAVAILABLE"
              : "CONNECTING TO LONDON MODEL"}
        </div>
        <span>OpenStreetMap · ONS · TfL · GLA · UK Police · HMRC</span>
        <Link href="/about">
          A clearer view of what’s possible
          <MoveUpRight size={12} />
        </Link>
      </footer>
      <section className="landing-below">
        <div className="eyebrow">
          <ArrowDown size={14} /> EVIDENCE BEFORE INTUITION
        </div>
        <h2>
          Find the places
          <br />
          worth a closer look.
        </h2>
        <div className="story-columns">
          <article>
            <span>01 / EXPLORE</span>
            <h3>Read the city.</h3>
            <p>
              See how demand proxies, access, mapped supply and the commercial
              environment fit together, one area at a time.
            </p>
          </article>
          <article>
            <span>02 / UNDERSTAND</span>
            <h3>Look beneath the score.</h3>
            <p>
              Inspect the raw evidence, source dates and model limitations
              behind every component. Adjust the profile to reflect your
              priorities.
            </p>
          </article>
          <article>
            <span>03 / INVESTIGATE</span>
            <h3>Make your next move.</h3>
            <p>
              Compare locations, explore walking-time proxies and build a
              shortlist for an on-the-ground investigation.
            </p>
          </article>
        </div>
        <p className="product-disclaimer">
          PULSE identifies areas worth investigating. It does not guarantee
          commercial success.
        </p>
      </section>
    </main>
  );
}
