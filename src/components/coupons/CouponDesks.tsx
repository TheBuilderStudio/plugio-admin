"use client";

import { useState } from "react";
import { CouponManager } from "@/components/coupons/CouponManager";
import { PlanCouponManager } from "@/components/coupons/PlanCouponManager";
import type { PlanCouponRow, TrialCouponRow } from "@/types";
import type { AdminPlanCatalog } from "@/constants";
import { formatUsd } from "@/constants";
import { trialPricePreviewLine } from "@/lib/plan-coupon-preview";

type Desk = "trial" | "paid";

interface CouponDesksProps {
  trialCoupons: TrialCouponRow[];
  planCoupons: PlanCouponRow[];
  planSchemaAvailable: boolean;
  catalog: AdminPlanCatalog;
}

export function CouponDesks({
  trialCoupons,
  planCoupons,
  planSchemaAvailable,
  catalog,
}: CouponDesksProps) {
  const [desk, setDesk] = useState<Desk>("trial");

  return (
    <div className="space-y-5">
      <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[#F7F4EE] p-1">
        <button
          type="button"
          onClick={() => setDesk("trial")}
          className={`rounded-lg px-3 py-2 text-[12.5px] font-semibold ${
            desk === "trial"
              ? "bg-white text-[var(--ink)] shadow-sm"
              : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
          }`}
        >
          Trial
        </button>
        <button
          type="button"
          onClick={() => setDesk("paid")}
          className={`rounded-lg px-3 py-2 text-[12.5px] font-semibold ${
            desk === "paid"
              ? "bg-white text-[var(--ink)] shadow-sm"
              : "text-[var(--ink-soft)] hover:text-[var(--ink)]"
          }`}
        >
          Creator / Pro
        </button>
      </div>

      {desk === "trial" ? (
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--ink-soft)]">
            Access via beta. Trial is {formatUsd(catalog.trialPrice)} for {catalog.trialDays} days of
            the Creator workspace. Coupons are created here only — maximum 90% off. Every trial still
            pays through Razorpay ({trialPricePreviewLine(90, catalog) || "90% still charges through Razorpay"}).
          </p>
          <CouponManager coupons={trialCoupons} catalog={catalog} />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-[13px] text-[var(--ink-soft)]">
            Creator and Pro coupons are created here only. Maximum 90% off list. Every term still pays through Razorpay.
          </p>
          <PlanCouponManager coupons={planCoupons} schemaAvailable={planSchemaAvailable} catalog={catalog} />
        </div>
      )}
    </div>
  );
}
