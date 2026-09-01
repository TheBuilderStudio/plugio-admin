import { formatDate, formatDateTime } from "@/lib/utils";
import type { AdminAccessGrantRow } from "@/types";

interface GrantHistoryPanelProps {
  grants: AdminAccessGrantRow[];
}

function statusClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-50 text-emerald-700";
  if (status === "REVOKED") return "bg-red-50 text-red-700";
  return "bg-zinc-100 text-zinc-600";
}

export function GrantHistoryPanel({ grants }: GrantHistoryPanelProps) {
  if (grants.length === 0) {
    return (
      <div className="mt-5 border-t border-zinc-100 pt-5">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">
          Grant history
        </h3>
        <p className="text-xs text-zinc-400">No complimentary grants yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-zinc-100 pt-5 space-y-3">
      <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
        Grant history
      </h3>
      <ul className="space-y-2">
        {grants.map((grant) => (
          <li
            key={grant.id}
            className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-3 py-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-zinc-800">
                {grant.plan_id} · {grant.duration_days}d
              </span>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusClass(
                  grant.status
                )}`}
              >
                {grant.status}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              {formatDate(grant.starts_at)} → {formatDate(grant.ends_at)}
            </p>
            {grant.reason && (
              <p className="text-[11px] text-zinc-600 mt-1">
                Reason: {grant.reason}
              </p>
            )}
            <p className="text-[10px] text-zinc-400 mt-1">
              by {grant.granted_by_admin_email} · {formatDateTime(grant.created_at)}
              {grant.revoked_by_admin_email
                ? ` · revoked by ${grant.revoked_by_admin_email}`
                : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
