"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Business, Layer, Weights, Cell } from "./types";
type Saved = {
  h3: string;
  business: Business;
  label: string;
  borough: string;
  timestamp: string;
};
type State = {
  business: Business;
  layer: Layer;
  weights: Weights | null;
  selected: string | null;
  battle: string[];
  shortlist: Saved[];
  pulse: boolean;
  time: number;
  day: string;
  pitch: boolean;
  minimum: number;
  confidence: number;
  panel: "rankings" | "weights" | "shortlist";
  camera: {
    longitude: number;
    latitude: number;
    zoom: number;
    pitch: number;
    bearing: number;
  } | null;
  set: (s: Partial<State>) => void;
  save: (c: Cell) => void;
  compare: (h3: string) => void;
};
export const usePulseStore = create<State>()(
  persist(
    (set, get) => ({
      business: "coffee",
      layer: "opportunity",
      weights: null,
      selected: null,
      battle: [],
      shortlist: [],
      pulse: false,
      time: 32,
      day: "weekday",
      pitch: true,
      minimum: 0,
      confidence: 0.6,
      panel: "rankings",
      camera: null,
      set: (s) => set(s),
      save: (c) =>
        set((s) => ({
          shortlist: s.shortlist.some(
            (x) => x.h3 === c.h3 && x.business === s.business,
          )
            ? s.shortlist.filter(
                (x) => x.h3 !== c.h3 || x.business !== s.business,
              )
            : [
                ...s.shortlist,
                {
                  h3: c.h3,
                  business: s.business,
                  label: c.label,
                  borough: c.borough,
                  timestamp: new Date().toISOString(),
                },
              ],
        })),
      compare: (h3) => {
        const b = get().battle;
        set({
          battle: b.includes(h3)
            ? b.filter((x) => x !== h3)
            : [...b.slice(-1), h3],
        });
      },
    }),
    {
      name: "pulse-shortlist-v1",
      partialize: (s) => ({
        shortlist: s.shortlist,
        battle: s.battle,
        business: s.business,
      }),
    },
  ),
);
