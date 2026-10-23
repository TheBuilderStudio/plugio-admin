import { Search, Shield } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { readRecentAuditLogs } from "@/lib/logger";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";

interface AuditPageProps {
  searchParams: Promise<{ q?: string; action?: string }>;
}

export default async function AuditLogsPage({ searchParams }: AuditPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100).toLowerCase();
  const action = (params.action ?? "").trim().slice(0, 60);

  const all = await readRecentAuditLogs(1000);
  const actions = Array.from(new Set(all.map((l) => l.action))).sort();
  const logs = all
    .filter((l) => !action || l.action === action)
    .filter(
      (l) =>
        !q ||
        [l.adminEmail, l.targetEmail, l.details, l.action]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
    )
    .slice(0, 300);

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="System"
        title="Audit trail"
        description="Who did what in this admin panel: approvals, coupon and price changes, payouts, refunds and admin changes."
      />

      <form method="get" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-(--ink-mute)" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Admin, creator email or detail"
            className="admin-input py-2 pl-9 pr-3"
          />
        </div>
        <select name="action" defaultValue={action} className="admin-input w-auto py-2" aria-label="Action">
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a.replaceAll("_", " ").toLowerCase()}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-(--ink) px-3.5 py-2 text-[13px] font-semibold text-white">
          Filter
        </button>
      </form>

      <AdminCard padded={false}>
        {logs.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="No matching events"
            description="Approvals, coupon writes, payouts and other admin actions appear here automatically."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Admin</th>
                  <th>Creator</th>
                  <th>Details</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={`${log.timestamp}-${log.adminEmail}-${log.action}-${log.targetUserId ?? ""}-${log.details ?? ""}`}>
                    <td className="whitespace-nowrap font-semibold">{log.action.replaceAll("_", " ").toLowerCase()}</td>
                    <td className="whitespace-nowrap text-(--ink-soft)">{log.adminEmail}</td>
                    <td>
                      {log.targetEmail ? (
                        <span className="rounded-md bg-[#F7F4EE] px-2 py-0.5 text-[12px]">{log.targetEmail}</span>
                      ) : (
                        <span className="text-(--ink-mute)">—</span>
                      )}
                    </td>
                    <td className="max-w-[320px] text-[12.5px] text-(--ink-soft)">{log.details?.trim() || "—"}</td>
                    <td className="whitespace-nowrap text-[12px] text-(--ink-soft)">{formatDateTime(log.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </AdminPage>
  );
}
