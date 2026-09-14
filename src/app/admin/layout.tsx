import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/security";
import { AdminSidebar } from "@/components/shared/AdminSidebar";
import { AdminTopBar } from "@/components/shared/AdminTopBar";
import { AdminReadOnlyProvider } from "@/components/shared/AdminReadOnlyContext";
import { getActiveDbContext, hasDistinctStagingDb } from "@/lib/db";
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

  if (!isAdminEmail(session.user.email)) {
    redirect("/unauthorized");
  }

  const hasStagingDb = hasDistinctStagingDb();
  const isReadOnly =
    process.env.READ_ONLY_MODE === "true" ||
    process.env.NEXT_PUBLIC_READ_ONLY_MODE === "true";

  let pendingBeta = 0;
  try {
    const dbContext = await getActiveDbContext();
    pendingBeta = await getPendingBetaCount(dbContext);
  } catch {
    pendingBeta = 0;
  }

  return (
    <AdminReadOnlyProvider isReadOnly={isReadOnly}>
      <div className="relative isolate flex h-dvh overflow-hidden bg-[var(--canvas)]">
        <AdminSidebar
          adminName={session.user.name}
          adminEmail={session.user.email}
          adminImage={session.user.image}
          hasStagingDb={hasStagingDb}
          isReadOnly={isReadOnly}
          pendingBeta={pendingBeta}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <AdminTopBar isReadOnly={isReadOnly} pendingBeta={pendingBeta} />
          <main className="custom-scrollbar min-h-0 min-w-0 flex-1 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    </AdminReadOnlyProvider>
  );
}
