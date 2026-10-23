import { requireAdmin } from "@/lib/security";
import { storeApi } from "@/lib/store-api";
import { logAdminAction } from "@/lib/logger";
import { NextResponse } from "next/server";

const ID_PATTERN = /^[0-9a-f-]{32,36}$/i;

/** Bank file for one settlement batch. The backend checks the payout permission; this only relays the file. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const adminEmail = session.user?.email;
    const { id } = await params;
    if (!adminEmail || !ID_PATTERN.test(id)) return new NextResponse("Bad request", { status: 400 });

    const csv = await storeApi.settlementCsv(adminEmail, id);
    logAdminAction({ action: "STORE_SETTLEMENT_EXPORT", adminEmail, details: id });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="settlement-${id}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return new NextResponse(message, { status: message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN") ? 403 : 500 });
  }
}
