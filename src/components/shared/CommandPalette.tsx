"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, User } from "lucide-react";
import { searchUsersAction, type UserSearchHit } from "@/actions/user.actions";
import type { NavEntry } from "@/components/shared/nav-config";
import { cn } from "@/lib/utils";

/** Cmd/Ctrl+K: jump to any page the admin may open, or find a creator by name, email or id. */
export function CommandPalette({
  open,
  onClose,
  pages,
}: {
  open: boolean;
  onClose: () => void;
  pages: NavEntry[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserSearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setQuery("");
      setUsers([]);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setUsers([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        try {
          setUsers(await searchUsersAction(q));
        } catch {
          setUsers([]);
        }
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const pageHits = pages.filter((p) => !q || p.label.toLowerCase().includes(q) || p.keywords?.includes(q));
  const items: { key: string; label: string; hint: string; href: string; user?: boolean }[] = [
    ...pageHits.map((p) => ({ key: p.href, label: p.label, hint: p.group, href: p.href })),
    ...users.map((u) => ({
      key: u.id,
      label: u.name ?? u.email,
      hint: u.name ? u.email : "Creator",
      href: `/admin/users/${u.id}`,
      user: true,
    })),
  ];

  function go(href: string) {
    onClose();
    router.push(href);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-(--line-strong) bg-(--paper) shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-(--line) px-4">
          <Search className="h-4 w-4 text-(--ink-mute)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter" && items[active]) go(items[active].href);
            }}
            placeholder="Jump to a page, or find a creator by name, email or ID"
            className="h-12 flex-1 bg-transparent text-[14px] text-(--ink) outline-hidden placeholder:text-(--ink-mute)"
          />
          <kbd className="rounded-md border border-(--line) px-1.5 py-0.5 text-[10px] font-semibold text-(--ink-mute)">Esc</kbd>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <li className="px-3 py-8 text-center text-[13px] text-(--ink-mute)">Nothing found</li>
          ) : (
            items.map((item, i) => (
              <li key={item.key}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(item.href)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left",
                    i === active ? "bg-(--canvas)" : ""
                  )}
                >
                  {item.user ? <User className="h-4 w-4 text-(--ink-mute)" /> : <CornerDownLeft className="h-4 w-4 text-(--ink-mute)" />}
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-(--ink)">{item.label}</span>
                  <span className="shrink-0 truncate text-[12px] text-(--ink-mute)">{item.hint}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
