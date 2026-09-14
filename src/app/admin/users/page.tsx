import Link from "next/link";
import { Users, Search, Download } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getUsers, getDashboardStats } from "@/lib/db/queries";
import { getActiveDbContext } from "@/lib/db";
import { validateSearch, validatePage } from "@/lib/validation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminPage, AdminCard, FilterPills } from "@/components/ui/page-shell";
import { formatDate, getInitials } from "@/lib/utils";
import type { AdminUserListFilter } from "@/types";

const USER_FILTERS: { value: AdminUserListFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "APPROVED_NO_TRIAL", label: "No trial" },
  { value: "TRIAL_NO_PUBLISH", label: "No publish" },
  { value: "TRIAL_ENDING", label: "Ending" },
  { value: "TRIALING", label: "Trial" },
  { value: "PAID", label: "Paid" },
  { value: "FREE", label: "No plan" },
];

const USER_FILTER_VALUES = USER_FILTERS.map((tab) => tab.value);

interface UsersPageProps {
  searchParams: Promise<{ search?: string; page?: string; filter?: string }>;
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

  const dbContext = await getActiveDbContext();
  const [result, stats] = await Promise.all([
    getUsers(search, filter, page, 20),
    getDashboardStats(dbContext),
  ]);

  return (
    <AdminPage>
      <AdminCard padded={false}>
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <FilterPills
              items={USER_FILTERS.map((tab) => ({
                href: `/admin/users?filter=${tab.value}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
                label: tab.label,
                active: filter === tab.value,
              }))}
            />
            <p className="shrink-0 text-[12px] text-[var(--ink-mute)]">
              {stats.total_users.toLocaleString()} total · +{stats.new_last_7_days} / 7d
            </p>
          </div>
          <div className="flex items-center gap-2">
            <form method="GET" className="relative min-w-[200px] flex-1 sm:w-[240px] sm:flex-none">
              {filter !== "ALL" && <input type="hidden" name="filter" value={filter} />}
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-mute)]" />
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Name or email"
                autoComplete="off"
                maxLength={100}
                className="admin-input py-2 pl-9 pr-3"
              />
            </form>
            <a href="/api/export/users" download className="admin-btn-ghost py-2 text-[12px]">
              <Download className="h-3.5 w-3.5" />
              Export
            </a>
          </div>
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={search ? "No users found" : "No users yet"}
            description={
              search
                ? `Nothing matched “${search}”.`
                : "People appear here after they sign in with Google."
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Creator</th>
                    <th>Joined</th>
                    <th>Access</th>
                    <th>Plan</th>
                    <th className="text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <Link href={`/admin/users/${user.id}`} className="flex items-center gap-3">
                          {user.picture ? (
                            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[var(--line)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF6719]/10 text-[12px] font-bold text-[#FF6719]">
                              {getInitials(user.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--ink)]">{user.name ?? "—"}</p>
                            <p className="truncate text-[12px] text-[var(--ink-soft)]">{user.email}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-[var(--ink-soft)]">{formatDate(user.created_at)}</td>
                      <td>
                        <StatusBadge status={user.access_status} />
                      </td>
                      <td>
                        <StatusBadge status={user.subscription_status ?? "NONE"} />
                      </td>
                      <td className="text-right">
                        <Link href={`/admin/users/${user.id}`} className="text-[12.5px] font-semibold text-[#FF6719]">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--line)]">
              <Pagination
                currentPage={page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
                baseUrl="/admin/users"
                searchParams={{
                  ...(search ? { search } : {}),
                  ...(filter !== "ALL" ? { filter } : {}),
                }}
              />
            </div>
          </>
        )}
      </AdminCard>
    </AdminPage>
  );
}
