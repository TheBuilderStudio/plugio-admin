import Link from "next/link";
import type { ReactNode } from "react";
import {
  Users,
  ClipboardList,
  TrendingUp,
  ArrowRight,
  Ticket,
  Gift,
  CreditCard,
  AlertTriangle,
  Film,
  UserCheck,
  Activity,
  Shield,
  Youtube,
  Instagram,
  Facebook,
} from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getAdminOverview } from "@/lib/db/admin-overview";
import { getActiveDbContext } from "@/lib/db";
import { readRecentAuditLogs } from "@/lib/logger";
import { formatRelativeTime, formatDate, cn } from "@/lib/utils";
import { PLAN_CATALOG_USD, formatUsd } from "@/constants";
import type { AdminOverviewPayload, BusinessOverview } from "@/types";

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
    paid_checkouts: 0,
    paid_checkouts_30d: 0,
    estimated_mrr_usd: 0,
  },
  plans: {
    active_creator: 0,
    active_pro: 0,
    trialing: 0,
    complimentary_grants: 0,
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
    grants_expiring_7d: 0,
    sync_failed: 0,
    content_failed: 0,
  },
};

export default async function DashboardPage() {
  const admin = await requireAdmin();
  const dbContext = await getActiveDbContext();

  let overview = EMPTY_OVERVIEW;
  let activity: AdminOverviewPayload["activity"] = [];
  let expiringGrants: AdminOverviewPayload["expiringGrants"] = [];
  let auditLogs: Awaited<ReturnType<typeof readRecentAuditLogs>> = [];
  let loadError: string | null = null;

  try {
    // One cached DB payload for metrics + activity + grants.
    // Audit log is a local file read (cheap) — kept separate on purpose.
    const [payload, logs] = await Promise.all([
      getAdminOverview(dbContext),
      readRecentAuditLogs(6),
    ]);
    overview = payload.metrics;
    activity = payload.activity;
    expiringGrants = payload.expiringGrants;
    auditLogs = logs;
  } catch (error) {
    console.error("[DashboardPage] Failed to load overview:", error);
    loadError = "Some overview data could not be loaded. Try refreshing.";
  }

  const { access, revenue, plans, coupons, social, content, activation, attention } =
    overview;
  const firstName = admin.user?.name?.split(" ")[0] ?? "Admin";
  const paidLive = plans.active_creator + plans.active_pro;
  const applied =
    access.approved_users + access.pending_requests + access.rejected_users;

  const alerts: {
    label: string;
    detail: string;
    href: string;
    tone: "high" | "medium";
  }[] = [];

  if (attention.pending_beta > 0) {
    alerts.push({
      label: `${attention.pending_beta} beta request${attention.pending_beta === 1 ? "" : "s"} waiting`,
      detail: "Creators blocked until you approve access",
      href: "/admin/beta?status=PENDING",
      tone: "high",
    });
  }
  if (attention.payment_failures_7d > 0) {
    alerts.push({
      label: `${attention.payment_failures_7d} payment failure${attention.payment_failures_7d === 1 ? "" : "s"} (7d)`,
      detail: "Checkout or webhook issues in the payment audit trail",
      href: "/admin/payments",
      tone: "high",
    });
  }
  if (attention.sync_failed > 0) {
    alerts.push({
      label: `${attention.sync_failed} social account${attention.sync_failed === 1 ? "" : "s"} failing sync`,
      detail: "YouTube / Instagram / Facebook connections need attention",
      href: "/admin/users",
      tone: "medium",
    });
  }
  if (attention.content_failed > 0) {
    alerts.push({
      label: `${attention.content_failed} failed content item${attention.content_failed === 1 ? "" : "s"}`,
      detail: "Publishing failures sitting in the content table",
      href: "/admin/users",
      tone: "medium",
    });
  }
  if (attention.grants_expiring_7d > 0) {
    alerts.push({
      label: `${attention.grants_expiring_7d} complimentary grant${attention.grants_expiring_7d === 1 ? "" : "s"} ending ≤7d`,
      detail: "Overlay access ending soon — extend or let expire",
      href: "/admin/users",
      tone: "medium",
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-5 sm:px-5 md:px-6 lg:space-y-6 lg:py-6">
      {loadError && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-900"
        >
          {loadError}
        </div>
      )}

      {/* Header */}
      <section className="admin-card relative overflow-hidden p-6 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl"
        />
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="admin-eyebrow">Overview</p>
            <h1 className="text-[24px] font-extrabold tracking-tight text-neutral-900 sm:text-[28px]">
              Welcome back, {firstName}
            </h1>
            <p className="max-w-xl text-[14px] font-medium text-neutral-500">
              Platform health across users, billing, connections, and content —
              what needs a decision, and what is moving.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatChip
              icon={Users}
              label={`${access.total_users.toLocaleString()} users`}
            />
            <StatChip
              icon={TrendingUp}
              label={`+${access.new_last_7_days} new / 7d`}
              accent
            />
            <StatChip
              icon={UserCheck}
              label={`${activation.approved_with_social} approved + connected`}
            />
          </div>
        </div>
      </section>

      {/* Alerts */}
      {alerts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-br from-[#fff7ed] to-white">
          <div className="flex items-center gap-2 border-b border-orange-100 px-5 py-3">
            <AlertTriangle className="h-4 w-4 text-[#FF6719]" />
            <h2 className="text-[14px] font-semibold text-neutral-900">
              Needs attention
            </h2>
          </div>
          <ul className="divide-y divide-orange-100/80">
            {alerts.map((a) => (
              <li key={a.label}>
                <Link
                  href={a.href}
                  className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-orange-50/80"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-neutral-900">
                      {a.label}
                    </p>
                    <p className="text-[12px] font-medium text-neutral-500">
                      {a.detail}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-[#FF6719]" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* At a glance */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <GlanceCard
          label="Users"
          value={access.total_users.toLocaleString()}
          hint={`${access.approved_users} approved`}
          href="/admin/users"
        />
        <GlanceCard
          label="Pending beta"
          value={String(attention.pending_beta)}
          hint="Awaiting review"
          href="/admin/beta?status=PENDING"
          highlight={attention.pending_beta > 0}
        />
        <GlanceCard
          label="Active paid"
          value={String(paidLive)}
          hint={`${plans.active_creator} Creator · ${plans.active_pro} Pro`}
          href="/admin/users?filter=PAID"
        />
        <GlanceCard
          label="Trialing"
          value={String(plans.trialing)}
          hint={`${coupons.redemptions_7d} coupon redeem / 7d`}
          href="/admin/users?filter=TRIALING"
        />
        <GlanceCard
          label="Est. MRR"
          value={formatUsd(revenue.estimated_mrr_usd)}
          hint="From live paid plans"
        />
        <GlanceCard
          label="Revenue 30d"
          value={formatUsd(revenue.collected_30d_usd)}
          hint={`${revenue.paid_checkouts_30d} paid invoices`}
          href="/admin/payments"
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Access */}
        <section className="admin-card xl:col-span-4">
          <SectionHead
            title="Access"
            subtitle="Who can use Plugio"
            href="/admin/beta"
            linkLabel="Beta queue"
          />
          <div className="space-y-4 p-5">
            <FunnelRow
              label="Registered"
              value={access.total_users}
              max={access.total_users}
              bar="bg-neutral-800"
              track="bg-neutral-100"
            />
            <FunnelRow
              label="Applied"
              value={applied}
              max={access.total_users}
              bar="bg-[#FF6719]"
              track="bg-orange-100"
            />
            <FunnelRow
              label="Approved"
              value={access.approved_users}
              max={access.total_users}
              bar="bg-emerald-500"
              track="bg-emerald-100"
            />
            <FunnelRow
              label="Connected social"
              value={activation.approved_with_social}
              max={Math.max(access.approved_users, 1)}
              bar="bg-sky-500"
              track="bg-sky-100"
            />
            <div className="grid grid-cols-3 gap-2 pt-1">
              <MiniStat label="Pending" value={access.pending_requests} />
              <MiniStat label="Rejected" value={access.rejected_users} />
              <MiniStat label="New 7d" value={access.new_last_7_days} />
            </div>
          </div>
        </section>

        {/* Billing */}
        <section className="admin-card xl:col-span-5">
          <SectionHead
            title="Subscriptions & revenue"
            subtitle="Plans, trials, coupons, invoices"
            href="/admin/payments"
            linkLabel="Payments"
          />
          <div className="space-y-5 p-5">
            <PlanMixBar
              items={[
                { label: "Creator", value: plans.active_creator, className: "bg-[#FF6719]" },
                { label: "Pro", value: plans.active_pro, className: "bg-neutral-900" },
                { label: "Trial", value: plans.trialing, className: "bg-sky-500" },
                { label: "Grants", value: plans.complimentary_grants, className: "bg-violet-500" },
              ]}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniStat label="Creator" value={plans.active_creator} />
              <MiniStat label="Pro" value={plans.active_pro} />
              <MiniStat label="Trialing" value={plans.trialing} />
              <MiniStat label="Grants" value={plans.complimentary_grants} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-neutral-200/70 bg-[#F8F9FB] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                  All-time revenue
                </p>
                <p className="mt-1 text-xl font-extrabold tabular-nums text-neutral-900">
                  {formatUsd(revenue.total_collected_usd)}
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
                  {revenue.paid_checkouts} paid invoices
                </p>
              </div>
              <div className="rounded-xl border border-orange-200/70 bg-gradient-to-br from-[#fff7ed] to-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#FF6719]">
                  Catalog
                </p>
                <p className="mt-1 text-[12px] font-semibold text-neutral-800">
                  Creator {formatUsd(PLAN_CATALOG_USD.CREATOR.monthly)} · Pro{" "}
                  {formatUsd(PLAN_CATALOG_USD.PRO.monthly)}
                  <span className="font-medium text-neutral-500"> /mo</span>
                </p>
                <p className="mt-0.5 text-[11px] font-medium text-neutral-500">
                  Trial {PLAN_CATALOG_USD.trialDays}d · {coupons.active_codes}{" "}
                  active coupons
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/coupons"
                className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] font-semibold text-neutral-700 hover:border-orange-200"
              >
                <Ticket className="h-3.5 w-3.5 text-[#FF6719]" />
                {coupons.redemptions_7d} redemptions / 7d
              </Link>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-[12px] font-semibold text-neutral-700">
                <Gift className="h-3.5 w-3.5 text-violet-500" />
                {plans.expired} expired · {plans.none} no plan
              </span>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section className="admin-card xl:col-span-3">
          <SectionHead title="Go to" subtitle="Control surfaces" />
          <div className="space-y-1 p-3">
            {[
              {
                href: "/admin/beta?status=PENDING",
                icon: ClipboardList,
                title: "Beta requests",
                detail: `${attention.pending_beta} pending`,
              },
              {
                href: "/admin/users",
                icon: Users,
                title: "Users",
                detail: `${access.total_users.toLocaleString()} total`,
              },
              {
                href: "/admin/coupons",
                icon: Ticket,
                title: "Coupons",
                detail: `${coupons.active_codes} active`,
              },
              {
                href: "/admin/payments",
                icon: CreditCard,
                title: "Payments / invoices",
                detail: `${revenue.paid_checkouts_30d} paid / 30d`,
              },
              {
                href: "/admin/audit",
                icon: Shield,
                title: "Audit log",
                detail: "Operator actions",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#F8F9FB]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200/80 bg-[#F8F9FB] text-neutral-600">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-neutral-900">
                      {item.title}
                    </p>
                    <p className="truncate text-[12px] font-medium text-neutral-500">
                      {item.detail}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* Platform pulse — social + content */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="admin-card">
          <SectionHead
            title="Social connections"
            subtitle="Active accounts across creators"
            href="/admin/users"
            linkLabel="Users"
          />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            <MiniStat label="Connected users" value={social.users_connected} />
            <MiniStat label="Active accounts" value={social.active_accounts} />
            <MiniStat label="Sync failed" value={social.sync_failed} warn={social.sync_failed > 0} />
            <MiniStat label="Syncing" value={social.syncing} />
          </div>
          <div className="grid grid-cols-3 gap-3 border-t border-neutral-100 px-5 py-4">
            <ProviderStat icon={Youtube} label="YouTube" value={social.youtube} />
            <ProviderStat icon={Instagram} label="Instagram" value={social.instagram} />
            <ProviderStat icon={Facebook} label="Facebook" value={social.facebook} />
          </div>
        </section>

        <section className="admin-card">
          <SectionHead
            title="Content & publishing"
            subtitle="Posts creators have in Plugio"
            href="/admin/users"
            linkLabel="Users"
          />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
            <MiniStat label="Published" value={content.published} />
            <MiniStat label="Scheduled" value={content.scheduled} />
            <MiniStat label="Failed" value={content.failed} warn={content.failed > 0} />
            <MiniStat label="Drafts / ready" value={content.drafts} />
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 px-5 py-4 text-[12px] font-medium text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" />
              {content.total.toLocaleString()} total items
            </span>
            <span>·</span>
            <span>{content.created_7d} created / 7d</span>
            <span>·</span>
            <span>{content.creators_with_content} creators with content</span>
          </div>
        </section>
      </div>

      {/* Feeds */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <FeedCard
          title="Recent activity"
          subtitle="Signups and beta decisions"
          href="/admin/users"
          linkLabel="Users"
        >
          {activity.length === 0 ? (
            <EmptyFeed text="No recent user activity" />
          ) : (
            activity.map((item) => (
              <div
                key={`${item.id}-${item.action}-${String(item.occurred_at)}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#F8F9FB]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-neutral-900">
                    {item.name ?? item.email}
                  </p>
                  <p className="text-[12px] font-medium text-neutral-500">
                    {activityCopy(item.action)}
                  </p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                  {formatRelativeTime(item.occurred_at)}
                </span>
              </div>
            ))
          )}
        </FeedCard>

        <FeedCard
          title="Grants ending soon"
          subtitle="Complimentary access ≤7 days"
          href="/admin/users"
          linkLabel="Users"
          icon={Gift}
        >
          {expiringGrants.length === 0 ? (
            <EmptyFeed text="No grants ending this week" />
          ) : (
            expiringGrants.map((g) => (
              <Link
                key={g.id}
                href={`/admin/users/${g.user_id}`}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-[#F8F9FB]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-neutral-900">
                    {g.user_name ?? g.user_email ?? "User"}
                  </p>
                  <p className="text-[12px] font-medium text-neutral-500">
                    {g.plan_id} · ends {formatDate(g.ends_at)}
                  </p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
              </Link>
            ))
          )}
        </FeedCard>

        <FeedCard
          title="Operator actions"
          subtitle="What admins changed recently"
          href="/admin/audit"
          linkLabel="Audit"
          icon={Activity}
        >
          {auditLogs.length === 0 ? (
            <EmptyFeed text="No operator actions logged yet" />
          ) : (
            auditLogs.map((log, i) => (
              <div
                key={`${log.timestamp}-${log.action}-${i}`}
                className="rounded-xl px-3 py-2.5 hover:bg-[#F8F9FB]"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[13px] font-semibold text-neutral-900">
                    {log.action.replaceAll("_", " ")}
                  </p>
                  <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-500">
                  {log.adminEmail}
                  {log.targetEmail ? ` → ${log.targetEmail}` : ""}
                </p>
              </div>
            ))
          )}
        </FeedCard>
      </div>
    </div>
  );
}

function activityCopy(action: string) {
  if (action === "registered") return "Joined Plugio";
  if (action === "applied") return "Applied for beta";
  if (action === "approved") return "Approved for access";
  if (action === "rejected") return "Beta declined";
  return action;
}

function StatChip({
  icon: Icon,
  label,
  accent,
}: {
  icon: typeof Users;
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        accent
          ? "border-orange-200 bg-[#fff7ed] text-[#FF6719]"
          : "border-neutral-200 bg-[#F8F9FB] text-neutral-600"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}

function GlanceCard({
  label,
  value,
  hint,
  href,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <div
      className={cn(
        "admin-card h-full p-4 transition-colors",
        highlight && "border-orange-200 bg-gradient-to-br from-[#fff7ed] to-white",
        href && "hover:border-orange-200"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-extrabold tabular-nums tracking-tight text-neutral-900 sm:text-2xl">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] font-medium text-neutral-500">{hint}</p>
      )}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function SectionHead({
  title,
  subtitle,
  href,
  linkLabel,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[12px] font-medium text-neutral-500">
            {subtitle}
          </p>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#FF6719] hover:text-[#EA580C]"
        >
          {linkLabel ?? "View"}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}

function FunnelRow({
  label,
  value,
  max,
  bar,
  track,
}: {
  label: string;
  value: number;
  max: number;
  bar: string;
  track: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px]">
        <span className="font-bold uppercase tracking-widest text-neutral-500">
          {label}
        </span>
        <span className="font-extrabold tabular-nums text-neutral-900">
          {value.toLocaleString()}
        </span>
      </div>
      <div className={cn("h-2 overflow-hidden rounded-full", track)}>
        <div
          className={cn("h-full rounded-full", bar)}
          style={{
            width:
              max > 0
                ? `${Math.min(100, Math.round((value / max) * 100))}%`
                : "0%",
          }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-3",
        warn
          ? "border-amber-200 bg-amber-50"
          : "border-neutral-200/70 bg-[#F8F9FB]"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-extrabold tabular-nums",
          warn ? "text-amber-800" : "text-neutral-900"
        )}
      >
        {value.toLocaleString()}
      </p>
    </div>
  );
}

function ProviderStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Youtube;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 bg-[#F8F9FB] text-neutral-600">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-neutral-500">{label}</p>
        <p className="text-[15px] font-extrabold tabular-nums text-neutral-900">
          {value}
        </p>
      </div>
    </div>
  );
}

function PlanMixBar({
  items,
}: {
  items: { label: string; value: number; className: string }[];
}) {
  const total = items.reduce((sum, i) => sum + i.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-neutral-100">
        {items.map((item) =>
          item.value > 0 ? (
            <div
              key={item.label}
              className={item.className}
              style={{ width: `${(item.value / total) * 100}%` }}
              title={`${item.label}: ${item.value}`}
            />
          ) : null
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", item.className)} />
            <span className="text-[12px] font-semibold text-neutral-600">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedCard({
  title,
  subtitle,
  href,
  linkLabel,
  icon: Icon,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  icon?: typeof Activity;
  children: ReactNode;
}) {
  return (
    <section className="admin-card flex max-h-[400px] flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
        <div className="flex items-start gap-2">
          {Icon && <Icon className="mt-0.5 h-4 w-4 text-neutral-500" />}
          <div>
            <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>
            <p className="text-[12px] font-medium text-neutral-500">{subtitle}</p>
          </div>
        </div>
        <Link
          href={href}
          className="text-[12px] font-semibold text-[#FF6719] hover:text-[#EA580C]"
        >
          {linkLabel}
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto p-2">{children}</div>
    </section>
  );
}

function EmptyFeed({ text }: { text: string }) {
  return (
    <p className="px-3 py-10 text-center text-[13px] font-medium text-neutral-400">
      {text}
    </p>
  );
}
