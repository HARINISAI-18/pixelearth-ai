/**
 * Visual multi-source evidence fusion chain.
 * Makes the "why should I trust this?" question answered at a glance.
 */
import { Camera, Cpu, Satellite, ArrowRight, ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import type { Hotspot, Report } from "../types";
import clsx from "clsx";

interface Props {
  hotspot: Hotspot;
  evidence?: Report[];
}

const CONFIDENCE_CONFIG = {
  high: {
    label: "HIGH CONFIDENCE",
    sublabel: "3 independent sources corroborate",
    icon: <ShieldCheck size={16} className="text-green-400" />,
    bar: "bg-green-500",
    badge: "border-green-500/40 bg-green-500/10 text-green-300",
    fill: "w-full",
  },
  medium: {
    label: "MEDIUM CONFIDENCE",
    sublabel: "2 independent sources corroborate",
    icon: <ShieldAlert size={16} className="text-yellow-400" />,
    bar: "bg-yellow-500",
    badge: "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
    fill: "w-2/3",
  },
  low: {
    label: "LOW CONFIDENCE",
    sublabel: "Single source — needs corroboration",
    icon: <Shield size={16} className="text-gray-400" />,
    bar: "bg-gray-500",
    badge: "border-gray-500/40 bg-gray-500/10 text-gray-400",
    fill: "w-1/3",
  },
};

function aqiCategory(aqi: number | null) {
  if (!aqi) return null;
  if (aqi <= 50)  return { label: "Good",          color: "text-green-400" };
  if (aqi <= 100) return { label: "Moderate",       color: "text-yellow-400" };
  if (aqi <= 150) return { label: "Unhealthy*",     color: "text-orange-400" };
  if (aqi <= 200) return { label: "Unhealthy",      color: "text-red-400" };
  if (aqi <= 300) return { label: "Very Unhealthy", color: "text-purple-400" };
  return           { label: "Hazardous",            color: "text-rose-300" };
}

export default function EvidenceChain({ hotspot: h, evidence }: Props) {
  const conf = CONFIDENCE_CONFIG[h.confidence_level ?? "low"];
  const localAqiInfo = aqiCategory(h.estimated_local_aqi);
  const officialAqiInfo = aqiCategory(h.nearest_station_aqi);

  // Sample descriptions from evidence
  const citizenReports = evidence?.filter(r => r.source === "citizen") ?? [];
  const sensorReports  = evidence?.filter(r => r.source === "sensor")    ?? [];
  const satelliteReports = evidence?.filter(r => r.source === "satellite") ?? [];

  return (
    <div className="space-y-3">

      {/* Confidence banner */}
      <div className={clsx("rounded-xl border p-3", conf.badge)}>
        <div className="flex items-center gap-2 mb-2">
          {conf.icon}
          <div>
            <p className="text-xs font-black tracking-wide">{conf.label}</p>
            <p className="text-xs opacity-70">{conf.sublabel}</p>
          </div>
        </div>
        <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
          <div className={clsx("h-full rounded-full transition-all", conf.bar, conf.fill)} />
        </div>
      </div>

      {/* The evidence chain */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Evidence Chain</p>
        <div className="space-y-2">

          {/* Citizen reports */}
          <EvidenceNode
            active={h.report_count > 0}
            icon={<Camera size={14} className="text-blue-400" />}
            label={`${h.report_count} Citizen Report${h.report_count !== 1 ? "s" : ""}`}
            color="blue"
            detail={citizenReports[0]?.description || (h.report_count > 0 ? `${h.report_count} geotagged photo${h.report_count !== 1 ? "s" : ""} — AI classified` : "No reports yet")}
            confidence={h.report_count >= 3 ? "strong" : h.report_count >= 1 ? "moderate" : "none"}
          />

          <ChainArrow active={h.report_count > 0 && (h.sensor_count > 0 || h.satellite_count > 0)} />

          {/* Sensor readings */}
          <EvidenceNode
            active={h.sensor_count > 0}
            icon={<Cpu size={14} className="text-purple-400" />}
            label={`Sensor Network (${h.sensor_count} reading${h.sensor_count !== 1 ? "s" : ""})`}
            color="purple"
            detail={h.sensor_count > 0
              ? `PM2.5 exceeds city baseline · corroborates location`
              : "No nearby sensor readings"}
            confidence={h.sensor_count >= 2 ? "strong" : h.sensor_count === 1 ? "moderate" : "none"}
          />

          <ChainArrow active={h.satellite_count > 0} />

          {/* Satellite */}
          <EvidenceNode
            active={h.satellite_count > 0}
            icon={<Satellite size={14} className="text-orange-400" />}
            label={`Satellite Detection (${h.satellite_count} hit${h.satellite_count !== 1 ? "s" : ""})`}
            color="orange"
            detail={h.satellite_count > 0
              ? `NASA FIRMS thermal anomaly · independent corroboration`
              : "No satellite signal"}
            confidence={h.satellite_count >= 1 ? "strong" : "none"}
          />
        </div>
      </div>

      {/* The gap — this is the key insight */}
      {h.nearest_station_aqi != null && h.estimated_local_aqi != null && (
        <div className="rounded-xl border border-dashed border-red-500/40 bg-red-950/20 p-3">
          <p className="text-xs font-bold text-red-300 mb-2">⚠ The Invisible Gap</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-900/60 rounded-lg p-2">
              <p className="text-gray-500 mb-0.5">Official station</p>
              <p className="font-bold text-white">{h.nearest_station_aqi} AQI</p>
              <p className={clsx("text-xs font-medium mt-0.5", officialAqiInfo?.color)}>
                {officialAqiInfo?.label}
              </p>
              <p className="text-gray-600 text-xs mt-1">
                {h.nearest_station_dist_km?.toFixed(1)}km away
              </p>
            </div>
            <div className="bg-red-950/40 rounded-lg p-2 border border-red-500/20">
              <p className="text-gray-400 mb-0.5">This street</p>
              <p className="font-bold text-white">{h.estimated_local_aqi} AQI</p>
              <p className={clsx("text-xs font-medium mt-0.5", localAqiInfo?.color)}>
                {localAqiInfo?.label}
              </p>
              <p className="text-red-400 text-xs mt-1">
                ↑ {Math.round(((h.estimated_local_aqi - h.nearest_station_aqi) / h.nearest_station_aqi) * 100)}% higher
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Official network shows "{officialAqiInfo?.label}" for this area.
            Ground reality: "{localAqiInfo?.label}" — a {h.nearest_station_dist_km?.toFixed(1)}km blind spot.
          </p>
        </div>
      )}

      {/* Detection timing */}
      {h.detection_gap_hours != null && h.detection_gap_hours > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl">
          <span className="text-xl">⚡</span>
          <div>
            <p className="text-xs font-bold text-orange-300">
              ~{h.detection_gap_hours}h earlier than complaint-based detection
            </p>
            <p className="text-xs text-gray-400">
              Typical municipal response time: 4–8h after first complaint
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function EvidenceNode({ active, icon, label, color, detail, confidence }: {
  active: boolean; icon: React.ReactNode; label: string; color: string;
  detail: string; confidence: "strong" | "moderate" | "none";
}) {
  const colorMap: Record<string, string> = {
    blue:   "border-blue-500/30 bg-blue-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
    orange: "border-orange-500/30 bg-orange-500/5",
  };
  const dimmed = "border-gray-700 bg-gray-800/30 opacity-40";

  return (
    <div className={clsx("rounded-lg border p-2.5 transition-all", active ? colorMap[color] : dimmed)}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs font-semibold text-white">{label}</span>
        <span className="ml-auto">
          {confidence === "strong"   && <span className="text-xs text-green-400 font-bold">●●●</span>}
          {confidence === "moderate" && <span className="text-xs text-yellow-400 font-bold">●●○</span>}
          {confidence === "none"     && <span className="text-xs text-gray-600 font-bold">○○○</span>}
        </span>
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{detail}</p>
    </div>
  );
}

function ChainArrow({ active }: { active: boolean }) {
  return (
    <div className={clsx("flex items-center gap-1 pl-3 text-xs", active ? "text-gray-500" : "text-gray-700")}>
      <ArrowRight size={11} />
      <span>corroborated by</span>
    </div>
  );
}
