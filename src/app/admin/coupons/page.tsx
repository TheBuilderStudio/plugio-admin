import { requireCapability } from "@/lib/admin-access";
import {
  listPlanCoupons,
  listRecentCouponRedemptions,
  listTrialCoupons,
  planCouponSchemaAvailable,
  getBillingPlanSettings,
} from "@/lib/db/queries";
import { CouponDesks } from "@/components/coupons/CouponDesks";
import { CouponRedemptionsTable } from "@/components/coupons/CouponRedemptionsTable";
import { AdminPage, AdminPageHeader } from "@/components/ui/page-shell";
import { PLAN_CATALOG_USD } from "@/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coupons — Plugio Console",
};

export default async function CouponsPage() {
  await requireCapability("VIEW_MONEY");

  let trialCoupons: Awaited<ReturnType<typeof listTrialCoupons>> = [];
  let planCoupons: Awaited<ReturnType<typeof listPlanCoupons>> = [];
  let redemptions: Awaited<ReturnType<typeof listRecentCouponRedemptions>> = [];
  let loadError: string | null = null;
  let planSchemaAvailable = true;
  let catalog = PLAN_CATALOG_USD;

  try {
    [trialCoupons, planCoupons, redemptions, planSchemaAvailable, catalog] = await Promise.all([
      listTrialCoupons(),
      listPlanCoupons(),
      listRecentCouponRedemptions(40),
      planCouponSchemaAvailable(),
      getBillingPlanSettings(),
    ]);
  } catch (error: unknown) {
    console.error("[CouponsPage] Failed to load coupons:", error);
    const code = typeof error === "object" && error && "code" in error ? String((error as { code?: string }).code) : "";
    loadError =
      code === "ER_NO_SUCH_TABLE"
        ? "Coupons are not set up yet. Apply migration V31."
        : code === "ER_BAD_FIELD_ERROR"
          ? "Coupons need migration V42 (percent off and expiry)."
          : "Failed to load coupons. Check database connectivity.";
  }

  return (
    <AdminPage>
      <AdminPageHeader title="Coupons" description="Trial and plan discount codes." hint="Trial coupons start a trial. Plan coupons take a percentage off a paid plan." />

      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950">
          {loadError}
        </div>
      ) : (
        <>
          <CouponDesks
            trialCoupons={trialCoupons}
            planCoupons={planCoupons}
            planSchemaAvailable={planSchemaAvailable}
            catalog={catalog}
          />
          <CouponRedemptionsTable redemptions={redemptions} />
        </>
      )}
    </AdminPage>
  );
}
