import { UserCog } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { adminUsersApi, type BackendAdmin } from "@/lib/store-api";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";
import { EmptyState } from "@/components/shared/EmptyState";
import { StoreRowAction } from "@/components/store/StoreRowAction";
import { AdminGrantForm } from "@/components/shared/AdminGrantForm";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";
import { activateAdminAction, deactivateAdminAction } from "@/actions/admins.actions";

export const dynamic = "force-dynamic";

const ROLE_INFO: Record<string, { label: string; can: string }> = {
  SUPPORT: { label: "Support", can: "Approve or decline access, moderate reviews, suspend or restore products. Cannot see money pages or change prices." },
  FINANCE: { label: "Finance", can: "See all money pages, pay or reject payouts, close refunds and disputes, approve session refunds. Cannot approve access or change prices." },
  SUPER_ADMIN: { label: "Super admin", can: "Everything, including prices, coupons, commission, logs and this page." },
};

async function load(actor: string): Promise<{ admins: BackendAdmin[] } | { error: string }> {
  try {
    return { admins: await adminUsersApi.list(actor) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not load admins." };
  }
}

export default async function AdminsPage() {
  const session = await requireAdmin();
  const actor = session.user?.email ?? "";
  const result = await load(actor);

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="System"
        title="Admins"
        description="Who can use the admin API, and what each person may do. Only super admins can change this list."
      />

      {"error" in result ? (
        <AdminCard>
          <p className="text-[13px] text-red-700">{result.error}</p>
          <p className="mt-2 text-[12.5px] text-(--ink-soft)">
            This page needs the backend in <code>dual</code> or <code>signed</code> admin-auth mode, and your account must
            be a super admin there.
          </p>
        </AdminCard>
      ) : (
        <>
          <AdminCard>
            <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">What each role can do</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              {Object.entries(ROLE_INFO).map(([key, r]) => (
                <div key={key} className="rounded-xl border border-(--line) bg-[#F7F4EE] px-4 py-3">
                  <dt className="text-[13px] font-semibold text-(--ink)">{r.label}</dt>
                  <dd className="mt-1 text-[12.5px] leading-relaxed text-(--ink-soft)">{r.can}</dd>
                </div>
              ))}
            </dl>
          </AdminCard>

          <AdminCard>
            <h2 className="mb-3 text-[15px] font-semibold tracking-tight text-(--ink)">Add an admin</h2>
            <AdminGrantForm />
            <p className="mt-3 text-[12.5px] text-(--ink-soft)">
              The person signs in with that Google account. Re-adding an existing email changes their role. Nobody can
              change their own role, and the last active super admin cannot be removed.
            </p>
          </AdminCard>

          <AdminCard>
            {result.admins.length === 0 ? (
              <EmptyState icon={UserCog} title="No admins yet" description="Add the first admin above." />
            ) : (
              <div className="overflow-x-auto">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Admin</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Added by</th>
                      <th>Last seen</th>
                      <th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {result.admins.map((a) => (
                      <tr key={a.email}>
                        <td>
                          <p className="font-semibold text-(--ink)">{a.email}</p>
                          {a.email === actor.toLowerCase() ? <p className="text-[11.5px] text-brand-500">You</p> : null}
                        </td>
                        <td>
                          <Badge tone={a.role === "SUPER_ADMIN" ? "info" : "neutral"} dot={false}>
                            {ROLE_INFO[a.role]?.label ?? a.role}
                          </Badge>
                        </td>
                        <td>
                          <Badge tone={a.active ? "success" : "neutral"}>{a.active ? "Active" : "Deactivated"}</Badge>
                        </td>
                        <td className="text-(--ink-soft)">{a.createdBy ?? "—"}</td>
                        <td className="whitespace-nowrap text-(--ink-soft)">
                          {a.lastSeenAt ? (
                            <span title={formatDateTime(a.lastSeenAt)}>{formatRelativeTime(a.lastSeenAt)}</span>
                          ) : (
                            "Never"
                          )}
                        </td>
                        <td className="text-right">
                          {a.active ? (
                            <StoreRowAction
                              label="Deactivate"
                              fieldLabel={null}
                              tone="danger"
                              confirmLabel="Yes, deactivate"
                              disabled={a.email === actor.toLowerCase()}
                              action={deactivateAdminAction.bind(null, a.email)}
                            />
                          ) : (
                            <StoreRowAction
                              label="Activate"
                              fieldLabel={null}
                              confirmLabel="Yes, activate"
                              action={activateAdminAction.bind(null, a.email)}
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>
        </>
      )}
    </AdminPage>
  );
}
