// lib/networkColors.ts
// Single source of truth for network colors — import this in dashboard, users, plans pages

export const NETWORK_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  MTN:       { color: "#FACC15", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.25)" },
  GLO:       { color: "#22C55E", bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.25)"  },
  AIRTEL:    { color: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.25)"  },
  "9MOBILE": { color: "#53E6D4", bg: "rgba(83,230,212,0.10)",  border: "rgba(83,230,212,0.25)" },
  UNKNOWN:   { color: "#888",    bg: "rgba(136,136,136,0.08)", border: "rgba(136,136,136,0.15)"},
};

// Normalize raw network value from DB to display key
export function normalizeNetwork(raw: string | null | undefined): string {
  if (!raw) return "UNKNOWN";
  const val = raw.trim().toUpperCase();
  // Handle legacy values just in case SQL update hasn't run yet
  if (val === "MTN")      return "MTN";
  if (val === "GLO")      return "GLO";
  if (val === "AIRTEL" || val === "02") return "AIRTEL";
  if (val === "9MOBILE" || val === "01" || val === "1") return "9MOBILE";
  return "UNKNOWN";
}

export function getNetworkColor(raw: string | null | undefined) {
  const key = normalizeNetwork(raw);
  return NETWORK_COLORS[key] ?? NETWORK_COLORS["UNKNOWN"];
}