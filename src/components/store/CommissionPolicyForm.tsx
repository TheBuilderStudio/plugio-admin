"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/types";

/**
 * The commission policies: Digital Products and Bookings (every booking type, including group workshops), plus the
 * payment gateway charge creators pay on top. The server is the authority: it validates (0-50% and 0-10%, 2 decimals), checks the version so nobody overwrites a newer
 * change, and records who changed what in the audit trail.
 */
export function CommissionPolicyForm({
  digital,
  bookings,
  gateway,
  version,
  updatedBy,
  updatedAt,
  action,
}: {
  digital: string;
  bookings: string;
  gateway: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
  action: (digital: string, bookings: string, gateway: string, version: number) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [d, setD] = useState(digital);
  const [b, setB] = useState(bookings);
  const [g, setG] = useState(gateway);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = d !== digital || b !== bookings || g !== gateway;
  const example = exampleSplit(d, g);

  const field = "h-9 w-28 rounded-lg border border-(--line) bg-white px-2 text-[13px] tabular-nums";

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await action(d, b, g, version);
          setMessage({ ok: result.success, text: result.message });
          if (result.success) router.refresh();
        });
      }}
    >
      <div>
        <h3 className="text-[14px] font-semibold text-(--ink)">Creator store &amp; monetization policy</h3>
        <p className="mt-1 text-[12.5px] text-(--ink-soft)">
          Plugio keeps this share of each sale. Changes apply to new checkouts only.
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
        <label className="block space-y-1.5">
          <span className="text-[12.5px] font-semibold text-(--ink)">Payment gateway fee (%)</span>
          <input className={field} inputMode="decimal" value={g} onChange={(e) => setG(e.target.value)} aria-label="Payment gateway fee percent" />
          <span className="block text-[11.5px] text-(--ink-mute)">
            Razorpay&apos;s charge with GST (2% + 18% = 2.36). Paid by creators on top. Plugio does not keep it. 0 = Plugio covers it.
          </span>
        </label>
      </div>

      {example && (
        <p className="rounded-lg bg-[#F7F4EE] px-3 py-2 text-[12px] text-(--ink-soft)" data-testid="policy-example">
          On a Rs 1,000 digital product: gateway <strong>Rs {example.gateway}</strong>, Plugio <strong>Rs {example.plugio}</strong>,
          creator receives <strong>Rs {example.creator}</strong>.
        </p>
      )}

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

/** Preview only: the server computes the real amounts at checkout. Null while either rate is not a valid number. */
function exampleSplit(digital: string, gateway: string): { gateway: string; plugio: string; creator: string } | null {
  const d = Number(digital);
  const g = Number(gateway);
  if (!digital.trim() || !gateway.trim() || !Number.isFinite(d) || !Number.isFinite(g) || d < 0 || g < 0) return null;
  const plugio = Math.round(1000 * d) / 100;
  const gate = Math.round(1000 * g) / 100;
  return { gateway: gate.toFixed(2), plugio: plugio.toFixed(2), creator: (1000 - plugio - gate).toFixed(2) };
}
