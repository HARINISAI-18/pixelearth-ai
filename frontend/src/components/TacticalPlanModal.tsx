import { useEffect, useState } from "react";
import { Bot, ShieldCheck, Users, Truck, CheckCircle2, X, Sparkles, ArrowRight, Clock } from "lucide-react";
import { api } from "../api";
import type { TacticalPlan } from "../types";

interface Props {
  hotspotId: number;
  onClose: () => void;
  onExecute: () => void;
}

export default function TacticalPlanModal({ hotspotId, onClose, onExecute }: Props) {
  const [plan, setPlan] = useState<TacticalPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    api.getTacticalPlan(hotspotId)
      .then(res => {
        if (mounted) setPlan(res);
      })
      .catch(err => {
        if (mounted) setError(err.message || "Failed to generate AI tactical plan");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [hotspotId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="w-full max-w-2xl bg-gray-900 border border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-900/60 via-gray-900 to-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300">
              <Bot size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">AI Tactical Dispatch Plan</h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles size={10} /> Claude AI Generated
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">Custom action steps for Hotspot #{hotspotId} factoring wind drift & demographics</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <Bot size={36} className="text-purple-400 animate-bounce mx-auto" />
              <p className="text-sm font-medium text-white">Analyzing wind vector, nearby schools, and sensor corroboration…</p>
              <p className="text-xs text-gray-500">Synthesizing tactical dispatch guidelines</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          {plan && !loading && (
            <>
              {/* Top Metrics Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                    <ShieldCheck size={14} className="text-green-400" />
                    <span>Citizen Trust Index</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-green-400">{plan.trust_index}%</span>
                    <span className="text-[10px] text-green-500 font-semibold uppercase">High Trust</span>
                  </div>
                  <div className="w-full bg-gray-700 h-1 rounded-full mt-2 overflow-hidden">
                    <div className="bg-green-400 h-full rounded-full" style={{ width: `${plan.trust_index}%` }} />
                  </div>
                </div>

                <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                    <Users size={14} className="text-blue-400" />
                    <span>Exposure Prevented</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-blue-400">~{plan.estimated_exposure_prevented.toLocaleString()}</span>
                    <span className="text-xs text-gray-400">residents</span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">Within 1.5km downwind radius</p>
                </div>

                <div className="bg-gray-800/80 border border-gray-700/80 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium mb-1">
                    <Truck size={14} className="text-purple-400" />
                    <span>Resource Required</span>
                  </div>
                  <p className="text-xs font-bold text-white leading-tight mt-1">{plan.recommended_resource}</p>
                  <p className="text-[10px] text-purple-400/80 mt-1 flex items-center gap-0.5">
                    <Clock size={9} /> Est. arrival &lt; 25 mins
                  </p>
                </div>
              </div>

              {/* Corroboration Summary */}
              <div className="p-3 bg-purple-950/20 border border-purple-500/30 rounded-xl flex items-start gap-2.5">
                <Sparkles size={16} className="text-purple-400 shrink-0 mt-0.5" />
                <p className="text-xs text-purple-200 leading-relaxed font-medium">
                  {plan.corroboration_summary}
                </p>
              </div>

              {/* Tactical Steps List */}
              <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2.5">
                  Recommended Tactical Action Plan
                </h4>
                <div className="space-y-2.5">
                  {plan.tactical_steps.map((step, idx) => {
                    const [title, ...rest] = step.split(": ");
                    const content = rest.join(": ");
                    return (
                      <div key={idx} className="p-3 bg-gray-800/60 border border-gray-700 rounded-xl flex items-start gap-3 hover:border-gray-600 transition-colors">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="text-xs">
                          <p className="font-bold text-white text-sm">{title}</p>
                          <p className="text-gray-300 mt-0.5 leading-relaxed">{content || title}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-800/80 border-t border-gray-800 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Advisory plan generated by AI intelligence layer. Officer confirmation required.
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => { onExecute(); onClose(); }}
              disabled={loading || !plan}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
            >
              <span>🚀 Execute & Dispatch Plan</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
