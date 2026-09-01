import { requireAdmin } from "@/lib/security";
import {
  listTrialCoupons,
  listRecentCouponRedemptions,
} from "@/lib/db/queries";
import { CouponManager } from "@/components/coupons/CouponManager";
import { CouponRedemptionsTable } from "@/components/coupons/CouponRedemptionsTable";
import { Ticket } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coupons — Plugio Admin",
};

export default async function CouponsPage() {
  await requireAdmin();

  let coupons: Awaited<ReturnType<typeof listTrialCoupons>> = [];
  let redemptions: Awaited<ReturnType<typeof listRecentCouponRedemptions>> = [];
  let loadError: string | null = null;

  try {
    [coupons, redemptions] = await Promise.all([
      listTrialCoupons(),
      listRecentCouponRedemptions(40),
    ]);
  } catch (error: any) {
    console.error("[CouponsPage] Failed to load coupons:", error);
    loadError =
      error?.code === "ER_NO_SUCH_TABLE"
        ? "The trial_coupons table is not available yet. Apply backend migration V31."
        : "Failed to load coupons. Check database connectivity.";
  }

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto min-h-screen space-y-6 lg:space-y-8">
      <div className="relative overflow-hidden rounded-xl p-8 bg-white border border-neutral-200 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl font-extrabold text-[#09090B] tracking-tight flex items-center gap-3">
            <Ticket className="w-8 h-8 text-[#FF6719]" />
            Trial Coupons
          </h1>
          <p className="text-neutral-500 font-medium">
            Control trial coupon codes, limits, activation, and who redeemed them.
          </p>
        </div>
      </div>

      {loadError ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 font-medium">
          {loadError}
        </div>
      ) : (
        <>
          <CouponManager coupons={coupons} />
          <CouponRedemptionsTable redemptions={redemptions} />
        </>
      )}
    </div>
  );
}
