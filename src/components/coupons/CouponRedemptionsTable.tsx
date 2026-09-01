"use client";

import Link from "next/link";
import { formatDateTime } from "@/lib/utils";
import type { CouponRedemptionRow } from "@/types";

interface CouponRedemptionsTableProps {
  redemptions: CouponRedemptionRow[];
}

export function CouponRedemptionsTable({
  redemptions,
}: CouponRedemptionsTableProps) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-neutral-100">
        <h2 className="text-sm font-bold text-[#09090B]">Recent redemptions</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          Who used which trial coupon — control-plane visibility only.
        </p>
      </div>
      {redemptions.length === 0 ? (
        <div className="px-5 py-8 text-sm text-neutral-500">
          No coupon redemptions yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#FAFAFA] border-b border-neutral-200 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              <tr>
                <th className="px-5 py-3">Coupon</th>
                <th className="px-5 py-3">User</th>
                <th className="px-5 py-3">Redeemed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {redemptions.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50/60">
                  <td className="px-5 py-3">
                    <code className="text-xs font-bold text-[#FF6719] bg-orange-50 px-2 py-0.5 rounded">
                      {row.coupon_code}
                    </code>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/users/${row.user_id}`}
                      className="text-sm font-medium text-neutral-800 hover:text-[#FF6719]"
                    >
                      {row.user_name || row.user_email || row.user_id.slice(0, 8)}
                    </Link>
                    {row.user_email && (
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {row.user_email}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-neutral-500 font-medium whitespace-nowrap">
                    {formatDateTime(row.redeemed_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
