"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import maplibregl, { type StyleSpecification } from "maplibre-gl";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { H3HexagonLayer } from "@deck.gl/geo-layers";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  AmbientLight,
  DirectionalLight,
  LightingEffect,
  type Layer as DeckLayer,
} from "@deck.gl/core";
import { AlertTriangle, Hexagon } from "lucide-react";
import type { Cell, Layer, Pulse, Catchment } from "@/lib/types";
import { labels } from "@/lib/types";

type Camera = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
};
export type MapHandle = {
  flyTo: (c: Cell) => void;
  reset: () => void;
  zoom: (delta: number) => void;
  camera: () => Camera | undefined;
};
type Props = {
  controlsRef?: React.Ref<MapHandle>;
  focusCell?: Cell;
  pressure?: { h3: string; intensity: number }[];
  cells: Cell[];
  layer?: Layer;
  selected?: string | null;
  onSelect?: (c: Cell) => void;
  onViewport?: (zoom: number, bbox: string, camera: Camera) => void;
  hero?: boolean;
  pitch?: boolean;
  pulse?: Pulse;
  time?: number;
  catchment?: Catchment | null;
  context?: GeoJSON.FeatureCollection;
  initialCamera?: Camera | null;
  debug?: boolean;
};
const base: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0e1418" },
    },
  ],
};
const center: [number, number] = [-0.115, 51.515];
export function mapValue(c: Cell, layer: Layer) {
  return layer === "confidence"
    ? c.confidence * 100
    : layer in c.components
      ? c.components[layer as keyof Cell["components"]]
      : c.score;
}
export function scoreColor(n: number): [number, number, number, number] {
  const stops = [
    [0, 41, 57, 65],
    [35, 52, 87, 81],
    [50, 79, 123, 92],
    [65, 170, 186, 97],
    [80, 222, 240, 155],
    [100, 241, 255, 204],
  ];
  let a = stops[0],
    b = stops[stops.length - 1];
  for (let i = 1; i < stops.length; i++) {
    if (n <= stops[i][0]) {
      a = stops[i - 1];
      b = stops[i];
      break;
    }
  }
  const f = Math.max(0, Math.min(1, (n - a[0]) / (b[0] - a[0])));
  return [
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    Math.round(a[3] + (b[3] - a[3]) * f),
    225,
  ];
}
export const CityMap = forwardRef<MapHandle, Props>(function CityMap(
  {
    controlsRef,
    focusCell,
    pressure,
    cells,
    layer = "opportunity",
    selected,
    onSelect,
    onViewport,
    hero = false,
    pitch = true,
    pulse,
    time = 32,
    catchment,
    context,
    initialCamera,
    debug = false,
  },
  ref,
) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null),
    overlay = useRef<MapboxOverlay | null>(null);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [tooltip, setTooltip] = useState<{
      cell: Cell;
      x: number;
      y: number;
    } | null>(null);
  const callbacks = useRef({ onSelect, onViewport });
  useEffect(() => {
    callbacks.current = { onSelect, onViewport };
  }, [onSelect, onViewport]);
  const pulseLookup = useMemo(
    () => new Map(pulse?.cells.map((c) => [c.h3, c.values]) || []),
    [pulse],
  );
  useImperativeHandle(
    controlsRef || ref,
    () => ({
      flyTo(c) {
        map.current?.flyTo({
          center: [c.longitude, c.latitude],
          zoom: 12.8,
          pitch: pitch ? 53 : 0,
          bearing: -18,
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : 1300,
          padding: { left: 30, right: 180, top: 20, bottom: 20 },
        });
      },
      reset() {
        map.current?.flyTo({
          center,
          zoom: 10.8,
          pitch: pitch ? 52 : 0,
          bearing: -20,
          padding: { left: 0, right: 0, top: 0, bottom: 0 },
          duration: 1100,
        });
      },
      zoom(delta) {
        map.current?.zoomTo((map.current?.getZoom() || 11) + delta, {
          duration: 250,
        });
      },
      camera() {
        const m = map.current;
        return m
          ? {
              longitude: m.getCenter().lng,
              latitude: m.getCenter().lat,
              zoom: m.getZoom(),
              pitch: m.getPitch(),
              bearing: m.getBearing(),
            }
          : undefined;
      },
    }),
    [pitch],
  );
  useEffect(() => {
    if (!container.current) return;
    let disposed = false;
    const camera = initialCamera || {
      longitude: hero ? -0.16 : center[0],
      latitude: 51.513,
      zoom: hero ? 11.05 : 10.8,
      pitch: hero ? 58 : 52,
      bearing: hero ? -28 : -20,
    };
    let m: maplibregl.Map;
    try {
      m = new maplibregl.Map({
        container: container.current,
        style: base,
        center: [camera.longitude, camera.latitude],
        zoom: camera.zoom,
        pitch: initialCamera?.pitch ?? (pitch ? camera.pitch : 0),
        bearing: camera.bearing,
        maxZoom: 15.5,
        minZoom: 9,
        maxPitch: 65,
        attributionControl: false,
        canvasContextAttributes: {
          antialias: true,
          preserveDrawingBuffer: true,
        },
        maxBounds: [
          [-0.8, 51.1],
          [0.5, 51.9],
        ],
      });
    } catch {
      setError(
        "This browser could not start the 3D map. Explore the ranked locations using the panel.",
      );
      return;
    }
    map.current = m;
    m.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: "London open-data model",
      }),
      "bottom-right",
    );
    m.on("load", () => {
      if (disposed) return;
      const lighting = new LightingEffect({
        ambientLight: new AmbientLight({
          color: [255, 255, 238],
          intensity: 0.9,
        }),
        directionalLight: new DirectionalLight({
          color: [246, 255, 220],
          intensity: 0.65,
          direction: [-1, -3, -2],
        }),
      });
      overlay.current = new MapboxOverlay({
        interleaved: true,
        layers: [],
        effects: [lighting],
      });
      m.addControl(overlay.current);
      setReady(true);
    });
    const controller = new AbortController();
    fetch(
      process.env.NEXT_PUBLIC_MAP_STYLE ||
        "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((style: StyleSpecification) => {
        if (disposed) return;
        style.layers = style.layers.map((l) => {
          if (l.type === "background")
            return {
              ...l,
              paint: { ...l.paint, "background-color": "#0d1317" },
            };
          if (l.type === "fill" && l.id.toLowerCase().includes("water"))
            return { ...l, paint: { ...l.paint, "fill-color": "#21363c" } };
          if (l.type === "symbol")
            return {
              ...l,
              paint: {
                ...l.paint,
                "text-color": "#819095",
                "text-halo-color": "#0d1317",
                "text-halo-width": 1,
              },
            };
          return l;
        });
        m.setStyle(style);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(
            "Basemap unavailable. The verified H3 opportunity layer remains available.",
          );
      });
    const reportViewport = () => {
      const b = m.getBounds(),
        c = m.getCenter();
      const bounds = [
        Math.max(-0.79, b.getWest()),
        Math.max(51.11, b.getSouth()),
        Math.min(0.49, b.getEast()),
        Math.min(51.89, b.getNorth()),
      ]
        .map((n) => n.toFixed(4))
        .join(",");
      callbacks.current.onViewport?.(m.getZoom(), bounds, {
        longitude: c.lng,
        latitude: c.lat,
        zoom: m.getZoom(),
        pitch: m.getPitch(),
        bearing: m.getBearing(),
      });
    };
    m.on("moveend", reportViewport);
    m.on("load", reportViewport);
    m.on("error", (e) => {
      if (e.error?.message?.includes("WebGL"))
        setError(
          "The browser interrupted 3D rendering. Reload to reconnect to the map.",
        );
    });
    return () => {
      disposed = true;
      controller.abort();
      overlay.current = null;
      map.current = null;
      m.remove();
    };
    // Camera initializes once; subsequent changes use explicit fly-to actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hero]);
  const lastFocus = useRef(initialCamera ? selected : null);
  const focusH3 = focusCell?.h3,
    focusLon = focusCell?.longitude,
    focusLat = focusCell?.latitude;
  useEffect(() => {
    if (
      ready &&
      focusH3 &&
      lastFocus.current !== focusH3 &&
      focusLon !== undefined &&
      focusLat !== undefined
    ) {
      lastFocus.current = focusH3;
      map.current?.flyTo({
        center: [focusLon, focusLat],
        zoom: 12.8,
        padding: {
          left: 30,
          right: window.innerWidth > 760 ? 340 : 0,
          top: 0,
          bottom: 0,
        },
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 1200,
      });
    }
  }, [ready, focusH3, focusLon, focusLat]);
  const pressureLookup = useMemo(
    () => new Map(pressure?.map((p) => [p.h3, p.intensity]) || []),
    [pressure],
  );
  const previousPitch = useRef(pitch);
  useEffect(() => {
    if (!ready || previousPitch.current === pitch) return;
    previousPitch.current = pitch;
    map.current?.easeTo({
      pitch: pitch ? 52 : 0,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : 600,
    });
  }, [pitch, ready]);
  useEffect(() => {
    if (!ready || !overlay.current) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const getValue = (c: Cell) =>
      pulse
        ? Math.min(
            100,
            ((pulseLookup.get(c.h3)?.[time] || 0) / pulse.display_scale) * 100,
          )
        : ["competition", "competitors"].includes(layer) && pressure
          ? pressureLookup.get(c.h3) || 0
          : mapValue(c, layer);
    const layers: DeckLayer[] = [
      new H3HexagonLayer<Cell>({
        id: "opportunity-hexagons",
        data: cells,
        pickable: !hero,
        extruded: pitch,
        wireframe: false,
        filled: true,
        getHexagon: (c) => c.h3,
        coverage: hero ? 0.68 : 0.68,
        // Instanced columns for same-resolution London cells; exact polygons in debug.
        highPrecision: debug ? true : "auto",
        getElevation: (c) =>
          Math.max(8, Math.pow(Math.max(0, getValue(c) - 28), 1.6) * 0.9),
        getFillColor: (c) =>
          c.h3 === selected ? [248, 250, 217, 255] : scoreColor(getValue(c)),
        getLineColor: [200, 220, 130, 65],
        stroked: debug,
        lineWidthMinPixels: debug ? 1 : 0,
        material: {
          ambient: 0.5,
          diffuse: 0.6,
          shininess: 25,
          specularColor: [90, 100, 60],
        },
        transitions: reduced ? {} : { getElevation: 650, getFillColor: 650 },
        updateTriggers: {
          getElevation: [
            layer,
            time,
            pulse?.feature_version,
            pulse?.day,
            pressure,
          ],
          getFillColor: [layer, time, selected, pulse?.day, pressure],
        },
        onHover: (info) => {
          setTooltip(
            info.object ? { cell: info.object, x: info.x, y: info.y } : null,
          );
        },
        onClick: (info) => {
          if (info.object) callbacks.current.onSelect?.(info.object);
        },
      }),
    ];
    if (selected) {
      const cell =
        focusCell?.h3 === selected
          ? focusCell
          : cells.find((c) => c.h3 === selected);
      if (cell)
        layers.push(
          new ScatterplotLayer({
            id: "selected-ring",
            data: [cell],
            getPosition: (d: Cell) => [d.longitude, d.latitude],
            getRadius: 230,
            getLineColor: [228, 248, 169],
            stroked: true,
            filled: false,
            lineWidthMinPixels: 2,
            parameters: { depthCompare: "always" },
          }),
        );
    }
    if (catchment)
      layers.push(
        new GeoJsonLayer({
          id: "catchment",
          data: {
            type: "Feature",
            geometry: catchment.geometry,
            properties: {},
          },
          filled: true,
          stroked: true,
          getFillColor: [192, 222, 148, 22],
          getLineColor: [223, 246, 158, 220],
          getLineWidth: 3,
          lineWidthUnits: "pixels",
          parameters: { depthCompare: "always" },
        }),
      );
    if (context)
      layers.push(
        new GeoJsonLayer({
          id: "context",
          data: context,
          filled: true,
          stroked: true,
          getFillColor:
            layer === "competitors"
              ? [250, 171, 128, 230]
              : [140, 217, 197, 75],
          getLineColor: [170, 230, 207, 200],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
          pointType: "circle",
          getPointRadius: 28,
          pointRadiusMinPixels: 3,
          parameters: { depthCompare: "always" },
        }),
      );
    overlay.current.setProps({ layers });
  }, [
    ready,
    cells,
    layer,
    selected,
    hero,
    pitch,
    pulse,
    pulseLookup,
    time,
    catchment,
    context,
    debug,
    pressure,
    pressureLookup,
    focusCell,
  ]);
  return (
    <div
      className="city-map"
      data-testid="city-map"
      data-map-ready={ready}
      data-cells-count={cells.length}
      data-extruded={pitch}
    >
      <div ref={container} className="map-container" />
      {!ready && !error && (
        <div className="map-connecting">
          <Hexagon size={24} />
          <span>Connecting to the city map</span>
        </div>
      )}
      {error && (
        <div className="map-error">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}
      {tooltip && !hero && (
        <div
          className="map-tooltip"
          style={{
            left: Math.min(
              tooltip.x + 14,
              (container.current?.clientWidth || 1000) - 230,
            ),
            top: Math.max(20, tooltip.y - 96),
          }}
        >
          <small>{pulse ? "Typical transport influence" : labels[layer]}</small>
          <strong>
            {Math.round(
              pulse
                ? Math.min(
                    100,
                    ((pulseLookup.get(tooltip.cell.h3)?.[time] || 0) /
                      pulse.display_scale) *
                      100,
                  )
                : ["competition", "competitors"].includes(layer) && pressure
                  ? pressureLookup.get(tooltip.cell.h3) || 0
                  : mapValue(tooltip.cell, layer),
            )}
            <span>/100</span>
          </strong>
          <p>{tooltip.cell.label}</p>
          <span>{tooltip.cell.borough} · Click to investigate</span>
        </div>
      )}
    </div>
  );
});
