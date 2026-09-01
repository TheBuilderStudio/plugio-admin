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
import { isAdminEmail } from "@/lib/security/emails";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;
  const email = session?.user?.email;

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
    if (isAdminEmail(email)) {
      return NextResponse.redirect(new URL("/admin/dashboard", req.url));
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Protect admin UI and admin APIs (except NextAuth)
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth")) {
      return NextResponse.next();
    }

    if (!email) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = new URL("/login", req.url);
      // Preserve query string for deep links (e.g. /admin/beta?status=PENDING)
      const returnTo = `${pathname}${req.nextUrl.search}`;
      loginUrl.searchParams.set("callbackUrl", returnTo);
      return NextResponse.redirect(loginUrl);
    }

    if (!isAdminEmail(email)) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }

    return NextResponse.next();
  }

  // Login page — redirect authenticated admins to dashboard
  if (pathname === "/login") {
    if (isAdminEmail(email)) {
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
