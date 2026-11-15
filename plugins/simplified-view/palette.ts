/** Per-thread color for the user's bubbles in a simplified thread. */
export const BUBBLE_COLORS = [
  { id: "blue", label: "Blue", value: "oklch(0.62 0.16 252)" },
  { id: "teal", label: "Teal", value: "oklch(0.66 0.11 190)" },
  { id: "green", label: "Green", value: "oklch(0.66 0.15 148)" },
  { id: "lime", label: "Lime", value: "oklch(0.8 0.18 128)" },
  { id: "yellow", label: "Yellow", value: "oklch(0.8 0.15 90)" },
  { id: "orange", label: "Orange", value: "oklch(0.7 0.16 52)" },
  { id: "pink", label: "Pink", value: "oklch(0.68 0.18 355)" },
  { id: "purple", label: "Purple", value: "oklch(0.6 0.17 300)" },
] as const;

export const COLOR_KEY = "color";

export function colorValue(id: unknown): string | null {
  return BUBBLE_COLORS.find((c) => c.id === id)?.value ?? null;
}

/** Text color on a filled bubble: dark on the light fills, white otherwise. */
export function colorInk(value: string): string {
  const lightness = Number(/oklch\(([\d.]+)/.exec(value)?.[1] ?? 0);
  return lightness >= 0.75 ? "oklch(0.2 0 0)" : "oklch(1 0 0)";
}
