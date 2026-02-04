export type StatusBadgeProps = {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad";
};

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const badgeClass =
    tone === "good"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800"
        : tone === "bad"
          ? "bg-red-100 text-red-800"
          : "bg-zinc-100 text-zinc-700";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}
    >
      {label}
    </span>
  );
}
