"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Bookmark, X } from "lucide-react";

type View = { name: string; query: string };

const EVENT = "plugio-saved-views";
const keyFor = (pageKey: string) => `plugio-admin:views:${pageKey}`;

function read(pageKey: string): string {
  try {
    return localStorage.getItem(keyFor(pageKey)) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): View[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is View => typeof x?.name === "string" && typeof x?.query === "string") : [];
  } catch {
    return [];
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * Per-browser saved filters for a list page. A view is just the page's query string, so it works with any filter,
 * search or sort the page already supports. Stored in localStorage (private to this admin on this device).
 */
export function SavedViews({ pageKey }: { pageKey: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = useSyncExternalStore(subscribe, () => read(pageKey), () => "[]");
  const views = parse(raw);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  // `page` is not part of a view: a saved view always opens on its first page.
  const current = (() => {
    const p = new URLSearchParams(params.toString());
    p.delete("page");
    return p.toString();
  })();

  const write = useCallback(
    (next: View[]) => {
      try {
        localStorage.setItem(keyFor(pageKey), JSON.stringify(next.slice(0, 12)));
      } catch {
        /* storage unavailable (private window): views just won't persist */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [pageKey]
  );

  const activeName = views.find((v) => v.query === current)?.name;
  const canSave = current !== "" && !activeName;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {views.map((v) => {
        const active = v.name === activeName;
        return (
          <span
            key={v.name}
            className={`inline-flex items-center overflow-hidden rounded-lg border text-[12px] font-semibold ${
              active ? "border-brand-500/50 bg-brand-500/10 text-brand-700" : "border-(--line-strong) bg-white text-(--ink-soft)"
            }`}
          >
            <Link href={`${pathname}${v.query ? `?${v.query}` : ""}`} className="inline-flex items-center gap-1 px-2 py-1 hover:text-(--ink)">
              <Bookmark className="h-3 w-3" aria-hidden />
              {v.name}
            </Link>
            <button
              type="button"
              aria-label={`Remove saved view ${v.name}`}
              onClick={() => write(views.filter((x) => x.name !== v.name))}
              className="px-1.5 py-1 text-(--ink-mute) hover:text-red-700"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        );
      })}

      {naming ? (
        <form
          className="inline-flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim().slice(0, 24);
            if (!n) return;
            write([...views.filter((v) => v.name !== n), { name: n, query: current }]);
            setNaming(false);
            setName("");
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            placeholder="Name this view"
            aria-label="View name"
            className="h-7 w-36 rounded-lg border border-(--line-strong) bg-white px-2 text-[12px]"
          />
          <button type="submit" className="rounded-lg bg-(--ink) px-2 py-1 text-[12px] font-semibold text-white">
            Save
          </button>
          <button type="button" onClick={() => setNaming(false)} className="px-1 text-[12px] text-(--ink-mute)">
            Cancel
          </button>
        </form>
      ) : canSave ? (
        <button
          type="button"
          onClick={() => setNaming(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-(--line-strong) px-2 py-1 text-[12px] font-semibold text-(--ink-soft) hover:border-brand-500/50 hover:text-brand-600"
        >
          <Bookmark className="h-3 w-3" aria-hidden />
          Save this view
        </button>
      ) : null}
    </div>
  );
}
