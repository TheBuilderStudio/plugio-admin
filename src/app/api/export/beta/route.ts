import { requireAdmin } from "@/lib/security";
import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await requireAdmin();

    // Same source as the Beta queue UI (users with applications) — not a separate beta_requests table.
    const [rows] = await pool.execute<any[]>(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.access_status,
        u.beta_application_submitted_at,
        u.instagram_username,
        u.youtube_channel,
        u.facebook_page,
        u.instagram_followers,
        u.youtube_followers,
        u.facebook_followers
      FROM users u
      WHERE u.beta_application_submitted_at IS NOT NULL
      ORDER BY u.beta_application_submitted_at DESC
    `
    );

    const headers = [
      "User ID",
      "Name",
      "Email",
      "Status",
      "Applied At",
      "Instagram",
      "YouTube",
      "Facebook",
      "IG Followers",
      "YT Followers",
      "FB Followers",
    ];

    const escapeCsv = (val: unknown) => {
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
          row.access_status,
          row.beta_application_submitted_at
            ? new Date(row.beta_application_submitted_at).toISOString()
            : "",
          row.instagram_username,
          row.youtube_channel,
          row.facebook_page,
          row.instagram_followers,
          row.youtube_followers,
          row.facebook_followers,
        ]
          .map(escapeCsv)
          .join(",")
      );
    }

    return new NextResponse(csvRows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="plugio-beta-requests-export.csv"',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN")) {
      return new NextResponse("Unauthorized", { status: 401 });
    }
    console.error("[Export Beta API Error]:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
