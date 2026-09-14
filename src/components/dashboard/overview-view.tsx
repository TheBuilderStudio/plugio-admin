import Link from "next/link";
import { Youtube, Instagram, Facebook } from "lucide-react";
import { formatRelativeTime, cn, getInitials } from "@/lib/utils";
import { formatUsd } from "@/constants";
import type { AdminOverviewPayload, BetaRequestRow, BusinessOverview } from "@/types";
import { AdminPage, AdminCard } from "@/components/ui/page-shell";

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
};

export function OverviewView({
  firstName,
  overview,
  activity,
  auditLogs,
  pendingQueue,
  loadError,
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
    <AdminPage className="!max-w-[1360px] !space-y-4">
      {loadError ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950">
          {loadError}
        </div>
      ) : null}

      {!queueBusy ? (
        <div className="flex items-center justify-between gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--paper)] px-4 py-2.5 shadow-[var(--shadow-paper)]">
          <p className="text-[13px] text-[var(--ink-soft)]">
            Queue is clear{firstName ? `, ${firstName}` : ""}. Nobody is waiting for access.
          </p>
          <Link href="/admin/beta?status=PENDING" className="text-[12.5px] font-semibold text-[#FF6719]">
            Open queue
          </Link>
        </div>
      ) : null}

      <div className={cn("grid grid-cols-1 gap-4", queueBusy && "xl:grid-cols-12")}>
        {queueBusy ? (
          <AdminCard padded={false} className="xl:col-span-7">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">Queue</h2>
                <p className="text-[12.5px] text-[var(--ink-soft)]">
                  {attention.pending_beta} waiting — approve is access, not a plan
                </p>
              </div>
              <Link href="/admin/beta?status=PENDING" className="text-[12.5px] font-semibold text-[#FF6719]">
                Review all
              </Link>
            </div>
            <ul className="divide-y divide-[var(--line)]">
              {pendingQueue.map((req) => (
                <li key={req.id}>
                  <Link
                    href={`/admin/users/${req.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-[#FAF7F2]"
                  >
                    <Avatar src={req.picture} name={req.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">
                        {req.name ?? "Unknown"}
                      </p>
                      <p className="truncate text-[12px] text-[var(--ink-soft)]">{req.email}</p>
                    </div>
                    <p className="hidden max-w-[200px] truncate text-[12px] text-[var(--ink-soft)] sm:block">
                      {socialLine(req)}
                    </p>
                    <span className="shrink-0 text-[11px] font-medium text-[var(--ink-mute)]">
                      {formatRelativeTime(req.beta_application_submitted_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </AdminCard>
        ) : null}

        <AdminCard padded={false} className={queueBusy ? "xl:col-span-5" : undefined}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">Money</h2>
              <p className="text-[12.5px] text-[var(--ink-soft)]">Prepaid · last 30 days</p>
            </div>
            <div className="flex gap-3">
              <Link href="/admin/plans" className="text-[12.5px] font-semibold text-[#FF6719]">
                Plans
              </Link>
              <Link href="/admin/payments" className="text-[12.5px] font-semibold text-[#FF6719]">
                Payments
              </Link>
              <Link href="/admin/coupons" className="text-[12.5px] font-semibold text-[#FF6719]">
                Coupons
              </Link>
            </div>
          </div>
          <div className={cn("grid gap-px bg-[var(--line)]", queueBusy ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4")}>
            <div className="bg-[var(--paper)] px-5 py-4">
              <p className="text-[11px] font-medium text-[var(--ink-mute)]">Collected</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                {formatUsd(revenue.collected_30d_usd)}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                {revenue.paid_checkouts_30d} invoices · {formatUsd(revenue.total_collected_usd)} all-time
              </p>
            </div>
            <div className="bg-[var(--paper)] px-5 py-4">
              <p className="text-[11px] font-medium text-[var(--ink-mute)]">Est. MRR</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                {formatUsd(revenue.estimated_mrr_usd)}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">Live paid plans</p>
            </div>
            <div className="bg-[var(--paper)] px-5 py-4">
              <p className="text-[11px] font-medium text-[var(--ink-mute)]">Paid</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                {paidLive}
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                {plans.active_creator} Creator · {plans.active_pro} Pro
              </p>
            </div>
            <div className="bg-[var(--paper)] px-5 py-4">
              <p className="text-[11px] font-medium text-[var(--ink-mute)]">Trial / none</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight text-[var(--ink)]">
                {plans.trialing}
                <span className="text-[15px] font-medium text-[var(--ink-mute)]"> / {plans.none}</span>
              </p>
              <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                {coupons.redemptions_7d} coupons / 7d · {plans.expired} expired
              </p>
            </div>
          </div>
        </AdminCard>
      </div>

      <AdminCard padded={false}>
        <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">Pipeline</h2>
            <p className="text-[12.5px] text-[var(--ink-soft)]">Who can use Plugio</p>
          </div>
          <Link href="/admin/users" className="text-[12.5px] font-semibold text-[#FF6719]">
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
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">Platform</h2>
            {incidents.length > 0 ? (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                {incidents.length} issue{incidents.length === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="text-[12px] font-medium text-[var(--ink-mute)]">Healthy</span>
            )}
          </div>
          <div className="grid grid-cols-1 gap-px bg-[var(--line)] md:grid-cols-3">
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
            <div className="bg-[var(--paper)] p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">
                Watch
              </p>
              <ul className="mt-3 space-y-2.5">
                <WatchRow label="Sync failed" value={social.sync_failed} href="/admin/users" />
                <WatchRow label="Publish failed" value={content.failed} href="/admin/users" />
                <WatchRow label="Pay failed / 7d" value={attention.payment_failures_7d} href="/admin/payments" />
              </ul>
              {incidents.length > 0 ? (
                <ul className="mt-4 space-y-1 border-t border-[var(--line)] pt-3">
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
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">Live</h2>
            <Link href="/admin/audit" className="text-[12.5px] font-semibold text-[#FF6719]">
              Audit
            </Link>
          </div>
          {feed.length === 0 ? (
            <p className="px-5 py-10 text-center text-[13px] text-[var(--ink-mute)]">No recent movement</p>
          ) : (
            <ul className="custom-scrollbar max-h-[22rem] divide-y divide-[var(--line)] overflow-y-auto">
              {feed.map((item) => (
                <li key={item.key} className="flex items-start justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{item.title}</p>
                    <p className="truncate text-[12px] text-[var(--ink-soft)]">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-medium text-[var(--ink-mute)]">{item.ago}</span>
                </li>
              ))}
            </ul>
          )}
        </AdminCard>
      </div>
    </AdminPage>
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
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-[var(--line)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
      </div>
    );
  }
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#FF6719]/10 text-[11px] font-bold text-[#FF6719]">
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
        "border-b border-[var(--line)] px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0",
        warn && "bg-amber-50/80"
      )}
    >
      <p className="text-[11px] font-medium text-[var(--ink-mute)]">{label}</p>
      <p className={cn("mt-1 text-[22px] font-semibold tabular-nums tracking-tight", warn ? "text-amber-900" : "text-[var(--ink)]")}>
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
    <div className="bg-[var(--paper)] p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--ink-mute)]">{title}</p>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.label} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-soft)]">
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {row.label}
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-[var(--ink)]">{row.value}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-[var(--ink-mute)]">{footer}</p>
    </div>
  );
}

function WatchRow({ label, value, href }: { label: string; value: number; href: string }) {
  const hot = value > 0;
  return (
    <li>
      <Link href={href} className="flex items-center justify-between gap-2">
        <span className="text-[13px] text-[var(--ink-soft)]">{label}</span>
        <span className={cn("text-[13px] font-semibold tabular-nums", hot ? "text-amber-800" : "text-[var(--ink)]")}>
          {value}
        </span>
      </Link>
    </li>
  );
}
