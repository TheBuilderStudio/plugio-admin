import { requireAdmin } from "@/lib/security";
import { storeApi } from "@/lib/store-api";
import { logAdminAction } from "@/lib/logger";
import { isReportName, parseTransactionFilter } from "@/lib/report-params";
import { NextResponse } from "next/server";

/** CSV of the transactions list or one report. The backend checks the permission; this validates and relays. */
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const session = await requireAdmin();
    const adminEmail = session.user?.email;
    const { name } = await params;
    if (!adminEmail || !isReportName(name)) return new NextResponse("Bad request", { status: 400 });

    const url = new URL(req.url);
    const filter = parseTransactionFilter(Object.fromEntries(url.searchParams));
    const csv = await storeApi.reportCsv(adminEmail, name, filter);
    logAdminAction({ action: "REPORT_EXPORT", adminEmail, details: `${name} ${url.searchParams.toString()}` });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return new NextResponse(message, { status: message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN") ? 403 : 500 });
  }
}
