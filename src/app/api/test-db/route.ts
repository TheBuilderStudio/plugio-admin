import { NextResponse } from "next/server";
import { getDashboardStats, getRecentActivity } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = await getDashboardStats();
    const activity = await getRecentActivity(8);
    return NextResponse.json({ success: true, stats, activity });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

