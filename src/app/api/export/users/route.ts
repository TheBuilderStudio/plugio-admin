import { requireAdmin } from "@/lib/security";
import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Ensure caller is an admin
    await requireAdmin();

    // 2. Fetch all users and subscription statuses
    const [rows] = await pool.execute<any[]>(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.created_at,
        u.access_status,
        u.beta_approved,
        s.subscription_status
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id
      ORDER BY u.created_at DESC
    `
    );

    // 3. Construct CSV
    // Headers
    const headers = [
      "User ID",
      "Name",
      "Email",
      "Created At",
      "Access Status",
      "Beta Approved",
      "Subscription Status",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.map(escapeCsv).join(",")];

    for (const row of rows) {
      csvRows.push(
        [
          row.id,
          row.name,
          row.email,
          new Date(row.created_at).toISOString(),
          row.access_status,
          row.beta_approved ? "Yes" : "No",
          row.subscription_status ?? "FREE",
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    const csvString = csvRows.join("\n");

    // 4. Return as downloadable file
    return new NextResponse(csvString, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="plugio-users-export.csv"',
      },
    });
  } catch (error: any) {
    console.error("[Export Users API Error]:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
