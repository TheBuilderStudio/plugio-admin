import { requireAdmin } from "@/lib/security";
import { getGlobalPaymentAuditEvents } from "@/lib/db/queries";
import { validatePage } from "@/lib/validation";
import { Pagination } from "@/components/shared/Pagination";
import { Receipt, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import Link from "next/link";

interface PaymentsPageProps {
  searchParams: Promise<{
    page?: string;
  }>;
}

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  await requireAdmin();

  const params = await searchParams;
  const page = validatePage(params.page);

  const result = await getGlobalPaymentAuditEvents(page, 50);

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto min-h-screen space-y-6 lg:space-y-8">
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-xl p-8 bg-white border border-neutral-200 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl font-extrabold text-[#09090B] tracking-tight flex items-center gap-3">
            Payment Audit Logs
          </h1>
          <p className="text-neutral-500 font-medium">
            Global view of all Razorpay webhook events and subscription receipts.
          </p>
        </div>
      </div>

      {/* ── Logs Table ── */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col">
        {result.items.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mb-4">
              <Receipt className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-base font-bold text-[#09090B] mb-1">
              No payments recorded
            </h3>
            <p className="text-neutral-500 text-sm max-w-sm">
              Webhook events will appear here once the backend starts receiving them.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-[#FAFAFA] border-b border-neutral-200 text-[#09090B] font-bold text-xs uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4">Event</th>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Provider Info</th>
                    <th className="px-6 py-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {result.items.map((log: any, i: number) => (
                    <tr
                      key={i}
                      className="hover:bg-neutral-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {log.status === "SUCCESS" ? (
                            <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            </div>
                          ) : log.status === "FAILED" ? (
                            <div className="w-6 h-6 rounded-md bg-red-50 flex items-center justify-center flex-shrink-0">
                              <XCircle className="w-3 h-3 text-red-600" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-md bg-neutral-100 flex items-center justify-center flex-shrink-0">
                              <Receipt className="w-3 h-3 text-neutral-500" />
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-semibold text-[#09090B]">
                              {log.event_type}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${
                              log.status === "SUCCESS" ? "text-emerald-600" :
                              log.status === "FAILED" ? "text-red-600" :
                              "text-neutral-500"
                            }`}>
                              {log.status}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {log.user_id ? (
                          <div className="flex flex-col">
                            <Link href={`/admin/users/${log.user_id}`} className="font-semibold text-[#FF6719] hover:underline">
                              {log.user_name || "Unknown User"}
                            </Link>
                            <span className="text-xs text-neutral-500">{log.user_email}</span>
                          </div>
                        ) : (
                          <span className="text-neutral-400 italic">No User Linked</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-mono bg-neutral-100 px-2 py-0.5 rounded-md text-neutral-600 border border-neutral-200">
                            {log.provider}
                          </span>
                          {log.order_id && (
                            <span className="text-xs text-neutral-500">
                              Order: <span className="font-mono">{log.order_id}</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-neutral-500 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateTime(new Date(log.created_at))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {result.totalPages > 1 && (
              <div className="px-6 py-4 border-t border-neutral-200 bg-[#FAFAFA]">
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
      </div>
    </div>
  );
}
