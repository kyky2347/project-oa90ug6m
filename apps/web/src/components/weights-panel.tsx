"use client";
import { useState } from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import type { Profile, Weights } from "@/lib/types";
import { componentKeys, labels } from "@/lib/types";
import { usePulseStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { Field, FieldGroup, FieldLabel } from "./ui/field";
export function WeightsPanel({ profile }: { profile: Profile }) {
  const { weights, set } = usePulseStore();
  const [draft, setDraft] = useState<Weights>(
    weights ||
      (Object.fromEntries(
        componentKeys.map((k) => [k, Math.round(profile.weights[k] * 100)]),
      ) as Weights),
  );
  const total = Object.values(draft).reduce((a, b) => a + b, 0);
  return (
    <div className="weights-panel">
      <div className="section-label">
        YOUR SCORING PROFILE
        <SlidersHorizontal size={14} />
      </div>
      <h3>
        A different priority.
        <br />A different perspective.
      </h3>
      <p>
        Set the relative importance of each signal. PULSE normalises these
        values to 100% before calculating the score.
      </p>
      <FieldGroup>
        {componentKeys.map((k) => (
          <Field key={k}>
            <FieldLabel htmlFor={"weight-" + k}>
              {labels[k]}
              <span>{total ? Math.round((draft[k] / total) * 100) : 0}%</span>
            </FieldLabel>
            <Slider
              id={"weight-" + k}
              aria-label={labels[k] + " weight"}
              min={0}
              max={100}
              step={1}
              value={[draft[k]]}
              onValueChange={([v]) => setDraft({ ...draft, [k]: v })}
            />
          </Field>
        ))}
      </FieldGroup>
      <Button
        className="w-full"
        disabled={total === 0}
        onClick={() => set({ weights: draft })}
      >
        Apply weights to London
      </Button>
      <Button
        variant="ghost"
        className="w-full"
        onClick={() => {
          set({ weights: null });
          setDraft(
            Object.fromEntries(
              componentKeys.map((k) => [
                k,
                Math.round(profile.weights[k] * 100),
              ]),
            ) as Weights,
          );
        }}
      >
        <RotateCcw data-icon="inline-start" />
        Reset to profile
      </Button>
      <p className="small-note">
        PULSE default business profiles are starting assumptions, not
        scientifically proven commercial optima.
      </p>
    </div>
  );
}
