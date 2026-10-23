"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminSidebar } from "@/components/shared/AdminSidebar";
import { AdminTopBar } from "@/components/shared/AdminTopBar";
import { CommandPalette } from "@/components/shared/CommandPalette";
import type { NavEntry } from "@/components/shared/nav-config";

interface AdminShellProps {
  children: ReactNode;
  adminName: string | null | undefined;
  adminEmail: string | null | undefined;
  adminImage: string | null | undefined;
  roleLabel: string;
  items: NavEntry[];
  isReadOnly: boolean;
  pendingBeta: number;
  badges: Record<string, number>;
}

export function AdminShell({ children, items, pendingBeta, isReadOnly, ...sidebar }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    let armed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const disarm = () => {
      armed = false;
      if (timer) clearTimeout(timer);
    };
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;

      if (armed) {
        const hit = items.find((i) => i.key === e.key.toLowerCase());
        disarm();
        if (hit) {
          e.preventDefault();
          router.push(hit.href);
        }
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((o) => !o);
      } else if (e.key === "g") {
        armed = true;
        timer = setTimeout(disarm, 1200);
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      disarm();
    };
  }, [items, router]);

  return (
    <div className="relative isolate flex h-dvh overflow-hidden bg-(--canvas)">
      <div className="hidden lg:block">
        <AdminSidebar {...sidebar} items={items} isReadOnly={isReadOnly} />
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 shadow-2xl">
            <AdminSidebar {...sidebar} items={items} isReadOnly={isReadOnly} onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AdminTopBar
          isReadOnly={isReadOnly}
          pendingBeta={pendingBeta}
          onOpenMenu={() => setMenuOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
        />
        <main className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} pages={items} />
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]"
          onMouseDown={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-(--line-strong) bg-(--paper) p-5 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 className="text-[15px] font-semibold text-(--ink)">Keyboard shortcuts</h2>
            <dl className="mt-3 space-y-1.5 text-[13px]">
              <Shortcut keys="⌘K or /" what="Search pages and creators" />
              <Shortcut keys="?" what="Show this list" />
              {items
                .filter((i) => i.key)
                .map((i) => (
                  <Shortcut key={i.href} keys={`g ${i.key}`} what={`Go to ${i.label}`} />
                ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}

function Shortcut({ keys, what }: { keys: string; what: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-(--ink-soft)">{what}</dt>
      <dd>
        <kbd className="rounded-md border border-(--line-strong) bg-white px-1.5 py-0.5 text-[11.5px] font-semibold text-(--ink)">{keys}</kbd>
      </dd>
    </div>
  );
}
