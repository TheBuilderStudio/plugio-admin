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

  // Build page numbers to show (always show 5 around current)
  const pages: (number | "...")[] = [];
  const delta = 2;

  for (let i = 1; i <= totalPages; i++) {
    if (
      i === 1 ||
      i === totalPages ||
      (i >= currentPage - delta && i <= currentPage + delta)
    ) {
      pages.push(i);
    } else if (
      i === currentPage - delta - 1 ||
      i === currentPage + delta + 1
    ) {
      pages.push("...");
    }
  }

  // Deduplicate
  const uniquePages = pages.filter(
    (p, idx) => p !== "..." || pages[idx - 1] !== "..."
  );

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100">
      <p className="text-xs text-zinc-500">
        Showing{" "}
        <span className="font-semibold text-zinc-700">
          {start}–{end}
        </span>{" "}
        of <span className="font-semibold text-zinc-700">{total}</span> results
      </p>

      <div className="flex items-center gap-1">
        {/* Prev */}
        {currentPage > 1 ? (
          <Link
            href={buildUrl(currentPage - 1)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
        ) : (
          <span className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-300 cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
          </span>
        )}

        {/* Pages */}
        {uniquePages.map((page, idx) =>
          page === "..." ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex items-center justify-center w-8 h-8 text-zinc-400 text-sm"
            >
              …
            </span>
          ) : (
            <Link
              key={page}
              href={buildUrl(page)}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                page === currentPage
                  ? "bg-orange-500 text-white font-semibold"
                  : "text-zinc-600 hover:bg-zinc-100"
              )}
            >
              {page}
            </Link>
          )
        )}

        {/* Next */}
        {currentPage < totalPages ? (
          <Link
            href={buildUrl(currentPage + 1)}
            className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        ) : (
          <span className="flex items-center justify-center w-8 h-8 rounded-lg text-zinc-300 cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </span>
        )}
      </div>
    </div>
  );
}
