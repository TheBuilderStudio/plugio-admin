import Link from "next/link";
import { CheckCircle2, Database, Server, ShieldCheck } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getActiveDbContext, testConnection } from "@/lib/db";
import { getPlatformHealth, getOpenAlerts } from "@/lib/db/health";
import { Badge } from "@/components/ui/badge";
import { adminUsersApi } from "@/lib/store-api";
import { AdminPage, AdminPageHeader, AdminPanel } from "@/components/ui/page-shell";
import { formatRelativeTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const session = await requireAdmin();
  const ctx = await getActiveDbContext();
  const actor = session.user?.email ?? "";

  const [dbOk, health, backend, alerts] = await Promise.all([
    testConnection(),
    getPlatformHealth(ctx).catch(() => null),
    adminUsersApi.me(actor).then(
      (me) => ({ ok: true as const, mode: me.method }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "unreachable" })
    ),
    getOpenAlerts(ctx).catch(() => null),
  ]);

  const checks = [
    { icon: Database, label: "Database", ok: dbOk, detail: dbOk ? "Connected" : "Connection failed" },
    {
      icon: Server,
      label: "Backend API",
      ok: backend.ok,
      detail: backend.ok ? "Reachable" : backend.error,
    },
    {
      icon: ShieldCheck,
      label: "Admin sign-in method",
      ok: backend.ok && backend.mode === "SIGNED_TOKEN",
      detail: backend.ok ? (backend.mode === "SIGNED_TOKEN" ? "Signed tokens" : "Shared key (legacy)") : "Unknown",
    },
  ];

  const total = health
    ? health.failedPublishes.length + health.failingSyncs.length + health.failedPayments.length + health.stuckPublishing
    : 0;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Platform health"
        description="What is broken for creators now." hint="Each row links to the creator, so you can reach out before they write to you."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {checks.map((c) => (
          <div key={c.label} className="admin-card flex items-center gap-3 p-4">
            <c.icon className="h-5 w-5 text-(--ink-mute)" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-(--ink)">{c.label}</p>
              <p className="truncate text-[12px] text-(--ink-soft)">{c.detail}</p>
            </div>
            <span
              className={`h-2.5 w-2.5 rounded-full ${c.ok ? "bg-emerald-500" : "bg-red-500"}`}
              role="img"
              aria-label={c.ok ? "OK" : "Problem"}
            />
          </div>
        ))}
      </div>

      {alerts && alerts.length > 0 ? (
        <AdminPanel title="Open alerts" subtitle="Emailed to admins. They close when the problem is gone.">
          <ul className="divide-y divide-(--line)">
            {alerts.map((a) => (
              <li key={`${a.rule}-${a.since.getTime()}`} className="flex items-start justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-(--ink)">{a.title}</p>
                  <p className="text-[12.5px] text-(--ink-soft)">{a.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <Badge tone={a.severity === "URGENT" ? "danger" : "warning"}>{a.severity === "URGENT" ? "Urgent" : "Needs a look"}</Badge>
                  <p className="mt-1 text-[11.5px] text-(--ink-mute)">
                    since {formatRelativeTime(a.since)}
                    {a.lastEmailed ? ` · emailed ${formatRelativeTime(a.lastEmailed)}` : " · not emailed yet"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </AdminPanel>
      ) : null}

      {!health ? (
        <AdminPanel title="Creator-facing failures">
          <p className="p-5 text-[13px] text-red-700">Could not read failures from the database.</p>
        </AdminPanel>
      ) : total === 0 ? (
        <div className="admin-card flex items-center gap-3 p-5">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <p className="text-[13.5px] text-(--ink)">
            All clear. No recent failures.
          </p>
        </div>
      ) : (
        <>
          {health.stuckPublishing > 0 && (
            <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-medium text-amber-950">
              {health.stuckPublishing} post{health.stuckPublishing === 1 ? "" : "s"} uploading for over 2 hours. The publish job may be stuck.
            </div>
          )}

          <AdminPanel title="Failed publishes" subtitle={`${health.failedPublishes.length} in the last 14 days`}>
            <FailureList
              empty="No failed publishes."
              rows={health.failedPublishes.map((r) => ({
                key: r.id,
                href: `/admin/users/${r.user_id}`,
                who: r.user_name ?? r.user_email,
                what: r.title || "Untitled post",
                why: r.error,
                when: formatRelativeTime(r.at),
              }))}
            />
          </AdminPanel>

          <AdminPanel title="Social accounts failing to sync" subtitle="Last analytics sync failed">
            <FailureList
              empty="All connected accounts are syncing."
              rows={health.failingSyncs.map((r) => ({
                key: r.id,
                href: `/admin/users/${r.user_id}`,
                who: r.user_name ?? r.user_email,
                what: `${r.provider.toLowerCase()} · ${r.account_name ?? "account"} · ${r.failures} failure${r.failures === 1 ? "" : "s"} in a row`,
                why: r.error,
                when: r.last_ok ? `last ok ${formatRelativeTime(r.last_ok)}` : "never synced",
              }))}
            />
          </AdminPanel>

          <AdminPanel
            title="Failed payments"
            subtitle="Last 7 days"
            action={
              <Link href="/admin/payments" className="text-[12.5px] font-semibold text-brand-500">
                All payments
              </Link>
            }
          >
            <FailureList
              empty="No failed payments."
              rows={health.failedPayments.map((r) => ({
                key: r.id,
                href: r.user_id ? `/admin/users/${r.user_id}` : "/admin/payments",
                who: r.user_email ?? "Unlinked payment",
                what: `${r.event_type} · ${r.provider}`,
                why: null,
                when: formatRelativeTime(r.at),
              }))}
            />
          </AdminPanel>
        </>
      )}
    </AdminPage>
  );
}

function FailureList({
  rows,
  empty,
}: {
  rows: { key: string; href: string; who: string; what: string; why: string | null; when: string }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className="px-5 py-6 text-[13px] text-(--ink-mute)">{empty}</p>;
  return (
    <ul className="divide-y divide-(--line)">
      {rows.map((r) => (
        <li key={r.key}>
          <Link href={r.href} className="flex items-start justify-between gap-4 px-5 py-3 transition hover:bg-(--subtle)">
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold text-(--ink)">{r.who}</p>
              <p className="truncate text-[12.5px] text-(--ink-soft)">{r.what}</p>
              {r.why ? <p className="mt-0.5 line-clamp-2 text-[12px] text-red-700">{r.why}</p> : null}
            </div>
            <span className="shrink-0 text-[11.5px] text-(--ink-mute)">{r.when}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
