import { Suspense } from "react";
import Link from "next/link";
import { Users, Download } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getUsers, getDashboardStats, USER_SORTS, type UserSort } from "@/lib/db/queries";
import { getActiveDbContext } from "@/lib/db";
import { validateSearch, validatePage } from "@/lib/validation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Pagination } from "@/components/shared/Pagination";
import { SavedViews } from "@/components/shared/SavedViews";
import { ListToolbar, resultSummary } from "@/components/shared/ListToolbar";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminPage, AdminPageHeader, AdminCard, KpiTile } from "@/components/ui/page-shell";
import { formatDate, getInitials } from "@/lib/utils";
import type { AdminUserListFilter } from "@/types";

const USER_FILTERS: { value: AdminUserListFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "APPROVED_NO_TRIAL", label: "Needs trial" },
  { value: "TRIAL_NO_PUBLISH", label: "Not publishing" },
  { value: "TRIAL_ENDING", label: "Trial ending" },
  { value: "TRIALING", label: "On trial" },
  { value: "PAID", label: "Paid" },
  { value: "FREE", label: "No plan" },
];

const USER_FILTER_VALUES = USER_FILTERS.map((tab) => tab.value);

interface UsersPageProps {
  searchParams: Promise<{ search?: string; page?: string; filter?: string; sort?: string; dir?: string }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const search = validateSearch(params.search);
  const page = validatePage(params.page);
  const filterRaw = params.filter ?? "ALL";
  const filter = USER_FILTER_VALUES.includes(filterRaw as AdminUserListFilter)
    ? (filterRaw as AdminUserListFilter)
    : "ALL";

  const sort: UserSort = USER_SORTS.includes(params.sort as UserSort) ? (params.sort as UserSort) : "joined";
  const dir = params.dir === "asc" ? "asc" : "desc";

  const dbContext = await getActiveDbContext();
  const [result, stats] = await Promise.all([
    getUsers(search, filter, page, 20, sort, dir),
    getDashboardStats(dbContext),
  ]);

  const sortHref = (key: UserSort) => {
    const p = new URLSearchParams();
    if (filter !== "ALL") p.set("filter", filter);
    if (search) p.set("search", search);
    p.set("sort", key);
    p.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `/admin/users?${p.toString()}`;
  };
  return (
    <AdminPage>
      <AdminPageHeader title="Creators" description="Everyone who has signed in." hint="Use the filters to find who needs a nudge: approved but no trial, trialing but never published, or trial ending." />
      <Suspense fallback={null}>
        <SavedViews pageKey="creators" />
      </Suspense>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="All creators" value={stats.total_users.toLocaleString()} href="/admin/users" />
        <KpiTile label="New, 7 days" value={`+${stats.new_last_7_days}`} />
        <KpiTile label="Approved" value={stats.approved_users.toLocaleString()} />
        <KpiTile
          label="Waiting for access"
          value={stats.pending_requests.toLocaleString()}
          href="/admin/beta?status=PENDING"
          tone={stats.pending_requests > 0 ? "alert" : "default"}
        />
      </div>

      <AdminCard padded={false}>
        <ListToolbar
          pills={USER_FILTERS.map((tab) => ({
            href: `/admin/users?filter=${tab.value}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
            label: tab.label,
            active: filter === tab.value,
          }))}
          search={{
            placeholder: "Search name or email",
            value: search,
            hidden: { ...(filter !== "ALL" ? { filter } : {}), ...(sort !== "joined" || dir !== "desc" ? { sort, dir } : {}) },
          }}
          actions={
            <a href="/api/export/users" download className="admin-btn-ghost py-2 text-[12px]">
              <Download className="h-3.5 w-3.5" />
              Export
            </a>
          }
          summary={resultSummary(page, result.pageSize, result.total, result.items.length)}
          clearHref={search || filter !== "ALL" ? "/admin/users" : undefined}
        />

        {result.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "No creators found" : filter !== "ALL" ? "Nobody in this group" : "No creators yet"}
            description={
              search
                ? `Nothing matched “${search}”.`
                : filter !== "ALL"
                  ? "Try another filter."
                  : "People appear after they sign in."
            }
            action={search || filter !== "ALL" ? { label: "Clear filters", href: "/admin/users" } : undefined}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <SortTh k="name" active={sort} dir={dir} href={sortHref("name")}>Creator</SortTh>
                    <SortTh k="joined" active={sort} dir={dir} href={sortHref("joined")}>Joined</SortTh>
                    <th>Access</th>
                    <th>Plan</th>
                    <SortTh k="channels" active={sort} dir={dir} href={sortHref("channels")} right>Channels</SortTh>
                    <SortTh k="published" active={sort} dir={dir} href={sortHref("published")} right>Published</SortTh>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3">
                          {user.picture ? (
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-(--line)">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-[12px] font-bold text-brand-500">
                              {getInitials(user.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-(--ink)">{user.name ?? "—"}</p>
                            <p className="truncate text-[12px] text-(--ink-soft)">{user.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-(--ink-soft)">{formatDate(user.created_at)}</td>
                      <td>
                        <StatusBadge status={user.access_status} />
                      </td>
                      <td>
                        <StatusBadge status={user.subscription_status ?? "NONE"} />
                      </td>
                      <td className="text-right tabular-nums text-(--ink-soft)">{user.channels ?? 0}</td>
                      <td className="text-right tabular-nums text-(--ink-soft)">{user.published ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-(--line)">
              <Pagination
                currentPage={page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
                baseUrl="/admin/users"
                searchParams={{
                  ...(search ? { search } : {}),
                  ...(filter !== "ALL" ? { filter } : {}),
                  ...(sort !== "joined" || dir !== "desc" ? { sort, dir } : {}),
                }}
              />
            </div>
          </>
        )}
      </AdminCard>
    </AdminPage>
  );
}

function SortTh({
  k,
  active,
  dir,
  href,
  right,
  children,
}: {
  k: UserSort;
  active: UserSort;
  dir: "asc" | "desc";
  href: string;
  right?: boolean;
  children: string;
}) {
  const on = active === k;
  return (
    <th className={right ? "text-right" : undefined} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <Link href={href} className="inline-flex items-center gap-1 hover:text-(--ink)">
        {children}
        <span aria-hidden className={on ? "text-brand-500" : "opacity-30"}>
          {on && dir === "asc" ? "↑" : "↓"}
        </span>
      </Link>
    </th>
  );
}
