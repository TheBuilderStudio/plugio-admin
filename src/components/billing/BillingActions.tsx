"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Clock, XCircle } from "lucide-react";
import { grantTrial, grantLifetime, revokeAccess } from "@/actions/billing.actions";

const IS_READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY_MODE === "true";

export function BillingActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [isPendingTrial, startTrial] = useTransition();
  const [isPendingLifetime, startLifetime] = useTransition();
  const [isPendingRevoke, startRevoke] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isLoading = isPendingTrial || isPendingLifetime || isPendingRevoke;

  // Auto-clear feedback banner after 4 seconds
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);

  function handleGrantTrial() {
    startTrial(async () => {
      const res = await grantTrial(userId, 14);
      if (res.success) {
        setResult({ type: "success", message: res.message ?? "Trial granted" });
        router.refresh();
      } else {
        setResult({ type: "error", message: res.error ?? "Failed to grant trial" });
      }
    });
  }

  function handleGrantLifetime() {
    if (!confirm("Are you sure you want to grant lifetime PRO access?")) return;
    startLifetime(async () => {
      const res = await grantLifetime(userId);
      if (res.success) {
        setResult({ type: "success", message: res.message ?? "Lifetime access granted" });
        router.refresh();
      } else {
        setResult({ type: "error", message: res.error ?? "Failed to grant lifetime access" });
      }
    });
  }

  function handleRevoke() {
    if (!confirm("Are you sure you want to completely revoke billing access?")) return;
    startRevoke(async () => {
      const res = await revokeAccess(userId);
      if (res.success) {
        setResult({ type: "success", message: res.message ?? "Access revoked" });
        router.refresh();
      } else {
        setResult({ type: "error", message: res.error ?? "Failed to revoke access" });
      }
    });
  }

  if (IS_READ_ONLY) {
    return (
      <div className="mt-5 border-t border-zinc-100 pt-5">
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
          <p className="text-xs text-blue-600 font-medium">
            Admin Panel is in Read-Only Mode. Billing modifications disabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-zinc-100 pt-5 space-y-3">
      {result && (
        <div
          className={`p-3 rounded-xl text-sm font-medium ${
            result.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {result.message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleGrantTrial}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
        >
          {isPendingTrial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
          +14d Trial
        </button>

        <button
          onClick={handleGrantLifetime}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
        >
          {isPendingLifetime ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Lifetime Pro
        </button>

        <button
          onClick={handleRevoke}
          disabled={isLoading}
          className="flex-none flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
        >
          {isPendingRevoke ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
          Revoke
        </button>
      </div>
    </div>
  );
}
