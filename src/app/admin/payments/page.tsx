import Link from "next/link";
import { Receipt, CheckCircle2, XCircle } from "lucide-react";
import { requireCapability } from "@/lib/admin-access";
import { getGlobalPaymentAuditEvents } from "@/lib/db/queries";
import { validatePage } from "@/lib/validation";
import { Pagination } from "@/components/shared/Pagination";
import { EmptyState } from "@/components/shared/EmptyState";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";
import { ListToolbar, resultSummary } from "@/components/shared/ListToolbar";
import { Badge } from "@/components/ui/badge";
import { statusTone, statusLabel } from "@/lib/status-tone";
import { formatDateTime } from "@/lib/utils";

interface PaymentsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  await requireCapability("VIEW_MONEY");
  const params = await searchParams;
  const page = validatePage(params.page);
  const result = await getGlobalPaymentAuditEvents(page, 50);

  return (
    <AdminPage>
      <AdminPageHeader kicker="Money" title="Subscription payments" description="Plan checkout and webhook events." hint="Newest first. Store and session payments are under Transactions." />

      <AdminCard padded={false}>
        <ListToolbar summary={resultSummary(result.page, result.pageSize, result.total, result.items.length)} />
        {result.items.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No payments recorded"
            description="Plan checkouts will appear here."
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
                            <Receipt className="h-4 w-4 text-(--ink-mute)" />
                          )}
                          <div>
                            <p className="font-semibold">{log.event_type}</p>
                            <Badge tone={statusTone(log.status)} className="mt-1">{statusLabel(log.status)}</Badge>
                          </div>
                        </div>
                      </td>
                      <td>
                        {log.user_id ? (
                          <div>
                            <Link href={`/admin/users/${log.user_id}`} className="font-semibold text-brand-500 hover:underline">
                              {log.user_name || "Unknown"}
                            </Link>
                            <p className="text-[12px] text-(--ink-soft)">{log.user_email}</p>
                          </div>
                        ) : (
                          <span className="text-(--ink-mute)">Unlinked</span>
                        )}
                      </td>
                      <td>
                        <code className="rounded-md bg-[#F7F4EE] px-1.5 py-0.5 text-[11px]">{log.provider}</code>
                        {log.order_id ? (
                          <p className="mt-1 font-mono text-[11px] text-(--ink-mute)">{log.order_id}</p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap text-(--ink-soft)">
                        {formatDateTime(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.totalPages > 1 && (
              <div className="border-t border-(--line)">
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
