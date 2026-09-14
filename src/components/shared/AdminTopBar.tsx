"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList } from "lucide-react";

const TITLES: Record<string, string> = {
  "/admin/dashboard": "Command",
  "/admin/users": "Users",
  "/admin/beta": "Queue",
  "/admin/coupons": "Coupons",
  "/admin/plans": "Plans",
  "/admin/payments": "Payments",
  "/admin/audit": "Audit",
  "/admin/logs": "Logs",
  "/admin/settings": "Settings",
};

function resolveTitle(pathname: string) {
  if (pathname.startsWith("/admin/users/")) return "Creator";
  return TITLES[pathname] ?? "Console";
}

interface AdminTopBarProps {
  isReadOnly?: boolean;
  pendingBeta?: number;
}

export function AdminTopBar({ isReadOnly = false, pendingBeta = 0 }: AdminTopBarProps) {
  const pathname = usePathname();
  const title = resolveTitle(pathname);

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--canvas)] px-6 lg:px-8">
      <p className="truncate text-[16px] font-semibold tracking-tight text-[var(--ink)]">{title}</p>

      <div className="flex shrink-0 items-center gap-2">
        {isReadOnly && (
          <span className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800">
            Read-only
          </span>
        )}
        {pendingBeta > 0 && pathname !== "/admin/beta" && (
          <Link
            href="/admin/beta?status=PENDING"
            aria-label={`${pendingBeta} pending beta requests`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF6719] px-2.5 py-1.5 text-[12px] font-semibold text-white outline-none ring-0 transition hover:bg-[#EA580C] focus:outline-none"
          >
            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            {pendingBeta}
          </Link>
        )}
      </div>
    </header>
  );
}
