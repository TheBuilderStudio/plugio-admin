import { requireAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Authenticate that the user is an authorized admin
    await requireAdmin();

    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";
    const apiKey = process.env.ADMIN_API_KEY || "dev-secret-key-12345";

    // 2. Open Server-Sent Events stream connection to the Spring Boot backend
    const response = await fetch(`${backendUrl}/api/admin/logs/stream`, {
      headers: {
        "X-Admin-Api-Key": apiKey,
      },
      cache: "no-store",
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
      },
    });
  } catch (error) {
    console.error("[logs/stream/route] Stream initialization failed:", error);
    return new Response("Unauthorized or internal connection error", { status: 401 });
  }
}
