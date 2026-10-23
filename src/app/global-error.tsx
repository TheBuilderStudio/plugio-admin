"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-[#0A0908] p-6 text-white font-sans">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#14110E] p-8 text-center shadow-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ff6719]">
            System Notice
          </p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-white">
            Something went wrong
          </h2>
          <p className="mt-2 text-[14px] leading-relaxed text-white/60">
            A server error occurred while rendering the page.
          </p>
          {error?.message ? (
            <div className="mt-4 overflow-auto rounded-xl border border-white/10 bg-black/40 p-3 text-left font-mono text-[12px] text-white/70">
              {error.message}
              {error.digest ? (
                <p className="mt-1 text-[10px] text-white/40">Digest: {error.digest}</p>
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
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#ff6719] text-[14px] font-semibold text-white transition hover:bg-[#e05610]"
          >
            Reload application
          </button>
        </div>
      </body>
    </html>
  );
}
