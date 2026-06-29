"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MlMap, type GeoJSONSource } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { RELATIONSHIPS } from "@/lib/types";
import type { SiteDTO } from "@/lib/serialize";

const STYLE_URL =
  process.env.NEXT_PUBLIC_MAP_STYLE_URL ||
  "https://tiles.openfreemap.org/styles/liberty";

const SOURCE_ID = "sites";
const LAYER_ID = "sites-circles";

// Build a MapLibre "match" expression mapping relationship -> color.
function relationshipColorExpr(): unknown {
  const expr: unknown[] = ["match", ["get", "relationship"]];
  for (const r of RELATIONSHIPS) {
    expr.push(r.value, r.color);
  }
  expr.push("#94a3b8"); // default
  return expr;
}

// Color by fit score 0..100 (grey -> brand).
const fitColorExpr: unknown = [
  "interpolate",
  ["linear"],
  ["coalesce", ["get", "fitScore"], 0],
  0,
  "#cbd5e1",
  40,
  "#a5b4fc",
  70,
  "#6366f1",
  100,
  "#4338ca",
];

function toFeatureCollection(sites: SiteDTO[]) {
  return {
    type: "FeatureCollection" as const,
    features: sites.map((s) => ({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        name: s.name,
        relationship: s.relationship,
        fitScore: s.fitScore ?? 0,
      },
    })),
  };
}

export default function SitesMap({
  sites,
  colorBy,
  selectedId,
  onSelect,
}: {
  sites: SiteDTO[];
  colorBy: "relationship" | "fit";
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MlMap | null>(null);
  const readyRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Init map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [4, 48], // Western Europe
      zoom: 3.5,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: toFeatureCollection([]),
      });
      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            4,
            8,
            7,
            12,
            10,
          ],
          "circle-color": relationshipColorExpr() as never,
          "circle-stroke-width": [
            "case",
            ["==", ["get", "id"], ["literal", ""]],
            3,
            1,
          ],
          "circle-stroke-color": "#ffffff",
          "circle-opacity": 0.85,
        },
      });

      map.on("click", LAYER_ID, (e) => {
        const f = e.features?.[0];
        if (f?.properties?.id) onSelectRef.current(String(f.properties.id));
      });
      map.on("mouseenter", LAYER_ID, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", LAYER_ID, () => {
        map.getCanvas().style.cursor = "";
      });

      readyRef.current = true;
      const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
      src?.setData(toFeatureCollection(sites) as never);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update data when sites change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    src?.setData(toFeatureCollection(sites) as never);
  }, [sites]);

  // Update color scheme.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.getLayer(LAYER_ID)) return;
    map.setPaintProperty(
      LAYER_ID,
      "circle-color",
      (colorBy === "fit" ? fitColorExpr : relationshipColorExpr()) as never
    );
  }, [colorBy]);

  // Highlight the selected site.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !map.getLayer(LAYER_ID)) return;
    map.setPaintProperty(LAYER_ID, "circle-stroke-width", [
      "case",
      ["==", ["get", "id"], selectedId ?? "__none__"],
      3.5,
      1,
    ] as never);
    map.setPaintProperty(LAYER_ID, "circle-stroke-color", [
      "case",
      ["==", ["get", "id"], selectedId ?? "__none__"],
      "#1e1b4b",
      "#ffffff",
    ] as never);
  }, [selectedId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
