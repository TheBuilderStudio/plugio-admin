"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Loader2,
  ArrowUpRight,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  grantComplimentaryAccessAction,
  extendComplimentaryAccessAction,
  changeComplimentaryPlanAction,
  revokeComplimentaryAccessAction,
} from "@/actions/billing.actions";
import { formatDate } from "@/lib/utils";
import type { AdminAccessGrantRow, GrantPlanId } from "@/types";
import { useAdminReadOnly } from "@/components/shared/AdminReadOnlyContext";

interface GrantAccessPanelProps {
  userId: string;
  activeGrant?: AdminAccessGrantRow | null;
}

type Mode = "grant" | "extend" | "change";

export function GrantAccessPanel({
  userId,
  activeGrant,
}: GrantAccessPanelProps) {
  const isReadOnly = useAdminReadOnly();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [mode, setMode] = useState<Mode>(activeGrant ? "extend" : "grant");
  const [planId, setPlanId] = useState<GrantPlanId>(
    activeGrant?.plan_id === "CREATOR" ? "PRO" : "CREATOR"
  );
  const [durationDays, setDurationDays] = useState<30 | 60 | 90>(30);
  const [extraDays, setExtraDays] = useState<30 | 60 | 90>(30);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);

  useEffect(() => {
    setMode(activeGrant ? "extend" : "grant");
    if (activeGrant) {
      setPlanId(activeGrant.plan_id === "CREATOR" ? "PRO" : "CREATOR");
    }
  }, [activeGrant]);

  function run(
    fn: () => Promise<{ success: boolean; message: string; error?: string }>
  ) {
    startTransition(async () => {
      const res = await fn();
      setResult({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      if (res.success) {
        setReason("");
        setNotes("");
        router.refresh();
      }
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 3) {
      setResult({
        type: "error",
        message: "Reason is required (at least 3 characters).",
      });
      return;
    }
    if (mode === "grant") {
      const replaceWarning = activeGrant
        ? `This replaces the current ${activeGrant.plan_id} grant. Continue?`
        : null;
      if (replaceWarning && !confirm(replaceWarning)) {
        return;
      }
      run(() =>
        grantComplimentaryAccessAction({
          userId,
          planId,
          durationDays,
          reason: reason.trim(),
          notes: notes || null,
        })
      );
    } else if (mode === "extend") {
      run(() =>
        extendComplimentaryAccessAction({
          userId,
          extraDays,
          reason: reason.trim(),
          notes: notes || null,
        })
      );
    } else {
      run(() =>
        changeComplimentaryPlanAction({
          userId,
          planId,
          reason: reason.trim(),
          notes: notes || null,
        })
      );
    }
  }

  function handleRevoke() {
    if (reason.trim().length < 3) {
      setResult({
        type: "error",
        message: "Enter a revoke reason (at least 3 characters) before revoking.",
      });
      return;
    }
    if (
      !confirm(
        `Type-confirm revoke: complimentary ${activeGrant?.plan_id ?? ""} access will end immediately.\n\nThis does NOT affect paid or trial subscriptions.\n\nReason: ${reason.trim()}`
      )
    ) {
      return;
    }
    run(() => revokeComplimentaryAccessAction(userId, reason.trim()));
  }

  if (isReadOnly) {
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
    <div className="mt-5 border-t border-zinc-100 pt-5 space-y-4">
      <div className="flex items-center gap-2">
        <Gift className="w-4 h-4 text-[#FF6719]" />
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          Complimentary Access
        </h3>
      </div>

      {activeGrant && (
        <div className="bg-orange-50/60 border border-orange-100 rounded-xl p-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wider">
              Active Grant
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
              {activeGrant.plan_id}
            </span>
          </div>
          <p className="text-xs text-zinc-600">
            Ends {formatDate(activeGrant.ends_at)} · {activeGrant.duration_days}d
            grant
          </p>
          {activeGrant.reason && (
            <p className="text-xs text-zinc-500">Reason: {activeGrant.reason}</p>
          )}
          <p className="text-[10px] text-zinc-400">
            by {activeGrant.granted_by_admin_email}
          </p>
        </div>
      )}

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

      <div className="flex gap-1 bg-zinc-50 p-1 rounded-lg">
        {(
          [
            { id: "grant" as const, label: "Grant", show: true },
            { id: "extend" as const, label: "Extend", show: !!activeGrant },
            { id: "change" as const, label: "Change", show: !!activeGrant },
          ] as const
        )
          .filter((t) => t.show)
          .map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${
                mode === tab.id
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {(mode === "grant" || mode === "change") && (
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Plan
            </label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value as GrantPlanId)}
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:border-[#FF6719]"
            >
              <option value="CREATOR">Creator</option>
              <option value="PRO">Pro</option>
            </select>
          </div>
        )}

        {mode === "grant" && (
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Duration
            </label>
            <select
              value={durationDays}
              onChange={(e) =>
                setDurationDays(Number(e.target.value) as 30 | 60 | 90)
              }
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:border-[#FF6719]"
            >
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        )}

        {mode === "extend" && (
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
              Extra Days
            </label>
            <select
              value={extraDays}
              onChange={(e) =>
                setExtraDays(Number(e.target.value) as 30 | 60 | 90)
              }
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-800 focus:outline-none focus:border-[#FF6719]"
            >
              <option value={30}>+30 days</option>
              <option value={60}>+60 days</option>
              <option value={90}>+90 days</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
            Reason <span className="text-red-500">*</span>
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Required — why are you changing access?"
            maxLength={255}
            required
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:border-[#FF6719]"
          />
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes"
            maxLength={1000}
            rows={2}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-800 focus:outline-none focus:border-[#FF6719] resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[#FF6719] hover:bg-[#e55a12] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : mode === "grant" ? (
            <Gift className="w-4 h-4" />
          ) : mode === "extend" ? (
            <ArrowUpRight className="w-4 h-4" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {mode === "grant"
            ? "Grant Access"
            : mode === "extend"
              ? "Extend Access"
              : "Change Plan"}
        </button>
      </form>

      {activeGrant && (
        <button
          type="button"
          onClick={handleRevoke}
          disabled={isPending}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2"
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          Revoke Complimentary Access
        </button>
      )}
    </div>
  );
}
