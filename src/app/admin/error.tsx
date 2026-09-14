"use client";

import { useEffect } from "react";
import { RefreshCcw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin Route Error:", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="admin-card max-w-md p-8 text-center">
        <p className="admin-kicker">Error</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[var(--ink)]">
          This screen could not load
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--ink-soft)]">
          Usually a database timeout. Retry, or check Settings for connection health.
        </p>
        <div className="mt-5 overflow-auto rounded-xl border border-[var(--line)] bg-[#F7F4EE] p-3 text-left text-[12px] font-mono text-[var(--ink-soft)]">
          {error.message || "Unknown error"}
          {error.digest ? <p className="mt-1 text-[10px] text-[var(--ink-mute)]">Digest: {error.digest}</p> : null}
        </div>
        <button type="button" onClick={() => reset()} className="admin-btn-primary mt-6 w-full">
          <RefreshCcw className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
