import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/security";

/**
 * Root page — redirects to dashboard (if admin) or login.
 * Middleware handles this too, but this is a fallback.
 */
export default async function RootPage() {
  const session = await auth();

  if (isAdminEmail(session?.user?.email)) {
    redirect("/admin/dashboard");
  }

  redirect("/login");
}
