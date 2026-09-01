import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/security";
import { getActiveDbContext } from "@/lib/db";
import { getDashboardStats, getRecentActivity } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * Dev-only DB smoke check. Requires admin auth.
 * Disabled in production to avoid accidental data exposure.
 */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await requireAdmin();
    const dbContext = await getActiveDbContext();
    const [stats, activity] = await Promise.all([
      getDashboardStats(dbContext),
      getRecentActivity(8, dbContext),
    ]);
    return NextResponse.json({ success: true, dbContext, stats, activity });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/test-db]", error);
    return NextResponse.json({ error: "Database check failed" }, { status: 500 });
  }
}
