import { useState, useEffect } from "react";
import { BarChart3, TrendingUp, MapPin, RefreshCw, Calendar } from "lucide-react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { api } from "../api";
import { SeverityBadge } from "../components/SeverityBadge";
import clsx from "clsx";
import "leaflet/dist/leaflet.css";

interface FrequencyCell {
  grid_cell_id: string;
  center_lat: number;
  center_lon: number;
  count: number;
  max_severity: number;
  categories: string[];
}

interface TimelineEntry {
  hour: string;
  citizen: number;
  sensor: number;
  satellite: number;
  total: number;
}

interface AnalyticsData {
  days: number;
  total_hotspots: number;
  frequency_by_cell: FrequencyCell[];
}

interface TimelineData {
  days: number;
  timeline: TimelineEntry[];
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        fetch(`/api/analytics/hotspot-history?days=${days}`).then(r => r.json()),
        fetch(`/api/analytics/report-timeline?days=${days}`).then(r => r.json()),
      ]);
      setAnalytics(a);
      setTimeline(t);
    } catch (e) {
      console.error("Analytics load failed", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [days]);

  const cells = analytics?.frequency_by_cell ?? [];
  const maxCount = cells.length > 0 ? Math.max(...cells.map(c => c.count)) : 1;

  // Build bar chart from hourly timeline
  const hourlyBars = timeline?.timeline ?? [];
  const maxBarVal = hourlyBars.length > 0 ? Math.max(...hourlyBars.map(h => h.total), 1) : 1;

  // Daily aggregation for simpler chart
  const dailyMap: Record<string, number> = {};
  for (const h of hourlyBars) {
    const day = h.hour.slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + h.total;
  }
  const dailyBars = Object.entries(dailyMap).sort();
  const maxDailyVal = dailyBars.length > 0 ? Math.max(...dailyBars.map(([, v]) => v), 1) : 1;

  function cellColor(count: number, max: number): string {
    const ratio = count / max;
    if (ratio > 0.75) return "#ef4444";
    if (ratio > 0.5)  return "#f97316";
    if (ratio > 0.25) return "#eab308";
    return "#22c55e";
  }

  return (
    <div className="flex h-full overflow-hidden bg-gray-950">
      {/* Left: stats + table */}
      <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0 overflow-y-auto">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-white">Historical Analysis</h2>
              <p className="text-xs text-gray-400">Recurring hotspot frequency</p>
            </div>
            <button onClick={load} disabled={loading}
              className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Day range selector */}
          <div className="flex gap-1">
            {[3, 7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={clsx("flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  days === d ? "bg-orange-500 text-white" : "bg-gray-800 text-gray-400 hover:text-white")}>
                {d}d
              </button>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        {analytics && (
          <div className="grid grid-cols-2 gap-2 p-3 border-b border-gray-800">
            <StatCard label="Total Hotspots" value={analytics.total_hotspots} color="text-orange-400" />
            <StatCard label="Unique Zones" value={cells.length} color="text-purple-400" />
            <StatCard label="Recurring (≥2×)" value={cells.filter(c => c.count >= 2).length} color="text-red-400" />
            <StatCard label="High Severity" value={cells.filter(c => c.max_severity >= 4).length} color="text-yellow-400" />
          </div>
        )}

        {/* Top recurring hotspot zones */}
        <div className="p-3 flex-1">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Top Recurring Zones
          </p>
          {loading && <p className="text-xs text-gray-500">Loading…</p>}
          {cells.slice(0, 10).map((cell, i) => (
            <div key={cell.grid_cell_id}
              className="mb-2 p-2.5 bg-gray-800 rounded-lg border border-gray-700">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-gray-500">#{i + 1}</span>
                  <span className="text-xs font-medium text-white capitalize">
                    {cell.categories[0] ?? "mixed"}
                  </span>
                </div>
                <span className="text-xs font-bold text-orange-400">{cell.count}×</span>
              </div>
              <p className="text-xs text-gray-400">
                {cell.center_lat.toFixed(4)}, {cell.center_lon.toFixed(4)}
              </p>
              <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(cell.count / maxCount) * 100}%`,
                    background: cellColor(cell.count, maxCount),
                  }}
                />
              </div>
            </div>
          ))}
          {cells.length === 0 && !loading && (
            <p className="text-xs text-gray-500">No historical data yet. Seed demo data first.</p>
          )}
        </div>
      </aside>

      {/* Right: map + chart */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Historical frequency map */}
        <div className="flex-1 relative min-h-0">
          <div className="absolute top-3 left-3 z-10 bg-gray-900/90 border border-gray-700 rounded-xl px-3 py-2 flex items-center gap-2">
            <MapPin size={13} className="text-orange-400" />
            <span className="text-xs text-gray-300 font-medium">
              Hotspot frequency map — last {days} days
            </span>
          </div>
          <MapContainer center={[13.0827, 80.2707]} zoom={12} style={{ width: "100%", height: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {cells.map(cell => {
              const radius = 8 + (cell.count / maxCount) * 22;
              const color = cellColor(cell.count, maxCount);
              return (
                <CircleMarker
                  key={cell.grid_cell_id}
                  center={[cell.center_lat, cell.center_lon]}
                  radius={radius}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.45, weight: 2 }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-bold text-white mb-1">
                        Recurring Hotspot Zone
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <span className="text-gray-400">Occurrences</span>
                        <span className="text-orange-300 font-bold">{cell.count}×</span>
                        <span className="text-gray-400">Max severity</span>
                        <span className="text-white font-medium">{cell.max_severity.toFixed(1)}/5</span>
                        <span className="text-gray-400">Categories</span>
                        <span className="text-white capitalize">{cell.categories.join(", ")}</span>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>

        {/* Daily report activity bar chart */}
        <div className="h-44 bg-gray-900 border-t border-gray-800 p-4 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={14} className="text-orange-400" />
            <span className="text-xs font-semibold text-gray-300">Daily Report Activity</span>
            <div className="ml-auto flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Citizen</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />Sensor</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Satellite</span>
            </div>
          </div>
          <div className="flex items-end gap-1 h-20 overflow-x-auto pb-1">
            {dailyBars.length === 0 && (
              <p className="text-xs text-gray-600 m-auto">No timeline data</p>
            )}
            {dailyBars.map(([day, total]) => {
              // Get per-source counts for this day
              const dayEntries = hourlyBars.filter(h => h.hour.startsWith(day));
              const citizen = dayEntries.reduce((s, h) => s + (h.citizen || 0), 0);
              const sensor = dayEntries.reduce((s, h) => s + (h.sensor || 0), 0);
              const satellite = dayEntries.reduce((s, h) => s + (h.satellite || 0), 0);
              const barH = Math.max(4, (total / maxDailyVal) * 72);
              return (
                <div key={day} className="flex flex-col items-center gap-0.5 shrink-0" style={{ minWidth: 28 }}>
                  <div className="flex flex-col justify-end w-5 rounded overflow-hidden"
                    style={{ height: barH }}
                    title={`${day}: ${total} reports`}>
                    {satellite > 0 && (
                      <div className="bg-orange-400" style={{ height: `${(satellite / total) * 100}%`, minHeight: 2 }} />
                    )}
                    {sensor > 0 && (
                      <div className="bg-purple-400" style={{ height: `${(sensor / total) * 100}%`, minHeight: 2 }} />
                    )}
                    {citizen > 0 && (
                      <div className="bg-blue-400" style={{ height: `${(citizen / total) * 100}%`, minHeight: 2 }} />
                    )}
                  </div>
                  <span className="text-gray-600 text-xs" style={{ fontSize: 9 }}>
                    {day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
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
