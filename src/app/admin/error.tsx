"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // We could log this to an error reporting service here
    console.error("Admin Route Error:", error);
  }, [error]);

  return (
    <div className="flex h-full w-full items-center justify-center p-8 bg-[#F8FAFC]">
      <div className="bg-white rounded-2xl card-shadow border border-zinc-100 p-8 max-w-md w-full text-center">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center mb-5">
          <AlertCircle className="w-7 h-7 text-red-500" strokeWidth={1.5} />
        </div>
        <h2 className="text-lg font-bold text-zinc-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-zinc-500 mb-6 leading-relaxed">
          We encountered an unexpected error while loading this page. This could
          be a database connection issue or a temporary timeout.
        </p>
        
        {process.env.NODE_ENV !== "production" && (
          <div className="bg-zinc-50 p-3 rounded-lg text-left overflow-auto mb-6 text-xs font-mono text-zinc-700 border border-zinc-200">
            {error.message}
          </div>
        )}

        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 w-full justify-center"
        >
          <RefreshCcw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
