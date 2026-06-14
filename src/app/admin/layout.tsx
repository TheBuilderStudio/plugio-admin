import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ADMIN_EMAILS } from "@/constants";
import { AdminSidebar } from "@/components/shared/AdminSidebar";

/**
 * Admin section layout.
 * Wraps all /admin/* pages with the sidebar.
 * Re-validates admin access on every render (defense in depth after middleware).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side session validation — cannot be bypassed
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!ADMIN_EMAILS.includes(session.user.email)) {
    redirect("/unauthorized");
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA]">
      {/* Sidebar */}
      <AdminSidebar
        adminName={session.user.name}
        adminEmail={session.user.email}
        adminImage={session.user.image}
      />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto min-w-0">
        <div className="min-h-full animate-fade-in">{children}</div>
      </main>
    </div>
  );
}
