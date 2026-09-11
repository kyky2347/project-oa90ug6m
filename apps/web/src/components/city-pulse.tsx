"use client";
import { useI18n } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
} from "recharts";
import { Activity, Pause, Play, X } from "lucide-react";
import type { Pulse } from "@/lib/types";
import { usePulseStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Slider } from "./ui/slider";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
export function CityPulse({ data, error }: { data?: Pulse; error?: string }) {
  const { t, number } = useI18n();

  const { time, day, set } = usePulseStore();
  const [playing, setPlaying] = useState(false);
  const chart = useMemo(
    () =>
      data?.times
        .map((t, i) => ({ time: t, value: data.total_influence[i] }))
        .filter((_, i) => i >= 24 && i <= 94) || [],
    [data],
  );
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const t = usePulseStore.getState().time;
      set({ time: t >= 94 ? 24 : t + 1 });
    }, 650);
    return () => clearInterval(id);
  }, [playing, set]);
  return (
    <section className="pulse-dock glass" aria-label={t("City Pulse")}>
      <div className="pulse-top">
        <div>
          <Activity size={18} />
          <h2>{t("City Pulse")}</h2>
          <span>{t("Typical transport demand profile")}</span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("Close City Pulse")}
          onClick={() => set({ pulse: false })}
        >
          <X />
        </Button>
      </div>
      <div className="pulse-body">
        <div className="pulse-clock">
          <strong>
            {data?.times[time] ||
              `${Math.floor(time / 4)
                .toString()
                .padStart(2, "0")}:${(time % 4) * 15 || "00"}`}
          </strong>
          <span>
            {t("TYPICAL ")}
            {t(day.toUpperCase())}
          </span>
          <Button
            size="icon"
            aria-label={t(playing ? "Pause timeline" : "Play timeline")}
            disabled={!data}
            onClick={() => setPlaying(!playing)}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
        </div>
        <div className="pulse-chart">
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={chart}>
              <XAxis dataKey="time" hide />
              <defs>
                <linearGradient id="pulseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d6ef9e" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#d6ef9e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#d6ef9e"
                strokeWidth={1.5}
                fill="url(#pulseGradient)"
                isAnimationActive={false}
              />
              <ReferenceLine x={data?.times[time]} stroke="#f1f5e4" />
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="chart-tooltip">
                      {payload[0].payload.time} ·{" "}
                      {number(Number(payload[0].value))} {t("influence units")}
                    </div>
                  ) : null
                }
              />
            </AreaChart>
          </ResponsiveContainer>
          <Slider
            value={[time]}
            min={24}
            max={94}
            step={1}
            onValueChange={([t]) => set({ time: t })}
            aria-label={t("Time of day")}
          />
          <div className="time-ticks">
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:30</span>
          </div>
        </div>
      </div>
      <div className="pulse-profile">
        <ToggleGroup
          type="single"
          value={day}
          onValueChange={(v) => {
            if (v) set({ day: v });
          }}
          aria-label={t("Day profile")}
        >
          <ToggleGroupItem value="weekday">{t("Weekday")}</ToggleGroupItem>
          <ToggleGroupItem value="saturday">{t("Sat")}</ToggleGroupItem>
          <ToggleGroupItem value="sunday">{t("Sun")}</ToggleGroupItem>
        </ToggleGroup>
        <p>
          {t(
            error ||
              "TfL NUMBAT · historical typical-day estimates. Only transport intensity changes with time.",
          )}
        </p>
      </div>
    </section>
  );
}
