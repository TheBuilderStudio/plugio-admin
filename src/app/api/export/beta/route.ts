import { requireAdmin } from "@/lib/security";
import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Ensure caller is an admin
    await requireAdmin();

    // 2. Fetch all beta requests
    const [rows] = await pool.execute<any[]>(
      `
      SELECT
        b.id,
        b.user_id,
        b.status,
        b.applied_at,
        u.name,
        u.email
      FROM beta_requests b
      JOIN users u ON u.id = b.user_id
      ORDER BY b.applied_at DESC
    `
    );

    // 3. Construct CSV
    // Headers
    const headers = [
      "Request ID",
      "User ID",
      "Name",
      "Email",
      "Status",
      "Applied At",
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
          row.user_id,
          row.name,
          row.email,
          row.status,
          new Date(row.applied_at).toISOString(),
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
        "Content-Disposition": 'attachment; filename="plugio-beta-requests-export.csv"',
      },
    });
  } catch (error: any) {
    console.error("[Export Beta API Error]:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
