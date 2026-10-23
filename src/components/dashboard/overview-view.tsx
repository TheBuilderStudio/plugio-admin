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
}: OverviewViewProps) {
  const { access, revenue, plans, coupons, social, content, activation, attention } = overview;
  const paidLive = plans.active_creator + plans.active_pro;
  const applied = access.approved_users + access.pending_requests + access.rejected_users;

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

  return (
    <AdminPage className="max-w-[1360px]! space-y-4!">
      {loadError ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950">
          {loadError}
        </div>
      ) : null}

      <ActionCenter
        firstName={firstName}
        items={[
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
        ].sort((a, b) => ORDER[a.tone] - ORDER[b.tone])}
      />

      {trends ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TrendChart label="New sign-ups" points={trends.signups} />
          <TrendChart label="Access applications" points={trends.applications} accent="#c2410c" />
          <TrendChart label="Posts published" points={trends.publishes} accent="#0f7a4a" />
          <TrendChart label="Successful subscription payments" points={trends.paid} accent="#14110e" />
        </div>
      ) : null}

      {funnel || revenueSeries ? (
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          {revenueSeries ? <RevenuePanel series={revenueSeries} /> : null}
          {funnel ? <FunnelPanel steps={funnel} /> : null}
        </div>
      ) : null}
      {retention ? <RetentionPanel r={retention} /> : null}

      {pulse ? (
        <AdminCard padded={false}>
          <div className="flex items-center justify-between gap-3 border-b border-(--line) px-5 py-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Marketplace</h2>
              <p className="text-[12.5px] text-(--ink-soft)">Store sales and paid sessions, last 30 days. Platform fee is what Plugio keeps.</p>
            </div>
            <Link href="/admin/transactions" className="text-[12.5px] font-semibold text-brand-500">Transactions</Link>
          </div>
          <div className="grid gap-px bg-(--line) sm:grid-cols-2 lg:grid-cols-4">
            <PulseCell label="Store sales" rows={pulse.store} href="/admin/store?tab=orders" />
            <PulseCell label="Paid sessions" rows={pulse.sessions} href="/admin/bookings?filter=ALL" />
            <div className="bg-(--paper) px-5 py-4">
              <p className="text-[11px] font-medium text-(--ink-mute)">Creators earning</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">{pulse.activeSellers30d}</p>
              <p className="mt-0.5 text-[12px] text-(--ink-soft)">sold or got paid in 30 days</p>
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
      ) : null}

      <div className={cn("grid grid-cols-1 gap-4", queueBusy && "xl:grid-cols-12")}>
        {queueBusy ? (
          <AdminCard padded={false} className="xl:col-span-7">
            <div className="flex items-center justify-between gap-3 border-b border-(--line) px-5 py-3">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Access requests</h2>
                <p className="text-[12.5px] text-(--ink-soft)">
                  {attention.pending_beta} waiting — approve is access, not a plan
                </p>
              </div>
              <Link href="/admin/beta?status=PENDING" className="text-[12.5px] font-semibold text-brand-500">
                Review all
              </Link>
            </div>
            <ul className="divide-y divide-(--line)">
              {pendingQueue.map((req) => (
                <li key={req.id}>
                  <Link
                    href={`/admin/users/${req.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-[#FAF7F2]"
                  >
                    <Avatar src={req.picture} name={req.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-(--ink)">
                        {req.name ?? "Unknown"}
                      </p>
                      <p className="truncate text-[12px] text-(--ink-soft)">{req.email}</p>
                    </div>
                    <p className="hidden max-w-[200px] truncate text-[12px] text-(--ink-soft) sm:block">
                      {socialLine(req)}
                    </p>
                    <span className="shrink-0 text-[11px] font-medium text-(--ink-mute)">
                      {formatRelativeTime(req.beta_application_submitted_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminCard>
        ) : null}

        <AdminCard padded={false} className={queueBusy ? "xl:col-span-5" : undefined}>
          <div className="flex items-center justify-between gap-3 border-b border-(--line) px-5 py-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Subscription revenue</h2>
              <p className="text-[12.5px] text-(--ink-soft)">Prepaid · last 30 days</p>
            </div>
            <div className="flex gap-3">
              <Link href="/admin/plans" className="text-[12.5px] font-semibold text-brand-500">
                Plans
              </Link>
              <Link href="/admin/payments" className="text-[12.5px] font-semibold text-brand-500">
                Payments
              </Link>
              <Link href="/admin/coupons" className="text-[12.5px] font-semibold text-brand-500">
                Coupons
              </Link>
            </div>
          </div>
          <div className={cn("grid gap-px bg-(--line)", queueBusy ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            <div className="bg-(--paper) px-5 py-4">
              <p className="text-[11px] font-medium text-(--ink-mute)">Collected (30d)</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">
                {formatInr(revenue.collected_30d_inr)}
              </p>
              <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-(--ink)">
                {formatUsd(revenue.collected_30d_usd)}
              </p>
              <p className="mt-0.5 text-[12px] text-(--ink-soft)">
                {revenue.paid_checkouts_30d_inr} INR · {revenue.paid_checkouts_30d} USD invoices
                · all-time {formatInr(revenue.total_collected_inr)} · {formatUsd(revenue.total_collected_usd)}
              </p>
            </div>
            <div className="bg-(--paper) px-5 py-4">
              <p className="text-[11px] font-medium text-(--ink-mute)">Est. MRR (USD list)</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">
                {formatUsd(revenue.estimated_mrr_usd)}
              </p>
              <p className="mt-0.5 text-[12px] text-(--ink-soft)">
                Live paid plans · USD catalog (seats are not currency-tagged)
              </p>
            </div>
            <div className="bg-(--paper) px-5 py-4">
              <p className="text-[11px] font-medium text-(--ink-mute)">Paid</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">
                {paidLive}
              </p>
              <p className="mt-0.5 text-[12px] text-(--ink-soft)">
                {plans.active_creator} Creator · {plans.active_pro} Pro
              </p>
            </div>
            <div className="bg-(--paper) px-5 py-4">
              <p className="text-[11px] font-medium text-(--ink-mute)">Trial / none</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-(--ink)">
                {plans.trialing}
                <span className="text-[15px] font-medium text-(--ink-mute)"> / {plans.none}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-(--ink-soft)">
                {coupons.redemptions_7d} coupons / 7d · {plans.expired} expired
              </p>
            </div>
          </div>
        </AdminCard>
      </div>

      <AdminCard padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-(--line) px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Pipeline</h2>
            <p className="text-[12.5px] text-(--ink-soft)">Who can use Plugio</p>
          </div>
          <Link href="/admin/users" className="text-[12.5px] font-semibold text-brand-500">
            Users
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          <PipeCell label="Signed in" value={access.total_users} href="/admin/users" />
          <PipeCell label="Applied" value={applied} href="/admin/beta" />
          <PipeCell
            label="Waiting"
            value={access.pending_requests}
            href="/admin/beta?status=PENDING"
            warn={access.pending_requests > 0}
          />
          <PipeCell label="Approved" value={access.approved_users} href="/admin/users" />
          <PipeCell label="Connected" value={activation.approved_with_social} href="/admin/users" />
          <PipeCell label="New / 7d" value={access.new_last_7_days} href="/admin/users" />
        </div>
      </AdminCard>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-12">
        <AdminCard padded={false} className="h-fit self-start lg:col-span-7">
          <div className="flex items-center justify-between gap-3 border-b border-(--line) px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Platform</h2>
            {incidents.length > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {incidents.length} issue{incidents.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-[12px] font-medium text-(--ink-mute)">Healthy</span>
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
              footer={`${content.created_7d} created / 7d`}
            />
            <div className="bg-(--paper) p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-(--ink-mute)">
                Watch
              </p>
              <ul className="mt-3 space-y-2.5">
                <WatchRow label="Sync failed" value={social.sync_failed} href="/admin/users" />
                <WatchRow label="Publish failed" value={content.failed} href="/admin/users" />
                <WatchRow label="Pay failed / 7d" value={attention.payment_failures_7d} href="/admin/payments" />
              </ul>
              {incidents.length > 0 ? (
                <ul className="mt-4 space-y-1 border-t border-(--line) pt-3">
                  {incidents.map((item) => (
                    <li key={item.label}>
                      <Link href={item.href} className="text-[12px] font-medium text-amber-800 hover:underline">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </AdminCard>

        <AdminCard padded={false} className="flex w-full flex-col self-start lg:col-span-5">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-(--line) px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Recent activity</h2>
            <Link href="/admin/audit" className="text-[12.5px] font-semibold text-brand-500">
              Audit
            </Link>
          </div>
          {feed.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-(--ink-mute)">No recent movement</p>
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
    </AdminPage>
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

function ActionCenter({ firstName, items }: { firstName: string; items: ActionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[14px] border border-emerald-200 bg-emerald-50/70 px-4 py-3">
        <span className="h-2 w-2 rounded-full bg-emerald-500" />
        <p className="text-[13.5px] font-medium text-emerald-900">
          Nothing needs you right now{firstName ? `, ${firstName}` : ""}. No waiting requests, payouts, disputes or failures.
        </p>
      </div>
    );
  }
  const tone = {
    urgent: "bg-red-500",
    money: "bg-amber-500",
    people: "bg-brand-500",
  } as const;
  return (
    <AdminCard padded={false}>
      <div className="border-b border-(--line) px-5 py-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Needs you</h2>
        <p className="text-[12.5px] text-(--ink-soft)">Most urgent first. Each row opens the place to deal with it.</p>
      </div>
      <ul className="grid divide-y divide-(--line) sm:grid-cols-2 sm:divide-y-0">
        {items.map((item) => (
          <li key={item.label} className="sm:border-b sm:border-(--line)">
            <Link href={item.href} className="flex items-center gap-3 px-5 py-3 transition hover:bg-[#FAF7F2]">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", tone[item.tone])} />
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-(--ink)">{item.label}</span>
              <span className="text-[15px] font-semibold tabular-nums text-(--ink)">{item.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminCard>
  );
}

function buildFeed(
  activity: AdminOverviewPayload["activity"],
  auditLogs: OverviewViewProps["auditLogs"]
) {
  const rows: { key: string; t: number; title: string; detail: string; ago: string }[] = [];

  for (const item of activity) {
    const t = new Date(item.occurred_at).getTime();
    rows.push({
      key: `u-${item.id}-${item.action}-${t}`,
      t,
      title: item.name ?? item.email,
      detail: activityCopy(item.action),
      ago: formatRelativeTime(item.occurred_at),
    });
  }

  for (const log of auditLogs) {
    const t = new Date(log.timestamp).getTime();
    rows.push({
      key: `a-${t}-${log.action}-${log.adminEmail}`,
      t,
      title: log.action.replaceAll("_", " "),
      detail: log.targetEmail ? `${log.adminEmail} → ${log.targetEmail}` : log.adminEmail,
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

function PipeCell({
  label,
  value,
  href,
  warn,
}: {
  label: string;
  value: number;
  href: string;
  warn?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "border-b border-(--line) px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0",
        warn && "bg-amber-50/80"
      )}
    >
      <p className="text-[11px] font-medium text-(--ink-mute)">{label}</p>
      <p className={cn("mt-1 text-[22px] font-semibold tabular-nums tracking-tight", warn ? "text-amber-900" : "text-(--ink)")}>
        {value.toLocaleString()}
      </p>
    </Link>
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
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-(--ink-mute)">{title}</p>
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
