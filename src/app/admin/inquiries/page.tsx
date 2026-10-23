import { Suspense } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getInquiryStats, listInquiries } from "@/lib/db/marketplace";
import { validatePage, validateSearch } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard, KpiTile } from "@/components/ui/page-shell";
import { SavedViews } from "@/components/shared/SavedViews";
import { ListToolbar, resultSummary } from "@/components/shared/ListToolbar";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime, getInitials } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ view?: string; search?: string; page?: string }>;
}

export default async function InquiriesPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;
  const unreadOnly = params.view === "unread";
  const search = validateSearch(params.search);
  const page = validatePage(params.page);

  const [stats, result] = await Promise.all([getInquiryStats(), listInquiries(unreadOnly, search, page)]);
  const kept: Record<string, string> = { ...(unreadOnly ? { view: "unread" } : {}), ...(search ? { search } : {}) };

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="People"
        title="Brand inquiries"
        description="Messages brands sent to creators." hint="Unread ones are creators missing deals. Useful for spotting spam and for nudging creators."
      />
      <Suspense fallback={null}>
        <SavedViews pageKey="inquiries" />
      </Suspense>
      <div className="grid grid-cols-3 gap-3">
        <KpiTile label="All time" value={stats.total.toLocaleString()} />
        <KpiTile label="Last 7 days" value={stats.last7d.toLocaleString()} />
        <KpiTile label="Unread" value={stats.unread.toLocaleString()} tone={stats.unread > 0 ? "alert" : "default"} />
      </div>

      <AdminCard padded={false}>
        <ListToolbar
          pills={[
            { href: "/admin/inquiries", label: "All", active: !unreadOnly, count: stats.total },
            { href: "/admin/inquiries?view=unread", label: "Unread", active: unreadOnly, count: stats.unread },
          ]}
          search={{ placeholder: "Search brand, sender or creator", value: search, hidden: unreadOnly ? { view: "unread" } : undefined }}
          summary={resultSummary(page, result.pageSize, result.total, result.items.length)}
          clearHref={search || unreadOnly ? "/admin/inquiries" : undefined}
        />
        {result.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={unreadOnly ? "All caught up" : "No inquiries"}
            description={unreadOnly ? "Every inquiry has been read." : search ? `Nothing matched “${search}”.` : "Brands have not written yet."}
            action={search || unreadOnly ? { label: "Show all inquiries", href: "/admin/inquiries" } : undefined}
          />
        ) : (
          <ul className="divide-y divide-(--line)">
            {result.items.map((i) => (
              <li key={i.id} className="flex gap-3 px-5 py-3.5 transition-colors hover:bg-[#FAF7F2]">
                <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[12px] font-bold text-brand-500" aria-hidden>
                  {getInitials(i.sender_name)}
                  {!i.read && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-amber-500" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate text-[13.5px] font-semibold text-(--ink)">
                      {i.sender_name}
                      {i.brand ? <span className="font-normal text-(--ink-soft)"> · {i.brand}</span> : null}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {!i.read && <Badge tone="warning">Unread</Badge>}
                      <span className="text-[11.5px] text-(--ink-mute)">{formatRelativeTime(i.created_at)}</span>
                    </div>
                  </div>
                  <p className="text-[12px] text-(--ink-mute)">
                    {i.sender_email} → {" "}
                    <Link href={`/admin/users/${i.creator_id}`} className="font-medium text-brand-500 hover:underline">
                      {i.creator_name ?? i.creator_email}
                    </Link>
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] text-(--ink-soft)">{i.message}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination currentPage={page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} baseUrl="/admin/inquiries" searchParams={kept} />
      </AdminCard>
    </AdminPage>
  );
}
