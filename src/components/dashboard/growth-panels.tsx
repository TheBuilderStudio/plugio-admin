import Link from "next/link";
import { AdminCard } from "@/components/ui/page-shell";
import { formatMinor } from "@/lib/utils";
import type { FunnelStep, RevenueSeries, Retention } from "@/lib/db/growth";

export function FunnelPanel({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(1, steps[0]?.count ?? 1);
  return (
    <AdminCard padded={false}>
      <div className="border-b border-(--line) px-5 py-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">From sign-in to paying</h2>
        <p className="text-[12.5px] text-(--ink-soft)">Share of the step before it.</p>
      </div>
      <ol className="divide-y divide-(--line)">
        {steps.map((s, i) => {
          const prev = i === 0 ? null : steps[i - 1].count;
          const pct = prev ? Math.round((s.count / prev) * 100) : null;
          const row = (
            <div className="grid grid-cols-[1fr_auto] items-center gap-3 px-5 py-2.5">
              <div className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[13.5px] text-(--ink)">{s.label}</span>
                  <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-(--ink)">
                    {s.count.toLocaleString()}
                    {pct !== null ? <span className="ml-2 text-[12px] font-normal text-(--ink-mute)">{pct}%</span> : null}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-black/5" aria-hidden>
                  <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(2, (s.count / top) * 100)}%` }} />
                </div>
              </div>
            </div>
          );
          return (
            <li key={s.key}>
              {s.href ? (
                <Link href={s.href} className="block transition hover:bg-(--subtle)">
                  {row}
                </Link>
              ) : (
                row
              )}
            </li>
          );
        })}
      </ol>
    </AdminCard>
  );
}

export function RevenuePanel({ series }: { series: RevenueSeries[] }) {
  return (
    <AdminCard padded={false}>
      <div className="border-b border-(--line) px-5 py-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Subscription revenue, last 30 days</h2>
        <p className="text-[12.5px] text-(--ink-soft)">Paid checkouts by day, per currency.</p>
      </div>
      {series.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-(--ink-mute)">No paid checkouts in the last 30 days.</p>
      ) : (
        <div className="divide-y divide-(--line)">
          {series.map((s) => {
            const max = Math.max(1, ...s.points.map((p) => p.value));
            const w = 300;
            const h = 56;
            const gap = 2;
            const bw = (w - gap * (s.points.length - 1)) / s.points.length;
            return (
              <div key={s.currency} className="px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">
                    {formatMinor(s.totalMinor, s.currency)}
                  </p>
                  <p className="text-[12px] text-(--ink-soft)">
                    {s.orders} paid order{s.orders === 1 ? "" : "s"} · {s.currency}
                  </p>
                </div>
                <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="mt-3 h-14 w-full" role="img" aria-label={`${s.currency} revenue per day`}>
                  {s.points.map((p, i) => {
                    const bh = p.value === 0 ? 1.5 : Math.max(3, (p.value / max) * (h - 2));
                    return (
                      <rect key={p.day} x={i * (bw + gap)} y={h - bh} width={bw} height={bh} rx={1.5} fill="#14110e" opacity={p.value === 0 ? 0.15 : 0.85}>
                        <title>{`${p.day}: ${formatMinor(p.value, s.currency)}`}</title>
                      </rect>
                    );
                  })}
                </svg>
              </div>
            );
          })}
        </div>
      )}
    </AdminCard>
  );
}

export function RetentionPanel({ r }: { r: Retention }) {
  const conv = r.trialsEnded30d > 0 ? Math.round((r.trialsConverted30d / r.trialsEnded30d) * 100) : null;
  const cells: { label: string; value: string; hint: string; href?: string; warn?: boolean }[] = [
    { label: "Paying now", value: String(r.paying), hint: "Creator and Pro", href: "/admin/users?filter=PAID" },
    { label: "On trial", value: String(r.trialing), hint: `${r.trialsEnding48h} ending in 2 days`, href: "/admin/users?filter=TRIAL_ENDING", warn: r.trialsEnding48h > 0 },
    {
      label: "Trial to paid (30 days)",
      value: conv === null ? "—" : `${conv}%`,
      hint: conv === null ? "No trials ended" : `${r.trialsConverted30d} of ${r.trialsEnded30d} trials ended`,
    },
    { label: "Lapsed (30 days)", value: String(r.lapsed30d), hint: `${r.expiredTotal} expired in total`, href: "/admin/users?filter=FREE", warn: r.lapsed30d > 0 },
  ];
  return (
    <AdminCard padded={false}>
      <div className="border-b border-(--line) px-5 py-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Keeping creators</h2>
        <p className="text-[12.5px] text-(--ink-soft)">Who pays, who decides soon, who left.</p>
      </div>
      <div className="grid grid-cols-2 gap-px bg-(--line) lg:grid-cols-4">
        {cells.map((c) => {
          const body = (
            <div className={`h-full bg-(--paper) px-5 py-4 ${c.warn ? "bg-amber-50/70" : ""}`}>
              <p className="text-[11px] font-medium text-(--ink-mute)">{c.label}</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">{c.value}</p>
              <p className="mt-0.5 text-[12px] text-(--ink-soft)">{c.hint}</p>
            </div>
          );
          return c.href ? (
            <Link key={c.label} href={c.href} className="block transition hover:opacity-90">
              {body}
            </Link>
          ) : (
            <div key={c.label}>{body}</div>
          );
        })}
      </div>
    </AdminCard>
  );
}
