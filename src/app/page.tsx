import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ADMIN_EMAILS } from "@/constants";

/**
 * Root page — redirects to dashboard (if admin) or login.
 * Middleware handles this too, but this is a fallback.
 */
export default async function RootPage() {
  const session = await auth();

  if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) {
    redirect("/admin/dashboard");
  }

  redirect("/login");
}
