import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, Search } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getBookingCounts, listBookings, type BookingFilter } from "@/lib/db/marketplace";
import { validatePage, validateSearch } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard, FilterPills, KpiTile } from "@/components/ui/page-shell";
import { SavedViews } from "@/components/shared/SavedViews";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-tone";
import { formatDateTime, formatMinor } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS: { id: BookingFilter; label: string }[] = [
  { id: "UPCOMING", label: "Upcoming" },
  { id: "NEEDS_ATTENTION", label: "Needs attention" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "COMPLETED", label: "Completed" },
  { id: "ALL", label: "All" },
];

const PAYMENT_LABEL: Record<string, string> = {
  FREE: "Free",
  PENDING: "Awaiting payment",
  PAID: "Paid",
  REFUND_PENDING: "Refund stuck",
  REFUNDED: "Refunded",
};

interface Props {
  searchParams: Promise<{ filter?: string; search?: string; page?: string }>;
}

export default async function BookingsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const filter = FILTERS.find((f) => f.id === params.filter)?.id ?? "UPCOMING";
  const search = validateSearch(params.search);
  const page = validatePage(params.page);

  const [counts, result] = await Promise.all([getBookingCounts(), listBookings(filter, search, page)]);
  const kept: Record<string, string> = { filter, ...(search ? { search } : {}) };

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Marketplace"
        title="Sessions"
        description="Paid and free sessions creators sell. Watch for refunds that did not go through, unpaid holds, meeting links that failed, and creators who keep cancelling."
      />
      <Suspense fallback={null}>
        <SavedViews pageKey="sessions" />
      </Suspense>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Upcoming" value={String(counts.upcoming)} href="/admin/bookings?filter=UPCOMING" />
        <KpiTile
          label="Needs attention"
          value={String(counts.needsAttention)}
          hint="Refund stuck, unpaid over a day, meeting link failed"
          href="/admin/bookings?filter=NEEDS_ATTENTION"
          tone={counts.needsAttention > 0 ? "alert" : "default"}
        />
        <KpiTile label="Cancelled (30 days)" value={String(counts.cancelled30d)} href="/admin/bookings?filter=CANCELLED" />
        <KpiTile
          label="Repeat cancellers"
          value={String(counts.repeatCancellers.length)}
          hint="Creators with 3+ cancellations in 90 days"
          tone={counts.repeatCancellers.length > 0 ? "alert" : "default"}
        />
      </div>

      {counts.repeatCancellers.length > 0 && (
        <AdminCard padded={false}>
          <p className="border-b border-(--line) px-5 py-3 text-[13px] font-semibold">Creators who keep cancelling paid customers</p>
          <ul className="divide-y divide-(--line)">
            {counts.repeatCancellers.map((c) => (
              <li key={c.creator_id}>
                <Link href={`/admin/users/${c.creator_id}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-[#FAF7F2]">
                  <span className="truncate text-[13.5px] font-medium">{c.name ?? c.email}</span>
                  <span className="text-[12.5px] font-semibold text-red-700">{c.n} cancelled in 90 days</span>
                </Link>
              </li>
            ))}
          </ul>
        </AdminCard>
      )}

      <AdminCard padded={false}>
        <div className="flex flex-col gap-3 border-b border-(--line) px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterPills
            items={FILTERS.map((f) => ({
              href: `/admin/bookings?filter=${f.id}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
              label: f.label,
              active: f.id === filter,
            }))}
          />
          <form method="get" className="relative sm:w-[260px]">
            <input type="hidden" name="filter" value={filter} />
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--ink-mute)" />
            <input type="search" name="search" defaultValue={search} placeholder="Creator or customer" maxLength={100} className="admin-input py-2 pl-9 pr-3" />
          </form>
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No sessions here"
            description={filter === "NEEDS_ATTENTION" ? "No stuck refunds, unpaid holds or failed meeting links. Nothing needs you." : "Nothing matches this view."}
            action={search || filter !== "UPCOMING" ? { label: "Back to upcoming", href: "/admin/bookings" } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>When</th><th>Creator</th><th>Customer</th><th>Payment</th><th className="text-right">Amount</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {result.items.map((b) => {
                  return (
                    <tr key={b.id}>
                      <td className="whitespace-nowrap">
                        <p className="font-semibold">{formatDateTime(b.slot_start)}</p>
                        <p className="text-[11.5px] text-(--ink-mute)">{b.session_title ?? "Session"}</p>
                        <Badge tone={statusTone(b.status)} className="mt-1">{statusLabel(b.status)}</Badge>
                      </td>
                      <td>
                        <Link href={`/admin/users/${b.creator_id}`} className="font-semibold text-brand-500 hover:underline">{b.creator_name ?? b.creator_email}</Link>
                      </td>
                      <td>
                        <p className="font-medium">{b.attendee_name}</p>
                        <p className="text-[11.5px] text-(--ink-mute)">{b.attendee_email}</p>
                      </td>
                      <td><Badge tone={statusTone(b.payment_status)}>{PAYMENT_LABEL[b.payment_status] ?? statusLabel(b.payment_status)}</Badge></td>
                      <td className="whitespace-nowrap text-right tabular-nums">{b.amount_minor ? formatMinor(b.amount_minor, b.currency) : "—"}</td>
                      <td className="max-w-[260px] text-[12px] text-(--ink-soft)">
                        {b.status === "CANCELLED" && (
                          <p>Cancelled by {(b.cancelled_by ?? "unknown").toLowerCase()}{b.cancel_reason ? `: ${b.cancel_reason}` : ""}</p>
                        )}
                        {(b.meeting_status === "FAILED" || b.meeting_status === "UNAVAILABLE") && (
                          <p className="text-red-700">Meeting link {b.meeting_status.toLowerCase()}{b.meeting_error ? `: ${b.meeting_error}` : ""}</p>
                        )}
                        {b.payment_status === "REFUND_PENDING" && (
                          <p className="text-red-700">Customer is owed a refund; the gateway has not accepted it. Retried every minute.</p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination currentPage={page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} baseUrl="/admin/bookings" searchParams={kept} />
      </AdminCard>
    </AdminPage>
  );
}
