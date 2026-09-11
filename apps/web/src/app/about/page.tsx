import Link from "next/link";
import { ArrowUpRight, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
export default function About() {
  return (
    <main className="content-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <Compass size={13} /> ABOUT PULSE
          </div>
          <h1>
            A city’s complexity.
            <br />
            <span>A clearer next move.</span>
          </h1>
          <p>
            Urban opportunity intelligence for the people deciding where
            businesses go next.
          </p>
        </div>
        <Button asChild>
          <Link href="/explore">
            Explore London
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>
      <p className="about-statement">
        The city already knows where your next store should be.
        <br />
        Ask the map.
      </p>
      <div className="about-grid">
        <article>
          <h2>Built for the first investigation.</h2>
          <p>
            Retail expansion teams, franchise planners, independent operators
            and commercial strategists face a city of competing possibilities.
            PULSE brings that decision into focus through a transparent model of
            area-level public data.
          </p>
          <p>
            Explore London, understand the evidence, compare tradeoffs and make
            a shortlist for a site visit. Every insight is generated from
            structured score contributions. No LLM or private data connection is
            required.
          </p>
        </article>
        <article>
          <h2>A model with visible boundaries.</h2>
          <p>
            PULSE is a decision-support research product. It is not a property
            valuation service, revenue predictor or live activity tracker. The
            model has not been validated against business outcomes.
          </p>
          <p>
            Real-world decisions still need local investigation, actual premises
            and lease costs, planning review, and commercial judgement. The
            methodology and source provenance are part of the product.
          </p>
        </article>
      </div>
      <p className="product-disclaimer">
        PULSE identifies areas worth investigating. It does not guarantee
        commercial success.{" "}
        <Link href="/methodology">Read the full methodology →</Link>
      </p>
    </main>
  );
}
