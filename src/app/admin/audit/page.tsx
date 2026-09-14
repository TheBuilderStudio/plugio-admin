import { Shield } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { readRecentAuditLogs } from "@/lib/logger";
import { formatDateTime } from "@/lib/utils";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminPage, AdminCard } from "@/components/ui/page-shell";

export default async function AuditLogsPage() {
  await requireAdmin();
  const logs = await readRecentAuditLogs(500);

  return (
    <AdminPage>
      <AdminCard padded={false}>
        {logs.length === 0 ? (
          <EmptyState icon={Shield} title="No audit events yet" description="Approve, reject, and coupon writes appear here automatically." />
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Operator</th>
                  <th>Target</th>
                  <th>Details</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={`${log.timestamp}-${log.adminEmail}-${log.action}-${log.targetUserId ?? ""}-${log.details ?? ""}`}>
                    <td className="whitespace-nowrap font-semibold">{log.action.replaceAll("_", " ")}</td>
                    <td className="whitespace-nowrap text-[var(--ink-soft)]">{log.adminEmail}</td>
                    <td>
                      {log.targetEmail ? (
                        <span className="rounded-md bg-[#F7F4EE] px-2 py-0.5 text-[12px]">{log.targetEmail}</span>
                      ) : (
                        <span className="text-[var(--ink-mute)]">—</span>
                      )}
                    </td>
                    <td className="max-w-[280px] text-[12.5px] text-[var(--ink-soft)]">{log.details?.trim() || "—"}</td>
                    <td className="whitespace-nowrap text-[12px] text-[var(--ink-soft)]">{formatDateTime(log.timestamp)}</td>
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
