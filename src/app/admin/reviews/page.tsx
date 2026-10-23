import { Star } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { reviewApi } from "@/lib/store-api";
import { validatePage } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";
import { ListToolbar, resultSummary } from "@/components/shared/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { StoreRowAction } from "@/components/store/StoreRowAction";
import { formatDateTime } from "@/lib/utils";
import { hideReviewAction, keepReviewAction } from "@/actions/review.actions";

export const dynamic = "force-dynamic";

const STATES = [
  { id: "REPORTED", label: "Waiting for a decision" },
  { id: "KEPT", label: "Kept public" },
  { id: "HIDDEN", label: "Removed" },
] as const;

interface ReviewsPageProps {
  searchParams: Promise<{ state?: string; page?: string }>;
}

export default async function ReviewsAdminPage({ searchParams }: ReviewsPageProps) {
  const session = await requireAdmin();
  const actor = session.user?.email ?? "";
  const params = await searchParams;
  const state = STATES.some((s) => s.id === params.state) ? (params.state as string) : "REPORTED";
  const page = validatePage(params.page) - 1;

  let result;
  try {
    result = await reviewApi.queue(actor, state, page);
  } catch (e) {
    return (
      <AdminPage>
        <AdminCard>
          <p className="text-[13px] font-semibold text-red-700">Could not load reviews</p>
          <p className="mt-1 text-[12.5px] text-(--ink-soft)">{e instanceof Error ? e.message : "Unknown error"}</p>
        </AdminCard>
      </AdminPage>
    );
  }

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Marketplace"
        title="Review moderation"
        description="Reported reviews waiting for you." hint="Creators cannot hide reviews. They report one, and you keep it or remove it with a reason the creator sees. Reviews hidden before this rule wait here too."
      />
      <AdminCard padded={false}>
        <ListToolbar
          pills={STATES.map((s) => ({ href: `/admin/reviews?state=${s.id}`, label: s.label, active: state === s.id }))}
          summary={resultSummary(result.page + 1, 25, result.total, result.rows.length)}
        />
        {result.rows.length === 0 ? (
          <EmptyState icon={Star} title={state === "REPORTED" ? "Queue is clear" : "Nothing here"} description={state === "REPORTED" ? "No reviews waiting for a decision." : "Nothing in this list yet."} />
        ) : (
          <div className="divide-y divide-(--line)">
            {result.rows.map((r) => (
              <div key={r.id} className="space-y-2 px-4 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p className="text-[13px] font-semibold">{r.reviewerName}</p>
                  <span className="text-[12px] tabular-nums" aria-label={`${r.rating} out of 5`}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
                  <span className="text-[11.5px] text-(--ink-mute)">{r.itemTitle} · {r.kind.toLowerCase()}</span>
                  <span className="text-[11.5px] text-(--ink-mute)">
                    for {r.creatorName ?? "creator"}{r.creatorUsername ? ` (@${r.creatorUsername})` : ""}
                  </span>
                  {r.status === "HIDDEN" && <Badge tone="neutral">Hidden now</Badge>}
                  {r.saleReversed && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">sale reversed</span>}
                </div>
                <p className="text-[13px] leading-relaxed">{r.body}</p>
                {r.replyBody && <p className="text-[12px] text-(--ink-soft)">Creator reply: {r.replyBody}</p>}
                {r.reportReason && (
                  <p className="text-[12px] text-(--ink-soft)">
                    <span className="font-semibold">Reported:</span> {r.reportReason}
                    {r.reportNote ? ` · “${r.reportNote}”` : ""}
                    {r.reportedAt ? ` · ${formatDateTime(r.reportedAt)}` : ""}
                  </p>
                )}
                {r.moderationNote && <p className="text-[12px] text-(--ink-soft)">Decision note: {r.moderationNote}</p>}
                {r.moderation === "REPORTED" && (
                  <div className="flex flex-wrap gap-3 pt-1">
                    {!r.saleReversed && (
                      <StoreRowAction label="Keep public" fieldLabel="Note (optional)" placeholder="Why it stays (optional)"
                        confirmLabel="Keep public" action={keepReviewAction.bind(null, r.id)} />
                    )}
                    <StoreRowAction label="Remove review" fieldLabel="Reason shown to the creator" tone="danger"
                      confirmLabel="Remove" action={hideReviewAction.bind(null, r.id)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Pagination currentPage={result.page + 1} totalPages={result.totalPages} total={result.total} pageSize={25}
          baseUrl="/admin/reviews" searchParams={{ state }} />
      </AdminCard>
    </AdminPage>
  );
}
