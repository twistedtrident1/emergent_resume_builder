// Time-of-day heuristic for "you might be forgetting" suggestions.
// Each bucket has 4-5 essentials. We surface up to 3 that the user hasn't
// already added as a recurring task.

export type TimeBucket = "morning" | "afternoon" | "evening" | "late";

export function getTimeBucket(d: Date = new Date()): TimeBucket {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 18) return "afternoon";
  if (h >= 18 && h < 24) return "evening";
  return "late";
}

const ESSENTIALS: Record<TimeBucket, string[]> = {
  morning: [
    "Drink a glass of water",
    "Take morning medication",
    "Brush teeth",
    "Eat breakfast",
    "Get dressed",
  ],
  afternoon: [
    "Drink water (mid-day)",
    "Eat a real meal",
    "Take a 5-minute break",
    "Step outside for fresh air",
    "10-minute walk outside",
  ],
  evening: [
    "Take evening medication",
    "Brush teeth",
    "Set out clothes for tomorrow",
    "Plug in the phone away from bed",
    "Lights out by 11 pm",
  ],
  late: [],
};

const BUCKET_LABELS: Record<TimeBucket, string> = {
  morning: "morning routine",
  afternoon: "midday boost",
  evening: "evening wind-down",
  late: "late-night",
};

export function getForgottenSuggestions(
  existingTitles: string[],
  bucket: TimeBucket = getTimeBucket(),
  limit = 3
): { bucket: TimeBucket; label: string; items: string[] } {
  const have = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  const pool = ESSENTIALS[bucket] ?? [];
  const items: string[] = [];
  for (const s of pool) {
    if (!have.has(s.toLowerCase())) {
      items.push(s);
      if (items.length >= limit) break;
    }
  }
  return { bucket, label: BUCKET_LABELS[bucket], items };
}
