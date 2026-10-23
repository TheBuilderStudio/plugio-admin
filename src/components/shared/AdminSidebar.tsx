"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarClock,
  Inbox,
  BarChart3,
  ArrowLeftRight,
  ClipboardList,
  LayoutDashboard,
  Receipt,
  Settings,
  Shield,
  Star,
  Store,
  Tags,
  Terminal,
  Ticket,
  UserCog,
  Users,
  type LucideIcon,
  Eye,
  LogOut,
} from "lucide-react";
import { logoutAction } from "@/actions/user.actions";
import { cn } from "@/lib/utils";
import { DatabaseSwitch } from "@/components/shared/DatabaseSwitch";
import { NAV, type NavEntry, type NavIconName } from "@/components/shared/nav-config";

const ICONS: Record<NavIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  beta: ClipboardList,
  users: Users,
  bookings: CalendarClock,
  inquiries: Inbox,
  reviews: Star,
  plans: Tags,
  coupons: Ticket,
  payments: Receipt,
  transactions: ArrowLeftRight,
  reports: BarChart3,
  store: Store,
  health: Activity,
  admins: UserCog,
  audit: Shield,
  logs: Terminal,
  settings: Settings,
};

interface AdminSidebarProps {
  adminName: string | null | undefined;
  adminEmail: string | null | undefined;
  adminImage: string | null | undefined;
  roleLabel: string;
  items: NavEntry[];
  isReadOnly?: boolean;
  badges?: Record<string, number>;
  onNavigate?: () => void;
}

function isNavActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/admin/dashboard") return pathname === "/admin/dashboard" || pathname === "/admin";
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function AdminSidebar({
  adminName,
  adminEmail,
  adminImage,
  roleLabel,
  items,
  isReadOnly = false,
  badges = {},
  onNavigate,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const groups = (["Work", "Money", "System"] as const)
    .map((group) => ({ group, items: items.filter((i) => i.group === group) }))
    .filter((g) => g.items.length > 0);

  return (
    <aside className="flex h-full w-(--sidebar-width) shrink-0 select-none flex-col border-r border-white/8 bg-sidebar-bg">
      <div className="flex h-14 shrink-0 items-center gap-2.5 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500">
          <span className="text-[14px] font-black leading-none text-white">P</span>
        </div>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold tracking-tight text-white">Plugio</p>
          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/45">Admin</p>
        </div>
      </div>

      {isReadOnly && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-sky-500/25 bg-sky-500/10 px-2.5 py-1.5">
            <Eye className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <p className="text-[11px] font-medium text-sky-100">Read-only mode</p>
          </div>
        </div>
      )}

      <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4">
        {groups.map(({ group, items: groupItems }) => (
          <div key={group}>
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{group}</p>
            <ul className="space-y-0.5">
              {groupItems.map((item) => {
                const active = isNavActive(pathname, item.href);
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const badge = badges[item.href] ?? 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-brand-500/60",
                        active ? "bg-white/9 text-white" : "text-white/75 hover:bg-white/6 hover:text-white"
                      )}
                    >
                      <Icon
                        className={cn("h-[18px] w-[18px] shrink-0", active ? "text-brand-500" : "text-white/60")}
                        strokeWidth={active ? 2.25 : 1.9}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {badge > 0 ? (
                        <span className="rounded-md bg-brand-500 px-1.5 py-px text-[10px] font-bold tabular-nums text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2.5 border-t border-white/8 p-3">
        <DatabaseSwitch compact tone="dark" />
        <div className="flex items-center gap-2">
          {adminImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={adminImage} alt="" referrerPolicy="no-referrer" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-[11px] font-bold text-white">
              {adminName?.[0]?.toUpperCase() ?? "A"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-semibold text-white">{adminName ?? "Admin"}</p>
            <p className="truncate text-[11px] text-white/50">
              {roleLabel} · {adminEmail ?? ""}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Sign out"
              aria-label="Sign out"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white/55 outline-hidden transition hover:bg-white/8 hover:text-white focus-visible:ring-2 focus-visible:ring-brand-500/60"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export { NAV };
