import { useState } from "react";
import {
  AlertTriangle, CheckCircle, Truck, RefreshCw, TrendingUp, TrendingDown,
  Minus, Camera, Cpu, Satellite, BarChart3, Database, Bot
} from "lucide-react";
import PollutionMap from "../components/PollutionMap";
import { SeverityBadge } from "../components/SeverityBadge";
import TacticalPlanModal from "../components/TacticalPlanModal";
import { useMapData } from "../hooks/useMapData";
import { api } from "../api";
import type { Hotspot } from "../types";
import clsx from "clsx";


const STATUS_STYLES: Record<string, string> = {
  active: "bg-red-500/20 text-red-300 border-red-500/40",
  acknowledged: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  dispatched: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  resolved: "bg-green-500/20 text-green-300 border-green-500/40",
};

const TREND_ICON = {
  worsening: <TrendingUp size={13} className="text-red-400" />,
  stable: <Minus size={13} className="text-yellow-400" />,
  improving: <TrendingDown size={13} className="text-green-400" />,
};

export default function MunicipalDashboard() {
  const { data, stats, loading, error, refresh } = useMapData(20000);
  const [selected, setSelected] = useState<number | null>(null);
  const [view, setView] = useState<"map" | "list">("list");
  const [seeding, setSeeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hotspots = data?.hotspots ?? [];
  const selectedHotspot = hotspots.find(h => h.id === selected) ?? null;

  async function handleStatusUpdate(id: number, status: string) {
    await api.updateHotspotStatus(id, status, "Officer Karthik");
    refresh();
  }

  async function handleSeedDemo() {
    setSeeding(true);
    try { await api.seedDemo(); await refresh(); } finally { setSeeding(false); }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try { await api.refreshData(); await refresh(); } finally { setRefreshing(false); }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: alert feed */}
      <aside className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col shrink-0">
        {/* Header stats */}
        <div className="p-3 border-b border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-white text-sm">Municipal Operations</h2>
            <div className="flex gap-1">
              <button onClick={handleRefresh} disabled={refreshing}
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors disabled:opacity-50"
                title="Refresh data">
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              </button>
              <button onClick={handleSeedDemo} disabled={seeding}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs transition-colors disabled:opacity-50"
                title="Seed demo data">
                <Database size={12} /> {seeding ? "Seeding…" : "Demo"}
              </button>
            </div>
          </div>

          {stats && (
            <div className="grid grid-cols-3 gap-1.5">
              <MiniStat label="Active" value={stats.active_hotspots} color="text-red-400" />
              <MiniStat label="Dispatched" value={stats.dispatched} color="text-blue-400" />
              <MiniStat label="Resolved" value={stats.resolved} color="text-green-400" />
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex border-b border-gray-800">
          {(["list", "map"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={clsx("flex-1 py-2 text-xs font-medium capitalize transition-colors",
                view === v ? "bg-gray-800 text-white" : "text-gray-500 hover:text-gray-300")}>
              {v === "list" ? "Alert Feed" : "Map View"}
            </button>
          ))}
        </div>

        {/* Alert feed */}
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-xs text-gray-500 p-4">Loading…</p>}
          {error && <p className="text-xs text-red-400 p-4">{error}</p>}
          {hotspots.length === 0 && !loading && (
            <div className="p-4 text-center">
              <p className="text-xs text-gray-500 mb-2">No active hotspots.</p>
              <button onClick={handleSeedDemo} className="text-xs text-orange-400 hover:text-orange-300 underline">
                Seed demo data
              </button>
            </div>
          )}
          {hotspots.map(h => (
            <HotspotRow
              key={h.id}
              hotspot={h}
              isSelected={selected === h.id}
              onClick={() => setSelected(selected === h.id ? null : h.id)}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {view === "map" || !selectedHotspot ? (
          <div className="flex-1 relative">
            {data && (
              <PollutionMap
                hotspots={data.hotspots}
                sensors={data.sensors}
                reports={data.reports}
                isMunicipal
                onHotspotsUpdated={refresh}
              />
            )}
          </div>
        ) : null}

        {selectedHotspot && view === "list" && (
          <HotspotDetail hotspot={selectedHotspot} onStatusUpdate={handleStatusUpdate} onClose={() => setSelected(null)} />
        )}

        {!selectedHotspot && view === "list" && (
          <div className="flex-1 flex items-center justify-center text-center p-8">
            <div>
              <BarChart3 size={48} className="text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Select a hotspot from the feed to view details</p>
              <p className="text-gray-600 text-xs mt-1">or switch to Map View</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-800 rounded-lg p-2 text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function HotspotRow({ hotspot: h, isSelected, onClick, onStatusUpdate }: {
  hotspot: Hotspot; isSelected: boolean; onClick: () => void;
  onStatusUpdate: (id: number, status: string) => void;
}) {
  const trend = h.forecast_trend ?? "stable";
  return (
    <div
      onClick={onClick}
      className={clsx("border-b border-gray-800 p-3 cursor-pointer transition-colors",
        isSelected ? "bg-gray-800" : "hover:bg-gray-800/50")}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          {h.status === "active" && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
          <span className="text-sm font-medium text-white capitalize">{h.category}</span>
        </div>
        <SeverityBadge severity={h.severity_score} />
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <span className={clsx("text-xs border rounded-full px-1.5 py-0.5 font-medium capitalize", STATUS_STYLES[h.status])}>
          {h.status}
        </span>
        <span className="flex items-center gap-0.5 text-xs text-gray-400">
          {(TREND_ICON as any)[trend]} {trend}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1"><Camera size={10} className="text-blue-400" />{h.report_count}</span>
        <span className="flex items-center gap-1"><Cpu size={10} className="text-purple-400" />{h.sensor_count}</span>
        <span className="flex items-center gap-1"><Satellite size={10} className="text-orange-400" />{h.satellite_count}</span>
      </div>

      {isSelected && h.status !== "resolved" && (
        <div className="flex gap-1.5 mt-2" onClick={e => e.stopPropagation()}>
          {h.status === "active" && (
            <button onClick={() => onStatusUpdate(h.id, "acknowledged")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-medium border border-yellow-500/30 transition-colors">
              <CheckCircle size={11} /> Acknowledge
            </button>
          )}
          {(h.status === "active" || h.status === "acknowledged") && (
            <button onClick={() => onStatusUpdate(h.id, "dispatched")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-medium border border-blue-500/30 transition-colors">
              <Truck size={11} /> Dispatch
            </button>
          )}
          {h.status === "dispatched" && (
            <button onClick={() => onStatusUpdate(h.id, "resolved")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-medium border border-green-500/30 transition-colors">
              <CheckCircle size={11} /> Resolve
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function HotspotDetail({ hotspot: h, onStatusUpdate, onClose }: {
  hotspot: Hotspot; onStatusUpdate: (id: number, status: string) => void; onClose: () => void;
}) {
  const [showTacticalPlan, setShowTacticalPlan] = useState(false);
  const trend = h.forecast_trend ?? "stable";
  return (
    <div className="flex-1 overflow-y-auto p-5 bg-gray-900 relative">
      {showTacticalPlan && (
        <TacticalPlanModal
          hotspotId={h.id}
          onClose={() => setShowTacticalPlan(false)}
          onExecute={() => onStatusUpdate(h.id, "dispatched")}
        />
      )}
      <div className="max-w-2xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white capitalize">{h.category} Hotspot #{h.id}</h2>
            <p className="text-gray-400 text-sm">{h.center_lat.toFixed(5)}, {h.center_lon.toFixed(5)}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-sm">✕ Close</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <InfoCard title="Current Severity">
            <SeverityBadge severity={h.severity_score} size="lg" />
          </InfoCard>
          <InfoCard title="24h Forecast">
            <div className="flex items-center gap-2">
              {(TREND_ICON as any)[trend]}
              <span className={clsx("font-semibold capitalize",
                trend === "worsening" ? "text-red-400" : trend === "improving" ? "text-green-400" : "text-yellow-400")}>
                {trend}
              </span>
              <span className="text-gray-400 text-sm">({h.forecast_score?.toFixed(1)}/5 predicted)</span>
            </div>
          </InfoCard>
        </div>

        <InfoCard title="Evidence Sources" className="mb-3">
          <div className="flex gap-6">
            <EvidenceStat icon={<Camera size={16} className="text-blue-400" />} label="Citizen reports" value={h.report_count} />
            <EvidenceStat icon={<Cpu size={16} className="text-purple-400" />} label="Sensor readings" value={h.sensor_count} />
            <EvidenceStat icon={<Satellite size={16} className="text-orange-400" />} label="Satellite detections" value={h.satellite_count} />
          </div>
        </InfoCard>

        {h.recommended_resource && (
          <InfoCard title="Recommended Resource" className="mb-3">
            <div className="flex items-center gap-2">
              <Truck size={16} className="text-blue-400" />
              <span className="text-white">{h.recommended_resource}</span>
            </div>
          </InfoCard>
        )}

        {/* AI Tactical Plan Button */}
        <div className="mb-4">
          <button
            onClick={() => setShowTacticalPlan(true)}
            className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-purple-900/60 via-indigo-900/40 to-gray-800 border border-purple-500/40 hover:border-purple-400 rounded-xl text-white transition-all shadow-lg shadow-purple-900/20 group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 group-hover:scale-110 transition-transform">
                <Bot size={18} className="animate-pulse" />
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-purple-200 flex items-center gap-1.5">
                  🤖 Generate AI Tactical Dispatch Plan
                  <span className="text-[10px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-semibold uppercase">New</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Custom crew routing, wind dispersion & school alerts</p>
              </div>
            </div>
            <span className="text-xs font-semibold text-purple-300 bg-purple-500/20 px-3 py-1.5 rounded-lg border border-purple-500/30 group-hover:bg-purple-500/30 transition-colors">
              View Plan →
            </span>
          </button>
        </div>

        {h.evidence && h.evidence.length > 0 && (

          <InfoCard title={`Evidence (${h.evidence.length} items)`} className="mb-3">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {h.evidence.map(r => (
                <div key={r.id} className="flex items-start gap-3 p-2.5 bg-gray-700/50 rounded-lg">
                  {r.photo_url && (
                    <img src={r.photo_url} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-600 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm text-white">{r.description || "(no description)"}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {r.source} · {r.category} · severity {r.severity}/5 · confidence {(r.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </InfoCard>
        )}

        {/* Actions */}
        {h.status !== "resolved" && (
          <div className="flex gap-3 mt-4">
            {h.status === "active" && (
              <button onClick={() => onStatusUpdate(h.id, "acknowledged")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 font-medium border border-yellow-500/30 transition-colors">
                <CheckCircle size={15} /> Acknowledge
              </button>
            )}
            {(h.status === "active" || h.status === "acknowledged") && (
              <button onClick={() => onStatusUpdate(h.id, "dispatched")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-medium border border-blue-500/30 transition-colors">
                <Truck size={15} /> Dispatch Team
              </button>
            )}
            {h.status === "dispatched" && (
              <button onClick={() => onStatusUpdate(h.id, "resolved")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/20 hover:bg-green-500/30 text-green-300 font-medium border border-green-500/30 transition-colors">
                <CheckCircle size={15} /> Mark Resolved
              </button>
            )}
          </div>
        )}
        {h.status === "resolved" && (
          <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
            <CheckCircle size={16} className="text-green-400" />
            <span className="text-green-300 text-sm font-medium">This hotspot has been resolved.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("bg-gray-800 rounded-xl p-4 border border-gray-700", className)}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{title}</p>
      {children}
    </div>
  );
}

function EvidenceStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <div>
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-xs text-gray-400">{label}</p>
      </div>
    </div>
  );
}
