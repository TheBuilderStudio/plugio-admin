import { requireAdmin } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // 1. Authenticate that the user is an authorized admin
    await requireAdmin();

    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:8080";
    const apiKey = process.env.ADMIN_API_KEY;
    if (!apiKey) {
      console.error("[logs/stream] ADMIN_API_KEY is not configured");
      return new Response("Admin log stream is not configured", { status: 503 });
    }

    // 2. Open Server-Sent Events stream connection to the Spring Boot backend
    const response = await fetch(`${backendUrl}/api/admin/logs/stream`, {
      headers: {
        "X-Admin-Api-Key": apiKey,
      },
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
