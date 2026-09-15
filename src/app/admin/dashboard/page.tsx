import { requireAdmin } from "@/lib/security";
import { getAdminOverview } from "@/lib/db/admin-overview";
import { getActiveDbContext } from "@/lib/db";
import { readRecentAuditLogs } from "@/lib/logger";
import { getBetaRequests } from "@/lib/db/queries";
import { OverviewView } from "@/components/dashboard/overview-view";
import type { AdminOverviewPayload, BetaRequestRow, BusinessOverview } from "@/types";

export const revalidate = 60;

const EMPTY_OVERVIEW: BusinessOverview = {
  access: {
    total_users: 0,
    approved_users: 0,
    pending_requests: 0,
    rejected_users: 0,
    new_last_7_days: 0,
  },
  revenue: {
    total_collected_usd: 0,
    collected_30d_usd: 0,
    total_collected_inr: 0,
    collected_30d_inr: 0,
    paid_checkouts: 0,
    paid_checkouts_30d: 0,
    paid_checkouts_inr: 0,
    paid_checkouts_30d_inr: 0,
    estimated_mrr_usd: 0,
  },
  plans: {
    active_creator: 0,
    active_pro: 0,
    trialing: 0,
    expired: 0,
    none: 0,
  },
  coupons: { active_codes: 0, redemptions_7d: 0 },
  social: {
    active_accounts: 0,
    users_connected: 0,
    youtube: 0,
    instagram: 0,
    facebook: 0,
    sync_failed: 0,
    syncing: 0,
  },
  content: {
    total: 0,
    published: 0,
    scheduled: 0,
    failed: 0,
    drafts: 0,
    created_7d: 0,
    creators_with_content: 0,
  },
  activation: { approved_with_social: 0 },
  attention: {
    pending_beta: 0,
    payment_failures_7d: 0,
    sync_failed: 0,
    content_failed: 0,
  },
};

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const dbContext = await getActiveDbContext();

  let overview = EMPTY_OVERVIEW;
  let activity: AdminOverviewPayload["activity"] = [];
  let auditLogs: Awaited<ReturnType<typeof readRecentAuditLogs>> = [];
  let pendingQueue: BetaRequestRow[] = [];
  let loadError: string | null = null;

  try {
    const [overviewResult, logsResult, queueResult] = await Promise.allSettled([
      getAdminOverview(dbContext),
      readRecentAuditLogs(12),
      getBetaRequests("PENDING", "", 1, 8),
    ]);

    if (overviewResult.status === "fulfilled") {
      overview = overviewResult.value.metrics;
      activity = overviewResult.value.activity;
    } else {
      console.error("[DashboardPage] Overview failed:", overviewResult.reason);
      loadError = "Some overview data could not be loaded. Try refreshing.";
    }

    if (logsResult.status === "fulfilled") {
      auditLogs = logsResult.value;
    }
    if (queueResult.status === "fulfilled") {
      pendingQueue = queueResult.value.items;
    }
  } catch (error) {
    console.error("[DashboardPage] Failed to load overview:", error);
    loadError = "Some overview data could not be loaded. Try refreshing.";
  }

  return (
    <OverviewView
      firstName={admin.user?.name?.split(" ")[0] ?? "Admin"}
      overview={overview}
      activity={activity}
      auditLogs={auditLogs}
      pendingQueue={pendingQueue}
      loadError={loadError}
    />
  );
}
