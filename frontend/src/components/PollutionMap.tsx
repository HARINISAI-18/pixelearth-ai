import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import type { Hotspot, SensorReading, Report } from "../types";
import { severityColor } from "./SeverityBadge";
import HotspotPopup from "./HotspotPopup";
import PlumeLayer from "./PlumeLayer";
import "leaflet/dist/leaflet.css";

// Chennai default center
const DEFAULT_CENTER: [number, number] = [13.0827, 80.2707];

interface Props {
  hotspots: Hotspot[];
  sensors: SensorReading[];
  reports: Report[];
  isMunicipal?: boolean;
  showHeatmap?: boolean;
  onHotspotsUpdated?: () => void;
}

// Heatmap layer using leaflet.heat
function HeatmapLayer({ hotspots, reports }: { hotspots: Hotspot[]; reports: Report[] }) {
  const map = useMap();
  const layerRef = useRef<any>(null);

  useEffect(() => {
    // Build heatmap points: [lat, lon, intensity]
    const points: [number, number, number][] = [
      ...hotspots.map(h => [h.center_lat, h.center_lon, (h.severity_score / 5)] as [number, number, number]),
      ...reports
        .filter(r => r.category !== "clear")
        .map(r => [r.lat, r.lon, (r.severity / 5) * 0.6] as [number, number, number]),
    ];

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
    }

    if (points.length > 0) {
      // leaflet.heat patches the global L, not the ESM-imported one — use window.L
      const heatFn = (window as any).L?.heatLayer;
      if (heatFn) {
        layerRef.current = heatFn(points, {
          radius: 35,
          blur: 25,
          maxZoom: 15,
          max: 1.0,
          gradient: { 0.2: "#22c55e", 0.4: "#eab308", 0.6: "#f97316", 0.8: "#ef4444", 1.0: "#7f1d1d" },
        }).addTo(map);
      }
    }

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [map, hotspots, reports]);

  return null;
}

function FlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export default function PollutionMap({ hotspots, sensors, reports, isMunicipal, showHeatmap = true, onHotspotsUpdated }: Props) {
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const [localHotspots, setLocalHotspots] = useState(hotspots);

  useEffect(() => {
    setLocalHotspots(hotspots);
  }, [hotspots]);

  function handleUpdated() {
    onHotspotsUpdated?.();
  }

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={12}
      style={{ width: "100%", height: "100%" }}
      className="rounded-none"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="map-tiles"
      />

      {/* Heatmap layer */}
      {showHeatmap && <HeatmapLayer hotspots={localHotspots} reports={reports} />}

      {/* Plume drift arrows */}
      <PlumeLayer hotspots={localHotspots} />

      {/* Sensor stations */}
      {sensors.map((s) => (
        <CircleMarker
          key={`sensor-${s.id}`}
          center={[s.lat, s.lon]}
          radius={6}
          pathOptions={{ color: "#a855f7", fillColor: "#a855f7", fillOpacity: 0.7, weight: 1.5 }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-bold text-white">{s.station_name}</p>
              <p className="text-purple-300 text-xs">{s.station_id}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                {s.pm25 != null && <><span className="text-gray-400">PM2.5</span><span className="text-white font-medium">{s.pm25} µg/m³</span></>}
                {s.pm10 != null && <><span className="text-gray-400">PM10</span><span className="text-white font-medium">{s.pm10} µg/m³</span></>}
                {s.no2 != null && <><span className="text-gray-400">NO₂</span><span className="text-white font-medium">{s.no2} µg/m³</span></>}
                {s.aqi != null && <><span className="text-gray-400">AQI</span><span className="text-white font-semibold">{s.aqi}</span></>}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Citizen / satellite reports (small dots) */}
      {reports.filter(r => r.source === "citizen").map((r) => (
        <CircleMarker
          key={`report-${r.id}`}
          center={[r.lat, r.lon]}
          radius={4}
          pathOptions={{ color: "#60a5fa", fillColor: "#3b82f6", fillOpacity: 0.6, weight: 1 }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold text-white capitalize">{r.category}</p>
              <p className="text-gray-300 text-xs mt-1">{r.description || "(no description)"}</p>
              <p className="text-gray-500 text-xs mt-1">Severity: {r.severity}/5 · {r.source}</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Hotspots — large pulsing circles */}
      {localHotspots.map((h) => {
        const color = severityColor(h.severity_score);
        const radius = 12 + h.severity_score * 5;
        return (
          <CircleMarker
            key={`hotspot-${h.id}`}
            center={[h.center_lat, h.center_lon]}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.35,
              weight: 2.5,
            }}
            eventHandlers={{ click: () => setSelectedHotspot(h) }}
          >
            {selectedHotspot?.id === h.id && (
              <Popup onClose={() => setSelectedHotspot(null)}>
                <HotspotPopup
                  hotspot={selectedHotspot}
                  onClose={() => setSelectedHotspot(null)}
                  onUpdated={handleUpdated}
                  isMunicipal={isMunicipal}
                />
              </Popup>
            )}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
