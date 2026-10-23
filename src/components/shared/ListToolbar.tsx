import type { ReactNode } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { FilterPills } from "@/components/ui/page-shell";

/** "Showing 21–40 of 143", or "No results", for the line under a list's filters. */
export function resultSummary(page: number, pageSize: number, total: number, shown: number): string {
  if (total === 0 || shown === 0) return "No results";
  const start = (page - 1) * pageSize + 1;
  return `Showing ${start}–${start + shown - 1} of ${total.toLocaleString()}`;
}

/**
 * The same top bar on every list page: filter pills on the left, search and actions on the right, and a thin line
 * underneath that says how many rows match and offers one click to clear the filters.
 */
export function ListToolbar({
  pills,
  search,
  actions,
  summary,
  clearHref,
}: {
  pills?: { href: string; label: string; active: boolean; count?: number }[];
  search?: { placeholder: string; value: string; hidden?: Record<string, string>; name?: string };
  actions?: ReactNode;
  summary?: string;
  /** Shown only while a filter or search is active. */
  clearHref?: string;
}) {
  return (
    <div className="border-b border-(--line)">
      {(pills || search || actions) && (
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {pills ? <FilterPills items={pills} /> : <span />}
        <div className="flex items-center gap-2">
          {search && (
            <form method="GET" className="relative min-w-[200px] flex-1 sm:w-[260px] sm:flex-none">
              {Object.entries(search.hidden ?? {}).map(([name, value]) => (
                <input key={name} type="hidden" name={name} value={value} />
              ))}
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--ink-mute)" />
              <input
                type="search"
                name={search.name ?? "search"}
                defaultValue={search.value}
                placeholder={search.placeholder}
                aria-label={search.placeholder}
                autoComplete="off"
                maxLength={100}
                className="admin-input py-2 pl-9 pr-3"
              />
            </form>
          )}
          {actions}
        </div>
      </div>
      )}
      {summary && (
        <div className={`flex items-center justify-between gap-3 bg-(--subtle) px-4 py-1.5 text-[12px] text-(--ink-mute) ${pills || search || actions ? "border-t border-(--line)" : ""}`}>
          <span aria-live="polite">{summary}</span>
          {clearHref && (
            <Link href={clearHref} className="inline-flex items-center gap-1 font-semibold text-(--ink-soft) hover:text-brand-500">
              <X className="h-3 w-3" /> Clear filters
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
