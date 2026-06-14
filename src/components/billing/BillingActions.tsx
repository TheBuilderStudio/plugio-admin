"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, Clock, XCircle } from "lucide-react";
import { grantTrial, grantLifetime, revokeAccess } from "@/actions/billing.actions";

export function BillingActions({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleGrantTrial() {
    setLoading(true);
    await grantTrial(userId, 14);
    setLoading(false);
  }

  async function handleGrantLifetime() {
    if (!confirm("Are you sure you want to grant lifetime PRO access?")) return;
    setLoading(true);
    await grantLifetime(userId);
    setLoading(false);
  }

  async function handleRevoke() {
    if (!confirm("Are you sure you want to completely revoke billing access?")) return;
    setLoading(true);
    await revokeAccess(userId);
    setLoading(false);
  }

  return (
    <div className="flex flex-wrap gap-2 mt-5 border-t border-zinc-100 pt-5">
      <button
        onClick={handleGrantTrial}
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock className="w-4 h-4" />}
        +14d Trial
      </button>

      <button
        onClick={handleGrantLifetime}
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
        Lifetime Pro
      </button>

      <button
        onClick={handleRevoke}
        disabled={loading}
        className="flex-none flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
        Revoke
      </button>
    </div>
  );
}
