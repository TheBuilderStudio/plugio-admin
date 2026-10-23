"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--canvas) p-6">
      <div className="w-full max-w-md rounded-2xl border border-(--line) bg-(--paper) p-8 text-center shadow-sm">
        <p className="admin-kicker">Error</p>
        <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-(--ink)">
          This page could not load
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-(--ink-soft)">
          A server error occurred while loading this view.
        </p>
        {error?.message ? (
          <div className="mt-4 overflow-auto rounded-xl border border-(--line) bg-black/5 p-3 text-left font-mono text-[12px] text-(--ink-soft)">
            {error.message}
            {error.digest ? (
              <p className="mt-1 text-[10px] text-(--ink-mute)">Digest: {error.digest}</p>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            if (reset) {
              reset();
            } else {
              window.location.reload();
            }
          }}
          className="admin-btn-primary mt-6 w-full"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
