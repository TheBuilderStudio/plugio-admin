import { Suspense } from "react";
import { ArrowLeftRight, Download } from "lucide-react";
import { requireCapability } from "@/lib/admin-access";
import { storeApi, type StorePage, type AdminTransaction } from "@/lib/store-api";
import { parseTransactionFilter } from "@/lib/report-params";
import { validatePage } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";
import { SavedViews } from "@/components/shared/SavedViews";
import { ListToolbar, resultSummary } from "@/components/shared/ListToolbar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-tone";
import { formatDateTime, formatMinor } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const KIND_LABEL: Record<string, string> = { STORE: "Store", BOOKING: "Session", SUBSCRIPTION: "Subscription" };

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TransactionsPage({ searchParams }: Props) {
  const session = await requireCapability("VIEW_MONEY");
  const actor = session.user?.email ?? "";
  const raw = await searchParams;
  const filter = parseTransactionFilter(raw);
  const page = validatePage(raw.page) - 1; // backend pages are 0-based

  let result: StorePage<AdminTransaction> | null = null;
  let error: string | null = null;
  try {
    result = await storeApi.transactions(actor, filter, page);
  } catch (e) {
    error = e instanceof Error ? e.message : "Could not load transactions";
  }

  const kept = Object.fromEntries(Object.entries(filter).filter(([, v]) => v)) as Record<string, string>;
  const exportHref = `/api/export/report/transactions?${new URLSearchParams(kept).toString()}`;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Transactions"
        description="Every payment in one list." hint="Store orders, paid sessions and subscriptions. Amounts keep their own currency."
        actions={
          <a href={exportHref} className="admin-btn-ghost py-2 text-[12px]">
            <Download className="h-4 w-4" /> Export CSV
          </a>
        }
      />
      <Suspense fallback={null}>
        <SavedViews pageKey="transactions" />
      </Suspense>

      <AdminCard padded={false}>
              <form method="get" className="flex flex-wrap items-end gap-2 border-b border-(--line) px-4 py-3">
                <Field label="Type">
                  <select name="kind" defaultValue={filter.kind ?? ""} className="admin-input">
                    <option value="">All</option>
                    <option value="STORE">Store</option>
                    <option value="BOOKING">Sessions</option>
                    <option value="SUBSCRIPTION">Subscriptions</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select name="status" defaultValue={filter.status ?? ""} className="admin-input">
                    <option value="">Any</option>
                    {["PAID", "FULFILLED", "PENDING", "CREATED", "FAILED", "EXPIRED", "REFUND_PENDING", "REFUNDED"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field label="From"><input type="date" name="from" defaultValue={filter.from ?? ""} className="admin-input" /></Field>
                <Field label="To"><input type="date" name="to" defaultValue={filter.to ?? ""} className="admin-input" /></Field>
                <Field label="Search">
                  <input type="search" name="q" defaultValue={filter.q ?? ""} placeholder="Email, payment or order id" maxLength={100} className="admin-input" />
                </Field>
                <button type="submit" className="rounded-lg bg-(--ink) px-3.5 py-2 text-[13px] font-semibold text-white">Apply</button>
              </form>
        {result && <ListToolbar summary={resultSummary(page + 1, PAGE_SIZE, result.total, result.items.length)} clearHref={Object.keys(kept).length > 0 ? "/admin/transactions" : undefined} />}
        {error ? (
          <div className="p-5">
            <p className="text-[13px] font-semibold text-red-700">Could not load transactions</p>
            <p className="mt-1 text-[12.5px] text-(--ink-soft)">{error}</p>
          </div>
        ) : !result || result.items.length === 0 ? (
          <EmptyState
            icon={ArrowLeftRight}
            title="No transactions"
            description="Try different filters."
            action={Object.keys(kept).length > 0 ? { label: "Clear filters", href: "/admin/transactions" } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>When</th><th>Type</th><th>Creator / payer</th><th>Customer</th><th>Status</th><th className="text-right">Gross</th><th className="text-right">Plugio fee</th><th className="text-right">Gateway charge</th><th className="text-right">Net</th></tr>
              </thead>
              <tbody>
                {result.items.map((t) => (
                  <tr key={`${t.kind}-${t.id}`}>
                    <td className="whitespace-nowrap text-[12.5px]">{formatDateTime(t.at)}</td>
                    <td>
                      <p className="font-semibold">{KIND_LABEL[t.kind] ?? t.kind}</p>
                      <p className="max-w-[200px] truncate text-[11.5px] text-(--ink-mute)">{t.description}</p>
                    </td>
                    <td>
                      <p className="font-semibold">{t.partyName ?? "—"}</p>
                      <p className="text-[11.5px] text-(--ink-mute)">{t.partyEmail}</p>
                    </td>
                    <td className="text-[12.5px]">{t.counterpartyEmail ?? "—"}</td>
                    <td>
                      <Badge tone={statusTone(t.status)}>{statusLabel(t.status)}</Badge>
                      {t.gatewayPaymentId && <p className="mt-1 font-mono text-[11px] text-(--ink-mute)">{t.gatewayPaymentId}</p>}
                    </td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatMinor(t.grossMinor, t.currency)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatMinor(t.feeMinor, t.currency)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatMinor(t.gatewayFeeMinor ?? 0, t.currency)}</td>
                    <td className="whitespace-nowrap text-right tabular-nums">{formatMinor(t.netMinor, t.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {result && (
          <Pagination
            currentPage={result.page + 1}
            totalPages={result.totalPages}
            total={result.total}
            pageSize={PAGE_SIZE}
            baseUrl="/admin/transactions"
            searchParams={kept}
          />
        )}
      </AdminCard>
    </AdminPage>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-medium text-(--ink-mute)">
      {label}
      {children}
    </label>
  );
}
