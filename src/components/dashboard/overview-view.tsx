import Link from "next/link";
import { Youtube, Instagram, Facebook } from "lucide-react";
import { formatRelativeTime, cn, getInitials, formatMinor } from "@/lib/utils";
import { formatInr, formatUsd } from "@/constants";
import type { MarketplacePulse, MoneyByCurrency } from "@/lib/db/marketplace";
import type { AdminOverviewPayload, BetaRequestRow, BusinessOverview } from "@/types";
import { AdminPage, AdminCard } from "@/components/ui/page-shell";
import { FunnelPanel, RevenuePanel, RetentionPanel } from "@/components/dashboard/growth-panels";
import type { FunnelStep, RevenueSeries, Retention } from "@/lib/db/growth";
import { TrendChart } from "@/components/ui/trend-chart";
import type { getTrendSeries } from "@/lib/db/health";

export type ActionItem = { label: string; count: number; href: string; tone: "urgent" | "money" | "people" };

type OverviewViewProps = {
  firstName: string;
  overview: BusinessOverview;
  activity: AdminOverviewPayload["activity"];
  auditLogs: {
    timestamp: Date | string;
    action: string;
    adminEmail: string;
    targetEmail?: string | null;
  }[];
  pendingQueue: BetaRequestRow[];
  loadError: string | null;
  storeItems: ActionItem[];
  trends: Awaited<ReturnType<typeof getTrendSeries>> | null;
  pulse: MarketplacePulse | null;
  funnel: FunnelStep[] | null;
  revenueSeries: RevenueSeries[] | null;
  retention: Retention | null;
  /** Money figures are for finance and super admins; support sees the rest of the overview. */
  canViewMoney?: boolean;
};

export function OverviewView({
  firstName,
  overview,
  activity,
  auditLogs,
  pendingQueue,
  loadError,
  storeItems,
  trends,
  pulse,
  funnel,
  revenueSeries,
  retention,
  canViewMoney = true,
}: OverviewViewProps) {
  const { access, revenue, plans, coupons, social, content, attention } = overview;
  const paidLive = plans.active_creator + plans.active_pro;

  const incidents: { label: string; href: string }[] = [];
  if (attention.payment_failures_7d > 0) {
    incidents.push({
      label: `${attention.payment_failures_7d} payment failure${attention.payment_failures_7d === 1 ? "" : "s"} this week`,
      href: "/admin/payments",
    });
  }
  if (attention.sync_failed > 0) {
    incidents.push({
      label: `${attention.sync_failed} social sync failing`,
      href: "/admin/users",
    });
  }
  if (attention.content_failed > 0) {
    incidents.push({
      label: `${attention.content_failed} publish failed`,
      href: "/admin/users",
    });
  }

  const feed = buildFeed(activity, auditLogs);
  const queueBusy = pendingQueue.length > 0;

  const needs: ActionItem[] = [
    ...storeItems,
    ...(attention.pending_beta > 0
      ? [{ label: "People waiting for access", count: attention.pending_beta, href: "/admin/beta?status=PENDING", tone: "people" as const }]
      : []),
    ...(attention.payment_failures_7d > 0
      ? [{ label: "Payment failures this week", count: attention.payment_failures_7d, href: "/admin/health", tone: "urgent" as const }]
      : []),
    ...(attention.content_failed > 0
      ? [{ label: "Posts that failed to publish", count: attention.content_failed, href: "/admin/health", tone: "urgent" as const }]
      : []),
    ...(attention.sync_failed > 0
      ? [{ label: "Social accounts failing to sync", count: attention.sync_failed, href: "/admin/health", tone: "urgent" as const }]
      : []),
  ].sort((a, b) => ORDER[a.tone] - ORDER[b.tone]);
  const needsTotal = needs.length;

  // Marketplace, in rupees (the only currency creators sell in), store and sessions together.
  const inr = (rows: MoneyByCurrency[] | undefined) => rows?.find((r) => r.currency === "INR");
  const marketGross = (inr(pulse?.store)?.grossMinor ?? 0) + (inr(pulse?.sessions)?.grossMinor ?? 0);
  const marketFee = (inr(pulse?.store)?.feeMinor ?? 0) + (inr(pulse?.sessions)?.feeMinor ?? 0);

  return (
    <AdminPage className="max-w-[1360px]! space-y-6!">
      {loadError ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950">
          {loadError}
        </div>
      ) : null}

      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12.5px] text-(--ink-mute)">{todayLabel()}</p>
          <h1 className="text-[20px] font-semibold tracking-tight text-(--ink)">
            {greeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
        </div>
        <p className="text-[13.5px] text-(--ink-soft)">
          {needsTotal > 0 ? (
            <><strong className="font-semibold text-(--ink)">{needsTotal}</strong> thing{needsTotal === 1 ? "" : "s"} need{needsTotal === 1 ? "s" : ""} you today.</>
          ) : (
            "Everything is running smoothly."
          )}
        </p>
      </header>

      <ActionCenter items={needs} />

      <section aria-label="Key numbers" className={cn("grid grid-cols-2 gap-3 lg:grid-cols-3", canViewMoney ? "xl:grid-cols-6" : "xl:grid-cols-4")}>
        <Kpi dot="bg-brand-500" label="Creators" value={access.total_users.toLocaleString()} sub={`+${access.new_last_7_days} this week`} href="/admin/users" />
        <Kpi dot="bg-brand-500" label="Waiting for access" value={access.pending_requests.toLocaleString()} sub={access.pending_requests > 0 ? "Needs a decision" : "Queue is clear"} href="/admin/beta?status=PENDING" warn={access.pending_requests > 0} />
        <Kpi dot="bg-emerald-500" label="Paying plans" value={paidLive.toLocaleString()} sub={`${plans.trialing} on trial`} href="/admin/users?filter=PAID" />
        {canViewMoney && (
          <>
            <Kpi dot="bg-emerald-500" label="Subscriptions, 30 days" value={formatInr(revenue.collected_30d_inr)} sub={formatUsd(revenue.collected_30d_usd)} href="/admin/payments" />
            <Kpi dot="bg-sky-500" label="Creator sales, 30 days" value={formatMinor(marketGross, "INR")} sub={`Plugio keeps ${formatMinor(marketFee, "INR")}`} href="/admin/store" />
          </>
        )}
        <Kpi dot="bg-violet-500" label="Platform" value={incidents.length > 0 ? `${incidents.length} issue${incidents.length === 1 ? "" : "s"}` : "Healthy"} sub={incidents.length > 0 ? "See what is failing" : "No failures"} href="/admin/health" warn={incidents.length > 0} />
      </section>

      {trends ? (
        <section aria-label="Last 30 days" className="space-y-3">
          <SectionHead title="Last 30 days" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <TrendChart label="New sign-ups" points={trends.signups} />
            <TrendChart label="Access applications" points={trends.applications} accent="#c2410c" />
            <TrendChart label="Posts published" points={trends.publishes} accent="#0f7a4a" />
            <TrendChart label="Subscription payments" points={trends.paid} accent="#14110e" />
          </div>
        </section>
      ) : null}

      <section aria-label="People" className="space-y-3">
        <SectionHead title="People" href="/admin/users" link="All creators" />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            {queueBusy ? (
              <AdminCard padded={false}>
                <div className="flex items-center justify-between gap-3 border-b border-(--line) px-5 py-3">
                  <div>
                    <h3 className="text-[15px] font-semibold tracking-tight text-(--ink)">Access requests</h3>
                    <p className="text-[12.5px] text-(--ink-soft)">{attention.pending_beta} waiting</p>
                  </div>
                  <Link href="/admin/beta?status=PENDING" className="text-[12.5px] font-semibold text-brand-500">Review all</Link>
                </div>
                <ul className="divide-y divide-(--line)">
                  {pendingQueue.slice(0, 5).map((req) => (
                    <li key={req.id}>
                      <Link href={`/admin/users/${req.id}`} className="flex items-center gap-3 px-5 py-3 transition hover:bg-(--subtle)">
                        <Avatar src={req.picture} name={req.name} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold text-(--ink)">{req.name ?? "Unknown"}</p>
                          <p className="truncate text-[12px] text-(--ink-soft)">{socialLine(req)}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium text-(--ink-mute)">{formatRelativeTime(req.beta_application_submitted_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </AdminCard>
            ) : null}
            {retention ? <RetentionPanel r={retention} /> : null}
          </div>
          {funnel ? <FunnelPanel steps={funnel} /> : null}
        </div>
      </section>

      {canViewMoney && (
      <section aria-label="Money" className="space-y-3">
        <SectionHead title="Money" href="/admin/reports" link="Reports" />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <AdminCard padded={false}>
            <div className="flex items-center justify-between gap-3 border-b border-(--line) px-5 py-3">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight text-(--ink)">Subscriptions</h3>
                <p className="text-[12.5px] text-(--ink-soft)">Prepaid plans</p>
              </div>
              <div className="flex gap-3">
                <Link href="/admin/plans" className="text-[12.5px] font-semibold text-brand-500">Plans</Link>
                <Link href="/admin/coupons" className="text-[12.5px] font-semibold text-brand-500">Coupons</Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-px bg-(--line)">
              <MiniStat label="All-time collected" value={formatInr(revenue.total_collected_inr)} sub={formatUsd(revenue.total_collected_usd)} />
              <MiniStat label="Est. MRR" value={formatUsd(revenue.estimated_mrr_usd)} sub="Live paid plans" />
              <MiniStat label="Paid" value={String(paidLive)} sub={`${plans.active_creator} Creator · ${plans.active_pro} Pro`} />
              <MiniStat label="Trial / no plan" value={`${plans.trialing} / ${plans.none}`} sub={`${coupons.redemptions_7d} coupons this week`} />
            </div>
          </AdminCard>
          {revenueSeries ? <RevenuePanel series={revenueSeries} /> : null}
        </div>
      </section>
      )}

      {pulse && canViewMoney ? (
        <section aria-label="Marketplace" className="space-y-3">
          <SectionHead title="Marketplace" href="/admin/transactions" link="Transactions" />
          <AdminCard padded={false}>
            <div className="grid gap-px bg-(--line) sm:grid-cols-2 lg:grid-cols-4">
              <PulseCell label="Store sales" rows={pulse.store} href="/admin/store?tab=orders" />
              <PulseCell label="Paid sessions" rows={pulse.sessions} href="/admin/bookings?filter=ALL" />
              <div className="bg-(--paper) px-5 py-4">
                <p className="text-[11px] font-medium text-(--ink-mute)">Creators earning</p>
                <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">{pulse.activeSellers30d}</p>
                <p className="mt-0.5 text-[12px] text-(--ink-soft)">in 30 days</p>
              </div>
              <Link href="/admin/bookings" className="bg-(--paper) px-5 py-4">
                <p className="text-[11px] font-medium text-(--ink-mute)">Upcoming sessions</p>
                <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">{pulse.upcomingSessions}</p>
                <p className={cn("mt-0.5 text-[12px]", pulse.refundPending > 0 ? "font-semibold text-red-700" : "text-(--ink-soft)")}>
                  {pulse.refundPending > 0 ? `${pulse.refundPending} refund${pulse.refundPending === 1 ? "" : "s"} stuck` : "No stuck refunds"}
                </p>
              </Link>
            </div>
          </AdminCard>
        </section>
      ) : null}

      <section aria-label="Platform" className="space-y-3">
        <SectionHead title="Platform" href="/admin/health" link="Health" />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
          <AdminCard padded={false} className="h-fit self-start lg:col-span-7">
            <div className="flex items-center justify-between gap-3 border-b border-(--line) px-5 py-3.5">
              <h3 className="text-[15px] font-semibold tracking-tight text-(--ink)">Connections and content</h3>
              {incidents.length > 0 ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  {incidents.length} issue{incidents.length === 1 ? "" : "s"}
                </span>
              ) : (
                <span className="text-[12px] font-medium text-emerald-700">Healthy</span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-px bg-(--line) md:grid-cols-3">
              <PlatformBlock
                title="Social"
                rows={[
                  { icon: Youtube, label: "YouTube", value: social.youtube },
                  { icon: Instagram, label: "Instagram", value: social.instagram },
                  { icon: Facebook, label: "Facebook", value: social.facebook },
                ]}
                footer={`${social.users_connected} creators · ${social.active_accounts} accounts`}
              />
              <PlatformBlock
                title="Content"
                rows={[
                  { label: "Published", value: content.published },
                  { label: "Scheduled", value: content.scheduled },
                  { label: "Drafts", value: content.drafts },
                ]}
                footer={`${content.created_7d} created this week`}
              />
              <div className="bg-(--paper) p-5">
                <p className="text-[12px] font-medium text-(--ink-mute)">Watch</p>
                <ul className="mt-3 space-y-2.5">
                  <WatchRow label="Sync failed" value={social.sync_failed} href="/admin/health" />
                  <WatchRow label="Publish failed" value={content.failed} href="/admin/health" />
                  <WatchRow label="Payment failed, 7 days" value={attention.payment_failures_7d} href="/admin/payments" />
                </ul>
              </div>
            </div>
          </AdminCard>

          <AdminCard padded={false} className="flex w-full flex-col self-start lg:col-span-5">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-(--line) px-5 py-3.5">
              <h3 className="text-[15px] font-semibold tracking-tight text-(--ink)">Recent activity</h3>
              <Link href="/admin/audit" className="text-[12.5px] font-semibold text-brand-500">Audit trail</Link>
            </div>
            {feed.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-(--ink-mute)">No recent activity</p>
            ) : (
              <ul className="custom-scrollbar max-h-88 divide-y divide-(--line) overflow-y-auto">
                {feed.map((item) => (
                  <li key={item.key} className="flex items-start justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-semibold text-(--ink)">{item.title}</p>
                      <p className="truncate text-[12px] text-(--ink-soft)">{item.detail}</p>
                    </div>
                    <span className="shrink-0 text-[11px] font-medium text-(--ink-mute)">{item.ago}</span>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </section>
    </AdminPage>
  );
}

function greeting(): string {
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())) % 24;
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

function todayLabel(): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(new Date());
}

/** A sector heading: a title, a hairline, and one link to the full page. */
function SectionHead({ title, href, link }: { title: string; href?: string; link?: string }) {
  return (
    <div className="flex items-center gap-3">
      <h2 className="text-[14px] font-semibold tracking-tight text-(--ink)">{title}</h2>
      <span aria-hidden className="h-px flex-1 bg-(--line)" />
      {href && link ? <Link href={href} className="text-[12.5px] font-semibold text-brand-500 hover:underline">{link} →</Link> : null}
    </div>
  );
}

function Kpi({ dot, label, value, sub, href, warn }: {
  dot: string; label: string; value: string; sub: string; href: string; warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "admin-card group block px-4 py-3.5 transition hover:border-(--line-strong) hover:shadow-[0_2px_6px_rgba(16,24,40,0.06)]",
        warn && "border-amber-300/70 bg-amber-50/60"
      )}
    >
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-(--ink-soft)">
        <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        {label}
      </p>
      <p className={cn("mt-0.5 text-[24px] font-semibold tabular-nums tracking-tight", warn ? "text-amber-900" : "text-(--ink)")}>{value}</p>
      <p className="mt-0.5 truncate text-[12px] text-(--ink-soft)">{sub}</p>
    </Link>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-(--paper) px-5 py-4">
      <p className="text-[11px] font-medium text-(--ink-mute)">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums tracking-tight text-(--ink)">{value}</p>
      <p className="mt-0.5 text-[12px] text-(--ink-soft)">{sub}</p>
    </div>
  );
}

function PulseCell({ label, rows, href }: { label: string; rows: MoneyByCurrency[]; href: string }) {
  return (
    <Link href={href} className="bg-(--paper) px-5 py-4">
      <p className="text-[11px] font-medium text-(--ink-mute)">{label}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-[22px] font-semibold tracking-tight text-(--ink-mute)">None yet</p>
      ) : (
        rows.map((r) => (
          <div key={r.currency} className="mt-1">
            <p className="text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">{formatMinor(r.grossMinor, r.currency)}</p>
            <p className="text-[12px] text-(--ink-soft)">
              {r.count} sale{r.count === 1 ? "" : "s"} · Plugio keeps {formatMinor(r.feeMinor, r.currency)}
            </p>
          </div>
        ))
      )}
    </Link>
  );
}

const ORDER = { urgent: 0, money: 1, people: 2 } as const;

function ActionCenter({ items }: { items: ActionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50/70 px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <p className="text-[13.5px] font-medium text-emerald-900">All clear. Nothing is waiting for you.</p>
      </div>
    );
  }
  const tone = {
    urgent: { dot: "bg-red-500", count: "text-red-700", ring: "hover:border-red-300" },
    money: { dot: "bg-amber-500", count: "text-amber-800", ring: "hover:border-amber-300" },
    people: { dot: "bg-brand-500", count: "text-brand-500", ring: "hover:border-brand-500/40" },
  } as const;
  return (
    <section aria-label="Needs you" className="space-y-3">
      <SectionHead title="Needs you" />
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className={cn("admin-card flex items-center gap-4 px-4 py-3.5 transition hover:shadow-md", tone[item.tone].ring)}>
              <span className={cn("text-[28px] font-semibold tabular-nums leading-none", tone[item.tone].count)}>{item.count}</span>
              <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-snug text-(--ink)">{item.label}</span>
              <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", tone[item.tone].dot)} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildFeed(
  activity: AdminOverviewPayload["activity"] | undefined,
  auditLogs: OverviewViewProps["auditLogs"] | undefined
) {
  const rows: { key: string; t: number; title: string; detail: string; ago: string }[] = [];

  for (const item of (activity ?? [])) {
    if (!item) continue;
    const t = new Date(item.occurred_at).getTime();
    rows.push({
      key: `u-${item.id}-${item.action}-${t}`,
      t,
      title: item.name ?? item.email ?? "User",
      detail: activityCopy(item.action),
      ago: formatRelativeTime(item.occurred_at),
    });
  }

  for (const log of (auditLogs ?? [])) {
    if (!log) continue;
    const t = new Date(log.timestamp).getTime();
    const actionName = (log.action ?? "ACTION").replaceAll("_", " ");
    rows.push({
      key: `a-${t}-${log.action}-${log.adminEmail}`,
      t,
      title: actionName,
      detail: log.targetEmail ? `${log.adminEmail} → ${log.targetEmail}` : (log.adminEmail ?? "Admin"),
      ago: formatRelativeTime(log.timestamp),
    });
  }

  return rows.sort((a, b) => b.t - a.t).slice(0, 10);
}

function activityCopy(action: string) {
  if (action === "registered") return "Joined Plugio";
  if (action === "applied") return "Applied for beta";
  if (action === "approved") return "Approved for access";
  if (action === "rejected") return "Beta declined";
  return action;
}

function socialLine(req: BetaRequestRow) {
  const bits = [
    req.instagram_username ? `IG ${req.instagram_username}` : null,
    req.youtube_channel ? "YouTube" : null,
    req.facebook_page ? "Facebook" : null,
  ].filter(Boolean);
  return bits.length ? bits.join(" · ") : "No socials on form";
}

function Avatar({ src, name }: { src: string | null; name: string | null }) {
  if (src) {
    return (
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-(--line)">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-[11px] font-bold text-brand-500">
      {getInitials(name)}
    </div>
  );
}

function PlatformBlock({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: { icon?: typeof Youtube; label: string; value: number }[];
  footer: string;
}) {
  return (
    <div className="bg-(--paper) p-5">
      <p className="text-[12px] font-medium text-(--ink-mute)">{title}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.label} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-(--ink-soft)">
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {row.label}
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-(--ink)">{row.value}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-(--ink-mute)">{footer}</p>
    </div>
  );
}

function WatchRow({ label, value, href }: { label: string; value: number; href: string }) {
  const hot = value > 0;
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-(--ink-soft)">{label}</span>
        <span className={cn("text-[13px] font-semibold tabular-nums", hot ? "text-amber-800" : "text-(--ink)")}>
          {value}
        </span>
      </Link>
    </li>
  );
}
