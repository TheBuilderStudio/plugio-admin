import { requireAdmin } from "@/lib/security";
import { assertCapability } from "@/lib/admin-access";
import { AdminAuthConfigError, adminAuthHeaders } from "@/lib/admin-token";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Authenticate that the user is an authorized admin
    const session = await requireAdmin();
    // The Logs menu item is hidden from other roles, but server logs must also be closed to a direct request.
    await assertCapability(session, "VIEW_LOGS");
    const adminEmail = session.user?.email ?? "";

    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";
    let headers: Record<string, string>;
    try {
      headers = adminAuthHeaders({
        actor: adminEmail,
        method: "GET",
        path: "/api/admin/logs/stream",
        apiKey: process.env.ADMIN_API_KEY,
      });
    } catch (err) {
      if (!(err instanceof AdminAuthConfigError)) throw err;
      console.error(`[logs/stream] ${err.message}`);
      return new Response("Admin log stream is not configured", { status: 503 });
    }

    // 2. Open Server-Sent Events stream connection to the Spring Boot backend
    const response = await fetch(`${backendUrl}/api/admin/logs/stream`, {
      headers,
      cache: "no-store",
      signal: request.signal,
    });

    if (!response.ok) {
      return new Response(`Failed to connect to backend log stream (status ${response.status})`, {
        status: response.status,
      });
    }

    const stream = response.body;
    if (!stream) {
      return new Response("No log stream body available from backend", { status: 500 });
    }

    // 3. Pipe the SSE stream chunks directly to the client browser
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN")) {
      return new Response("Unauthorized", { status: 401 });
    }
    console.error("[logs/stream/route] Stream initialization failed:", error);
    return new Response("Failed to initialize log stream", { status: 500 });
  }
}
