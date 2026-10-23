import type { DailyPoint } from "@/lib/db/health";

/** Small bar chart for a daily series. Server-rendered SVG, no client JS; the table-free summary is in the title. */
export function TrendChart({ label, points = [], accent = "#ff6719" }: { label: string; points?: DailyPoint[]; accent?: string }) {
  const pts = points ?? [];
  const total = pts.reduce((s, p) => s + (p?.value ?? 0), 0);
  const last7 = pts.slice(-7).reduce((s, p) => s + (p?.value ?? 0), 0);
  const prev7 = pts.slice(-14, -7).reduce((s, p) => s + (p?.value ?? 0), 0);
  const max = Math.max(1, ...pts.map((p) => p?.value ?? 0));
  const w = 300;
  const h = 56;
  const gap = 2;
  const len = Math.max(1, pts.length);
  const bw = (w - gap * (len - 1)) / len;
  const delta = last7 - prev7;

  return (
    <div className="admin-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-medium text-(--ink-soft)">{label}</p>
        <p className="text-[11px] text-(--ink-mute)">30 days</p>
      </div>
      <p className="mt-1 text-[24px] font-semibold tabular-nums tracking-tight text-(--ink)">{total.toLocaleString()}</p>
      <p className="text-[12px] text-(--ink-soft)">
        {last7} in the last 7 days
        {prev7 > 0 || last7 > 0 ? (
          <span className={delta > 0 ? "text-emerald-700" : delta < 0 ? "text-red-700" : ""}>
            {" "}
            · {delta > 0 ? "+" : ""}
            {delta} vs the week before
          </span>
        ) : null}
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-14 w-full" role="img" aria-label={`${label}: ${total} in 30 days`} preserveAspectRatio="none">
        {points.map((p, i) => {
          const bh = p.value === 0 ? 1.5 : Math.max(3, (p.value / max) * (h - 2));
          return (
            <rect key={p.day} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={1.5} fill={accent} opacity={p.value === 0 ? 0.18 : 0.9}>
              <title>{`${p.day}: ${p.value}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}
