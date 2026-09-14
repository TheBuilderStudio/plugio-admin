import Link from "next/link";
import { Receipt, CheckCircle2, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getGlobalPaymentAuditEvents } from "@/lib/db/queries";
import { validatePage } from "@/lib/validation";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminPage, AdminCard } from "@/components/ui/page-shell";
import { formatDateTime } from "@/lib/utils";

interface PaymentsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const page = validatePage(params.page);
  const result = await getGlobalPaymentAuditEvents(page, 50);

  return (
    <AdminPage>
      <AdminCard padded={false}>
        {result.items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments recorded"
            description="Events appear here when checkout or webhooks complete."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>User</th>
                    <th>Provider</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          {log.status === "SUCCESS" ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          ) : log.status === "FAILED" ? (
                            <XCircle className="h-4 w-4 text-red-600" />
                          ) : (
                            <Receipt className="h-4 w-4 text-[var(--ink-mute)]" />
                          )}
                          <div>
                            <p className="font-semibold">{log.event_type}</p>
                            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--ink-mute)]">
                              {log.status}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        {log.user_id ? (
                          <div>
                            <Link href={`/admin/users/${log.user_id}`} className="font-semibold text-[#FF6719] hover:underline">
                              {log.user_name || "Unknown"}
                            </Link>
                            <p className="text-[12px] text-[var(--ink-soft)]">{log.user_email}</p>
                          </div>
                        ) : (
                          <span className="text-[var(--ink-mute)]">Unlinked</span>
                        )}
                      </td>
                      <td>
                        <code className="rounded-md bg-[#F7F4EE] px-1.5 py-0.5 text-[11px]">{log.provider}</code>
                        {log.order_id ? (
                          <p className="mt-1 font-mono text-[11px] text-[var(--ink-mute)]">{log.order_id}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap text-[var(--ink-soft)]">
                        {formatDateTime(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.totalPages > 1 && (
              <div className="border-t border-[var(--line)]">
                <Pagination
                  currentPage={result.page}
                  totalPages={result.totalPages}
                  total={result.total}
                  pageSize={result.pageSize}
                  baseUrl="/admin/payments"
                />
              </div>
            )}
          </>
        )}
      </AdminCard>
    </AdminPage>
  );
}
