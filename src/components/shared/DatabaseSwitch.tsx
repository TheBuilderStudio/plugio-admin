"use client";

import { useEffect, useState } from "react";
import { ENVIRONMENT } from "@/constants";
import { cn } from "@/lib/utils";

export type DbContext = "production" | "staging";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift();
  return undefined;
}

export function useDbContext() {
  const [dbContext, setDbContext] = useState<DbContext>("production");

  useEffect(() => {
    const current =
      getCookie("plugio_db_context") ||
      (ENVIRONMENT === "staging" ? "staging" : "production");
    if (current === "production" || current === "staging") {
      setDbContext(current);
    }
  }, []);

  function switchTo(next: DbContext) {
    if (next === dbContext) return;
    if (next === "production") {
      const confirmed = window.confirm(
        "Switch to PRODUCTION database?\n\nCoupon and beta writes will affect live users."
      );
      if (!confirmed) return;
    }
    document.cookie = `plugio_db_context=${next}; path=/; max-age=31536000; sameSite=lax`;
    setDbContext(next);
    window.location.reload();
  }

  return { dbContext, switchTo };
}

export function DatabaseSwitch({
  compact = false,
  tone = "light",
}: {
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const { dbContext, switchTo } = useDbContext();
  const dark = tone === "dark";

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <p
        className={cn(
          "font-semibold",
          compact ? "px-0.5 text-[10px] uppercase tracking-[0.12em]" : "text-[12.5px]",
          dark ? "text-[#FF6719]" : "text-[var(--ink-mute)]"
        )}
      >
        Database
      </p>
      <div
        className={cn(
          "grid grid-cols-2 gap-0.5 rounded-lg p-0.5",
          dark ? "bg-white/[0.06]" : "bg-black/[0.06]"
        )}
      >
        <button
          type="button"
          onClick={() => switchTo("staging")}
          className={cn(
            "rounded-md px-2 py-1.5 text-[12px] font-semibold outline-none ring-0 transition focus:outline-none",
            dbContext === "staging"
              ? dark
                ? "bg-white/14 text-white"
                : "bg-[var(--paper)] text-[var(--ink)] shadow-sm"
              : dark
                ? "text-white/70 hover:text-white"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
          )}
        >
          Staging
        </button>
        <button
          type="button"
          onClick={() => switchTo("production")}
          className={cn(
            "rounded-md px-2 py-1.5 text-[12px] font-semibold outline-none ring-0 transition focus:outline-none",
            dbContext === "production"
              ? "bg-[#FF6719] text-white"
              : dark
                ? "text-white/70 hover:text-white"
                : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
          )}
        >
          Production
        </button>
      </div>
    </div>
  );
}
