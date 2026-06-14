import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unauthorized — Plugio Admin",
};

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[#18181b] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.834-1.732-.834-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h1 className="text-white font-bold text-2xl mb-2">Access Denied</h1>
        <p className="text-zinc-400 text-sm max-w-xs mx-auto mb-8">
          Your Google account is not authorized to access the Plugio Admin
          panel.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Try a different account
        </Link>
      </div>
    </div>
  );
}
