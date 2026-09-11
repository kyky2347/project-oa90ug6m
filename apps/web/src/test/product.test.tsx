import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { usePulseStore } from "@/lib/store";
import { cellSchema, mapSchema, type Cell, type Profile } from "@/lib/types";
import { WeightsPanel } from "@/components/weights-panel";
import { Slider } from "@/components/ui/slider";
import { qs, population, number } from "@/lib/api";
// Explicit test-only values; no fabricated data is exposed by production.
const c: Cell = {
  h3: "88194ad267fffff",
  score: 65,
  confidence: 0.7,
  components: {
    demand: 70,
    access: 60,
    white_space: 60,
    ecosystem: 50,
    cost_efficiency: 50,
    operational_context: 30,
  },
  label: "Test-only site",
  borough: "Test-only borough",
  latitude: 51.5,
  longitude: -0.1,
  rank: 1,
};
const profile: Profile = {
  id: "coffee",
  name: "Coffee Shop",
  complements: [],
  weights: {
    demand: 0.27,
    access: 0.18,
    white_space: 0.25,
    ecosystem: 0.13,
    cost_efficiency: 0.12,
    operational_context: 0.05,
  },
};
beforeEach(() => {
  cleanup();
  usePulseStore.setState({
    business: "coffee",
    weights: null,
    battle: [],
    shortlist: [],
  });
});
describe("product state", () => {
  it("shortlists can be toggled and preserve category context", () => {
    usePulseStore.getState().save(c);
    expect(usePulseStore.getState().shortlist).toHaveLength(1);
    usePulseStore.setState({ business: "gym" });
    usePulseStore.getState().save(c);
    expect(usePulseStore.getState().shortlist).toHaveLength(2);
    usePulseStore.getState().save(c);
    expect(usePulseStore.getState().shortlist[0].business).toBe("coffee");
  });
  it("battle retains exactly two distinct sites", () => {
    for (const h of ["a", "b", "c"]) usePulseStore.getState().compare(h);
    expect(usePulseStore.getState().battle).toEqual(["b", "c"]);
    usePulseStore.getState().compare("b");
    expect(usePulseStore.getState().battle).toEqual(["c"]);
  });
  it("weights apply without computing a score in the frontend", () => {
    render(<WeightsPanel profile={profile} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Apply weights to London" }),
    );
    expect(usePulseStore.getState().weights?.demand).toBe(27);
    fireEvent.click(screen.getByRole("button", { name: "Reset to profile" }));
    expect(usePulseStore.getState().weights).toBeNull();
  });
  it("sliders expose an accessible name on the interactive thumb", () => {
    render(<Slider value={[30]} aria-label="Demand weight" />);
    expect(
      screen.getByRole("slider", { name: "Demand weight" }),
    ).toHaveAttribute("aria-valuenow", "30");
  });
});
describe("API boundary and presentation", () => {
  it("rejects incomplete or impossible map responses", () => {
    expect(cellSchema.safeParse({ ...c, score: NaN }).success).toBe(false);
    expect(cellSchema.safeParse({ ...c, score: 140 }).success).toBe(false);
    expect(mapSchema.safeParse({ cells: [c] }).success).toBe(false);
  });
  it("rounds population and labels missing evidence", () => {
    expect(population(9234)).toBe("9,200");
    expect(population(null)).toBe("Unavailable");
    expect(number(undefined)).toBe("Unavailable");
  });
  it("encodes query parameters and excludes missing ones", () => {
    expect(
      qs({ business: "coffee", bbox: undefined, weights: '{"demand":2}' }),
    ).toContain("weights=%7B");
    expect(qs({ a: null, b: 8 })).toBe("b=8");
  });
});
