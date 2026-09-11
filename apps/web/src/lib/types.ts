import { z } from "zod";

export const componentKeys = [
  "demand",
  "access",
  "white_space",
  "ecosystem",
  "cost_efficiency",
  "operational_context",
] as const;
export type ComponentKey = (typeof componentKeys)[number];
export type Business =
  "coffee" | "bakery" | "restaurant" | "gym" | "convenience" | "coworking";
export type Weights = Record<ComponentKey, number>;
export type Layer =
  | "opportunity"
  | ComponentKey
  | "confidence"
  | "competitors"
  | "transport"
  | "high_streets"
  | "competition"
  | "complements";
export const labels: Record<string, string> = {
  opportunity: "Opportunity",
  demand: "Demand Potential",
  access: "Access",
  white_space: "White Space",
  ecosystem: "Ecosystem",
  cost_efficiency: "Cost Efficiency",
  operational_context: "Operational Context",
  confidence: "Confidence",
  competitors: "Competitors",
  competition: "Competitive Gravity",
  complements: "Complementary Venues",
  transport: "Transport Demand",
  high_streets: "High Streets",
};
export const businesses: { id: Business; name: string }[] = [
  { id: "coffee", name: "Coffee Shop" },
  { id: "bakery", name: "Bakery" },
  { id: "restaurant", name: "Restaurant" },
  { id: "gym", name: "Gym" },
  { id: "convenience", name: "Convenience Store" },
  { id: "coworking", name: "Coworking Space" },
];
const components = z.object({
  demand: z.number(),
  access: z.number(),
  white_space: z.number(),
  ecosystem: z.number(),
  cost_efficiency: z.number(),
  operational_context: z.number(),
});
export const cellSchema = z.object({
  h3: z.string(),
  score: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  components,
  label: z.string(),
  borough: z.string(),
  longitude: z.number(),
  latitude: z.number(),
  rank: z.number(),
});
export const mapSchema = z.object({
  feature_version: z.string(),
  business: z.string(),
  resolution: z.number(),
  weights: components,
  cells: z.array(cellSchema),
});
export type Cell = z.infer<typeof cellSchema>;
export type MapData = z.infer<typeof mapSchema>;
export type Profile = {
  id: Business;
  name: string;
  weights: Weights;
  complements: string[];
};
export type Contribution = {
  component: ComponentKey;
  label: string;
  value: number;
  weight: number;
  contribution: number;
};
export type Detail = Cell & {
  feature_version: string;
  business: Business;
  weights: Weights;
  raw: {
    population: number;
    population_density: number;
    households: number;
    transit_demand: number;
    station_distance_m: number;
    nearest_station: string;
    high_street_name: string;
    high_street_distance: number;
    occupancy_cost_pressure: number;
    incident_count: number;
    reported_incident_rate_proxy: number;
    observed_supply: number;
    expected_supply: number;
    supply_gap: number;
    poi_counts: Record<string, number>;
    model_version: string;
    resolution: number;
    source_coverage: Record<string, boolean>;
  };
  explanation: {
    summary: string;
    contributions: Contribution[];
    baseline: number;
    note: string;
  };
  nearby_pois: {
    id: string;
    name: string;
    category: string;
    longitude: number;
    latitude: number;
    distance_m: number;
  }[];
  model: {
    family: string;
    metrics: {
      cv_mae: number | null;
      cv_baseline_mae: number | null;
      overdispersion: number | null;
      validation: string;
    };
  };
  confidence_factors: Record<string, number>;
  source_snapshots: Record<string, string>;
  confidence_note: string;
};
export type Catchment = {
  minutes: number;
  radius_m: number;
  method: string;
  methodology: string;
  geometry: GeoJSON.Geometry;
  metrics: {
    population: number;
    incidents: number;
    occupancy_cost_pressure: number;
    transit_access: number;
    high_street_intersection: boolean;
  };
  competitors: number;
  complementary_venues: number;
  opportunity_distribution: number[];
};
export type Pulse = {
  feature_version: string;
  day: string;
  label: string;
  times: string[];
  total_influence: number[];
  display_scale: number;
  cells: { h3: string; values: number[] }[];
};
export type Snapshot = {
  id: string;
  published_at: string | null;
  retrieved_at: string;
  row_count: number;
  checksum: string;
  source_url: string;
  parser_version: string;
  status: string;
  error: string | null;
  metadata: {
    notes: string[];
    assets: {
      filename: string;
      published_at: string | null;
      url: string;
      extra: Record<string, unknown>;
    }[];
  };
};
export type Source = {
  id: string;
  name: string;
  publisher: string;
  url: string;
  license: string;
  cadence_days: number;
  reference_stale: boolean;
  reference_age_days: number | null;
  status: string;
  latest_snapshot: Snapshot | null;
  latest_attempt: Snapshot | null;
};
export type SourceData = {
  sources: Source[];
  active_version: {
    id: string;
    created_at: string;
    snapshots: Record<string, string>;
  } | null;
};
export type Comparison = {
  feature_version: string;
  sites: Detail[];
  weights: Weights;
  deltas: { component: ComponentKey; label: string; difference: number }[];
  tradeoff: string;
  note: string;
};
