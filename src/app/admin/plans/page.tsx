import { requireAdmin } from "@/lib/security";
import {
  billingPlanSettingsSchemaAvailable,
  getBillingPlanSettings,
} from "@/lib/db/queries";
import { PlanCatalogEditor } from "@/components/plans/PlanCatalogEditor";
import { AdminPage } from "@/components/ui/page-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plans — Plugio Console",
};

export default async function PlansPage() {
  await requireAdmin();

  let catalog: Awaited<ReturnType<typeof getBillingPlanSettings>> | null = null;
  let loadError: string | null = null;
  let schemaAvailable = true;

  try {
    schemaAvailable = await billingPlanSettingsSchemaAvailable();
    if (schemaAvailable) {
      catalog = await getBillingPlanSettings();
    } else {
      loadError =
        "The billing_plan_settings table is not available yet. Apply backend migration V44, then restart the API.";
    }
  } catch (error: unknown) {
    console.error("[PlansPage] Failed to load plan catalog:", error);
    loadError = "Failed to load plan catalog. Check database connectivity.";
  }

  return (
    <AdminPage>
      <div className="mb-5 max-w-2xl">
        <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
          This is the commercial catalog. Checkout, landing prices, save percentages, and channel
          limits all read this row. USD is international; INR is India — not converted from USD.
          Coupons (percent off) stay on the Coupons desk. Enable UPI, cards, netbanking, and
          international/USD in the Razorpay Dashboard; this app cannot turn those methods on.
        </p>
      </div>
      {loadError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950">
          {loadError}
        </div>
      ) : catalog ? (
        <PlanCatalogEditor catalog={catalog} />
      ) : null}
    </AdminPage>
  );
}
