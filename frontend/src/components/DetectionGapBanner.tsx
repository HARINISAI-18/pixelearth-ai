/**
 * The core "invisible hotspot" narrative — side-by-side comparison of
 * what official city AQI shows vs what PollutionWatch detects.
 * This IS the pitch.
 */
import { AlertTriangle, CheckCircle, Zap, Eye, EyeOff } from "lucide-react";
import type { Hotspot, SensorReading } from "../types";

interface Props {
  hotspots: Hotspot[];
  sensors: SensorReading[];
}

function aqiLabel(aqi: number): { label: string; color: string; bg: string } {
  if (aqi <= 50)  return { label: "Good",        color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" };
  if (aqi <= 100) return { label: "Moderate",     color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" };
  if (aqi <= 150) return { label: "Unhealthy (Sensitive)", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" };
  if (aqi <= 200) return { label: "Unhealthy",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" };
  if (aqi <= 300) return { label: "Very Unhealthy", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/30" };
  return { label: "Hazardous", color: "text-rose-300", bg: "bg-rose-500/10 border-rose-500/30" };
}

export default function DetectionGapBanner({ hotspots, sensors }: Props) {
  const activeHotspots = hotspots.filter(h => h.status === "active" || h.status === "acknowledged");

  // Official view: average AQI from sensor network
  const sensorsWithAqi = sensors.filter(s => s.aqi != null);
  const officialAvgAqi = sensorsWithAqi.length > 0
    ? Math.round(sensorsWithAqi.reduce((s, r) => s + (r.aqi ?? 0), 0) / sensorsWithAqi.length)
    : null;

  // Our view: worst hotspot local AQI
  const worstHotspot = activeHotspots
    .filter(h => h.estimated_local_aqi != null)
    .sort((a, b) => (b.estimated_local_aqi ?? 0) - (a.estimated_local_aqi ?? 0))[0];

  const ourWorstAqi = worstHotspot?.estimated_local_aqi ?? null;

  // Max detection gap hours
  const maxGap = Math.max(0, ...activeHotspots.map(h => h.detection_gap_hours ?? 0));

  // High-confidence hotspots missed by official network
  const missedHotspots = activeHotspots.filter(
    h => h.nearest_station_dist_km != null && h.nearest_station_dist_km > 1.5
  );

  const officialInfo = officialAvgAqi != null ? aqiLabel(officialAvgAqi) : null;
  const ourInfo = ourWorstAqi != null ? aqiLabel(ourWorstAqi) : null;

  if (activeHotspots.length === 0) return null;

  return (
    <div className="mx-3 mb-3 rounded-xl border border-gray-700 bg-gray-900/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 border-b border-gray-700">
        <Zap size={13} className="text-orange-400" />
        <span className="text-xs font-bold text-white uppercase tracking-wide">Detection Advantage</span>
        <span className="ml-auto text-xs text-gray-500">What the city misses</span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-700">
        {/* Official city view */}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <EyeOff size={12} className="text-gray-500" />
            <span className="text-xs text-gray-400 font-medium">Official City AQI</span>
          </div>
          {officialInfo && officialAvgAqi != null ? (
            <>
              <p className={`text-2xl font-black ${officialInfo.color}`}>{officialAvgAqi}</p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border font-medium ${officialInfo.bg} ${officialInfo.color}`}>
                {officialInfo.label}
              </span>
              <p className="text-xs text-gray-500 mt-1.5">
                {sensorsWithAqi.length} station{sensorsWithAqi.length !== 1 ? "s" : ""} · city average
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-xs">No sensor data</p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-green-400">
            <CheckCircle size={11} />
            <span>No alerts flagged</span>
          </div>
        </div>

        {/* Our hyper-local view */}
        <div className="p-3 bg-red-950/20">
          <div className="flex items-center gap-1.5 mb-2">
            <Eye size={12} className="text-orange-400" />
            <span className="text-xs text-orange-300 font-medium">PollutionWatch Local</span>
          </div>
          {ourInfo && ourWorstAqi != null ? (
            <>
              <p className={`text-2xl font-black ${ourInfo.color}`}>{ourWorstAqi}</p>
              <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full border font-medium ${ourInfo.bg} ${ourInfo.color}`}>
                {ourInfo.label}
              </span>
              <p className="text-xs text-gray-400 mt-1.5">
                worst hotspot · {worstHotspot?.nearest_station_dist_km?.toFixed(1)}km from station
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-xs">Calculating…</p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle size={11} />
            <span>{activeHotspots.length} active hotspot{activeHotspots.length !== 1 ? "s" : ""} detected</span>
          </div>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="flex divide-x divide-gray-700 border-t border-gray-700">
        <div className="flex-1 px-3 py-2 text-center">
          <p className="text-orange-400 font-bold text-sm">~{maxGap}h</p>
          <p className="text-gray-500 text-xs">earlier than complaints</p>
        </div>
        <div className="flex-1 px-3 py-2 text-center">
          <p className="text-red-400 font-bold text-sm">{missedHotspots.length}</p>
          <p className="text-gray-500 text-xs">missed by network</p>
        </div>
        <div className="flex-1 px-3 py-2 text-center">
          <p className="text-purple-400 font-bold text-sm">
            {activeHotspots.filter(h => h.confidence_level === "high").length}
          </p>
          <p className="text-gray-500 text-xs">high confidence</p>
        </div>
      </div>
    </div>
  );
}
