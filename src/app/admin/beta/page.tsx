import Link from "next/link";
import { ClipboardList, Search, Instagram, Youtube, Facebook, ExternalLink, ShieldAlert, Download } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getBetaRequests } from "@/lib/db/queries";
import { validateSearch, validatePage, validateStatusFilter } from "@/lib/validation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { BetaActions } from "@/components/beta/BetaActions";
import { formatDate, formatFollowers, getInitials } from "@/lib/utils";

interface BetaPageProps {
  searchParams: Promise<{
    status?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function BetaPage({ searchParams }: BetaPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const status = validateStatusFilter(params.status ?? "ALL");
  const search = validateSearch(params.search);
  const page = validatePage(params.page);

  const result = await getBetaRequests(status, search, page, 20);

  const tabs = [
    { value: "ALL", label: "All Requests" },
    { value: "PENDING", label: "Needs Review" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Declined" },
  ] as const;

  function buildTabUrl(tabStatus: string) {
    const p = new URLSearchParams();
    if (tabStatus !== "ALL") p.set("status", tabStatus);
    if (search) p.set("search", search);
    const qs = p.toString();
    return `/admin/beta${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="p-6 md:p-8 max-w-[1600px] mx-auto min-h-screen space-y-6 lg:space-y-8">
      
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-xl p-8 bg-white border border-neutral-200 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-[#09090B] tracking-tight flex items-center gap-3">
              Beta Applications
            </h1>
            <p className="text-neutral-500 font-medium">
              Review creator profiles and manage exclusive beta access.
            </p>
          </div>

          <div className="w-full md:w-auto md:min-w-[320px] flex flex-col sm:flex-row items-center gap-3">
            <a
              href="/api/export/beta"
              download
              className="flex items-center gap-2 px-4 py-3 bg-white border border-neutral-200 hover:border-orange-200 hover:bg-orange-50 text-neutral-600 hover:text-[#FF6719] font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export
            </a>
            <form method="GET" className="relative flex items-center">
              {status !== "ALL" && <input type="hidden" name="status" value={status} />}
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-neutral-400" />
              </div>
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Search applicants..."
                autoComplete="off"
                maxLength={100}
                className="block w-full pl-10 pr-24 py-3 bg-[#FAFAFA] border border-neutral-200 rounded-xl text-sm text-[#09090B] placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#FF6719]/20 focus:border-[#FF6719] transition-all shadow-inner"
              />
              <div className="absolute inset-y-1 right-1 flex items-center gap-1">
                {search && (
                  <Link
                    href={`/admin/beta${status !== "ALL" ? `?status=${status}` : ""}`}
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

      {/* ── Segmented Control & Status Bar ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-[#FAFAFA] border border-neutral-200 p-1 rounded-xl w-fit shadow-inner">
          {tabs.map((tab) => {
            const isActive = status === tab.value;
            return (
              <Link
                key={tab.value}
                href={buildTabUrl(tab.value)}
                className={`px-5 py-2 rounded-lg text-[11px] font-extrabold uppercase tracking-widest transition-all duration-200 ${
                  isActive
                    ? "bg-white text-[#09090B] shadow-sm border border-neutral-200/60"
                    : "text-neutral-400 hover:text-[#09090B] hover:bg-neutral-100 border border-transparent"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        <p className="text-sm font-medium text-neutral-500">
          Showing <span className="font-bold text-[#09090B]">{result.total}</span>{" "}
          {status === "ALL" ? "total applications" : `${status.toLowerCase()} applications`}
        </p>
      </div>

      {/* ── Applications Feed ── */}
      {result.items.length === 0 ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-12">
          <EmptyState
            icon={ClipboardList}
            title={
              search
                ? "No applications found"
                : status === "ALL"
                  ? "No beta applications yet"
                  : `No ${status.toLowerCase()} applications`
            }
            description={
              search
                ? `No results for "${search}".`
                : "Beta applications will appear here once users submit them."
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {result.items.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden hover:border-orange-200 hover:shadow-md transition-all duration-200"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-neutral-100 bg-neutral-50/30">
                <div className="flex items-center gap-4 min-w-0">
                  {req.picture ? (
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-neutral-200 shadow-sm flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={req.picture} alt={req.name ?? req.email} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-orange-50 text-[#FF6719] border border-orange-100 shadow-sm flex items-center justify-center flex-shrink-0">
                      <span className="text-base font-bold">
                        {getInitials(req.name)}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-lg font-bold text-[#09090B] truncate">
                      {req.name ?? "Unknown Applicant"}
                    </p>
                    <p className="text-neutral-500 font-medium text-sm truncate">{req.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <StatusBadge status={req.access_status} />
                  <Link
                    href={`/admin/users/${req.id}`}
                    className="flex items-center justify-center w-10 h-10 rounded-lg bg-white border border-neutral-200 text-neutral-400 hover:text-[#FF6719] hover:border-orange-200 hover:bg-orange-50 transition-colors shadow-sm"
                    title="View full profile"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  
                  {/* Left Column: Socials */}
                  <div className="lg:col-span-3">
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      {[
                        {
                          icon: Instagram,
                          label: "Instagram",
                          handle: req.instagram_username,
                          followers: req.instagram_followers,
                          color: "text-pink-500",
                          bgHover: "hover:border-pink-200 hover:bg-pink-50/50"
                        },
                        {
                          icon: Youtube,
                          label: "YouTube",
                          handle: req.youtube_channel,
                          followers: req.youtube_followers,
                          color: "text-red-500",
                          bgHover: "hover:border-red-200 hover:bg-red-50/50"
                        },
                        {
                          icon: Facebook,
                          label: "Facebook",
                          handle: req.facebook_page,
                          followers: req.facebook_followers,
                          color: "text-blue-600",
                          bgHover: "hover:border-blue-200 hover:bg-blue-50/50"
                        },
                      ].map(({ icon: Icon, label, handle, followers, color, bgHover }) => (
                        <div
                          key={label}
                          className={`bg-[#FAFAFA] rounded-xl p-4 border border-neutral-100 transition-all ${handle ? bgHover : 'opacity-60'}`}
                        >
                          <Icon className={`w-6 h-6 ${color} mb-2`} />
                          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1">{label}</p>
                          {handle ? (
                            <>
                              <p className="text-sm font-bold text-[#09090B] truncate">
                                @{handle}
                              </p>
                              {followers !== null && (
                                <p className="text-xs font-semibold text-neutral-500 mt-1">
                                  {formatFollowers(followers)}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-xs font-medium text-neutral-400">Not Linked</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {req.application_message && (
                      <div className="bg-[#FAFAFA] border border-neutral-100 rounded-xl p-5 shadow-inner">
                        <div className="flex items-center gap-2 mb-2">
                          <ShieldAlert className="w-4 h-4 text-[#FF6719]" />
                          <p className="text-[10px] font-extrabold text-neutral-500 uppercase tracking-widest">
                            Applicant Message
                          </p>
                        </div>
                        <p className="text-sm text-neutral-700 font-medium leading-relaxed">
                          "{req.application_message}"
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Actions */}
                  <div className="lg:col-span-1 flex flex-col justify-between h-full bg-[#FAFAFA] border border-neutral-100 rounded-xl p-5">
                    <div>
                      <p className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mb-1">
                        Application Date
                      </p>
                      <p className="text-sm font-bold text-[#09090B]">
                        {formatDate(req.beta_application_submitted_at)}
                      </p>
                    </div>

                    <div className="mt-6 pt-6 border-t border-neutral-200">
                      <p className="text-[10px] font-extrabold text-neutral-400 uppercase tracking-widest mb-3">
                        Action Required
                      </p>
                      {req.access_status === "PENDING" || !req.access_status ? (
                        <BetaActions
                          userId={req.id}
                          currentStatus={req.access_status}
                        />
                      ) : (
                        <div className={`px-4 py-3 rounded-lg text-sm font-bold text-center border ${
                          req.access_status === "APPROVED" 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-red-50 text-red-700 border-red-200"
                        }`}>
                          {req.access_status === "APPROVED"
                            ? "✓ Access Granted"
                            : "✗ Access Declined"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Pagination */}
          {result.totalPages > 1 && (
            <div className="bg-white rounded-xl border border-neutral-200 shadow-sm">
              <Pagination
                currentPage={page}
                totalPages={result.totalPages}
                total={result.total}
                pageSize={result.pageSize}
                baseUrl="/admin/beta"
                searchParams={{
                  ...(status !== "ALL" ? { status } : {}),
                  ...(search ? { search } : {}),
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
