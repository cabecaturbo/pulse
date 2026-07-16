import type { Severity } from "@/lib/forecast/types";

/**
 * Broadsheet severity tones: ink on paper, no gradients. Strain warms
 * toward the pulse amber (never red); calm takes the cyan press ink.
 */
export function severityTone(severity: Severity): string {
  switch (severity) {
    case "storm":
      return "text-pulse-5";
    case "gathering":
      return "text-slate-500";
    default:
      return "text-press-deep";
  }
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case "storm":
      return "⛈ Storm";
    case "gathering":
      return "🌥 Gathering";
    default:
      return "☀️ Clear";
  }
}
