export type KpiCardProps = {
  title: string;
  value: string;
  subtext?: string;
  tone?: "neutral" | "good" | "warn" | "bad";
  onClick?: () => void;
};

export function KpiCard({ title, value, subtext, tone = "neutral", onClick }: KpiCardProps) {
  const valueColor =
    tone === "good"
      ? "text-emerald-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "bad"
          ? "text-red-700"
          : "text-zinc-900";

  const clickable = typeof onClick === "function";

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={`rounded-xl border border-zinc-200 bg-white p-4 shadow-sm ${
        clickable ? "cursor-pointer hover:bg-zinc-50" : ""
      }`}
    >
      <div className="text-xs font-medium text-zinc-500">{title}</div>
      <div className={`mt-2 break-words text-xl font-semibold leading-tight sm:text-2xl ${valueColor}`}>
        {value}
      </div>
      {subtext ? <div className="mt-1 text-xs text-zinc-500">{subtext}</div> : null}
    </div>
  );
}
