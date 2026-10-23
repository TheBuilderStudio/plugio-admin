import { Download } from "lucide-react";
import { requireCapability } from "@/lib/admin-access";
import { storeApi, type RevenueRow, type CommissionRow, type PayoutSummaryRow } from "@/lib/store-api";
import { parseRange } from "@/lib/report-params";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatMinor } from "@/lib/utils";
import { BarChart3 } from "lucide-react";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { STORE: "Store", BOOKING: "Sessions", SUBSCRIPTION: "Subscriptions" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReportsPage({ searchParams }: Props) {
  const session = await requireCapability("VIEW_MONEY");
  const actor = session.user?.email ?? "";
  const sParams = await searchParams;
  const range = parseRange(sParams);
  const rawKind = typeof sParams.kind === "string" ? sParams.kind.trim().toUpperCase() : "";
  const kind = rawKind === "STORE" || rawKind === "BOOKING" || rawKind === "SUBSCRIPTION" ? rawKind : undefined;

  const [revenue, commission, payouts] = await Promise.allSettled([
    storeApi.revenueReport(actor, range),
    storeApi.commissionReport(actor, range),
    storeApi.payoutReport(actor, range),
  ]);

  const queryParams: Record<string, string> = {
    ...(range.from ? { from: range.from } : {}),
    ...(range.to ? { to: range.to } : {}),
    ...(kind ? { kind } : {}),
  };
  const qs = new URLSearchParams(queryParams).toString();
  const preset = (days: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    return `/admin/reports?${new URLSearchParams({ from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), ...(kind ? { kind } : {}) }).toString()}`;
  };
  const csv = (name: string) => `/api/export/report/${name}${qs ? `?${qs}` : ""}`;
  const shown = revenue.status === "fulfilled" ? revenue.value : commission.status === "fulfilled" ? commission.value : null;
  // The backend treats a chosen end date as inclusive (it queries up to the next midnight), so show what was chosen.
  const day = (iso: string) => iso.slice(0, 10);
  const shownFrom = range.from ?? (shown ? day(shown.from) : "");
  const shownTo = range.to ?? (shown ? day(shown.to) : "");

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Money"
        title="Reports"
        description="Revenue, commission and payouts." hint="Default is the last 30 days, up to one year. Totals are per currency and never added across currencies."
      />

      <form method="get" className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold uppercase tracking-wide text-(--ink-mute)">
          From <input type="date" name="from" defaultValue={range.from ?? ""} className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold uppercase tracking-wide text-(--ink-mute)">
          To <input type="date" name="to" defaultValue={range.to ?? ""} className="admin-input" />
        </label>
        <label className="flex flex-col gap-1 text-[11.5px] font-semibold uppercase tracking-wide text-(--ink-mute)">
          Source / Type
          <select name="kind" defaultValue={kind ?? ""} className="admin-input">
            <option value="">All sources</option>
            <option value="STORE">Digital Products</option>
            <option value="BOOKING">Bookings</option>
            <option value="SUBSCRIPTION">Subscriptions</option>
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-(--ink) px-3.5 py-2 text-[13px] font-semibold text-white">Apply</button>
        <div className="flex gap-1.5 pb-0.5 text-[12px]">
          {[7, 30, 90].map((d) => (
            <a key={d} href={preset(d)} className="rounded-lg border border-(--line) px-2.5 py-1.5 font-semibold text-(--ink-soft) hover:text-(--ink)">
              Last {d} days
            </a>
          ))}
        </div>
        {shown && <p className="pb-2 text-[12px] text-(--ink-soft)">Showing {shownFrom} to {shownTo} (UTC)</p>}
      </form>

      <Section<RevenueRow>
        title="Revenue"
        note="By payment date. Refunds on their own lines."
        csv={csv("revenue")}
        result={revenue}
        filterKind={kind}
      >
        {(rows) => (
          <table className="admin-table">
            <thead><tr><th>Type</th><th>Status</th><th>Currency</th><th className="text-right">Count</th><th className="text-right">Gross</th><th className="text-right">Platform fee</th><th className="text-right">Gateway charge</th><th className="text-right">Creator net</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.kind}-${r.status}-${r.currency}`}>
                  <td className="font-semibold">{KIND_LABEL[r.kind] ?? r.kind}</td><td>{r.status}</td><td>{r.currency}</td>
                  <td className="text-right tabular-nums">{r.count}</td>
                  <td className="text-right tabular-nums">{formatMinor(r.grossMinor, r.currency)}</td>
                  <td className="text-right tabular-nums">{formatMinor(r.feeMinor, r.currency)}</td>
                  <td className="text-right tabular-nums">{formatMinor(r.gatewayFeeMinor ?? 0, r.currency)}</td>
                  <td className="text-right tabular-nums">{formatMinor(r.netMinor, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section<CommissionRow>
        title="Commission by creator"
        note="Paid orders and sessions. Refunds excluded."
        csv={csv("commission")}
        result={commission}
        filterKind={kind}
      >
        {(rows) => (
          <table className="admin-table">
            <thead><tr><th>Creator</th><th>Type</th><th>Currency</th><th className="text-right">Count</th><th className="text-right">Gross</th><th className="text-right">Commission</th><th className="text-right">Gateway charge</th><th className="text-right">Creator net</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.sellerId}-${r.kind}-${r.currency}`}>
                  <td><p className="font-semibold">{r.sellerName ?? "—"}</p><p className="text-[11.5px] text-(--ink-mute)">{r.sellerEmail}</p></td>
                  <td>{KIND_LABEL[r.kind] ?? r.kind}</td><td>{r.currency}</td>
                  <td className="text-right tabular-nums">{r.count}</td>
                  <td className="text-right tabular-nums">{formatMinor(r.grossMinor, r.currency)}</td>
                  <td className="text-right tabular-nums">{formatMinor(r.feeMinor, r.currency)}</td>
                  <td className="text-right tabular-nums">{formatMinor(r.gatewayFeeMinor ?? 0, r.currency)}</td>
                  <td className="text-right tabular-nums">{formatMinor(r.netMinor, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {!kind || kind === "STORE" || kind === "BOOKING" ? (
        <Section<PayoutSummaryRow>
          title="Payout requests"
          note="Requests in this range, by status."
          csv={csv("payouts")}
          result={payouts}
        >
          {(rows) => (
            <table className="admin-table">
              <thead><tr><th>Status</th><th>Currency</th><th className="text-right">Requests</th><th className="text-right">Total</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.status}-${r.currency}`}>
                    <td className="font-semibold">{r.status}</td><td>{r.currency}</td>
                    <td className="text-right tabular-nums">{r.count}</td>
                    <td className="text-right tabular-nums">{formatMinor(r.totalMinor, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      ) : null}
    </AdminPage>
  );
}

function Section<T>({
  title, note, csv, result, children, filterKind,
}: {
  title: string;
  note: string;
  csv: string;
  result: PromiseSettledResult<{ rows: T[] }>;
  children: (rows: T[]) => React.ReactNode;
  filterKind?: string;
}) {
  return (
    <AdminCard padded={false}>
      <div className="flex items-start justify-between gap-3 p-5 pb-3">
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <p className="text-[12.5px] text-(--ink-soft)">{note}</p>
        </div>
        <a href={csv} className="admin-btn-ghost shrink-0 py-1.5 text-[12px]">
          <Download className="h-3.5 w-3.5" /> CSV
        </a>
      </div>
      {result.status === "rejected" ? (
        <p className="px-5 pb-5 text-[12.5px] text-red-700">
          {result.reason instanceof Error ? result.reason.message : "Could not load this report"}
        </p>
      ) : result.value.rows.length === 0 ? (
        <EmptyState icon={BarChart3} title="No data" description="Nothing recorded in this range." />
      ) : (() => {
        const rows = filterKind
          ? result.value.rows.filter((r) => !("kind" in (r as any)) || (r as any).kind === filterKind)
          : result.value.rows;
        if (rows.length === 0) {
          return (
            <EmptyState
              icon={BarChart3}
              title="No matching data"
              description={`No ${(filterKind ?? "").toLowerCase()} records in this range.`}
            />
          );
        }
        return <div className="overflow-x-auto">{children(rows)}</div>;
      })()}
    </AdminCard>
  );
}
