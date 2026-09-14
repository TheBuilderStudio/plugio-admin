"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Ticket,
  X,
} from "lucide-react";
import {
  createPlanCouponAction,
  setPlanCouponActiveAction,
  updatePlanCouponAction,
} from "@/actions/coupon.actions";
import { formatDateTime } from "@/lib/utils";
import {
  percentWarning,
  planPricePreviewLines,
  MAX_PERCENT_OFF,
  PERCENT_RANGE_HINT,
} from "@/lib/plan-coupon-preview";
import type { PlanCouponRow } from "@/types";
import { useAdminReadOnly } from "@/components/shared/AdminReadOnlyContext";
import { EmptyState } from "@/components/shared/EmptyState";
import type { AdminPlanCatalog } from "@/constants";

interface PlanCouponManagerProps {
  coupons: PlanCouponRow[];
  schemaAvailable: boolean;
  catalog: AdminPlanCatalog;
}

function defaultExpiryLocal(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(23, 59, 0, 0);
  return toDatetimeLocalValue(d);
}

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PlanCouponManager({ coupons, schemaAvailable, catalog }: PlanCouponManagerProps) {
  const isReadOnly = useAdminReadOnly();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [code, setCode] = useState("");
  const [plan, setPlan] = useState<"CREATOR" | "PRO">("CREATOR");
  const [percent, setPercent] = useState("40");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiryLocal);
  const [note, setNote] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMax, setEditMax] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editPercent, setEditPercent] = useState("");
  const [editExpires, setEditExpires] = useState("");

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);

  const percentOff = Number(percent);
  const warning = percentWarning(percentOff);
  const previewLines = useMemo(
    () => (Number.isInteger(percentOff) ? planPricePreviewLines(plan, percentOff, catalog) : []),
    [plan, percentOff, catalog]
  );

  function runAction(fn: () => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      const res = await fn();
      setResult({
        type: res.success ? "success" : "error",
        message: res.message,
      });
      if (res.success) {
        setCode("");
        setMaxRedemptions("");
        setNote("");
        setPercent("40");
        setExpiresAt(defaultExpiryLocal());
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    runAction(() =>
      createPlanCouponAction({
        code,
        plan,
        percentOff: Number(percent),
        maxRedemptions: maxRedemptions.trim() ? Number(maxRedemptions) : null,
        expiresAt,
        note: note.trim() || null,
      })
    );
  }

  function startEdit(coupon: PlanCouponRow) {
    setEditingId(coupon.id);
    setEditMax(coupon.max_redemptions === null ? "" : String(coupon.max_redemptions));
    setEditNote(coupon.note ?? "");
    setEditPercent(String(coupon.percent_off));
    setEditExpires(toDatetimeLocalValue(new Date(coupon.expires_at)));
  }

  function handleSaveEdit(id: string) {
    runAction(() =>
      updatePlanCouponAction({
        id,
        maxRedemptions: editMax.trim() ? Number(editMax) : null,
        note: editNote.trim() || null,
        percentOff: Number(editPercent),
        expiresAt: editExpires,
      })
    );
  }

  function handleToggle(id: string, currentlyActive: boolean) {
    const next = !currentlyActive;
    const label = next ? "activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${label} this coupon?`)) return;
    runAction(() => setPlanCouponActiveAction(id, next));
  }

  if (!schemaAvailable) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950">
        Paid-plan coupons need backend migration V41. Trial coupons still work.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {result && (
        <div
          className={`rounded-2xl border px-4 py-3 text-[13px] font-medium ${
            result.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.message}
        </div>
      )}

      <section className="admin-card p-5 sm:p-6">
        <h2 className="mb-1 text-[15px] font-semibold tracking-tight text-[var(--ink)]">
          Create Creator / Pro code
        </h2>
        <p className="mb-4 text-[12.5px] text-[var(--ink-soft)]">
          Percent off that checkout total. Maximum 90% — every term still pays through Razorpay.
        </p>
        {isReadOnly ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-center text-[13px] font-medium text-sky-800">
            Read-only mode — coupon writes are blocked.
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
                  Code
                </label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SAVE40"
                  required
                  maxLength={64}
                  className="admin-input font-mono font-semibold uppercase"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
                  Plan
                </label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value === "PRO" ? "PRO" : "CREATOR")}
                  className="admin-input"
                >
                  <option value="CREATOR">Creator</option>
                  <option value="PRO">Pro</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
                  Percent off
                </label>
                <input
                  type="number"
                  min={1}
                  max={MAX_PERCENT_OFF}
                  value={percent}
                  onChange={(e) => setPercent(e.target.value)}
                  required
                  className="admin-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
                  Expires
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  required
                  className="admin-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
                  Max people
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxRedemptions}
                  onChange={(e) => setMaxRedemptions(e.target.value)}
                  placeholder="Unlimited"
                  className="admin-input"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
                  Note
                </label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                  maxLength={255}
                  className="admin-input"
                />
              </div>
            </div>
            {warning.level !== "none" ? (
              <p
                className={`rounded-xl border px-3 py-2 text-[12.5px] font-medium ${
                  warning.level === "danger"
                    ? "border-red-200 bg-red-50 text-red-800"
                    : warning.level === "strong"
                      ? "border-orange-200 bg-orange-50 text-orange-900"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {warning.message}
              </p>
            ) : null}
            {previewLines.length > 0 ? (
              <div className="rounded-xl border border-[var(--line)] bg-[#F7F4EE] px-3 py-2 font-mono text-[12px] leading-relaxed text-[var(--ink)]">
                {previewLines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                {PERCENT_RANGE_HINT}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending || !code.trim()}
                className="admin-btn-primary"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="admin-card overflow-hidden">
        {coupons.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No paid-plan coupons yet"
            description="Create a Creator or Pro percent-off code. Checkout still goes through Razorpay."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Plan</th>
                  <th>%</th>
                  <th>Usage</th>
                  <th>Expires</th>
                  <th>Status</th>
                  <th>Note</th>
                  <th className="text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td>
                      <span className="font-mono font-semibold">{coupon.code}</span>
                      {coupon.created_by ? (
                        <p className="mt-0.5 text-[12px] text-[var(--ink-mute)]">by {coupon.created_by}</p>
                      ) : null}
                    </td>
                    <td className="font-semibold">{coupon.plan === "PRO" ? "Pro" : "Creator"}</td>
                    <td>
                      {editingId === coupon.id ? (
                        <input
                          type="number"
                          min={1}
                          max={MAX_PERCENT_OFF}
                          value={editPercent}
                          onChange={(e) => setEditPercent(e.target.value)}
                          className="admin-input w-20 py-1.5"
                        />
                      ) : (
                        <span className="font-semibold tabular-nums">{coupon.percent_off}%</span>
                      )}
                    </td>
                    <td>
                      {editingId === coupon.id ? (
                        <input
                          type="number"
                          min={1}
                          value={editMax}
                          onChange={(e) => setEditMax(e.target.value)}
                          placeholder="Unlimited"
                          className="admin-input w-24 py-1.5"
                        />
                      ) : (
                        <span className="font-semibold tabular-nums">
                          {coupon.redeemed_count}
                          <span className="font-medium text-[var(--ink-mute)]">
                            {" "}
                            / {coupon.max_redemptions === null ? "∞" : coupon.max_redemptions}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap text-[var(--ink-soft)]">
                      {editingId === coupon.id ? (
                        <input
                          type="datetime-local"
                          value={editExpires}
                          onChange={(e) => setEditExpires(e.target.value)}
                          className="admin-input py-1.5"
                        />
                      ) : (
                        formatDateTime(coupon.expires_at)
                      )}
                    </td>
                    <td>
                      <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${coupon.active ? "badge-approved" : "badge-none"}`}>
                        {coupon.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="max-w-[220px]">
                      {editingId === coupon.id ? (
                        <input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          maxLength={255}
                          className="admin-input py-1.5"
                        />
                      ) : (
                        <span className="block truncate text-[var(--ink-soft)]">{coupon.note || "—"}</span>
                      )}
                    </td>
                    <td>
                      {isReadOnly ? (
                        <span className="text-[12px] text-[var(--ink-mute)]">Read-only</span>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {editingId === coupon.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(coupon.id)}
                                disabled={isPending}
                                className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                                title="Save"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                disabled={isPending}
                                className="rounded-lg bg-[#F7F4EE] p-1.5 text-[var(--ink-soft)] hover:bg-[#EDE8DF]"
                                title="Cancel"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEdit(coupon)}
                                disabled={isPending}
                                className="rounded-lg bg-[#F7F4EE] p-1.5 text-[var(--ink-soft)] hover:bg-[#EDE8DF] disabled:opacity-50"
                                title="Edit"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggle(coupon.id, coupon.active)}
                                disabled={isPending}
                                className={`rounded-lg p-1.5 disabled:opacity-50 ${
                                  coupon.active
                                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                }`}
                                title={coupon.active ? "Deactivate" : "Activate"}
                              >
                                {coupon.active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
