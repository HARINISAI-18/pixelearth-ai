import clsx from "clsx";

const COLORS: Record<number, string> = {
  1: "bg-green-500/20 text-green-300 border-green-500/40",
  2: "bg-lime-500/20 text-lime-300 border-lime-500/40",
  3: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
  4: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  5: "bg-red-500/20 text-red-300 border-red-500/40",
};

const LABELS: Record<number, string> = {
  1: "Minimal",
  2: "Low",
  3: "Moderate",
  4: "High",
  5: "Extreme",
};

export function SeverityBadge({ severity, size = "sm" }: { severity: number; size?: "sm" | "lg" }) {
  const s = Math.max(1, Math.min(5, Math.round(severity)));
  return (
    <span className={clsx(
      "inline-flex items-center gap-1 rounded-full border font-semibold",
      COLORS[s],
      size === "lg" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"
    )}>
      <span className={clsx("rounded-full", size === "lg" ? "w-2 h-2" : "w-1.5 h-1.5",
        s <= 1 ? "bg-green-400" : s === 2 ? "bg-lime-400" : s === 3 ? "bg-yellow-400" : s === 4 ? "bg-orange-400" : "bg-red-400"
      )} />
      {LABELS[s]} ({s}/5)
    </span>
  );
}

export function severityColor(s: number): string {
  const m: Record<number, string> = { 1: "#22c55e", 2: "#84cc16", 3: "#eab308", 4: "#f97316", 5: "#ef4444" };
  return m[Math.max(1, Math.min(5, Math.round(s)))] ?? "#6b7280";
}
