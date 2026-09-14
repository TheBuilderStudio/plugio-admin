import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not found — Plugio Console",
};

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--canvas)] px-6">
      <div className="max-w-sm text-center">
        <p className="admin-kicker">404</p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--ink)]">
          This screen is not in the console
        </h1>
        <p className="mt-3 text-[14px] text-[var(--ink-soft)]">
          The route does not exist. Return to Command.
        </p>
        <Link href="/admin/dashboard" className="admin-btn-primary mt-8 inline-flex">
          Back to Command
        </Link>
      </div>
    </div>
  );
}
