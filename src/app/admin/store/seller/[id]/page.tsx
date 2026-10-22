import Link from "next/link";
import { ArrowLeft, Store } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { storeApi } from "@/lib/store-api";
import { validatePage } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ID_PATTERN = /^[0-9a-f-]{32,36}$/i;

function inr(minor: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(minor / 100);
}

export default async function SellerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireAdmin();
  const actor = session.user?.email ?? "";
  const { id } = await params;
  const page = validatePage((await searchParams).page) - 1;

  let statement;
  try {
    if (!ID_PATTERN.test(id)) throw new Error("Invalid seller id.");
    statement = await storeApi.sellerStatement(actor, id, page);
  } catch (e) {
    return (
      <AdminPage>
        <AdminCard>
          <p className="text-[13px] font-semibold text-red-700">Could not load this seller&apos;s statement</p>
          <p className="mt-1 text-[12.5px] text-(--ink-soft)">{e instanceof Error ? e.message : "Unknown error"}</p>
        </AdminCard>
      </AdminPage>
    );
  }

  const b = statement.breakdown;
  const cards: { label: string; value: string; hint: string; warn?: boolean }[] = [
    { label: "Available to withdraw", value: inr(b.availableMinor), hint: "After hold period, minus held amounts" },
    { label: "Pending", value: inr(b.pendingMinor), hint: "Still in the hold period" },
    { label: "Withdrawal in review", value: inr(b.requestedMinor), hint: "Requested, not yet paid" },
    { label: "Paid out", value: inr(b.paidOutMinor), hint: "Marked paid by an admin" },
    { label: "Lifetime earnings", value: inr(b.lifetimeEarnedMinor), hint: "After platform fees" },
    { label: "Held for review", value: inr(b.heldMinor), hint: "Gateway refunds, disputes, cancelled paid sessions", warn: b.heldMinor > 0 },
    { label: "Owed by seller", value: inr(b.owedMinor), hint: "Shortfall after refunds on paid-out money", warn: b.owedMinor > 0 },
  ];

  return (
    <AdminPage>
      <Link href="/admin/store?tab=payouts" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-(--ink-soft) hover:underline">
        <ArrowLeft className="size-3.5" /> Back to store operations
      </Link>
      <AdminPageHeader
        kicker="Creator statement"
        title={statement.sellerName ?? "Seller"}
        description={`${statement.sellerEmail ?? ""} · every sale, fee, withdrawal and correction with the balance after each`}
      />

      {!b.reconciles && (
        <AdminCard>
          <p className="text-[13px] font-semibold text-red-700">This ledger does not reconcile</p>
          <p className="mt-1 text-[12.5px] text-(--ink-soft)">
            Ledger balance {inr(b.ledgerBalanceMinor)} differs from earnings plus adjustments minus withdrawals. Do not pay
            this seller until it is investigated.
          </p>
        </AdminCard>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <AdminCard key={c.label}>
            <p className="text-[11.5px] text-(--ink-mute)">{c.label}</p>
            <p className={`mt-1 text-[18px] font-semibold tabular-nums ${c.warn ? "text-red-700" : ""}`}>{c.value}</p>
            <p className="mt-0.5 text-[11px] text-(--ink-mute)">{c.hint}</p>
          </AdminCard>
        ))}
      </div>

      <AdminCard padded={false}>
        {statement.page.rows.length === 0 ? (
          <EmptyState icon={Store} title="No transactions" description="This seller has no ledger entries yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>When</th><th>Type</th><th>Details</th><th>Amount</th><th>Balance after</th></tr>
              </thead>
              <tbody>
                {statement.page.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-[12.5px]">{formatDateTime(r.createdAt)}</td>
                    <td className="font-semibold">
                      {r.label}
                      {!r.availableNow && <p className="text-[11px] font-normal text-(--ink-mute)">available {formatDateTime(r.availableAt)}</p>}
                    </td>
                    <td className="text-[12.5px] text-(--ink-soft)">
                      {r.description ?? "—"}
                      {r.payoutStatus && <p className="text-[11px] text-(--ink-mute)">payout {r.payoutStatus.toLowerCase()}{r.payoutReference ? ` · ${r.payoutReference}` : ""}</p>}
                    </td>
                    <td className={`font-semibold tabular-nums ${r.amountMinor < 0 ? "text-red-700" : "text-emerald-700"}`}>
                      {r.amountMinor < 0 ? "−" : "+"}{inr(Math.abs(r.amountMinor))}
                    </td>
                    <td className="tabular-nums">{inr(r.balanceAfterMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={statement.page.page + 1}
          totalPages={statement.page.totalPages}
          total={statement.page.total}
          pageSize={50}
          baseUrl={`/admin/store/seller/${id}`}
          searchParams={{}}
        />
      </AdminCard>
    </AdminPage>
  );
}
