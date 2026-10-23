"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Menu, Search } from "lucide-react";
import { useDbContext } from "@/components/shared/DatabaseSwitch";
import { titleFor } from "@/components/shared/nav-config";
import { cn } from "@/lib/utils";

interface AdminTopBarProps {
  isReadOnly?: boolean;
  pendingBeta?: number;
  onOpenMenu: () => void;
  onOpenSearch: () => void;
}

export function AdminTopBar({ isReadOnly = false, pendingBeta = 0, onOpenMenu, onOpenSearch }: AdminTopBarProps) {
  const pathname = usePathname();
  const { dbContext } = useDbContext();
  const prod = dbContext === "production";

  return (
    <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-(--line) bg-(--canvas) px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open menu"
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-(--ink-soft) hover:bg-black/5 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <p className="min-w-0 flex-1 truncate text-[16px] font-semibold tracking-tight text-(--ink)">{titleFor(pathname)}</p>

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden h-9 items-center gap-2 rounded-lg border border-(--line-strong) bg-(--paper) px-3 text-[12.5px] text-(--ink-mute) transition hover:border-brand-500/40 sm:flex"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search creators or pages</span>
        <kbd className="ml-4 rounded border border-(--line) px-1.5 text-[10px] font-semibold">⌘K</kbd>
      </button>
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-(--ink-soft) hover:bg-black/5 sm:hidden"
      >
        <Search className="h-4.5 w-4.5" />
      </button>

      <span
        title={prod ? "You are reading and writing LIVE data" : "Staging data: safe to test"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
          prod ? "border-red-200 bg-red-50 text-red-700" : "border-sky-200 bg-sky-50 text-sky-700"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", prod ? "bg-red-500" : "bg-sky-500")} />
        {prod ? "Live" : "Staging"}
      </span>

      {isReadOnly && (
        <span className="hidden rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800 sm:inline">
          Read-only
        </span>
      )}
      {pendingBeta > 0 && pathname !== "/admin/beta" && (
        <Link
          href="/admin/beta?status=PENDING"
          aria-label={`${pendingBeta} pending access requests`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-600"
        >
          <ClipboardList className="h-3.5 w-3.5" aria-hidden />
          {pendingBeta}
        </Link>
      )}
    </header>
  );
}
