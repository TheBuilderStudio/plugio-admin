import { requireCapability } from "@/lib/admin-access";
import {
  billingPlanSettingsSchemaAvailable,
  getBillingPlanSettings,
} from "@/lib/db/queries";
import { PlanCatalogEditor } from "@/components/plans/PlanCatalogEditor";
import { AdminPage, AdminPageHeader } from "@/components/ui/page-shell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plans — Plugio Console",
};

export default async function PlansPage() {
  await requireCapability("VIEW_MONEY");

  let catalog: Awaited<ReturnType<typeof getBillingPlanSettings>> | null = null;
  let loadError: string | null = null;
  let schemaAvailable = true;

  try {
    schemaAvailable = await billingPlanSettingsSchemaAvailable();
    if (schemaAvailable) {
      catalog = await getBillingPlanSettings();
    } else {
      loadError =
        "Plan settings are not set up yet. Apply migration V44 and restart the API.";
    }
  } catch (error: unknown) {
    console.error("[PlansPage] Failed to load plan catalog:", error);
    loadError = "Failed to load plan catalog. Check database connectivity.";
  }

  return (
    <AdminPage>
      <AdminPageHeader kicker="Pricing" title="Plans" description="Prices and channel limits." hint="Checkout and the landing page read these. USD is international and INR is India (not converted). Payment methods are switched on in the Razorpay Dashboard." />

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
