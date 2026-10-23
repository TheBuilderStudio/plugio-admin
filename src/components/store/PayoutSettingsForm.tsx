"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/types";

/**
 * The normal minimum withdrawal and the withdraw-all floor. A creator may always withdraw their whole available
 * balance once it reaches the floor, whatever the minimum is. The server validates, checks the version and audits the change.
 */
export function PayoutSettingsForm({
  minRupees,
  floorRupees,
  holdDays,
  version,
  updatedBy,
  updatedAt,
  action,
}: {
  minRupees: string;
  floorRupees: string;
  holdDays: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
  action: (minRupees: string, floorRupees: string, holdDays: string, version: number) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(minRupees);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [floor, setFloor] = useState(floorRupees);
  const [hold, setHold] = useState(holdDays);
  const dirty = value !== minRupees || floor !== floorRupees || hold !== holdDays;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await action(value, floor, hold, version);
          setMessage({ ok: result.success, text: result.message });
          if (result.success) router.refresh();
        });
      }}
    >
      <div>
        <h3 className="text-[14px] font-semibold text-(--ink)">Payout rules</h3>
        <p className="mt-1 text-[12.5px] text-(--ink-soft)">
          Creators can always withdraw their <strong>whole</strong> balance once it reaches ₹{floor || floorRupees}. Smaller balances roll into the next withdrawal.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="block text-[12.5px] font-semibold text-(--ink)">Minimum payout (₹)</span>
        <input
          className="h-9 w-32 rounded-lg border border-(--line) bg-white px-2 text-[13px] tabular-nums"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="Minimum payout in rupees"
        />
        <span className="block text-[11.5px] text-(--ink-mute)">Whole rupees, from the floor below up to ₹50,000. Applies at once.</span>
      </label>
      <label className="block space-y-1.5">
        <span className="block text-[12.5px] font-semibold text-(--ink)">Withdraw-all floor (₹)</span>
        <input
          className="h-9 w-32 rounded-lg border border-(--line) bg-white px-2 text-[13px] tabular-nums"
          inputMode="numeric"
          value={floor}
          onChange={(e) => setFloor(e.target.value)}
          aria-label="Withdraw-all floor in rupees"
        />
        <span className="block text-[11.5px] text-(--ink-mute)">Whole rupees, ₹10 up to the minimum payout. Balances below this roll into the next withdrawal.</span>
      </label>
      <label className="block space-y-1.5">
        <span className="block text-[12.5px] font-semibold text-(--ink)">Safety window (days)</span>
        <input
          className="h-9 w-32 rounded-lg border border-(--line) bg-white px-2 text-[13px] tabular-nums"
          inputMode="numeric"
          value={hold}
          onChange={(e) => setHold(e.target.value)}
          aria-label="Safety window in days"
        />
        <span className="block text-[11.5px] text-(--ink-mute)">Days after a sale before its money can be withdrawn (0 to 90). Applies to sales made after you save; earlier sales keep their release date.</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg border border-(--line) px-3 py-1.5 text-[13px] font-semibold text-(--ink) hover:bg-(--hover) disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save payout rules"}
        </button>
        {message && <span className={`text-[12.5px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
      </div>
      <p className="text-[11.5px] text-(--ink-mute)">
        Settings v{version}
        {updatedBy ? ` · last changed by ${updatedBy}` : ""}
        {updatedAt ? ` · ${updatedAt}` : ""}
      </p>
    </form>
  );
}
