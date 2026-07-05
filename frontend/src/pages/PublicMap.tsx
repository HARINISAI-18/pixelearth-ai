import { AlertTriangle, RefreshCw, Info } from "lucide-react";
import PollutionMap from "../components/PollutionMap";
import { SeverityBadge } from "../components/SeverityBadge";
import DetectionGapBanner from "../components/DetectionGapBanner";
import RoiCalculator from "../components/RoiCalculator";
import { useMapData } from "../hooks/useMapData";

export default function PublicMap() {
  const { data, stats, loading, error, refresh } = useMapData(30000);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <h2 className="font-bold text-white mb-1">Live Air Quality Map</h2>
          <p className="text-xs text-gray-400">Chennai Metro Area • Updates every 30s</p>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-2 p-3 border-b border-gray-800">
            <StatCard label="Active Hotspots" value={stats.active_hotspots} color="text-red-400" />
            <StatCard label="Citizen Reports" value={stats.citizen_reports} color="text-blue-400" />
            <StatCard label="Dispatched" value={stats.dispatched} color="text-blue-400" />
            <StatCard label="Resolved" value={stats.resolved} color="text-green-400" />
          </div>
        )}

        {/* Legend */}
        <div className="p-3 border-b border-gray-800">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Severity Scale</p>
          <div className="space-y-1.5">
            {[1,2,3,4,5].map(s => <SeverityBadge key={s} severity={s} />)}
          </div>
          <div className="mt-3 space-y-1.5 text-xs text-gray-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
              Sensor station
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
              Citizen report
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full border-2 border-orange-400 inline-block" />
              Detected hotspot
            </div>
          </div>
        </div>

        {/* Detection advantage banner & ROI Calculator */}
        {data && (
          <DetectionGapBanner hotspots={data.hotspots} sensors={data.sensors} />
        )}
        <RoiCalculator />

        {/* Active hotspots list */}

        <div className="p-3 flex-1">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">Active Hotspots</p>
          {loading && <p className="text-xs text-gray-500">Loading…</p>}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {data?.hotspots.map(h => (
            <div key={h.id} className="mb-2 p-2.5 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-white capitalize">{h.category}</span>
                <SeverityBadge severity={h.severity_score} />
              </div>
              <p className="text-xs text-gray-400">{h.center_lat.toFixed(4)}, {h.center_lon.toFixed(4)}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {h.report_count} reports · {h.sensor_count} sensors · trend: {" "}
                <span className={h.forecast_trend === "worsening" ? "text-red-400" : h.forecast_trend === "improving" ? "text-green-400" : "text-yellow-400"}>
                  {h.forecast_trend}
                </span>
              </p>
            </div>
          ))}
          {data?.hotspots.length === 0 && !loading && (
            <p className="text-xs text-gray-500">No active hotspots detected.</p>
          )}
        </div>

        <div className="p-3 border-t border-gray-800">
          <button
            onClick={refresh}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-medium transition-colors"
          >
            <RefreshCw size={13} /> Refresh Data
          </button>
          <div className="mt-2 flex items-start gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Info size={12} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-400">Click on any hotspot circle to view evidence and details.</p>
          </div>
        </div>
      </aside>

      {/* Map */}
      <div className="flex-1 relative">
        {loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-400">Loading map data…</p>
            </div>
          </div>
        )}
        {data && (
          <PollutionMap
            hotspots={data.hotspots}
            sensors={data.sensors}
            reports={data.reports}
            onHotspotsUpdated={refresh}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2.5 text-center">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}
