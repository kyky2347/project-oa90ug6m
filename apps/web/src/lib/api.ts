import { useQuery } from "@tanstack/react-query";
import {
  mapSchema,
  type Business,
  type Weights,
  type Detail,
  type Profile,
  type SourceData,
  type Pulse,
  type Cell,
} from "./types";

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ detail: "The city model is temporarily unavailable." }));
    throw new Error(
      typeof error.detail === "string"
        ? error.detail
        : "The request could not be validated.",
    );
  }
  return response.json();
}
export const qs = (
  params: Record<string, string | number | undefined | null>,
) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)]),
  ).toString();
export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: () => api<{ profiles: Profile[] }>("/business-types"),
    staleTime: 3600000,
  });
}
export function useMap(
  business: Business,
  weights: Weights | null,
  resolution: number,
  bbox?: string,
) {
  return useQuery({
    queryKey: ["map", business, weights, resolution, bbox],
    queryFn: async () =>
      mapSchema.parse(
        await api(
          "/map/opportunity?" +
            qs({
              business,
              resolution,
              bbox,
              weights: weights ? JSON.stringify(weights) : undefined,
            }),
        ),
      ),
    staleTime: 60000,
  });
}
export function useRankings(
  business: Business,
  weights: Weights | null,
  confidence = 0.6,
) {
  return useQuery({
    queryKey: ["rankings", business, weights, confidence],
    queryFn: () =>
      api<{ feature_version: string; sites: (Cell & { reason: string })[] }>(
        "/rankings?" +
          qs({
            business,
            weights: weights ? JSON.stringify(weights) : undefined,
            min_confidence: confidence,
          }),
      ),
    staleTime: 60000,
  });
}
export function useDetail(
  h3: string | null,
  business: Business,
  weights: Weights | null,
) {
  return useQuery({
    queryKey: ["cell", h3, business, weights],
    queryFn: async () => {
      const start = performance.now();
      const detail = await api<Detail>(
        `/cells/${h3}?` +
          qs({
            business,
            weights: weights ? JSON.stringify(weights) : undefined,
          }),
      );
      return {
        ...detail,
        client_round_trip_ms:
          Math.round((performance.now() - start) * 100) / 100,
      };
    },
    enabled: !!h3,
    staleTime: 60000,
  });
}
export function useSources() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: () => api<SourceData>("/sources"),
    staleTime: 30000,
  });
}
export function usePulse(
  enabled: boolean,
  day: string,
  resolution: number,
  bbox?: string,
) {
  return useQuery({
    queryKey: ["pulse", day, resolution, bbox],
    queryFn: () =>
      api<Pulse>("/pulse/time-profile?" + qs({ day, resolution, bbox })),
    enabled,
    staleTime: 3600000,
  });
}
export function download(
  name: string,
  value: string,
  type = "application/json",
) {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export const number = (n: number | null | undefined, digits = 0) =>
  n == null
    ? "Unavailable"
    : new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(
        n,
      );
export const population = (n: number | null | undefined) =>
  n == null ? "Unavailable" : number(Math.round(n / 100) * 100);
