"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { approveBetaAction, rejectBetaAction } from "@/actions/beta.actions";

interface BetaActionsProps {
  userId: string;
  currentStatus: string | null | undefined;
}

export function BetaActions({ userId, currentStatus }: BetaActionsProps) {
  const router = useRouter();
  const [isPendingApprove, startApprove] = useTransition();
  const [isPendingReject, startReject] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const isLoading = isPendingApprove || isPendingReject;

  // Auto-clear feedback banner after 4 seconds
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);

  async function handleApprove() {
    startApprove(async () => {
      const res = await approveBetaAction(userId);
      if (res.success) {
        setResult({ type: "success", message: res.message });
        router.refresh();
      } else {
        setResult({ type: "error", message: res.message });
      }
    });
  }

  async function handleReject() {
    startReject(async () => {
      const res = await rejectBetaAction(userId);
      if (res.success) {
        setResult({ type: "success", message: res.message });
        router.refresh();
      } else {
        setResult({ type: "error", message: res.message });
      }
    });
  }

  if (currentStatus === "APPROVED" || currentStatus === "REJECTED") {
    return (
      <div className="p-3 bg-zinc-50 rounded-xl text-center">
        <p className="text-xs text-zinc-500 font-medium">
          This application has already been{" "}
          {currentStatus === "APPROVED" ? "approved" : "rejected"}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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

      <div className="flex gap-2">
        <button
          onClick={handleApprove}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          {isPendingApprove ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          Approve
        </button>

        <button
          onClick={handleReject}
          disabled={isLoading}
          className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold text-sm px-4 py-2.5 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          {isPendingReject ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
          Reject
        </button>
      </div>
    </div>
  );
}
