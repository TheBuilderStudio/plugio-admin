import Link from "next/link";
import { ClipboardList, Search, Instagram, Youtube, Facebook, Download } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getBetaRequests } from "@/lib/db/queries";
import { validateSearch, validatePage, validateStatusFilter } from "@/lib/validation";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { BetaActions } from "@/components/beta/BetaActions";
import { AdminPage, AdminCard, FilterPills } from "@/components/ui/page-shell";
import { formatRelativeTime, formatFollowers, getInitials } from "@/lib/utils";

interface BetaPageProps {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}

export default async function BetaPage({ searchParams }: BetaPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const status = validateStatusFilter(params.status ?? "PENDING");
  const search = validateSearch(params.search);
  const page = validatePage(params.page);
  const result = await getBetaRequests(status, search, page, 20);

  const tabs = [
    { value: "PENDING", label: "Waiting" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Declined" },
    { value: "ALL", label: "All" },
  ] as const;

  function buildTabUrl(tabStatus: string) {
    const p = new URLSearchParams();
    p.set("status", tabStatus);
    if (search) p.set("search", search);
    return `/admin/beta?${p.toString()}`;
  }

  return (
    <AdminPage>
      <AdminCard padded={false}>
        <div className="flex flex-col gap-3 border-b border-[var(--line)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <FilterPills
            items={tabs.map((tab) => ({
              href: buildTabUrl(tab.value),
              label: tab.label,
              active: status === tab.value,
            }))}
          />
          <div className="flex items-center gap-2">
            <form method="GET" className="relative min-w-[200px] flex-1 sm:w-[240px] sm:flex-none">
              <input type="hidden" name="status" value={status} />
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-mute)]" />
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Search applicants"
                autoComplete="off"
                maxLength={100}
                className="admin-input py-2 pl-9 pr-3"
              />
            </form>
            <a href="/api/export/beta" download className="admin-btn-ghost py-2 text-[12px]">
              <Download className="h-3.5 w-3.5" />
              Export
            </a>
          </div>
        </div>

        {result.items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={search ? "No applications found" : status === "PENDING" ? "Queue is clear" : `No ${status.toLowerCase()} applications`}
            description={search ? `No results for “${search}”.` : "Applications land here after creators submit the beta form."}
          />
        ) : (
          <>
            <ul className="divide-y divide-[var(--line)]">
              {result.items.map((req) => {
                const pending = req.access_status === "PENDING" || !req.access_status;
                return (
                  <li key={req.id} className="px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                      <div className="flex min-w-0 flex-1 gap-3">
                        {req.picture ? (
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--line)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={req.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#FF6719]/10 font-bold text-[#FF6719]">
                            {getInitials(req.name)}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href={`/admin/users/${req.id}`} className="truncate text-[14px] font-semibold text-[var(--ink)] hover:text-[#FF6719]">
                              {req.name ?? "Unknown"}
                            </Link>
                            {!pending ? <StatusBadge status={req.access_status} /> : null}
                            <span className="text-[12px] text-[var(--ink-mute)]">
                              {formatRelativeTime(req.beta_application_submitted_at)}
                            </span>
                          </div>
                          <p className="truncate text-[12.5px] text-[var(--ink-soft)]">{req.email}</p>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--ink-soft)]">
                            <SocialBit icon={Instagram} handle={req.instagram_username} followers={req.instagram_followers} />
                            <SocialBit icon={Youtube} handle={req.youtube_channel} followers={req.youtube_followers} />
                            <SocialBit icon={Facebook} handle={req.facebook_page} followers={req.facebook_followers} />
                          </div>
                          {req.application_message ? (
                            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[var(--ink)]">
                              {req.application_message}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="w-full shrink-0 lg:w-[240px]">
                        {pending ? (
                          <BetaActions userId={req.id} currentStatus={req.access_status} />
                        ) : (
                          <Link href={`/admin/users/${req.id}`} className="admin-btn-ghost w-full py-2 text-[12px]">
                            Open file
                          </Link>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {result.totalPages > 1 && (
              <div className="border-t border-[var(--line)]">
                <Pagination
                  currentPage={page}
                  totalPages={result.totalPages}
                  total={result.total}
                  pageSize={result.pageSize}
                  baseUrl="/admin/beta"
                  searchParams={{
                    status,
                    ...(search ? { search } : {}),
                  }}
                />
              </div>
            )}
          </>
        )}
      </AdminCard>
    </AdminPage>
  );
}

function SocialBit({
  icon: Icon,
  handle,
  followers,
}: {
  icon: typeof Instagram;
  handle: string | null;
  followers: number | null;
}) {
  if (!handle) return null;
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="h-3.5 w-3.5 text-[var(--ink-mute)]" />
      <span className="max-w-[140px] truncate">{handle}</span>
      {followers !== null ? <span className="text-[var(--ink-mute)]">{formatFollowers(followers)}</span> : null}
    </span>
  );
}
