import Link from "next/link";
import { Users, Search, ExternalLink, TrendingUp, Download } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getUsers, getDashboardStats } from "@/lib/db/queries";
import { validateSearch, validatePage } from "@/lib/validation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDate, getInitials } from "@/lib/utils";

interface UsersPageProps {
  searchParams: Promise<{
    search?: string;
    page?: string;
    filter?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const search = validateSearch(params.search);
  const page = validatePage(params.page);
  
  const filterRaw = params.filter ?? "ALL";
  const filter = ["ALL", "SUBSCRIBED", "FREE"].includes(filterRaw)
    ? (filterRaw as "ALL" | "SUBSCRIBED" | "FREE")
    : "ALL";

  const [result, stats] = await Promise.all([
    getUsers(search, filter, page, 20),
    getDashboardStats()
  ]);

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6 lg:space-y-8">
      
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-xl p-8 bg-white border border-neutral-200 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-extrabold text-[#09090B] tracking-tight flex items-center gap-3">
                User Directory
              </h1>
              <p className="text-neutral-500 font-medium mt-1">
                Manage and view your platform's registered users.
              </p>
            </div>
            
            {/* Quick Stats Badges */}
            <div className="flex items-center gap-3">
              <div className="bg-[#FAFAFA] border border-neutral-200 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-inner">
                <Users className="w-4 h-4 text-neutral-400" />
                <span className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest">Total Users:</span>
                <span className="text-xs font-black text-[#09090B]">{stats.total_users.toLocaleString()}</span>
              </div>
              <div className="bg-orange-50/50 border border-orange-100/60 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-inner">
                <TrendingUp className="w-4 h-4 text-[#FF6719]" />
                <span className="text-[10px] font-extrabold text-[#FF6719] uppercase tracking-widest">New (7 Days):</span>
                <span className="text-xs font-black text-[#EA580C]">+{stats.new_last_7_days.toLocaleString()}</span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 mt-6 p-1 bg-neutral-100/80 rounded-xl w-fit">
              {[
                { value: "ALL", label: "All Users" },
                { value: "SUBSCRIBED", label: "Subscribers" },
                { value: "FREE", label: "Free Users" },
              ].map((tab) => (
                <Link
                  key={tab.value}
                  href={`/admin/users?filter=${tab.value}${search ? `&search=${search}` : ""}`}
                  className={`px-4 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-all duration-200 ${
                    filter === tab.value
                      ? "bg-white text-[#09090B] shadow-sm border border-neutral-200/60"
                      : "text-neutral-400 hover:text-[#09090B] hover:bg-white/50 border border-transparent"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Search Bar & Actions */}
          <div className="w-full md:w-auto md:min-w-[320px] md:self-end flex flex-col sm:flex-row items-center gap-3">
            <a
              href="/api/export/users"
              download
              className="flex items-center gap-2 px-4 py-3 bg-white border border-neutral-200 hover:border-orange-200 hover:bg-orange-50 text-neutral-600 hover:text-[#FF6719] font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </a>
            <form method="GET" className="relative flex items-center">
              {filter !== "ALL" && <input type="hidden" name="filter" value={filter} />}
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-neutral-400" />
              </div>
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Search by name or email…"
                autoComplete="off"
                maxLength={100}
                className="block w-full pl-10 pr-24 py-3 bg-[#FAFAFA] border border-neutral-200 rounded-xl text-sm text-[#09090B] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FF6719]/20 focus:border-[#FF6719] transition-all shadow-inner"
              />
              <div className="absolute inset-y-1 right-1 flex items-center gap-1">
                {search && (
                  <Link
                    href="/admin/users"
                    className="px-2 py-1.5 text-neutral-400 hover:text-neutral-700 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors"
                  >
                    Clear
                  </Link>
                )}
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#FF6719] hover:bg-[#EA580C] text-white text-xs font-bold uppercase tracking-widest rounded-lg transition-colors shadow-sm"
                >
                  Find
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
        {result.items.length === 0 ? (
          <div className="p-12">
            <EmptyState
              icon={Users}
              title={search ? "No users found" : "No users yet"}
              description={
                search
                  ? `We couldn't find anyone matching "${search}".`
                  : "Users will appear here once they register."
              }
            />
          </div>
        ) : (
          <>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 border-b border-neutral-200">
                    <th className="py-4 px-6 text-[11px] font-extrabold text-neutral-500 uppercase tracking-widest">User Profile</th>
                    <th className="py-4 px-6 text-[11px] font-extrabold text-neutral-500 uppercase tracking-widest">Registered Date</th>
                    <th className="py-4 px-6 text-[11px] font-extrabold text-neutral-500 uppercase tracking-widest">Beta Access</th>
                    <th className="py-4 px-6 text-[11px] font-extrabold text-neutral-500 uppercase tracking-widest">Subscription</th>
                    <th className="py-4 px-6 text-[11px] font-extrabold text-neutral-500 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {result.items.map((user) => (
                    <tr key={user.id} className="hover:bg-neutral-50/50 transition-colors group">
                      {/* User Profile */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          {user.picture ? (
                            <div className="w-10 h-10 rounded-xl overflow-hidden border border-neutral-200 shadow-sm flex-shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={user.picture} alt={user.name ?? user.email} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#FF6719] border border-orange-100 shadow-sm flex items-center justify-center flex-shrink-0 group-hover:bg-[#FF6719] group-hover:border-[#EA580C] group-hover:text-white transition-all duration-300">
                              <span className="text-sm font-bold">
                                {getInitials(user.name)}
                              </span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-[#09090B] text-sm truncate max-w-[220px]">
                              {user.name ?? "—"}
                            </p>
                            <p className="text-neutral-500 text-xs font-medium truncate max-w-[220px] mt-0.5">
                              {user.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Registered Date */}
                      <td className="py-4 px-6">
                        <span className="text-neutral-600 text-sm font-medium">
                          {formatDate(user.created_at)}
                        </span>
                      </td>

                      {/* Beta Status */}
                      <td className="py-4 px-6">
                        <StatusBadge status={user.access_status} />
                      </td>

                      {/* Subscription */}
                      <td className="py-4 px-6">
                        <StatusBadge status={user.subscription_status ?? "NONE"} />
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6 text-right">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="inline-flex items-center gap-2 text-xs font-bold text-neutral-500 hover:text-[#FF6719] bg-white hover:bg-orange-50 border border-neutral-200 hover:border-orange-200 shadow-sm px-3 py-2 rounded-lg transition-all"
                        >
                          View Profile
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer / Pagination */}
            <div className="border-t border-neutral-200 bg-neutral-50/50 rounded-b-xl">
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
      </div>
    </div>
  );
}
