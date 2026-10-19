"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/types";

/**
 * The two commission policies: Digital Products and Bookings (every booking type, including group workshops).
 * The server is the authority: it validates (0-50%, 2 decimals), checks the version so nobody overwrites a newer
 * change, and records who changed what in the audit trail.
 */
export function CommissionPolicyForm({
  digital,
  bookings,
  version,
  updatedBy,
  updatedAt,
  action,
}: {
  digital: string;
  bookings: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
  action: (digital: string, bookings: string, version: number) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [d, setD] = useState(digital);
  const [b, setB] = useState(bookings);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = d !== digital || b !== bookings;

  const field = "h-9 w-28 rounded-lg border border-(--line) bg-white px-2 text-[13px] tabular-nums";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await action(d, b, version);
          setMessage({ ok: result.success, text: result.message });
          if (result.success) router.refresh();
        });
      }}
    >
      <div>
        <h3 className="text-[14px] font-semibold text-(--ink)">Creator store &amp; monetization policy</h3>
        <p className="mt-1 text-[12.5px] text-(--ink-soft)">
          The platform keeps this percentage of what the customer pays; the creator receives the rest. A change applies to
          checkouts started after it is saved. Sales already made keep the rate they were quoted.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-[12.5px] font-semibold text-(--ink)">Digital products fee (%)</span>
          <input className={field} inputMode="decimal" value={d} onChange={(e) => setD(e.target.value)} aria-label="Digital products fee percent" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[12.5px] font-semibold text-(--ink)">Bookings fee (%)</span>
          <input className={field} inputMode="decimal" value={b} onChange={(e) => setB(e.target.value)} aria-label="Bookings fee percent" />
          <span className="block text-[11.5px] text-(--ink-mute)">One rate for 1:1 sessions and group workshops.</span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || !dirty}
          className="rounded-lg border border-(--line) px-3 py-1.5 text-[13px] font-semibold text-(--ink) hover:bg-[#F7F4EE] disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save policy"}
        </button>
        {message && <span className={`text-[12.5px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
      </div>

      <p className="text-[11.5px] text-(--ink-mute)">
        Policy v{version}
        {updatedBy ? ` · last changed by ${updatedBy}` : ""}
        {updatedAt ? ` · ${updatedAt}` : ""}
      </p>
    </form>
  );
}
