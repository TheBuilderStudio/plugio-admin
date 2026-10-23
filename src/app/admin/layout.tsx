import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/security";
import { AdminShell } from "@/components/shared/AdminShell";
import { NAV } from "@/components/shared/nav-config";
import { AdminReadOnlyProvider } from "@/components/shared/AdminReadOnlyContext";
import { getAdminAccess } from "@/lib/admin-access";
import { getActiveDbContext } from "@/lib/db";
import { getPendingBetaCount } from "@/lib/db/queries";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email) && !session.user.backendAdmin) {
    redirect("/unauthorized");
  }

  const isReadOnly =
    process.env.READ_ONLY_MODE === "true" ||
    process.env.NEXT_PUBLIC_READ_ONLY_MODE === "true";

  const access = await getAdminAccess(session);

  let pendingBeta = 0;
  try {
    const dbContext = await getActiveDbContext();
    pendingBeta = await getPendingBetaCount(dbContext);
  } catch {
    pendingBeta = 0;
  }

  const items = NAV.filter((item) => !item.needs || access.can(item.needs));

  return (
    <AdminReadOnlyProvider isReadOnly={isReadOnly}>
      <AdminShell
        adminName={session.user?.name ?? "Admin"}
        adminEmail={session.user?.email ?? ""}
        adminImage={session.user?.image ?? null}
        roleLabel={(access?.role ?? "SUPPORT").replace("_", " ").toLowerCase()}
        items={items}
        isReadOnly={isReadOnly}
        pendingBeta={pendingBeta}
        badges={{ "/admin/beta?status=PENDING": pendingBeta }}
      >
        {children}
      </AdminShell>
    </AdminReadOnlyProvider>
  );
}
