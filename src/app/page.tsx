import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/security";

/**
 * Root page — redirects to dashboard (if admin) or login.
 * Middleware handles this too, but this is a fallback.
 */
export default async function RootPage() {
  if (await getAdminSession()) {
    redirect("/admin/dashboard");
  }

  redirect("/login");
}
