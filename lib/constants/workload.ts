/** 1 = weakest (green), 2 = medium (blue), 3 = hardest (red) — cards + calendar */

export const WORKLOAD_LEVELS = [1, 2, 3] as const;
export type WorkloadLevel = (typeof WORKLOAD_LEVELS)[number];

export function isWorkloadLevel(n: number): n is WorkloadLevel {
  return n === 1 || n === 2 || n === 3;
}

export function clampWorkload(n: number): WorkloadLevel {
  if (n <= 1) return 1;
  if (n >= 3) return 3;
  return 2;
}

/** Distinct green / blue / red system — shared across Dashboard, To-Do, Calendar */
export const workloadVisual = {
  1: {
    label: "Weakest",
    ring: "ring-emerald-400/70",
    border: "border-emerald-400/90",
    glow: "shadow-[0_0_0_1px_rgba(16,185,129,0.35),0_8px_28px_-10px_rgba(16,185,129,0.45)]",
    bg: "bg-emerald-50/95",
    dot: "bg-emerald-500",
    fcBg: "#d1fae5",
    fcBorder: "#10b981",
    fcText: "#065f46",
  },
  2: {
    label: "Medium",
    ring: "ring-blue-400/70",
    border: "border-blue-400/90",
    glow: "shadow-[0_0_0_1px_rgba(59,130,246,0.35),0_8px_28px_-10px_rgba(59,130,246,0.4)]",
    bg: "bg-blue-50/95",
    dot: "bg-blue-500",
    fcBg: "#dbeafe",
    fcBorder: "#3b82f6",
    fcText: "#1e40af",
  },
  3: {
    label: "Hardest",
    ring: "ring-red-400/80",
    border: "border-red-400/95",
    glow: "shadow-[0_0_0_1px_rgba(239,68,68,0.4),0_10px_32px_-10px_rgba(239,68,68,0.45)]",
    bg: "bg-red-50/95",
    dot: "bg-red-600",
    fcBg: "#fecaca",
    fcBorder: "#ef4444",
    fcText: "#991b1b",
  },
} as const;

export function defaultEventDurationHours(workload: WorkloadLevel): number {
  return workload >= 3 ? 2 : 1;
}
