import { Suspense } from "react";
import Link from "next/link";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getBookingCounts, listBookings, type BookingFilter } from "@/lib/db/marketplace";
import { validatePage, validateSearch } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";
import { SavedViews } from "@/components/shared/SavedViews";
import { ListToolbar, resultSummary } from "@/components/shared/ListToolbar";
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
        title="Sessions"
        description="Sessions creators sell." hint="Watch for refunds that failed, unpaid holds, broken meeting links and creators who keep cancelling."
      />
      <Suspense fallback={null}>
        <SavedViews pageKey="sessions" />
      </Suspense>

      {counts.repeatCancellers.length > 0 && (
        <div role="note" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] text-amber-900">
          <span className="inline-flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-3.5 w-3.5" /> Keep cancelling paid customers:</span>
          {counts.repeatCancellers.map((c) => (
            <Link key={c.creator_id} href={`/admin/users/${c.creator_id}`} className="rounded-full border border-amber-300 bg-white px-2.5 py-0.5 font-medium hover:border-amber-500">
              {c.name ?? c.email} · {c.n}
            </Link>
          ))}
        </div>
      )}

      <AdminCard padded={false}>
        <ListToolbar
          pills={FILTERS.map((f) => ({
            href: `/admin/bookings?filter=${f.id}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
            label: f.label,
            active: f.id === filter,
            count: f.id === "UPCOMING" ? counts.upcoming : f.id === "NEEDS_ATTENTION" ? counts.needsAttention : undefined, // "Cancelled" lists all time, so a 30-day count there would not match the list
          }))}
          search={{ placeholder: "Search creator or customer", value: search, hidden: { filter } }}
          summary={resultSummary(page, result.pageSize, result.total, result.items.length)}
          clearHref={search || filter !== "UPCOMING" ? "/admin/bookings" : undefined}
        />

        {result.items.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No sessions"
            description={filter === "NEEDS_ATTENTION" ? "Nothing needs you." : "Nothing matches this view."}
            action={search || filter !== "UPCOMING" ? { label: "Back to upcoming", href: "/admin/bookings" } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr><th>When</th><th>Creator</th><th>Customer</th><th>Status</th><th className="text-right">Amount</th></tr>
              </thead>
              <tbody>
                {result.items.map((b) => {
                  return (
                    <tr key={b.id}>
                      <td className="whitespace-nowrap">
                        <p className="font-semibold">{formatDateTime(b.slot_start)}</p>
                        <p className="text-[11.5px] text-(--ink-mute)">{b.session_title ?? "Session"}</p>
                      </td>
                      <td>
                        <Link href={`/admin/users/${b.creator_id}`} className="font-semibold text-brand-500 hover:underline">{b.creator_name ?? b.creator_email}</Link>
                      </td>
                      <td>
                        <p className="font-medium">{b.attendee_name}</p>
                        <p className="text-[11.5px] text-(--ink-mute)">{b.attendee_email}</p>
                      </td>
                      <td className="max-w-[280px]">
                        <div className="flex flex-wrap gap-1">
                          <Badge tone={statusTone(b.status)}>{statusLabel(b.status)}</Badge>
                          <Badge tone={statusTone(b.payment_status)}>{PAYMENT_LABEL[b.payment_status] ?? statusLabel(b.payment_status)}</Badge>
                        </div>
                        {b.status === "CANCELLED" && (
                          <p className="mt-1 text-[11.5px] text-(--ink-soft)">By {(b.cancelled_by ?? "unknown").toLowerCase()}{b.cancel_reason ? `: ${b.cancel_reason}` : ""}</p>
                        )}
                        {(b.meeting_status === "FAILED" || b.meeting_status === "UNAVAILABLE") && (
                          <p className="mt-1 text-[11.5px] text-red-700">Meeting link {b.meeting_status.toLowerCase()}{b.meeting_error ? `: ${b.meeting_error}` : ""}</p>
                        )}
                        {b.payment_status === "REFUND_PENDING" && (
                          <p className="mt-1 text-[11.5px] text-red-700">Refund not accepted yet. Retried every minute.</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">{b.amount_minor ? formatMinor(b.amount_minor, b.currency) : "Free"}</td>
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
