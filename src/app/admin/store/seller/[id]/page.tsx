import Link from "next/link";
import { Store } from "lucide-react";
import { requireCapability } from "@/lib/admin-access";
import { storeApi, type KycGate, type SellerPayoutAccount } from "@/lib/store-api";
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
  searchParams: Promise<{ page?: string; source?: string }>;
}) {
  const session = await requireCapability("VIEW_MONEY");
  const actor = session.user?.email ?? "";
  const { id } = await params;
  const sParams = await searchParams;
  const page = validatePage(sParams.page) - 1;
  const rawSource = sParams.source?.trim().toUpperCase();
  const source = rawSource === "STORE" || rawSource === "BOOKING" ? rawSource : undefined;

  let statement;
  let account: SellerPayoutAccount | null = null;
  let accountError: string | null = null;
  try {
    if (!ID_PATTERN.test(id)) throw new Error("Invalid seller id.");
    statement = await storeApi.sellerStatement(actor, id, page, source);
    // A failure here must not hide the statement: show the problem inside the card instead.
    try {
      account = await storeApi.sellerPayoutAccount(actor, id);
    } catch (e) {
      accountError = e instanceof Error ? e.message : "Unknown error";
    }
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
    { label: "Customers paid you", value: inr(b.grossSalesMinor ?? 0), hint: "Lifetime sales, before any charge" },
    { label: "Payment gateway charge", value: inr(b.gatewayFeeMinor ?? 0), hint: "Razorpay's share, charged to the creator" },
    { label: "Plugio platform fee", value: inr(b.platformFeeMinor ?? 0), hint: "Plugio's income from this creator" },
    { label: "Lifetime earnings", value: inr(b.lifetimeEarnedMinor), hint: "After the gateway charge, platform fee and refunds" },
    { label: "Held for review", value: inr(b.heldMinor), hint: "Gateway refunds, disputes, cancelled paid sessions", warn: b.heldMinor > 0 },
    { label: "Owed by seller", value: inr(b.owedMinor), hint: "Shortfall after refunds on paid-out money", warn: b.owedMinor > 0 },
  ];

  return (
    <AdminPage>
      <AdminPageHeader
        entity
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

      <PayoutAccountPanel account={account} error={accountError} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <AdminCard key={c.label}>
            <p className="text-[11.5px] text-(--ink-mute)">{c.label}</p>
            <p className={`mt-1 text-[18px] font-semibold tabular-nums ${c.warn ? "text-red-700" : ""}`}>{c.value}</p>
            <p className="mt-0.5 text-[11px] text-(--ink-mute)">{c.hint}</p>
          </AdminCard>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/admin/store/seller/${id}`}
          className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
            !source
              ? "bg-(--ink) text-white"
              : "border border-(--line) bg-(--paper) text-(--ink-soft) hover:text-(--ink)"
          }`}
        >
          All movements
        </Link>
        <Link
          href={`/admin/store/seller/${id}?source=STORE`}
          className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
            source === "STORE"
              ? "bg-(--ink) text-white"
              : "border border-(--line) bg-(--paper) text-(--ink-soft) hover:text-(--ink)"
          }`}
        >
          Digital products
        </Link>
        <Link
          href={`/admin/store/seller/${id}?source=BOOKING`}
          className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition ${
            source === "BOOKING"
              ? "bg-(--ink) text-white"
              : "border border-(--line) bg-(--paper) text-(--ink-soft) hover:text-(--ink)"
          }`}
        >
          Bookings
        </Link>
      </div>

      <AdminCard padded={false}>
        {statement.page.rows.length === 0 ? (
          <EmptyState
            icon={Store}
            title={source ? `No ${source === "STORE" ? "digital product" : "booking"} transactions` : "No transactions"}
            description={source ? `This creator has no ${source.toLowerCase()} ledger entries.` : "This seller has no ledger entries yet."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Amount</th>
                  <th>Balance after</th>
                </tr>
              </thead>
              <tbody>
                {statement.page.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-[12.5px]">{formatDateTime(r.createdAt)}</td>
                    <td>
                      {r.source === "STORE" ? (
                        <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                          Product
                        </span>
                      ) : r.source === "BOOKING" ? (
                        <span className="inline-flex rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                          Booking
                        </span>
                      ) : (
                        <span className="inline-flex rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600">
                          Payout
                        </span>
                      )}
                    </td>
                    <td className="font-semibold">
                      {r.label}
                      {!r.availableNow && <p className="text-[11px] font-normal text-(--ink-mute)">available {formatDateTime(r.availableAt)}</p>}
                    </td>
                    <td className="text-[12.5px] text-(--ink-soft)">
                      {r.description ?? "—"}
                      {r.payoutStatus && (
                        <p className="text-[11px] text-(--ink-mute)">
                          payout {r.payoutStatus.toLowerCase()}
                          {r.payoutReference && (
                            <span className="ml-1.5 inline-block rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[10.5px] font-medium text-stone-800">
                              UTR: {r.payoutReference}
                            </span>
                          )}
                        </p>
                      )}
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
          searchParams={source ? { source } : {}}
        />
      </AdminCard>
    </AdminPage>
  );
}

const GATE_LABEL: Record<KycGate, { text: string; cls: string }> = {
  APPROVED: { text: "Identity verified", cls: "bg-emerald-50 text-emerald-700" },
  PENDING: { text: "Identity check waiting for review", cls: "bg-amber-50 text-amber-700" },
  REJECTED: { text: "Identity check rejected", cls: "bg-red-50 text-red-700" },
  STALE: { text: "Payout account changed after verification", cls: "bg-amber-50 text-amber-700" },
  WAITING: { text: "Verified, in the first-payout waiting period", cls: "bg-amber-50 text-amber-700" },
  NOT_SUBMITTED: { text: "Identity check not submitted", cls: "bg-stone-100 text-stone-700" },
  NOT_REQUIRED: { text: "Identity check not required", cls: "bg-stone-100 text-stone-700" },
};

function PayoutAccountPanel({ account, error }: { account: SellerPayoutAccount | null; error: string | null }) {
  if (!account) {
    return (
      <AdminCard>
        <p className="text-[13px] font-semibold text-red-700">Could not load the payout account</p>
        <p className="mt-1 text-[12.5px] text-(--ink-soft)">{error ?? "Unknown error"}</p>
      </AdminCard>
    );
  }
  const gate = GATE_LABEL[account.gate] ?? GATE_LABEL.NOT_SUBMITTED;
  const rows: [string, string | null][] = account.hasPayoutAccount
    ? [
        ["Method", account.method === "UPI" ? "UPI" : "Bank transfer"],
        ["Account holder", account.accountHolder],
        ...(account.method === "UPI"
          ? ([["UPI ID", account.upiId]] as [string, string | null][])
          : ([["Account number", account.bankAccount], ["IFSC", account.ifsc]] as [string, string | null][])),
        ["Last changed", account.payoutUpdatedAt ? formatDateTime(account.payoutUpdatedAt) : null],
      ]
    : [];
  return (
    <AdminCard>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">Payout account and identity</p>
        <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold ${gate.cls}`}>{gate.text}</span>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[11.5px] text-(--ink-mute)">Where the money goes</p>
          {account.hasPayoutAccount ? (
            <dl className="mt-1 space-y-1 text-[12.5px]">
              {rows.map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <dt className="w-28 shrink-0 text-(--ink-mute)">{k}</dt>
                  <dd className="font-mono break-all">{v ?? "—"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-1 text-[12.5px] text-(--ink-soft)">This creator has not added a payout account yet.</p>
          )}
        </div>
        <div>
          <p className="text-[11.5px] text-(--ink-mute)">Identity check</p>
          {account.legalName ? (
            <dl className="mt-1 space-y-1 text-[12.5px]">
              <div className="flex gap-2"><dt className="w-28 shrink-0 text-(--ink-mute)">Legal name</dt><dd>{account.legalName}</dd></div>
              <div className="flex gap-2"><dt className="w-28 shrink-0 text-(--ink-mute)">PAN</dt><dd className="font-mono">{account.pan}</dd></div>
              {account.nameMatchesPayout !== null && (
                <p className={account.nameMatchesPayout ? "text-emerald-700" : "font-semibold text-red-700"}>
                  {account.nameMatchesPayout ? "Name matches the account holder" : "Name differs from the account holder"}
                </p>
              )}
              {account.rejectReason && account.gate === "REJECTED" && <p className="text-red-700">Reason: {account.rejectReason}</p>}
              {(account.gate === "PENDING" || account.gate === "STALE") && (
                <Link href="/admin/store?tab=kyc" className="font-semibold text-brand-500 hover:underline">Open the verification queue</Link>
              )}
            </dl>
          ) : (
            <p className="mt-1 text-[12.5px] text-(--ink-soft)">No PAN submitted yet.</p>
          )}
        </div>
      </div>
    </AdminCard>
  );
}
