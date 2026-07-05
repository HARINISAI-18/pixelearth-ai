import { useState } from "react";
import { Calculator, Shield, HeartPulse, Clock, Sparkles } from "lucide-react";

export default function RoiCalculator() {
  const [hoursSaved, setHoursSaved] = useState(14);
  const [hotspotCount, setHotspotCount] = useState(3);

  // Formulas for demo impact calculator
  const residentsProtected = hoursSaved * hotspotCount * 1450;
  const healthcareSavings = hoursSaved * hotspotCount * 850; // in INR/USD equivalent
  const erVisitsPrevented = Math.round(hoursSaved * hotspotCount * 1.8);

  return (
    <div className="mx-3 mb-3 p-3 bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950/40 border border-indigo-500/30 rounded-xl shadow-lg">
      <div className="flex items-center gap-2 mb-2.5 pb-2 border-b border-gray-800">
        <Calculator size={14} className="text-indigo-400" />
        <span className="text-xs font-bold text-white uppercase tracking-wider">Early Detection ROI Calculator</span>
        <span className="ml-auto text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold">
          Hackathon Impact
        </span>
      </div>

      {/* Sliders */}
      <div className="space-y-3 mb-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400 font-medium">Detection Advantage (vs. Complaints):</span>
            <span className="text-indigo-300 font-bold">{hoursSaved} hours earlier</span>
          </div>
          <input
            type="range"
            min="1"
            max="24"
            value={hoursSaved}
            onChange={(e) => setHoursSaved(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400 font-medium">Active Severe Hotspots Tracked:</span>
            <span className="text-purple-300 font-bold">{hotspotCount} zones</span>
          </div>
          <input
            type="range"
            min="1"
            max="10"
            value={hotspotCount}
            onChange={(e) => setHotspotCount(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
          />
        </div>
      </div>

      {/* Calculated Impact Cards */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800/80 border border-gray-700/80 p-2 rounded-lg">
          <Shield size={14} className="text-blue-400 mx-auto mb-1" />
          <p className="text-base font-black text-blue-400">{residentsProtected.toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Residents Protected</p>
        </div>

        <div className="bg-gray-800/80 border border-gray-700/80 p-2 rounded-lg">
          <HeartPulse size={14} className="text-rose-400 mx-auto mb-1" />
          <p className="text-base font-black text-rose-400">₹{(healthcareSavings * 80).toLocaleString()}</p>
          <p className="text-[10px] text-gray-400 leading-tight">Est. Health Savings</p>
        </div>

        <div className="bg-gray-800/80 border border-gray-700/80 p-2 rounded-lg">
          <Clock size={14} className="text-green-400 mx-auto mb-1" />
          <p className="text-base font-black text-green-400">~{erVisitsPrevented}</p>
          <p className="text-[10px] text-gray-400 leading-tight">ER Visits Avoided</p>
        </div>
      </div>
    </div>
  );
}
