"use client";

import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import { formatPayableMinor } from "@/constants";
import type { CouponRedemptionRow } from "@/types";

interface CouponRedemptionsTableProps {
  redemptions: CouponRedemptionRow[];
}

export function CouponRedemptionsTable({
  redemptions,
}: CouponRedemptionsTableProps) {
  return (
    <section className="admin-card overflow-hidden">
      <div className="border-b border-[var(--line)] px-5 py-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">
          Recent redemptions
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
          Who used which code — trial vs paid checkout.
        </p>
      </div>
      {redemptions.length === 0 ? (
        <p className="px-5 py-10 text-center text-[13px] text-[var(--ink-mute)]">
          No coupon redemptions yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Coupon</th>
                <th>Kind</th>
                <th>User</th>
                <th>Paid</th>
                <th>Redeemed</th>
              </tr>
            </thead>
            <tbody>
              {redemptions.map((row) => (
                <tr key={row.id}>
                  <td>
                    <code className="rounded-md bg-orange-50 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-[#FF6719]">
                      {row.coupon_code}
                    </code>
                  </td>
                  <td className="font-semibold text-[var(--ink)]">
                    {row.kind === "TRIAL" ? "Trial" : row.kind === "PRO" ? "Pro" : "Creator"}
                  </td>
                  <td>
                    <Link
                      href={`/admin/users/${row.user_id}`}
                      className="font-semibold text-[var(--ink)] hover:text-[#FF6719]"
                    >
                      {row.user_name || row.user_email || row.user_id.slice(0, 8)}
                    </Link>
                    {row.user_email ? (
                      <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{row.user_email}</p>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap font-semibold tabular-nums text-[var(--ink)]">
                    {formatPayableMinor(row.payable_cents, row.currency)}
                  </td>
                  <td className="whitespace-nowrap text-[var(--ink-soft)]">
                    {formatDateTime(row.redeemed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
