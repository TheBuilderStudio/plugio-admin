import Link from "next/link";
import { SearchX } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found — Plugio Admin",
};

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#18181b] flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex w-16 h-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/50 items-center justify-center mb-6">
          <SearchX className="w-8 h-8 text-zinc-400" strokeWidth={1.5} />
        </div>
        <h1 className="text-white font-bold text-2xl mb-2">404 - Not Found</h1>
        <p className="text-zinc-400 text-sm max-w-xs mx-auto mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
