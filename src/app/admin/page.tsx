import { redirect } from "next/navigation";

/**
 * Root admin route.
 * Automatically redirects to the dashboard to prevent 404s.
 */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
