import Link from "next/link";
import { Store } from "lucide-react";
import { requireCapability } from "@/lib/admin-access";
import { storeApi, type StorePage } from "@/lib/store-api";
import { validatePage } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard, FilterPills } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { StoreRowAction } from "@/components/store/StoreRowAction";
import { CommissionPolicyForm } from "@/components/store/CommissionPolicyForm";
import { MoneyView } from "@/components/store/MoneyView";
import { ListToolbar, resultSummary } from "@/components/shared/ListToolbar";
import { parseRange } from "@/lib/report-params";
import { PayoutSettingsForm } from "@/components/store/PayoutSettingsForm";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-tone";
import { formatDateTime } from "@/lib/utils";
import {
  approveKycAction,
  cancelBatchAction,
  createSettlementAction,
  settleBatchAction,
  rejectKycAction,
  markPayoutPaidAction,
  rejectPayoutAction,
  confirmDisputeLossAction,
  dismissExceptionAction,
  refundCancelledSessionAction,
  suspendProductAction,
  unsuspendProductAction,
  updateCommissionPolicyAction,
  updatePayoutSettingsAction,
} from "@/actions/store.actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
type Tab = "money" | "payouts" | "settlements" | "kyc" | "exceptions" | "orders" | "products" | "commission";
const TABS: { id: Tab; label: string }[] = [
  { id: "money", label: "Money" },
  { id: "payouts", label: "Payouts" },
  { id: "settlements", label: "Settlements" },
  { id: "kyc", label: "Verification" },
  { id: "exceptions", label: "Refunds & disputes" },
  { id: "orders", label: "Orders" },
  { id: "products", label: "Products" },
  { id: "commission", label: "Commission policy" },
];

interface StorePageProps {
  searchParams: Promise<{ tab?: string; status?: string; page?: string; recon?: string; from?: string; to?: string; source?: string }>;
}

const EXCEPTION_LABEL: Record<"GATEWAY_REFUND" | "DISPUTE" | "PAID_SESSION_CANCELLED", string> = {
  GATEWAY_REFUND: "Gateway refund",
  DISPUTE: "Dispute",
  PAID_SESSION_CANCELLED: "Paid session cancelled",
};

function inr(minor: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(minor / 100);
}

function ErrorCard({ error }: { error: unknown }) {
  return (
    <AdminCard>
      <p className="text-[13px] font-semibold text-red-700">Could not load store data</p>
      <p className="mt-1 text-[12.5px] text-(--ink-soft)">{error instanceof Error ? error.message : "Unknown error"}</p>
    </AdminCard>
  );
}

function Pager<T>({ result, searchParams }: { result: StorePage<T>; searchParams: Record<string, string> }) {
  return (
    <Pagination
      currentPage={result.page + 1}
      totalPages={result.totalPages}
      total={result.total}
      pageSize={PAGE_SIZE}
      baseUrl="/admin/store"
      searchParams={searchParams}
    />
  );
}

export default async function StoreAdminPage({ searchParams }: StorePageProps) {
  const session = await requireCapability("VIEW_MONEY");
  const actor = session.user?.email ?? "";
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : "money";
  const page = validatePage(params.page) - 1; // backend pages are 0-based
  const status = params.status === "PAID" || params.status === "REJECTED" ? params.status : "REQUESTED";

  const kycStatus = params.status === "APPROVED" || params.status === "REJECTED" ? params.status : "PENDING";

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Marketplace"
        title="Store operations"
        description="Money, payouts and products." hint="Every action here is audited."
      />
      <FilterPills items={TABS.map((t) => ({ href: `/admin/store?tab=${t.id}`, label: t.label, active: tab === t.id }))} />

      {tab === "money" && <MoneyTab actor={actor} params={params} page={page} />}
      {tab === "payouts" && <PayoutsTab actor={actor} status={status} page={page} />}
      {tab === "settlements" && <SettlementsTab actor={actor} page={page} runRecon={params.recon === "1"} />}
      {tab === "kyc" && <KycTab actor={actor} status={kycStatus} page={page} />}
      {tab === "exceptions" && <ExceptionsTab actor={actor} page={page} />}
      {tab === "orders" && <OrdersTab actor={actor} page={page} />}
      {tab === "products" && <ProductsTab actor={actor} page={page} />}
      {tab === "commission" && <CommissionTab actor={actor} />}
    </AdminPage>
  );
}

async function MoneyTab({ actor, params, page }: { actor: string; params: { from?: string; to?: string; source?: string }; page: number }) {
  const range = parseRange({ from: params.from, to: params.to });
  const source = params.source === "STORE" || params.source === "BOOKING" ? params.source : undefined;
  let overview;
  let creators = null;
  try {
    [overview, creators] = await Promise.all([
      storeApi.moneyOverview(actor, range, source),
      storeApi.moneyCreators(actor, range, source, page),
    ]);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return <MoneyView overview={overview} creators={creators} filters={{ ...range, source }} />;
}

async function CommissionTab({ actor }: { actor: string }) {
  let policy;
  let payout;
  try {
    [policy, payout] = await Promise.all([storeApi.commissionPolicy(actor), storeApi.payoutSettings(actor)]);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <>
    <AdminCard>
      <CommissionPolicyForm
        digital={String(policy.digitalProductsFeePercent)}
        bookings={String(policy.bookingsFeePercent)}
        gateway={String(policy.gatewayFeePercent ?? 0)}
        version={policy.version}
        updatedBy={policy.updatedBy}
        updatedAt={policy.updatedAt ? formatDateTime(policy.updatedAt) : null}
        action={updateCommissionPolicyAction}
      />
    </AdminCard>
    <AdminCard>
      <PayoutSettingsForm
        minRupees={String(payout.minPayoutMinor / 100)}
        floorRupees={payout.withdrawAllFloorMinor / 100}
        version={payout.version}
        updatedBy={payout.updatedBy}
        updatedAt={payout.updatedAt ? formatDateTime(payout.updatedAt) : null}
        action={updatePayoutSettingsAction}
      />
    </AdminCard>
    </>
  );
}

async function ExceptionsTab({ actor, page }: { actor: string; page: number }) {
  let result;
  try {
    result = await storeApi.exceptions(actor, true, page);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <AdminCard padded={false}>
      <ListToolbar summary={`${resultSummary(result.page + 1, result.size, result.total, result.items.length)}. Held amounts stay with Plugio until you close the item.`} />
      {result.items.length === 0 ? (
        <EmptyState icon={Store} title="Nothing to review" description="Refunds and disputes appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr><th>Type</th><th>Amount held</th><th>Payment</th><th>Status</th><th>Seen</th><th>Action</th></tr>
            </thead>
            <tbody>
              {result.items.map((x) => (
                <tr key={x.id}>
                  <td>
                    <p className="font-semibold">{EXCEPTION_LABEL[x.type]}</p>
                    <p className="text-[11.5px] text-(--ink-mute)">{x.subjectKind.toLowerCase()}{x.reasonCode ? ` · ${x.reasonCode}` : ""}</p>
                    {x.type === "PAID_SESSION_CANCELLED" && x.creatorCancellations90d != null && (
                      <p className={`text-[11.5px] ${x.creatorCancellations90d >= 3 ? "font-semibold text-red-700" : "text-(--ink-mute)"}`}>
                        Creator cancelled {x.creatorCancellations90d} paid session{x.creatorCancellations90d === 1 ? "" : "s"} in 90 days
                      </p>
                    )}
                    {x.lateCancellation && <p className="text-[11.5px] font-semibold text-red-700">Late: under 24 hours&apos; notice</p>}
                  </td>
                  <td className="font-semibold tabular-nums">
                    {inr(x.amountMinor)}
                    <p className="text-[11px] font-normal text-(--ink-mute)">
                      {x.holdActive ? "held" : "no hold"}
                      {x.grossMinor != null && x.grossMinor !== x.amountMinor ? ` · customer paid ${inr(x.grossMinor)}` : ""}
                    </p>
                  </td>
                  <td className="max-w-[220px] wrap-break-word font-mono text-[12px]">{x.paymentId ?? "—"}</td>
                  <td className="text-[12.5px]">
                    <Badge tone={statusTone(x.state)}>{statusLabel(x.state)}</Badge>
                    <p className="mt-1 text-[11px] text-(--ink-mute)">{x.gatewayStatus}{x.phase ? ` · ${x.phase}` : ""}</p>
                    {x.respondBy && <p className="text-[11px] text-red-700">Respond by {formatDateTime(x.respondBy)}</p>}
                  </td>
                  <td className="whitespace-nowrap text-[12.5px]">{formatDateTime(x.createdAt)}</td>
                  <td>
                    {x.sellerId && (
                      <Link href={`/admin/store/seller/${x.sellerId}`} className="mb-1 block text-[11.5px] font-semibold text-(--ink-soft) underline">Seller statement</Link>
                    )}
                    {x.type === "DISPUTE" && x.gatewayStatus?.toLowerCase() === "lost" && x.state !== "RESOLVED" && x.state !== "DISMISSED" && (
                      <div className="mb-1">
                        <StoreRowAction label="Confirm loss" fieldLabel={null} confirmLabel="Debit creator and return fee" tone="danger"
                          action={confirmDisputeLossAction.bind(null, x.id)} />
                      </div>
                    )}
                    {x.type === "PAID_SESSION_CANCELLED" && (
                      <div className="mb-1">
                        <StoreRowAction label="Refund customer in full" fieldLabel={null} confirmLabel="Confirm full refund" tone="danger"
                          action={refundCancelledSessionAction.bind(null, x.id)} />
                      </div>
                    )}
                    <StoreRowAction label="Close" fieldLabel="What was done" placeholder="What was done" confirmLabel="Close and release"
                      action={dismissExceptionAction.bind(null, x.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager result={result} searchParams={{ tab: "exceptions" }} />
    </AdminCard>
  );
}

async function PayoutsTab({ actor, status, page }: { actor: string; status: string; page: number }) {
  let result;
  try {
    result = await storeApi.payouts(actor, status, page);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <>
      <AdminCard padded={false}>
        <ListToolbar
          pills={(["REQUESTED", "PAID", "REJECTED"] as const).map((s) => ({
            href: `/admin/store?tab=payouts&status=${s}`,
            label: s === "REQUESTED" ? "To pay" : s === "PAID" ? "Paid" : "Rejected",
            active: status === s,
          }))}
          summary={resultSummary(result.page + 1, result.size, result.total, result.items.length)}
        />
        {result.items.length === 0 ? (
          <EmptyState icon={Store} title={status === "REQUESTED" ? "Nothing to pay" : "No payouts here"} description={status === "REQUESTED" ? "No withdrawals waiting." : "Nothing in this list."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>Seller</th><th>Amount</th><th>Seller balance now</th><th>Send to</th><th>Requested</th><th>Action</th></tr>
              </thead>
              <tbody>
                {result.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-semibold">{p.sellerName ?? "—"}</p>
                      <p className="text-[11.5px] text-(--ink-mute)">{p.sellerEmail}</p>
                      <Link href={`/admin/store/seller/${p.sellerId}`} className="text-[11.5px] font-semibold text-(--ink-soft) underline">View statement</Link>
                    </td>
                    <td className="font-semibold tabular-nums">{inr(p.amountMinor)}</td>
                    <td className={`tabular-nums ${p.sellerAvailableMinor < 0 ? "font-semibold text-red-700" : ""}`}>
                      {inr(p.sellerAvailableMinor)}
                      {p.sellerAvailableMinor < 0 && p.status === "REQUESTED" && (
                        <p className="text-[11px] font-normal">Seller is short after a refund or dispute. Check before paying.</p>
                      )}
                    </td>
                    <td className="max-w-[260px] wrap-break-word font-mono text-[12px]">{p.destination}</td>
                    <td className="whitespace-nowrap text-[12.5px]">{formatDateTime(p.requestedAt)}</td>
                    <td>
                      {p.status === "REQUESTED" ? (
                        <div className="flex flex-col gap-2">
                          <StoreRowAction label="Mark paid" fieldLabel="UTR / reference" placeholder="UTR or reference"
                            confirmLabel="Mark paid" action={markPayoutPaidAction.bind(null, p.id)} />
                          <StoreRowAction label="Reject" fieldLabel="Reason" tone="danger" confirmLabel="Reject"
                            action={rejectPayoutAction.bind(null, p.id)} />
                        </div>
                      ) : (
                        <p className="text-[12px] text-(--ink-soft)">
                          {p.status === "PAID" ? `Ref ${p.reference}` : p.note} · {p.processedBy}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager result={result} searchParams={{ tab: "payouts", status }} />
      </AdminCard>
    </>
  );
}

const BATCH_LABEL = { OPEN: "Open", SETTLED: "Settled", CANCELLED: "Cancelled" } as const;
const KIND_LABEL: Record<string, string> = {
  PAYOUT_DEBIT_MISMATCH: "Payout debits differ from payouts",
  PAYOUT_RESTORE_MISMATCH: "Rejected payouts not restored correctly",
  SALE_CREDIT_MISMATCH: "Sale credit differs from the order",
  PLATFORM_FEE_MISMATCH: "Platform fee differs from the order",
  GATEWAY_FEE_MISMATCH: "Gateway charge differs from the order",
  PAID_WITHOUT_REFERENCE: "Paid with no bank reference",
};

async function SettlementsTab({ actor, page, runRecon }: { actor: string; page: number; runRecon: boolean }) {
  let batches;
  let report = null;
  try {
    // Reconciliation scans every order and ledger entry, so it runs on request, not on every page view.
    [batches, report] = await Promise.all([storeApi.settlements(actor, page), runRecon ? storeApi.reconciliation(actor) : null]);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <>
      <AdminCard>
        {!report ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold">Reconciliation</p>
              <p className="text-[12.5px] text-(--ink-soft)">Checks the ledger against orders and payouts. Run it when needed.</p>
            </div>
            <Link href="/admin/store?tab=settlements&recon=1" className="rounded-lg border border-(--line) px-3 py-1.5 text-[12px] font-semibold hover:bg-[#F7F4EE]">Run reconciliation</Link>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold">Reconciliation</p>
                <p className={`text-[12.5px] ${report.balanced ? "text-emerald-700" : "font-semibold text-red-700"}`}>
                  {report.balanced
                    ? "Ledger, orders and payouts agree."
                    : `${report.discrepancies.length} item(s) need a look.`}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-4">
                <div><dt className="text-(--ink-mute)">Owed to creators</dt><dd className="font-semibold tabular-nums">{inr(report.owedToCreatorsMinor)}</dd></div>
                <div><dt className="text-(--ink-mute)">Ledger total</dt><dd className="font-semibold tabular-nums">{inr(report.ledgerTotalMinor)}</dd></div>
                <div><dt className="text-(--ink-mute)">Payouts waiting</dt><dd className="font-semibold tabular-nums">{inr(report.requestedPayoutsMinor)}</dd></div>
                <div><dt className="text-(--ink-mute)">Paid out</dt><dd className="font-semibold tabular-nums">{inr(report.paidPayoutsMinor)}</dd></div>
              </dl>
            </div>
            {report.discrepancies.length > 0 && (
              <div className="mt-4 overflow-x-auto">
                <table className="admin-table">
                  <thead><tr><th>Problem</th><th>Subject</th><th>Expected</th><th>Actual</th></tr></thead>
                  <tbody>
                    {report.discrepancies.map((d, i) => (
                      <tr key={`${d.kind}-${d.subjectId}-${i}`}>
                        <td><p className="font-semibold">{KIND_LABEL[d.kind] ?? d.kind}</p><p className="text-[11.5px] text-(--ink-mute)">{d.detail}</p></td>
                        <td className="font-mono text-[12px]">
                          {d.sellerId ? <Link href={`/admin/store/seller/${d.sellerId}`} className="underline">{d.subjectId}</Link> : d.subjectId}
                        </td>
                        <td className="tabular-nums">{d.expectedMinor === null ? "—" : inr(d.expectedMinor)}</td>
                        <td className="tabular-nums">{d.actualMinor === null ? "—" : inr(d.actualMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </AdminCard>

      <AdminCard padded={false}>
        <div className="flex items-center justify-between gap-3 p-4">
          <p className="text-[12.5px] text-(--ink-soft)">Group open payouts, download the bank file, then settle with the bank reference.</p>
          <StoreRowAction label="Create batch from open payouts" fieldLabel={null} confirmLabel="Create batch" action={createSettlementAction} />
        </div>
        {batches.items.length === 0 ? (
          <EmptyState icon={Store} title="No batches yet" description="Batches you create appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead><tr><th>Batch</th><th>Payouts</th><th>Total</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
              <tbody>
                {batches.items.map((b) => (
                  <tr key={b.id}>
                    <td className="font-mono text-[12px]">{b.id.slice(0, 8)}<p className="font-sans text-[11.5px] text-(--ink-mute)">{b.createdBy}</p></td>
                    <td className="tabular-nums">{b.payoutCount}</td>
                    <td className="font-semibold tabular-nums">{inr(b.totalMinor)}</td>
                    <td><Badge tone={statusTone(b.status)}>{BATCH_LABEL[b.status]}</Badge>{b.cancelReason && <p className="text-[11.5px] text-(--ink-mute)">{b.cancelReason}</p>}{b.bankReference && <p className="text-[11.5px] text-(--ink-mute)">Ref {b.bankReference}</p>}</td>
                    <td className="whitespace-nowrap text-[12.5px]">{formatDateTime(b.createdAt)}</td>
                    <td>
                      <div className="flex flex-col gap-2">
                        {b.status !== "CANCELLED" && (
                          <a href={`/api/export/settlement/${b.id}`} className="text-[12px] font-semibold underline">Download bank file</a>
                        )}
                        {b.status === "OPEN" && (
                          <>
                            <StoreRowAction label="Mark settled" fieldLabel="Bank reference" placeholder="UTR or batch reference"
                              confirmLabel="Settle batch" action={settleBatchAction.bind(null, b.id)} />
                            {b.exportedAt ? (
                              <>
                                <p className="max-w-[220px] text-[11px] text-(--ink-soft)">Bank file downloaded {formatDateTime(b.exportedAt)}. Check the bank statement before cancelling.</p>
                                <StoreRowAction label="Cancel batch" fieldLabel="Reason" placeholder="Why cancel after download?" tone="danger" confirmLabel="Cancel batch"
                                  action={cancelBatchAction.bind(null, b.id)} />
                              </>
                            ) : (
                              <StoreRowAction label="Cancel batch" fieldLabel={null} tone="danger" confirmLabel="Cancel batch"
                                action={cancelBatchAction.bind(null, b.id, "")} />
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager result={batches} searchParams={{ tab: "settlements" }} />
      </AdminCard>
    </>
  );
}

async function KycTab({ actor, status, page }: { actor: string; status: string; page: number }) {
  let result;
  try {
    result = await storeApi.kyc(actor, status, page);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <>
      <AdminCard padded={false}>
        <ListToolbar
          pills={(["PENDING", "APPROVED", "REJECTED"] as const).map((s) => ({
            href: `/admin/store?tab=kyc&status=${s}`,
            label: s === "PENDING" ? "To review" : s === "APPROVED" ? "Approved" : "Rejected",
            active: status === s,
          }))}
          summary={resultSummary(result.page + 1, result.size, result.total, result.items.length)}
        />
        {result.items.length === 0 ? (
          <EmptyState icon={Store} title={status === "PENDING" ? "Nothing to review" : "Nothing here"} description={status === "PENDING" ? "No identity checks waiting." : "Nothing in this list."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>Creator</th><th>Name and PAN</th><th>Payout account</th><th>Submitted</th><th>Action</th></tr>
              </thead>
              <tbody>
                {result.items.map((k) => (
                  <tr key={k.sellerId}>
                    <td>
                      <p className="font-semibold">{k.sellerName ?? "—"}</p>
                      <p className="text-[11.5px] text-(--ink-mute)">{k.sellerEmail}</p>
                    </td>
                    <td>
                      <p className="font-semibold">{k.legalName}</p>
                      <p className="font-mono text-[12px]">{k.pan}</p>
                      {k.duplicatePan && <p className="text-[11.5px] font-semibold text-red-700">Same PAN as another creator. Check before approving.</p>}
                    </td>
                    <td className="max-w-[260px] wrap-break-word text-[12px]">
                      <p className="font-mono">{k.payoutDestination ?? "No payout details yet"}</p>
                      <p className={k.nameMatchesPayout ? "text-emerald-700" : "font-semibold text-red-700"}>
                        {k.nameMatchesPayout ? "Name matches the account holder" : "Name differs from the account holder"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-[12.5px]">{formatDateTime(k.submittedAt)}</td>
                    <td>
                      {k.status === "PENDING" ? (
                        <div className="flex flex-col gap-2">
                          <StoreRowAction label="Approve" fieldLabel={null} confirmLabel="Confirm approval"
                            disabled={!k.payoutDestination} action={approveKycAction.bind(null, k.sellerId)} />
                          <StoreRowAction label="Reject" fieldLabel="Reason" tone="danger" confirmLabel="Reject"
                            action={rejectKycAction.bind(null, k.sellerId)} />
                        </div>
                      ) : (
                        <p className="text-[12px] text-(--ink-soft)">{k.status === "REJECTED" ? k.rejectReason : "Approved"} · {k.reviewedBy}</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager result={result} searchParams={{ tab: "kyc", status }} />
      </AdminCard>
    </>
  );
}

async function OrdersTab({ actor, page }: { actor: string; page: number }) {
  let result;
  try {
    result = await storeApi.orders(actor, page);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <AdminCard padded={false}>
      <ListToolbar summary={resultSummary(result.page + 1, result.size, result.total, result.items.length)} />
      {result.items.length === 0 ? (
        <EmptyState icon={Store} title="No orders yet" description="Paid orders appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Seller</th><th>Buyer</th><th>Amount</th><th>Gateway (Razorpay)</th><th>Status</th></tr>
            </thead>
            <tbody>
              {result.items.map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold">{o.productTitle}</td>
                  <td>{o.sellerName ?? "—"}</td>
                  <td className="text-[12.5px]">{o.buyerEmail}</td>
                  <td className="tabular-nums">{inr(o.amountMinor)}<p className="text-[11px] text-(--ink-mute)">Plugio fee {inr(o.platformFeeMinor)}</p></td>
                  <td className="tabular-nums text-[12.5px]">
                    {inr(o.gatewayFeeMinor ?? 0)}<p className="text-[11px] text-(--ink-mute)">charged to creator</p>
                    <p className="text-[11px] text-(--ink-mute)">{o.actualGatewayFeeKnown ? `Razorpay took ${inr(o.actualGatewayFeeMinor ?? 0)}` : "Razorpay fee not in yet"}</p>
                  </td>
                  <td className="text-[12.5px]">
                    <Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge>
                    <p className="mt-1 text-[11px] text-(--ink-mute)">{formatDateTime(o.paidAt)}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager result={result} searchParams={{ tab: "orders" }} />
    </AdminCard>
  );
}

async function ProductsTab({ actor, page }: { actor: string; page: number }) {
  let result;
  try {
    result = await storeApi.products(actor, page);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <AdminCard padded={false}>
      <ListToolbar summary={resultSummary(result.page + 1, result.size, result.total, result.items.length)} />
      {result.items.length === 0 ? (
        <EmptyState icon={Store} title="No products yet" description="Creator products appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Seller</th><th>Price</th><th>Sales / views</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold">{p.title}</td>
                  <td>{p.sellerName ?? "—"}<p className="text-[11px] text-(--ink-mute)">@{p.sellerUsername}</p></td>
                  <td className="tabular-nums">{inr(p.priceMinor)}</td>
                  <td className="tabular-nums">{p.salesCount} / {p.viewCount}</td>
                  <td className="text-[12.5px]"><Badge tone={statusTone(p.status)}>{statusLabel(p.status)}</Badge>{p.suspendedReason && <p className="mt-1 text-[11px] text-(--ink-mute)">{p.suspendedReason}</p>}</td>
                  <td>
                    {p.status === "SUSPENDED" ? (
                      <StoreRowAction label="Restore" fieldLabel={null} confirmLabel="Restore to draft"
                        action={unsuspendProductAction.bind(null, p.id)} />
                    ) : (
                      <StoreRowAction label="Suspend" fieldLabel="Reason" tone="danger" confirmLabel="Suspend"
                        action={suspendProductAction.bind(null, p.id)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager result={result} searchParams={{ tab: "products" }} />
    </AdminCard>
  );
}
