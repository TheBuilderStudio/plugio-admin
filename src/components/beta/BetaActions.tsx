"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { approveBetaAction, rejectBetaAction } from "@/actions/beta.actions";
import { useAdminReadOnly } from "@/components/shared/AdminReadOnlyContext";
import { CopyOutreachScript } from "@/components/beta/CopyOutreachScript";

interface BetaActionsProps {
  userId: string;
  currentStatus: string | null | undefined;
}

const outreachKey = (userId: string) => `plugio_admin_outreach_${userId}`;

export function BetaActions({ userId, currentStatus }: BetaActionsProps) {
  const isReadOnly = useAdminReadOnly();
  const router = useRouter();
  const [isPendingApprove, startApprove] = useTransition();
  const [isPendingReject, startReject] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [outreach, setOutreach] = useState<{
    script: string;
    couponCode?: string | null;
  } | null>(null);

  const isLoading = isPendingApprove || isPendingReject;

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(outreachKey(userId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as { script?: string; couponCode?: string | null };
      if (parsed.script) {
        setOutreach({ script: parsed.script, couponCode: parsed.couponCode ?? null });
      }
    } catch {
      /* ignore */
    }
  }, [userId]);

  useEffect(() => {
    if (!result || outreach) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result, outreach]);

  async function handleApprove() {
    startApprove(async () => {
      const res = await approveBetaAction(userId);
      if (res.success) {
        setResult({ type: "success", message: res.message });
        if (res.outreachScript) {
          const next = {
            script: res.outreachScript,
            couponCode: res.couponCode ?? null,
          };
          setOutreach(next);
          sessionStorage.setItem(outreachKey(userId), JSON.stringify(next));
        }
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

  if (currentStatus === "REJECTED") {
    return (
      <p className="text-center text-[13px] font-medium text-[var(--ink-soft)]">
        This application has already been declined.
      </p>
    );
  }

  if (currentStatus === "APPROVED" && !isPendingApprove) {
    return (
      <div className="space-y-3">
        <p className="text-center text-[13px] font-medium text-[var(--ink-soft)]">
          Access granted — they still need a coupon to start trial.
        </p>
        {outreach ? (
          <CopyOutreachScript script={outreach.script} couponCode={outreach.couponCode} />
        ) : null}
      </div>
    );
  }

  if (isReadOnly) {
    return (
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-[13px] font-medium text-sky-800">
        Read-only mode — approve and reject are blocked.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {result && (
        <div
          className={`rounded-xl border px-3 py-2.5 text-[13px] font-medium ${
            result.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.message}
        </div>
      )}

      {outreach ? (
        <CopyOutreachScript script={outreach.script} couponCode={outreach.couponCode} />
      ) : null}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isLoading}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPendingApprove ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
          Approve access
        </button>
        <button
          type="button"
          onClick={handleReject}
          disabled={isLoading}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          {isPendingReject ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
          Decline
        </button>
      </div>
    </div>
  );
}
