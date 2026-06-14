import { Shield, Clock, User, Fingerprint, Activity } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { readRecentAuditLogs } from "@/lib/logger";
import { formatDate } from "@/lib/utils";

export default async function AuditLogsPage() {
  await requireAdmin();

  // Read up to the last 500 actions
  const logs = await Promise.resolve(readRecentAuditLogs(500));

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto min-h-screen space-y-6 lg:space-y-8">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-xl p-8 bg-white border border-neutral-200 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl font-extrabold text-[#09090B] tracking-tight flex items-center gap-3">
            Security Audit
          </h1>
          <p className="text-neutral-500 font-medium">
            Immutable log of all critical administrative and access events.
          </p>
        </div>
      </div>

      {/* ── Logs Table ── */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
        {logs.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-base font-bold text-[#09090B] mb-1">
              No audit logs yet
            </h3>
            <p className="text-neutral-500 text-sm max-w-sm">
              Critical events and admin actions will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto min-h-[500px]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-[#FAFAFA] border-b border-neutral-200 text-[#09090B] font-bold text-xs uppercase tracking-widest">
                <tr>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Admin</th>
                  <th className="px-6 py-4">Target</th>
                  <th className="px-6 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {logs.map((log, i) => (
                  <tr
                    key={i}
                    className="hover:bg-neutral-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {log.action.includes("APPROVE") ? (
                          <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center flex-shrink-0">
                            <Activity className="w-3 h-3 text-green-600" />
                          </div>
                        ) : log.action.includes("REJECT") ? (
                          <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-3 h-3 text-red-600" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Fingerprint className="w-3 h-3 text-blue-600" />
                          </div>
                        )}
                        <span className="font-semibold text-[#09090B]">
                          {log.action}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-semibold text-neutral-700">
                          {log.adminEmail}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {log.targetEmail && (
                          <span className="text-neutral-500 font-medium bg-neutral-100 px-2 py-0.5 rounded-md text-xs">
                            {log.targetEmail}
                          </span>
                        )}
                        {log.targetUserId && (
                          <span className="text-neutral-400 text-xs font-mono">
                            ID: {log.targetUserId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-neutral-500 font-medium">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(log.timestamp)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
