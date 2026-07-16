import type { Severity } from "@/lib/forecast/types";

/** Ambient strain gradients: clear/calm -> gathering grey -> storm. */
export function ambientGradient(severity: Severity): string {
  switch (severity) {
    case "storm":
      return "linear-gradient(160deg, #1c2434 0%, #3a3021 55%, #4a3417 100%)";
    case "gathering":
      return "linear-gradient(160deg, #232b3a 0%, #3a4150 60%, #4b5264 100%)";
    default:
      return "linear-gradient(160deg, #0f2e33 0%, #12424a 55%, #145258 100%)";
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
