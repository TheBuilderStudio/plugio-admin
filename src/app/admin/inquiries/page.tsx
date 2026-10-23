import { Suspense } from "react";
import Link from "next/link";
import { Inbox, Search } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getInquiryStats, listInquiries } from "@/lib/db/marketplace";
import { validatePage, validateSearch } from "@/lib/validation";
import { AdminPage, AdminPageHeader, AdminCard, FilterPills, KpiTile } from "@/components/ui/page-shell";
import { SavedViews } from "@/components/shared/SavedViews";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pagination } from "@/components/shared/Pagination";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

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
        kicker="Marketplace"
        title="Brand inquiries"
        description="Messages brands send to creators from portfolio pages. Unread ones are creators missing deals; useful for spotting spam and for nudging creators."
      />
      <Suspense fallback={null}>
        <SavedViews pageKey="inquiries" />
      </Suspense>
      <div className="grid grid-cols-3 gap-3">
        <KpiTile label="All time" value={stats.total.toLocaleString()} />
        <KpiTile label="Last 7 days" value={stats.last7d.toLocaleString()} />
        <KpiTile label="Unread by creators" value={stats.unread.toLocaleString()} tone={stats.unread > 0 ? "alert" : "default"} />
      </div>

      <AdminCard padded={false}>
        <div className="flex flex-col gap-3 border-b border-(--line) px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterPills
            items={[
              { href: "/admin/inquiries", label: "All", active: !unreadOnly },
              { href: "/admin/inquiries?view=unread", label: "Unread", active: unreadOnly },
            ]}
          />
          <form method="get" className="relative sm:w-[260px]">
            {unreadOnly && <input type="hidden" name="view" value="unread" />}
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--ink-mute)" />
            <input type="search" name="search" defaultValue={search} placeholder="Brand, sender or creator" maxLength={100} className="admin-input py-2 pl-9 pr-3" />
          </form>
        </div>
        {result.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No inquiries"
            description={unreadOnly ? "Every inquiry has been read." : "Nothing matches this view."}
            action={search || unreadOnly ? { label: "Show all inquiries", href: "/admin/inquiries" } : undefined}
          />
        ) : (
          <ul className="divide-y divide-(--line)">
            {result.items.map((i) => (
              <li key={i.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-(--ink)">
                      {i.sender_name}
                      {i.brand ? <span className="font-normal text-(--ink-soft)"> · {i.brand}</span> : null}
                    </p>
                    <p className="text-[12px] text-(--ink-mute)">
                      {i.sender_email} to{" "}
                      <Link href={`/admin/users/${i.creator_id}`} className="font-medium text-brand-500 hover:underline">
                        {i.creator_name ?? i.creator_email}
                      </Link>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!i.read && <Badge tone="warning">Unread</Badge>}
                    <span className="text-[11.5px] text-(--ink-mute)">{formatRelativeTime(i.created_at)}</span>
                  </div>
                </div>
                <p className="mt-1.5 line-clamp-2 text-[13px] text-(--ink-soft)">{i.message}</p>
              </li>
            ))}
          </ul>
        )}
        <Pagination currentPage={page} totalPages={result.totalPages} total={result.total} pageSize={result.pageSize} baseUrl="/admin/inquiries" searchParams={kept} />
      </AdminCard>
    </AdminPage>
  );
}
