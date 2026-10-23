import Link from "next/link";
import { AlertTriangle, ArrowRight, Banknote, Download, Landmark, ShieldCheck, Store, Users } from "lucide-react";
import { AdminCard } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import type { MoneyCreatorPage, MoneyOverview, MoneySource, MoneyTotals } from "@/lib/store-api";
import { formatMinor } from "@/lib/utils";

const inr = (minor: number) => formatMinor(minor, "INR");
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);

/** Colours used for the same four things everywhere on this page. */
const C = {
  creators: { bar: "bg-emerald-500", text: "text-emerald-700", soft: "bg-emerald-50 border-emerald-200" },
  plugio: { bar: "bg-orange-500", text: "text-orange-700", soft: "bg-orange-50 border-orange-200" },
  gateway: { bar: "bg-sky-500", text: "text-sky-700", soft: "bg-sky-50 border-sky-200" },
  refund: { bar: "bg-rose-400", text: "text-rose-700", soft: "bg-rose-50 border-rose-200" },
  waiting: { bar: "bg-amber-400", text: "text-amber-800", soft: "bg-amber-50 border-amber-200" },
} as const;

/**
 * Where every rupee customers paid went, for one date range: to creators, to Plugio, to the payment gateway, or back to
 * customers as refunds. Razorpay never pays creators: it settles to Plugio, and Plugio pays creators through payouts.
 */
export function MoneyView({ overview, creators, filters }: {
  overview: MoneyOverview;
  creators: MoneyCreatorPage | null;
  filters: { from?: string; to?: string; source?: MoneySource };
}) {
  const t = overview.total;
  const g = overview.gateway;
  const keep = { from: filters.from, to: filters.to, source: filters.source };

  return (
    <div className="space-y-5">
      <RangeBar overview={overview} filters={filters} />

      {t.saleCount === 0 && t.grossMinor === 0 ? (
        <AdminCard>
          <EmptyState icon={Store} title="No creator sales in this range" description="Pick a wider range, or another source." />
        </AdminCard>
      ) : (
        <>
          <WhereItWent t={t} />
          <FlowCards overview={overview} />
          <GatewayCard g={g} />
          <SourceTable overview={overview} />
        </>
      )}

      <Liabilities overview={overview} />

      <AdminCard padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <div>
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-(--ink)"><Users className="size-4" /> By creator</h3>
            <p className="text-[12px] text-(--ink-soft)">Biggest first. Open one for the full statement.</p>
          </div>
          <a
            href={`/api/export/report/money-by-creator?${new URLSearchParams(cleanParams(keep)).toString()}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) px-3 py-1.5 text-[12.5px] font-semibold text-(--ink) hover:bg-(--hover)"
          >
            <Download className="size-3.5" /> Download CSV
          </a>
        </div>
        {!creators || creators.rows.length === 0 ? (
          <EmptyState icon={Users} title="No creators in this range" description="Creators with sales or refunds in the range appear here." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th className="text-right">Sales</th>
                    <th className="text-right">Customers paid</th>
                    <th className="text-right">Refunded</th>
                    <th className="text-right">Gateway charge</th>
                    <th className="text-right">Plugio fee</th>
                    <th className="text-right">Creator earned</th>
                    <th className="text-right">Paid out</th>
                    <th className="text-right">Owed now</th>
                  </tr>
                </thead>
                <tbody>
                  {creators.rows.map((r) => (
                    <tr key={r.sellerId}>
                      <td>
                        <Link href={`/admin/store/seller/${r.sellerId}`} className="font-semibold hover:underline">{r.name ?? "—"}</Link>
                        <p className="text-[11.5px] text-(--ink-mute)">{r.email}</p>
                      </td>
                      <td className="text-right tabular-nums">{r.saleCount}</td>
                      <td className="text-right tabular-nums">{inr(r.grossMinor)}</td>
                      <td className="text-right tabular-nums text-rose-700">{r.refundedMinor > 0 ? `−${inr(r.refundedMinor)}` : "—"}</td>
                      <td className="text-right tabular-nums text-sky-700">{inr(r.gatewayChargedMinor)}</td>
                      <td className="text-right tabular-nums text-orange-700">{inr(r.platformFeeMinor)}</td>
                      <td className="text-right font-semibold tabular-nums text-emerald-700">{inr(r.creatorNetMinor)}</td>
                      <td className="text-right tabular-nums">
                        {inr(r.paidOutMinor)}
                        {r.inReviewMinor > 0 && <p className="text-[11px] text-amber-700">{inr(r.inReviewMinor)} in review</p>}
                      </td>
                      <td className={`text-right tabular-nums ${r.balanceNowMinor < 0 ? "text-red-700" : ""}`}>{inr(r.balanceNowMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              currentPage={creators.page + 1}
              totalPages={creators.totalPages}
              total={creators.total}
              pageSize={50}
              baseUrl="/admin/store"
              searchParams={{ tab: "money", ...cleanParams(keep) }}
            />
          </>
        )}
      </AdminCard>

      <HowToRead />
    </div>
  );
}

function cleanParams(p: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string>;
}

// ───────────────────────── date range and source ─────────────────────────

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function RangeBar({ overview, filters }: { overview: MoneyOverview; filters: { from?: string; to?: string; source?: MoneySource } }) {
  const today = new Date();
  const preset = (days: number) => {
    const from = new Date(today.getTime() - days * 86_400_000);
    return `/admin/store?${new URLSearchParams(cleanParams({ tab: "money", from: isoDay(from), to: isoDay(today), source: filters.source })).toString()}`;
  };
  const shownFrom = filters.from ?? overview.from.slice(0, 10);
  const shownTo = filters.to ?? overview.to.slice(0, 10);

  return (
    <AdminCard>
      <form method="get" className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value="money" />
        <label className="flex flex-col gap-1 text-[12px] font-medium text-(--ink-mute)">
          From <input type="date" name="from" defaultValue={filters.from ?? ""} className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-(--ink-mute)">
          To <input type="date" name="to" defaultValue={filters.to ?? ""} className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-(--ink-mute)">
          Source
          <select name="source" defaultValue={filters.source ?? ""} className="admin-input">
            <option value="">Digital products and bookings</option>
            <option value="STORE">Digital products only</option>
            <option value="BOOKING">Bookings only</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-(--ink) px-3.5 py-2 text-[13px] font-semibold text-white">Apply</button>
        <div className="flex gap-1.5 pb-0.5 text-[12px]">
          {[7, 30, 90].map((d) => (
            <Link key={d} href={preset(d)} className="rounded-lg border border-(--line) px-2.5 py-1.5 font-semibold text-(--ink-soft) hover:text-(--ink)">
              Last {d} days
            </Link>
          ))}
        </div>
      </form>
      <p className="mt-2 text-[12px] text-(--ink-soft)">{shownFrom} to {shownTo} (UTC). Refunds count on the day they happen.</p>
    </AdminCard>
  );
}

// ───────────────────────── 1. where it went ─────────────────────────

function WhereItWent({ t }: { t: MoneyTotals }) {
  const parts = [
    { key: "creators", label: "Creators earned", value: t.creatorNetMinor, c: C.creators },
    { key: "plugio", label: "Plugio platform fee", value: t.platformFeeMinor, c: C.plugio },
    { key: "gateway", label: "Payment gateway (Razorpay)", value: t.gatewayChargedMinor, c: C.gateway },
    { key: "refund", label: "Refunded to customers", value: t.refundedMinor, c: C.refund },
  ];
  return (
    <AdminCard>
      <div className="space-y-4">
        <div>
          <p className="text-[12px] font-medium text-(--ink-mute)">Customers paid</p>
          <p className="mt-1 text-[30px] font-semibold tabular-nums tracking-tight text-(--ink)">{inr(t.grossMinor)}</p>
          <p className="text-[12px] text-(--ink-soft)">{t.saleCount} sale{t.saleCount === 1 ? "" : "s"}</p>
        </div>
        <div className="flex h-9 w-full overflow-hidden rounded-xl bg-stone-100" role="img"
          aria-label={parts.map((p) => `${p.label} ${inr(p.value)}`).join(", ")}>
          {parts.map((p) => p.value > 0 && (
            <div key={p.key} title={`${p.label}: ${inr(p.value)}`} style={{ width: `${Math.max(pct(p.value, t.grossMinor), 1.5)}%` }}
              className={`${p.c.bar} flex items-center justify-center overflow-hidden text-[11px] font-bold text-white`}>
              {pct(p.value, t.grossMinor) >= 9 ? `${pct(p.value, t.grossMinor)}%` : ""}
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {parts.map((p) => (
            <div key={p.key} className={`rounded-xl border p-3.5 ${p.c.soft}`}>
              <p className="flex items-center gap-1.5 text-[12px] font-medium text-(--ink-mute)">
                <span className={`size-2 rounded-full ${p.c.bar}`} /> {p.label}
              </p>
              <p className={`mt-1 text-[20px] font-semibold tabular-nums ${p.c.text}`}>{inr(p.value)}</p>
              <p className="text-[11.5px] text-(--ink-soft)">{pct(p.value, t.grossMinor)}% of sales</p>
            </div>
          ))}
        </div>
      </div>
    </AdminCard>
  );
}

// ───────────────────────── 2. the flow ─────────────────────────

function FlowCards({ overview }: { overview: MoneyOverview }) {
  const t = overview.total;
  const g = overview.gateway;
  const settled = t.grossMinor - t.refundedMinor - g.actualFeeMinor;
  const steps = [
    { icon: Users, title: "Customers pay", amount: inr(t.grossMinor), note: "Razorpay checkout" },
    {
      icon: Banknote, title: "Razorpay settles to Plugio", amount: g.complete ? inr(settled) : `${inr(settled)}*`,
      note: `After refunds and Razorpay's ${inr(g.actualFeeMinor)} fee`,
    },
    { icon: Landmark, title: "Plugio pays creators", amount: inr(overview.payouts.paidMinor), note: `${overview.payouts.paidCount} payout${overview.payouts.paidCount === 1 ? "" : "s"}` },
  ];
  return (
    <AdminCard>
      <h3 className="mb-3 text-[14px] font-semibold text-(--ink)">How the money moves</h3>
      <ol className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        {steps.flatMap((s, i) => {
          const Icon = s.icon;
          const card = (
            <li key={s.title} className="rounded-xl border border-(--line) bg-(--paper) p-4">
              <p className="flex items-center gap-2 text-[12px] font-semibold text-(--ink-soft)"><Icon className="size-4 text-orange-600" /> {s.title}</p>
              <p className="mt-1 text-[20px] font-semibold tabular-nums text-(--ink)">{s.amount}</p>
              <p className="text-[11.5px] text-(--ink-soft)">{s.note}</p>
            </li>
          );
          return i < steps.length - 1
            ? [card, <li key={`a${i}`} aria-hidden className="hidden items-center md:flex"><ArrowRight className="size-5 text-stone-300" /></li>]
            : [card];
        })}
      </ol>
      {!g.complete && (
        <p className="mt-3 text-[11.5px] text-(--ink-mute)">* Not final: {g.paymentsWithoutFee} payment{g.paymentsWithoutFee === 1 ? "" : "s"} still waiting for Razorpay&apos;s fee.</p>
      )}
    </AdminCard>
  );
}

// ───────────────────────── 3. the gateway, charged vs actual ─────────────────────────

function GatewayCard({ g }: { g: MoneyOverview["gateway"] }) {
  const covering = g.marginMinor < 0;
  return (
    <AdminCard>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-(--ink)">Payment gateway</h3>
          {g.complete
            ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700"><ShieldCheck className="size-3.5" /> Complete</span>
            : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800"><AlertTriangle className="size-3.5" /> {g.paymentsWithoutFee} waiting for fee</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className={`rounded-xl border p-3.5 ${C.gateway.soft}`}>
            <p className="text-[12px] font-medium text-(--ink-mute)">Charged to creators</p>
            <p className={`mt-1 text-[20px] font-semibold tabular-nums ${C.gateway.text}`}>{inr(g.chargedToCreatorsMinor)}</p>
            <p className="text-[11.5px] text-(--ink-soft)">Gateway rate, after refunds</p>
          </div>
          <div className="rounded-xl border border-(--line) bg-(--paper) p-3.5">
            <p className="text-[12px] font-medium text-(--ink-mute)">Razorpay actually charged Plugio</p>
            <p className="mt-1 text-[20px] font-semibold tabular-nums text-(--ink)">{inr(g.actualFeeMinor)}</p>
            <p className="text-[11.5px] text-(--ink-soft)">Includes {inr(g.actualTaxMinor)} GST</p>
          </div>
          <div className={`rounded-xl border p-3.5 ${covering ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}>
            <p className="text-[12px] font-medium text-(--ink-mute)">{covering ? "Plugio is covering" : "Left over for Plugio"}</p>
            <p className={`mt-1 text-[20px] font-semibold tabular-nums ${covering ? "text-red-700" : "text-emerald-700"}`}>{inr(Math.abs(g.marginMinor))}</p>
            <p className="text-[11.5px] text-(--ink-soft)">{covering ? "Consider raising the gateway rate." : "Creators paid more than Razorpay charged."}{g.complete ? "" : " Partial."}</p>
          </div>
        </div>
      </div>
    </AdminCard>
  );
}

// ───────────────────────── 4. product vs session ─────────────────────────

function SourceTable({ overview }: { overview: MoneyOverview }) {
  const rows: [string, MoneyTotals][] = [
    ["Digital products", overview.store],
    ["Bookings", overview.booking],
    ["Total", overview.total],
  ];
  return (
    <AdminCard padded={false}>
      <div className="px-4 pt-4">
        <h3 className="text-[14px] font-semibold text-(--ink)">Digital products and bookings</h3>
        <p className="text-[12px] text-(--ink-soft)">Paid − refunds − gateway − Plugio fee = creator earned.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr><th>Source</th><th className="text-right">Sales</th><th className="text-right">Customers paid</th><th className="text-right">Refunded</th><th className="text-right">Gateway charge</th><th className="text-right">Plugio fee</th><th className="text-right">Creator earned</th></tr>
          </thead>
          <tbody>
            {rows.map(([label, t]) => (
              <tr key={label} className={label === "Total" ? "font-semibold" : ""}>
                <td>{label}</td>
                <td className="text-right tabular-nums">{t.saleCount}</td>
                <td className="text-right tabular-nums">{inr(t.grossMinor)}</td>
                <td className="text-right tabular-nums text-rose-700">{t.refundedMinor > 0 ? `−${inr(t.refundedMinor)}` : "—"}</td>
                <td className="text-right tabular-nums text-sky-700">−{inr(t.gatewayChargedMinor)}</td>
                <td className="text-right tabular-nums text-orange-700">−{inr(t.platformFeeMinor)}</td>
                <td className="text-right tabular-nums text-emerald-700">{inr(t.creatorNetMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminCard>
  );
}

// ───────────────────────── 5. what Plugio really made, and what it owes ─────────────────────────

function Liabilities({ overview }: { overview: MoneyOverview }) {
  const t = overview.total;
  const l = overview.liabilities;
  const p = overview.payouts;
  const tiles = [
    {
      label: "Plugio made", tone: C.plugio, value: inr(overview.plugioIncomeMinor),
      hint: `Platform fee ${inr(t.platformFeeMinor)} ${overview.gateway.marginMinor < 0 ? "−" : "+"} gateway ${overview.gateway.marginMinor < 0 ? "cost" : "left over"} ${inr(Math.abs(overview.gateway.marginMinor))}${overview.plugioIncomeComplete ? "" : " (partial)"}`,
    },
    { label: "Paid out to creators", tone: C.creators, value: inr(p.paidMinor), hint: `${p.paidCount} payout${p.paidCount === 1 ? "" : "s"}` },
    { label: "Withdrawals waiting for you", tone: C.waiting, value: inr(l.withdrawalsInReviewMinor), hint: "Asked for, not paid yet" },
    { label: "Plugio owes creators now", tone: C.creators, value: inr(l.creatorBalancesMinor), hint: `${l.creatorsWithBalance} creator${l.creatorsWithBalance === 1 ? "" : "s"}, all time` },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((x) => (
        <div key={x.label} className={`rounded-xl border p-4 ${x.tone.soft}`}>
          <p className="text-[12px] font-medium text-(--ink-mute)">{x.label}</p>
          <p className={`mt-1 text-[22px] font-semibold tabular-nums ${x.tone.text}`}>{x.value}</p>
          <p className="mt-1 text-[11.5px] text-(--ink-soft)">{x.hint}</p>
        </div>
      ))}
      {l.negativeBalancesMinor > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 sm:col-span-2 lg:col-span-4">
          <p className="text-[12.5px] font-semibold text-red-700">Creators owe Plugio {inr(l.negativeBalancesMinor)}</p>
          <p className="text-[11.5px] text-(--ink-soft)">Refunds after payout. New sales clear it first.</p>
        </div>
      )}
    </div>
  );
}

function HowToRead() {
  return (
    <AdminCard>
      <h3 className="text-[14px] font-semibold text-(--ink)">How to read this</h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-(--ink-soft)">
        <li><strong className="text-(--ink)">Razorpay pays Plugio, not creators.</strong> Plugio pays creators by payout.</li>
        <li>Two charges come out of each sale: the <strong className="text-(--ink)">gateway charge</strong> (Razorpay&apos;s cost) and the <strong className="text-(--ink)">Plugio fee</strong> (your income).</li>
        <li>Numbers match each creator&apos;s own Earnings page. A refund returns both charges to them.</li>
      </ul>
    </AdminCard>
  );
}
