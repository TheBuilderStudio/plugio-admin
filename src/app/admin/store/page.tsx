import { Store } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { storeApi, type StorePage } from "@/lib/store-api";
import { validatePage } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard, FilterPills } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { StoreRowAction } from "@/components/store/StoreRowAction";
import { CommissionPolicyForm } from "@/components/store/CommissionPolicyForm";
import { formatDateTime } from "@/lib/utils";
import {
  markPayoutPaidAction,
  rejectPayoutAction,
  suspendProductAction,
  unsuspendProductAction,
  updateCommissionPolicyAction,
} from "@/actions/store.actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
type Tab = "payouts" | "orders" | "products" | "commission";
const TABS: { id: Tab; label: string }[] = [
  { id: "payouts", label: "Payouts" },
  { id: "orders", label: "Orders" },
  { id: "products", label: "Products" },
  { id: "commission", label: "Commission policy" },
];

interface StorePageProps {
  searchParams: Promise<{ tab?: string; status?: string; page?: string }>;
}

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
  const session = await requireAdmin();
  const actor = session.user?.email ?? "";
  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : "payouts";
  const page = validatePage(params.page) - 1; // backend pages are 0-based
  const status = params.status === "PAID" || params.status === "REJECTED" ? params.status : "REQUESTED";

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Digital store"
        title="Store operations"
        description="Pay out seller balances and take down products. Every action is audited."
      />
      <FilterPills items={TABS.map((t) => ({ href: `/admin/store?tab=${t.id}`, label: t.label, active: tab === t.id }))} />

      {tab === "payouts" && <PayoutsTab actor={actor} status={status} page={page} />}
      {tab === "orders" && <OrdersTab actor={actor} page={page} />}
      {tab === "products" && <ProductsTab actor={actor} page={page} />}
      {tab === "commission" && <CommissionTab actor={actor} />}
    </AdminPage>
  );
}

async function CommissionTab({ actor }: { actor: string }) {
  let policy;
  try {
    policy = await storeApi.commissionPolicy(actor);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <AdminCard>
      <CommissionPolicyForm
        digital={String(policy.digitalProductsFeePercent)}
        bookings={String(policy.bookingsFeePercent)}
        version={policy.version}
        updatedBy={policy.updatedBy}
        updatedAt={policy.updatedAt ? formatDateTime(policy.updatedAt) : null}
        action={updateCommissionPolicyAction}
      />
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
      <FilterPills
        items={(["REQUESTED", "PAID", "REJECTED"] as const).map((s) => ({
          href: `/admin/store?tab=payouts&status=${s}`,
          label: s === "REQUESTED" ? "To pay" : s === "PAID" ? "Paid" : "Rejected",
          active: status === s,
        }))}
      />
      <AdminCard padded={false}>
        {result.items.length === 0 ? (
          <EmptyState icon={Store} title="No payouts here" description="Seller payout requests appear in this queue." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>Seller</th><th>Amount</th><th>Send to</th><th>Requested</th><th>Action</th></tr>
              </thead>
              <tbody>
                {result.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-semibold">{p.sellerName ?? "—"}</p>
                      <p className="text-[11.5px] text-(--ink-mute)">{p.sellerEmail}</p>
                    </td>
                    <td className="font-semibold tabular-nums">{inr(p.amountMinor)}</td>
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

async function OrdersTab({ actor, page }: { actor: string; page: number }) {
  let result;
  try {
    result = await storeApi.orders(actor, page);
  } catch (e) {
    return <ErrorCard error={e} />;
  }
  return (
    <AdminCard padded={false}>
      {result.items.length === 0 ? (
        <EmptyState icon={Store} title="No orders yet" description="Paid store orders appear here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr><th>Product</th><th>Seller</th><th>Buyer</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {result.items.map((o) => (
                <tr key={o.id}>
                  <td className="font-semibold">{o.productTitle}</td>
                  <td>{o.sellerName ?? "—"}</td>
                  <td className="text-[12.5px]">{o.buyerEmail}</td>
                  <td className="tabular-nums">{inr(o.amountMinor)}<p className="text-[11px] text-(--ink-mute)">fee {inr(o.platformFeeMinor)}</p></td>
                  <td className="text-[12.5px]">
                    {o.status}
                    <p className="text-[11px] text-(--ink-mute)">{formatDateTime(o.paidAt)}</p>
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
      {result.items.length === 0 ? (
        <EmptyState icon={Store} title="No products yet" description="Seller products appear here." />
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
                  <td className="text-[12.5px]">{p.status}{p.suspendedReason && <p className="text-[11px] text-(--ink-mute)">{p.suspendedReason}</p>}</td>
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
