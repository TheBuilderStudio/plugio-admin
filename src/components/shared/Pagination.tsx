import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  pageSize: number;
  baseUrl: string;
  searchParams?: Record<string, string>;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  pageSize,
  baseUrl,
  searchParams = {},
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, total);

  function buildUrl(page: number) {
    const params = new URLSearchParams({
      ...searchParams,
      page: String(page),
    });
    return `${baseUrl}?${params.toString()}`;
  }

  const pages: (number | "...")[] = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
      pages.push(i);
    } else if (i === currentPage - delta - 1 || i === currentPage + delta + 1) {
      pages.push("...");
    }
  }
  const uniquePages = pages.filter((p, idx) => p !== "..." || pages[idx - 1] !== "...");

  return (
    <div className="flex items-center justify-between px-5 py-3.5">
      <p className="text-[12.5px] text-[var(--ink-soft)]">
        {start}–{end} of <span className="font-semibold text-[var(--ink)]">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        {currentPage > 1 ? (
          <Link href={buildUrl(currentPage - 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[#F7F4EE]">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-mute)] opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        {uniquePages.map((page, idx) =>
          page === "..." ? (
            <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center text-[13px] text-[var(--ink-mute)]">
              …
            </span>
          ) : (
            <Link
              key={page}
              href={buildUrl(page)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] font-semibold transition",
                page === currentPage
                  ? "bg-[#FF6719] text-white"
                  : "text-[var(--ink-soft)] hover:bg-[#F7F4EE]"
              )}
            >
              {page}
            </Link>
          )
        )}
        {currentPage < totalPages ? (
          <Link href={buildUrl(currentPage + 1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[#F7F4EE]">
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-mute)] opacity-40">
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}
