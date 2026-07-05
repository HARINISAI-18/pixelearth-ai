import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Truck, CheckCircle, X, Bot } from "lucide-react";
import type { Hotspot } from "../types";
import { SeverityBadge } from "./SeverityBadge";
import TacticalPlanModal from "./TacticalPlanModal";
import { api } from "../api";
import clsx from "clsx";
import EvidenceChain from "./EvidenceChain";


interface Props {
  hotspot: Hotspot;
  onClose: () => void;
  onUpdated: () => void;
  isMunicipal?: boolean;
}

const TREND_ICON = {
  worsening: <TrendingUp size={14} className="text-red-400" />,
  stable: <Minus size={14} className="text-yellow-400" />,
  improving: <TrendingDown size={14} className="text-green-400" />,
};

const TREND_TEXT = {
  worsening: "text-red-400",
  stable: "text-yellow-400",
  improving: "text-green-400",
};

const STATUS_STYLES: Record<string, string> = {
  active: "bg-red-500/20 text-red-300 border-red-500/40",
  acknowledged: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  dispatched: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  resolved: "bg-green-500/20 text-green-300 border-green-500/40",
};

export default function HotspotPopup({ hotspot: initial, onClose, onUpdated, isMunicipal }: Props) {
  const [hotspot, setHotspot] = useState(initial);
  const [updating, setUpdating] = useState(false);
  const [evidence, setEvidence] = useState<typeof initial.evidence>(initial.evidence);
  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [showTacticalPlan, setShowTacticalPlan] = useState(false);

  async function loadEvidence() {
    if (evidence) return;
    setLoadingEvidence(true);
    try {
      const full = await api.getHotspot(hotspot.id);
      setEvidence(full.evidence);
    } finally {
      setLoadingEvidence(false);
    }
  }

  async function updateStatus(status: string) {
    setUpdating(true);
    try {
      const updated = await api.updateHotspotStatus(hotspot.id, status, "Officer");
      setHotspot(updated);
      onUpdated();
    } finally {
      setUpdating(false);
    }
  }

  const trend = hotspot.forecast_trend ?? "stable";

  return (
    <div className="w-80 text-sm relative" onClick={loadEvidence}>
      {showTacticalPlan && (
        <TacticalPlanModal
          hotspotId={hotspot.id}
          onClose={() => setShowTacticalPlan(false)}
          onExecute={() => updateStatus("dispatched")}
        />
      )}
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-bold text-white text-base capitalize">{hotspot.category} Hotspot</p>
          <p className="text-gray-400 text-xs mt-0.5">
            {hotspot.center_lat.toFixed(4)}, {hotspot.center_lon.toFixed(4)}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white -mt-1 -mr-1">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <SeverityBadge severity={hotspot.severity_score} />
        <span className={clsx("text-xs border rounded-full px-2 py-0.5 font-medium capitalize", STATUS_STYLES[hotspot.status])}>
          {hotspot.status}
        </span>
      </div>

      {/* Evidence chain — the core value proposition */}
      <div className="mb-3">
        <EvidenceChain hotspot={hotspot} evidence={evidence} />
      </div>

      {/* Forecast */}
      <div className="bg-gray-800/60 rounded-lg p-2.5 mb-3">
        <p className="text-gray-400 text-xs font-medium mb-1.5">24-Hour Forecast</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {TREND_ICON[trend]}
            <span className={clsx("text-xs font-semibold capitalize", TREND_TEXT[trend])}>{trend}</span>
          </div>
          <div className="text-xs text-gray-400">
            Predicted severity: <span className="text-white font-semibold">{hotspot.forecast_score?.toFixed(1)}/5</span>
          </div>
        </div>
      </div>

      {/* Resource recommendation */}
      {hotspot.recommended_resource && (
        <div className="flex items-start gap-2 mb-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5">
          <Truck size={13} className="text-blue-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-blue-300">Recommended Resource</p>
            <p className="text-xs text-gray-300 mt-0.5">{hotspot.recommended_resource}</p>
          </div>
        </div>
      )}

      {/* AI Tactical Plan Button */}
      <div className="mb-3">
        <button
          onClick={(e) => { e.stopPropagation(); setShowTacticalPlan(true); }}
          className="w-full flex items-center justify-between p-2.5 bg-gradient-to-r from-purple-900/80 to-indigo-900/60 border border-purple-500/40 hover:border-purple-400 rounded-lg text-white transition-all shadow group"
        >
          <div className="flex items-center gap-2">
            <Bot size={15} className="text-purple-300 animate-pulse shrink-0" />
            <span className="font-bold text-xs text-purple-200">🤖 AI Tactical Dispatch Plan</span>
          </div>
          <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
            View →
          </span>
        </button>
      </div>

      {/* Evidence photos */}
      {loadingEvidence && <p className="text-xs text-gray-500 mb-2">Loading evidence…</p>}
      {evidence && evidence.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-400 font-medium mb-1.5">Evidence</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {evidence.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-start gap-2 bg-gray-800/50 rounded p-2">
                {r.photo_url && (
                  <img src={r.photo_url} alt="evidence" className="w-10 h-10 rounded object-cover shrink-0 border border-gray-700" />
                )}
                <div className="min-w-0">
                  <p className="text-xs text-gray-300 truncate">{r.description || "(no description)"}</p>
                  <p className="text-xs text-gray-500">{r.source} · sev {r.severity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Municipal actions */}
      {isMunicipal && hotspot.status !== "resolved" && (
        <div className="flex gap-2 mt-2">
          {hotspot.status === "active" && (
            <button
              onClick={() => updateStatus("acknowledged")}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 text-xs font-medium border border-yellow-500/30 transition-colors disabled:opacity-50"
            >
              <CheckCircle size={12} /> Acknowledge
            </button>
          )}
          {(hotspot.status === "active" || hotspot.status === "acknowledged") && (
            <button
              onClick={() => updateStatus("dispatched")}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-xs font-medium border border-blue-500/30 transition-colors disabled:opacity-50"
            >
              <Truck size={12} /> Dispatch
            </button>
          )}
          {hotspot.status === "dispatched" && (
            <button
              onClick={() => updateStatus("resolved")}
              disabled={updating}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-300 text-xs font-medium border border-green-500/30 transition-colors disabled:opacity-50"
            >
              <CheckCircle size={12} /> Resolve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
