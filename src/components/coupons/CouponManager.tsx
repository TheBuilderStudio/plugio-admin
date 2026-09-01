"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Power,
  PowerOff,
  Ticket,
  Pencil,
  Check,
  X,
} from "lucide-react";
import {
  createCouponAction,
  setCouponActiveAction,
  updateCouponAction,
} from "@/actions/coupon.actions";
import { formatDateTime } from "@/lib/utils";
import type { TrialCouponRow } from "@/types";
import { useAdminReadOnly } from "@/components/shared/AdminReadOnlyContext";

interface CouponManagerProps {
  coupons: TrialCouponRow[];
}

export function CouponManager({ coupons }: CouponManagerProps) {
  const isReadOnly = useAdminReadOnly();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const [code, setCode] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [note, setNote] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMax, setEditMax] = useState("");
  const [editNote, setEditNote] = useState("");

  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(() => setResult(null), 4000);
    return () => clearTimeout(timer);
  }, [result]);

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
        setEditingId(null);
        router.refresh();
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    runAction(() =>
      createCouponAction({
        code,
        maxRedemptions: maxRedemptions.trim()
          ? Number(maxRedemptions)
          : null,
        note: note.trim() || null,
      })
    );
  }

  function startEdit(coupon: TrialCouponRow) {
    setEditingId(coupon.id);
    setEditMax(
      coupon.max_redemptions === null ? "" : String(coupon.max_redemptions)
    );
    setEditNote(coupon.note ?? "");
  }

  function handleSaveEdit(id: string) {
    runAction(() =>
      updateCouponAction({
        id,
        maxRedemptions: editMax.trim() ? Number(editMax) : null,
        note: editNote.trim() || null,
      })
    );
  }

  function handleToggle(id: string, currentlyActive: boolean) {
    const next = !currentlyActive;
    const label = next ? "activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${label} this coupon?`)) return;
    runAction(() => setCouponActiveAction(id, next));
  }

  return (
    <div className="space-y-6">
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

      {/* Create form */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6">
        <h2 className="text-sm font-bold text-[#09090B] mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#FF6719]" />
          Create Trial Coupon
        </h2>

        {isReadOnly ? (
          <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
            <p className="text-xs text-blue-600 font-medium">
              Admin Panel is in Read-Only Mode. Coupon mutations disabled.
            </p>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                Code
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="LAUNCH50"
                required
                maxLength={64}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm font-mono font-semibold text-[#09090B] focus:outline-none focus:border-[#FF6719] uppercase"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                Max Redemptions
              </label>
              <input
                type="number"
                min={1}
                value={maxRedemptions}
                onChange={(e) => setMaxRedemptions(e.target.value)}
                placeholder="Unlimited"
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-[#09090B] focus:outline-none focus:border-[#FF6719]"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                Note
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                maxLength={255}
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-[#09090B] focus:outline-none focus:border-[#FF6719]"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isPending || !code.trim()}
                className="w-full flex items-center justify-center gap-2 bg-[#FF6719] hover:bg-[#e55a12] disabled:opacity-50 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Create
              </button>
            </div>
          </form>
        )}
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
        {coupons.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <Ticket className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-base font-bold text-[#09090B] mb-1">
              No coupons yet
            </h3>
            <p className="text-neutral-500 text-sm max-w-sm">
              Create a trial coupon to allow users to redeem free trial access.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#FAFAFA] border-b border-neutral-200 text-[#09090B] font-bold text-xs uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Usage</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Note</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {coupons.map((coupon) => (
                  <tr
                    key={coupon.id}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="font-mono font-bold text-[#09090B]">
                        {coupon.code}
                      </span>
                      {coupon.created_by && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          by {coupon.created_by}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {editingId === coupon.id ? (
                        <input
                          type="number"
                          min={1}
                          value={editMax}
                          onChange={(e) => setEditMax(e.target.value)}
                          placeholder="Unlimited"
                          className="w-24 rounded-md border border-neutral-200 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="font-semibold text-neutral-700">
                          {coupon.redeemed_count}
                          <span className="text-neutral-400 font-medium">
                            {" "}
                            /{" "}
                            {coupon.max_redemptions === null
                              ? "∞"
                              : coupon.max_redemptions}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          coupon.active
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {coupon.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      {editingId === coupon.id ? (
                        <input
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          maxLength={255}
                          className="w-full rounded-md border border-neutral-200 px-2 py-1 text-sm"
                        />
                      ) : (
                        <span className="text-neutral-500 truncate block max-w-[200px]">
                          {coupon.note || "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-neutral-500 font-medium">
                      {formatDateTime(coupon.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      {isReadOnly ? (
                        <span className="text-xs text-neutral-400">Read-only</span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {editingId === coupon.id ? (
                            <>
                              <button
                                onClick={() => handleSaveEdit(coupon.id)}
                                disabled={isPending}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50"
                                title="Save"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                disabled={isPending}
                                className="p-1.5 rounded-lg bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(coupon)}
                                disabled={isPending}
                                className="p-1.5 rounded-lg bg-neutral-50 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() =>
                                  handleToggle(coupon.id, coupon.active)
                                }
                                disabled={isPending}
                                className={`p-1.5 rounded-lg disabled:opacity-50 ${
                                  coupon.active
                                    ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                                    : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                }`}
                                title={
                                  coupon.active ? "Deactivate" : "Activate"
                                }
                              >
                                {coupon.active ? (
                                  <PowerOff className="w-4 h-4" />
                                ) : (
                                  <Power className="w-4 h-4" />
                                )}
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
      </div>
    </div>
  );
}
