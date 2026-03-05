export const STATUS_OPTIONS = [
  { key: "abandoned", label: "Dropped", emoji: "🚫" },
  { key: "reading", label: "Reading", emoji: "📖" },
  { key: "finished", label: "Finished", emoji: "✅" },
];

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.key, o.label])
);

export const STATUS_EMOJI: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.key, o.emoji])
);
