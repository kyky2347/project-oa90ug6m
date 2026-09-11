"use client";
import { useI18n } from "@/lib/i18n";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  ChevronDown,
  Coffee,
  Compass,
  Hexagon,
  Layers3,
  ListFilter,
  LocateFixed,
  Minus,
  Plus,
  RotateCcw,
  Share2,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  api,
  qs,
  useDetail,
  useMap,
  useProfiles,
  usePulse,
  useRankings,
} from "@/lib/api";
import {
  businesses,
  labels,
  type Cell,
  type Business,
  type Layer,
  type Catchment,
  type Weights,
} from "@/lib/types";
import { usePulseStore } from "@/lib/store";
import type { MapHandle } from "./city-map";
import { SiteDetail } from "./site-detail";
import { CityPulse } from "./city-pulse";
import { WeightsPanel } from "./weights-panel";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Slider } from "./ui/slider";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";
const CityMap = dynamic(() => import("./city-map").then((m) => m.CityMap), {
  ssr: false,
});
export function Explorer({ initialSite }: { initialSite?: string }) {
  const { t, number } = useI18n();

  const state = usePulseStore();
  const [resolution, setResolution] = useState(8),
    [bbox, setBbox] = useState<string>(),
    [catchment, setCatchment] = useState<Catchment | null>(null),
    [mobilePanel, setMobilePanel] = useState(false),
    [shared, setShared] = useState(""),
    [debug, setDebug] = useState(false),
    [urlReady, setUrlReady] = useState(false);
  const map = useRef<MapHandle>(null);
  const focus = useDetail(state.selected, state.business, state.weights);
  const gravity = useQuery({
    queryKey: ["gravity", state.business, resolution],
    enabled: ["competition", "competitors"].includes(state.layer),
    queryFn: () =>
      api<{ cells: { h3: string; intensity: number }[] }>(
        "/map/competition?" + qs({ business: state.business, resolution }),
      ),
    staleTime: 3600000,
  });
  const profiles = useProfiles();
  const data = useMap(
      state.business,
      state.weights,
      resolution,
      resolution === 9 ? bbox : undefined,
    ),
    rankings = useRankings(state.business, state.weights, state.confidence);
  const pulse = usePulse(
    state.pulse || state.layer === "transport",
    state.day,
    resolution,
    resolution === 9 ? bbox : undefined,
  );
  const context = useQuery({
    queryKey: ["context", state.layer, state.business, bbox],
    enabled: ["competitors", "complements", "high_streets"].includes(
      state.layer,
    ),
    queryFn: () =>
      api<GeoJSON.FeatureCollection>(
        "/map/context?" +
          qs({
            kind:
              state.layer === "high_streets"
                ? "high_streets"
                : state.layer === "complements"
                  ? "complements"
                  : "competitors",
            business: state.business,
            bbox,
          }),
      ),
    staleTime: 60000,
  });
  // Browser URL state must be restored after hydration before the map is mounted.
  /* eslint-disable react-hooks/set-state-in-effect -- Restore browser URL after hydration before mounting the map. */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const business = q.get("business");
    const layer = q.get("layer");
    const h = q.get("site") || initialSite;
    const next: Parameters<typeof state.set>[0] = {
      selected: h || null,
      pulse: false,
      camera: null,
      weights: null,
    };
    if (businesses.some((b) => b.id === business))
      next.business = business as Business;
    if (layer && layer in labels) next.layer = layer as Layer;
    else next.layer = "opportunity";
    if (q.get("weights"))
      try {
        next.weights = JSON.parse(q.get("weights")!) as Weights;
      } catch {
        /* Invalid links retain defaults; API also validates weights. */
      }
    if (q.get("camera"))
      try {
        const c = JSON.parse(q.get("camera")!);
        if (
          [c.longitude, c.latitude, c.zoom, c.pitch, c.bearing].every(
            Number.isFinite,
          ) &&
          c.longitude >= -0.8 &&
          c.longitude <= 0.5 &&
          c.latitude >= 51.1 &&
          c.latitude <= 51.9 &&
          c.zoom >= 9 &&
          c.zoom <= 15.5 &&
          c.pitch >= 0 &&
          c.pitch <= 65
        ) {
          next.camera = c;
          next.pitch = c.pitch > 0;
        }
      } catch {}
    state.set(next);
    setDebug(q.get("debug") === "1");
    setUrlReady(true);
    // Restore share state once on entering the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSite]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const onViewport = useCallback((zoom: number, box: string) => {
    setResolution(zoom >= 12.1 ? 9 : 8);
    setBbox(box);
  }, []);
  const select = useCallback((c: Cell) => {
    usePulseStore.getState().set({ selected: c.h3 });
    setCatchment(null);
    setMobilePanel(false);
    map.current?.flyTo(c);
  }, []);
  const close = () => {
    state.set({ selected: null });
    setCatchment(null);
  };
  const cells = useMemo(
    () =>
      data.data?.cells.filter(
        (c) => c.score >= state.minimum && c.confidence >= state.confidence,
      ) || [],
    [data.data, state.minimum, state.confidence],
  );
  const profile = profiles.data?.profiles.find((p) => p.id === state.business);
  const share = async () => {
    const q = new URLSearchParams({
      business: state.business,
      layer: state.layer,
    });
    if (state.selected) q.set("site", state.selected);
    if (state.weights) q.set("weights", JSON.stringify(state.weights));
    const camera = map.current?.camera();
    if (camera) q.set("camera", JSON.stringify(camera));
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/explore?${q}`,
      );
      setShared("View link copied");
    } catch {
      setShared("Copy the link from your address bar");
      window.history.replaceState(null, "", `/explore?${q}`);
    }
    setTimeout(() => setShared(""), 3500);
  };
  return (
    <main
      className={cn(
        "explorer",
        state.selected && "has-selection",
        state.pulse && "has-pulse",
      )}
    >
      <aside className={cn("explore-sidebar", mobilePanel && "mobile-open")}>
        <div className="sidebar-title">
          <div className="eyebrow">{t("LONDON OPPORTUNITY MODEL")}</div>
          <h1>
            {t("Find your")}
            <br />
            <span>{t("next address.")}</span>
          </h1>
          <p>{t("A city of possibilities. A clearer place to start.")}</p>
          <Button
            className="mobile-close"
            variant="ghost"
            size="icon-sm"
            aria-label={t("Close filters")}
            onClick={() => setMobilePanel(false)}
          >
            <X />
          </Button>
        </div>
        <div className="business-picker">
          <label htmlFor="business">{t("I’M EXPLORING FOR")}</label>
          <div>
            <Coffee size={18} />
            <select
              id="business"
              aria-label={t("Business type")}
              value={state.business}
              onChange={(e) => {
                state.set({
                  business: e.target.value as Business,
                  weights: null,
                });
                setCatchment(null);
              }}
            >
              {businesses.map((b) => (
                <option value={b.id} key={b.id}>
                  {t(b.name)}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>
        <div className="sidebar-tabs">
          <ToggleGroup
            type="single"
            value={state.panel}
            onValueChange={(v) => {
              if (v) state.set({ panel: v as typeof state.panel });
            }}
            aria-label={t("Explore tools")}
          >
            <ToggleGroupItem value="rankings">
              <Sparkles />
              {t("Top sites")}
            </ToggleGroupItem>
            <ToggleGroupItem value="weights" aria-label={t("Weights")}>
              <SlidersHorizontal />
            </ToggleGroupItem>
            <ToggleGroupItem value="shortlist" aria-label={t("Shortlist")}>
              <Bookmark />
              {state.shortlist.length > 0 && state.shortlist.length}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
        {state.panel === "rankings" && (
          <>
            <div className="rankings-heading">
              <span>{t("TOP OPPORTUNITIES")}</span>
              <Badge variant="outline">
                {rankings.data?.sites.length || "—"}
                {t(" areas")}
              </Badge>
            </div>
            <div className="rankings-list" aria-label={t("Top opportunities")}>
              {rankings.isPending &&
                [1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="m-4 h-16" />
                ))}
              {rankings.error && (
                <Alert variant="destructive">
                  <AlertTitle>{t("City model unavailable")}</AlertTitle>
                  <AlertDescription>
                    {t(rankings.error.message)}
                  </AlertDescription>
                </Alert>
              )}
              {rankings.data?.sites.length === 0 && (
                <p className="no-results">
                  {t(
                    "No areas meet this confidence threshold. Lower it below to explore more of London.",
                  )}
                </p>
              )}
              {rankings.data?.sites.map((c, i) => (
                <button
                  key={c.h3}
                  className={cn(
                    "ranking-row",
                    state.selected === c.h3 && "selected",
                  )}
                  onClick={() => select(c)}
                  aria-label={t(`Inspect ${c.label}`)}
                >
                  <span className="rank-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="rank-location">
                    <strong>{t(c.label)}</strong>
                    <small>{c.borough}</small>
                    <span>
                      {Math.round(c.confidence * 100)}
                      {t("% confidence")}
                    </span>
                  </span>
                  <span className="rank-score">
                    {Math.round(c.score)}
                    <ArrowUpRight size={12} />
                  </span>
                </button>
              ))}
            </div>
            <div className="ranking-footer">
              <span>{t("London-wide · H3 resolution 8")}</span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label={t("Fly to next opportunity")}
                onClick={() => {
                  const sites = rankings.data?.sites || [];
                  const i = sites.findIndex((c) => c.h3 === state.selected);
                  if (sites.length) select(sites[(i + 1) % sites.length]);
                }}
              >
                <ArrowRight />
              </Button>
            </div>
          </>
        )}
        {state.panel === "weights" && profile && (
          <WeightsPanel profile={profile} key={state.business} />
        )}
        {state.panel === "shortlist" && (
          <div className="shortlist-panel">
            <h3>{t("Your shortlist")}</h3>
            <p>{t("Saved on this device, ready for a closer look.")}</p>
            {!state.shortlist.length && (
              <div className="shortlist-instruction">
                <Bookmark size={30} />
                <p>
                  {t(
                    "Inspect an area on the map, then choose Shortlist to save it here.",
                  )}
                </p>
                <Button
                  variant="outline"
                  onClick={() => state.set({ panel: "rankings" })}
                >
                  {t("Browse opportunities")}
                </Button>
              </div>
            )}
            {state.shortlist.map((s) => (
              <Link
                key={s.h3 + s.business}
                href={`/site/${s.h3}?business=${t(s.business)}`}
              >
                <Bookmark size={15} />
                <span>
                  {t(s.label)}
                  <small>
                    {s.borough} · {t(s.business)}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        )}
        <div className="sidebar-filters">
          <div>
            <span>{t("Opportunity threshold")}</span>
            <b>{state.minimum}+</b>
          </div>
          <Slider
            value={[state.minimum]}
            min={0}
            max={90}
            step={5}
            onValueChange={([minimum]) => state.set({ minimum })}
            aria-label={t("Opportunity threshold")}
          />
          <div>
            <span>{t("Minimum confidence")}</span>
            <b>{Math.round(state.confidence * 100)}%</b>
          </div>
          <Slider
            value={[state.confidence * 100]}
            min={0}
            max={95}
            step={5}
            onValueChange={([c]) => state.set({ confidence: c / 100 })}
            aria-label={t("Minimum confidence")}
          />
          <p>
            <span className="status-dot" />
            {t(
              data.data
                ? "Verified public-data model"
                : "Connecting to city model",
            )}
          </p>
        </div>
      </aside>
      <section className="map-stage" aria-label={t("Explore London map")}>
        {urlReady && (
          <CityMap
            controlsRef={map}
            focusCell={focus.data}
            pressure={gravity.data?.cells}
            cells={cells}
            layer={state.layer}
            selected={state.selected}
            onSelect={select}
            onViewport={onViewport}
            pitch={state.pitch}
            pulse={
              state.pulse || state.layer === "transport"
                ? pulse.data
                : undefined
            }
            time={state.time}
            catchment={catchment}
            context={
              ["complements", "high_streets"].includes(state.layer) ||
              (state.layer === "competitors" && resolution === 9)
                ? context.data
                : undefined
            }
            initialCamera={state.camera}
            debug={debug}
          />
        )}
        <div className="map-topline">
          <div className="map-location">
            <span className="status-dot" />
            <span>{t("GREATER LONDON")}</span>
            <i>/</i>
            <span>
              {t(
                businesses
                  .find((b) => b.id === state.business)
                  ?.name.toUpperCase(),
              )}
            </span>
          </div>
          <div className="map-top-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() => state.set({ pulse: !state.pulse })}
              data-active={state.pulse}
            >
              <Activity data-icon="inline-start" />
              {t("City Pulse")}
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={t("Copy view link")}
              onClick={share}
            >
              <Share2 />
            </Button>
          </div>
        </div>
        <div className="layer-control glass">
          <Layers3 size={15} />
          <select
            aria-label={t("Map layer")}
            value={state.layer}
            onChange={(e) => state.set({ layer: e.target.value as Layer })}
          >
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </select>
          <ChevronDown size={13} />
          <span className="toolbar-divider" />
          <ToggleGroup
            type="single"
            value={state.pitch ? "3d" : "2d"}
            onValueChange={(v) => {
              if (v) state.set({ pitch: v === "3d" });
            }}
            size="sm"
            aria-label={t("Map perspective")}
          >
            <ToggleGroupItem value="3d">{t("3D")}</ToggleGroupItem>
            <ToggleGroupItem value="2d">{t("2D")}</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <Button
          className="mobile-filters"
          variant="outline"
          onClick={() => setMobilePanel(true)}
        >
          <ListFilter data-icon="inline-start" />
          {t("Filters & top sites")}
        </Button>
        <div className="map-controls glass">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Zoom in")}
            onClick={() => map.current?.zoom(1)}
          >
            <Plus />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Zoom out")}
            onClick={() => map.current?.zoom(-1)}
          >
            <Minus />
          </Button>
          <span />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Reset London view")}
            onClick={() => map.current?.reset()}
          >
            <LocateFixed />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Reset scoring and filters")}
            onClick={() =>
              state.set({
                weights: null,
                minimum: 0,
                confidence: 0.6,
                layer: "opportunity",
              })
            }
          >
            <RotateCcw />
          </Button>
        </div>
        {!state.selected && !state.pulse && (
          <div className="map-instruction">
            <Hexagon size={18} />
            <p>
              {t("Every hexagon has a story.")}
              <span>{t("Select an area to see the evidence.")}</span>
            </p>
          </div>
        )}
        <div className="map-legend glass" aria-label={t("Map legend")}>
          <div>
            <span>
              {t(
                state.pulse
                  ? "TYPICAL TRANSPORT INFLUENCE"
                  : labels[state.layer].toUpperCase(),
              )}
            </span>
            <Badge variant="outline">
              {t(state.pulse ? "RELATIVE" : "0–100")}
            </Badge>
          </div>
          <div className="legend-gradient" />
          <div className="legend-values">
            <span>{t(state.pulse ? "Quieter" : "Lower signal")}</span>
            <span>{t(state.pulse ? "Busier" : "Stronger signal")}</span>
          </div>
          <p>
            <Hexagon size={12} />
            {number(cells.length)}
            {t(" cells in view · H3 ")}
            {resolution}
            {data.isFetching && <span className="updating-dot" />}
          </p>
        </div>
        {data.error && (
          <div className="map-api-error">
            <Alert variant="destructive">
              <AlertTitle>{t("London model unavailable")}</AlertTitle>
              <AlertDescription>
                {t(data.error.message)}
                <Button variant="outline" onClick={() => data.refetch()}>
                  {t("Reconnect")}
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}
        {shared && (
          <div className="toast" role="status">
            <Check size={16} />
            {t(shared)}
          </div>
        )}
        {state.pulse && (
          <CityPulse data={pulse.data} error={pulse.error?.message} />
        )}
        <div className="map-bottomline">
          <span>
            <Compass size={12} />
            {t("Drag to explore · Ctrl + drag to rotate")}
          </span>
          <Link href="/methodology">
            {t("Signals for investigation, not guaranteed outcomes")}
            <ArrowUpRight size={11} />
          </Link>
        </div>
      </section>
      {state.selected && (
        <SiteDetail
          key={state.selected}
          h3={state.selected}
          onClose={close}
          onCatchment={setCatchment}
          debug={debug}
        />
      )}
    </main>
  );
}
