import { useState } from "react";
import { Play, Flame, Car, Trash2, Bell, ShieldAlert, CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";
import { api } from "../api";

interface Props {
  onScenarioTriggered: () => void;
}

export default function DemoController({ onScenarioTriggered }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play a synthesized alert chime using Web Audio API so no audio file is needed!
  function playAlertChime(isCritical: boolean) {
    if (!soundEnabled || typeof window === "undefined") return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isCritical) {
        // Warning siren pulse
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.6);
      } else {
        // Soft notification bell
        osc.type = "sine";
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.error("Audio chime error:", e);
    }
  }

  async function trigger(scenario: string, isCritical = false) {
    setLoading(true);
    setLastMessage(null);
    try {
      const res = await api.triggerScenario(scenario);
      setLastMessage(res.message);
      playAlertChime(isCritical);
      onScenarioTriggered();
    } catch (err: any) {
      setLastMessage("Error: " + (err.message || "Failed to trigger"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      {/* Toast notification */}
      {lastMessage && (
        <div className="mb-2 px-3 py-2 bg-gray-900 border border-orange-500/50 rounded-lg shadow-2xl flex items-center gap-2 text-xs text-orange-200 animate-bounce">
          <CheckCircle2 size={14} className="text-orange-400 shrink-0" />
          <span>{lastMessage}</span>
          <button onClick={() => setLastMessage(null)} className="ml-1 text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Expanded control panel */}
      {open && (
        <div className="mb-2 w-72 bg-gray-900/95 backdrop-blur-md border border-orange-500/40 rounded-xl shadow-2xl p-3 text-white overflow-hidden transition-all">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-2.5">
            <div className="flex items-center gap-1.5 font-bold text-xs text-orange-400 uppercase tracking-wider">
              <Play size={13} className="fill-orange-400" />
              <span>Hackathon Story Mode</span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute alert chime" : "Unmute alert chime"}
              className={`p-1 rounded text-xs transition-colors ${soundEnabled ? "text-green-400 bg-green-500/10" : "text-gray-500 bg-gray-800"}`}
            >
              <Bell size={12} />
            </button>
          </div>

          <p className="text-[11px] text-gray-400 mb-2.5 leading-relaxed">
            Instantly inject simulated real-time events to demonstrate automatic clustering & alerts during your pitch.
          </p>

          <div className="space-y-1.5">
            <button
              onClick={() => trigger("dump_fire", true)}
              disabled={loading}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-200 text-xs font-semibold transition-colors disabled:opacity-50 text-left"
            >
              <Flame size={15} className="text-red-400 shrink-0 animate-pulse" />
              <div>
                <div>🔥 Dump Fire Flare-Up</div>
                <div className="text-[10px] text-red-300/70 font-normal">3x citizen reports + NASA thermal hit</div>
              </div>
            </button>

            <button
              onClick={() => trigger("rush_hour_smog", false)}
              disabled={loading}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-200 text-xs font-semibold transition-colors disabled:opacity-50 text-left"
            >
              <Car size={15} className="text-yellow-400 shrink-0" />
              <div>
                <div>🚗 Rush Hour Traffic Smog</div>
                <div className="text-[10px] text-yellow-300/70 font-normal">Anna Salai junction dust & NO2 spike</div>
              </div>
            </button>

            <button
              onClick={() => trigger("clear_recent", false)}
              disabled={loading}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-colors disabled:opacity-50 text-left mt-2 border border-gray-700"
            >
              <Trash2 size={13} className="text-gray-400 shrink-0" />
              <span>Reset / Clear Recent Reports</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating trigger badge */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-500 hover:to-red-500 text-white font-bold text-xs rounded-full shadow-lg hover:shadow-orange-500/25 border border-orange-400/30 transition-all transform hover:-translate-y-0.5"
      >
        <ShieldAlert size={15} className="animate-pulse" />
        <span>🎬 Story Mode</span>
        {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>
    </div>
  );
}
