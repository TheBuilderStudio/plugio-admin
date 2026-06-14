/**
 * Plugio Admin — Middleware
 *
 * Protects all /admin/** routes.
 *
 * Security layers:
 * 1. No session → redirect to /login
 * 2. Session exists but email not in ADMIN_EMAILS → redirect to /unauthorized
 * 3. Session valid and admin email → allow request
 *
 * Note: This is a first line of defense. Every Server Action independently
 * re-validates via requireAdmin() to provide defense in depth.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { ADMIN_EMAILS } from "@/constants";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow Next.js internals and static files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Allow auth API routes (NextAuth callbacks must be accessible)
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Root → redirect to dashboard (if admin) or login
  if (pathname === "/") {
    if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Admin routes require authentication + whitelist
  if (pathname.startsWith("/admin")) {
    if (!session?.user?.email) {
      // Not authenticated → login
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!ADMIN_EMAILS.includes(session.user.email)) {
      // Authenticated but not an admin → unauthorized
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    // Valid admin — allow through
    return NextResponse.next();
  }

  // Login page — redirect authenticated admins to dashboard
  if (pathname === "/login") {
    if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
