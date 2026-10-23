import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { getAdminAccess } from "@/lib/admin-access";
import type { Capability } from "@/lib/admin-roles";
import { getActiveDbContext, hasDistinctStagingDb } from "@/lib/db";
import { APP_VERSION, ENVIRONMENT, ADMIN_EMAILS } from "@/constants";
import { AdminPage, AdminPageHeader, AdminCard } from "@/components/ui/page-shell";
import { DatabaseSwitch } from "@/components/shared/DatabaseSwitch";

export const revalidate = 0;

const CAPABILITIES: { id: Capability; label: string }[] = [
  { id: "VIEW", label: "View creators, sessions and reports" },
  { id: "REVIEW_BETA", label: "Approve or decline access requests" },
  { id: "VIEW_MONEY", label: "See plans, coupons, payments and store payouts" },
  { id: "MANAGE_COUPONS", label: "Create and edit coupons" },
  { id: "EDIT_PLANS", label: "Change plan prices and limits" },
  { id: "VIEW_LOGS", label: "Read live server logs" },
  { id: "MANAGE_ADMINS", label: "Add or remove admins" },
];

export default async function SettingsPage() {
  const session = await requireAdmin();
  const [dbContext, access] = await Promise.all([getActiveDbContext(), getAdminAccess(session)]);
  const hasStagingDb = hasDistinctStagingDb();
  const readOnly = process.env.READ_ONLY_MODE === "true" || process.env.NEXT_PUBLIC_READ_ONLY_MODE === "true";
  const email = session.user?.email?.toLowerCase();

  return (
    <AdminPage>
      <AdminPageHeader
        kicker="Admin"
        title="Settings"
        description="Data source, your role and setup." hint="Health checks are on the Platform health page."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AdminCard>
          <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Data source</h2>
          <p className="mt-1 text-[12.5px] text-(--ink-soft)">
            Staging is safe to test. Live is real money.
          </p>
          <div className="mt-4">
            <DatabaseSwitch />
          </div>
          <p className="mt-3 text-[12.5px] text-(--ink-soft)">
            Now on <span className="font-semibold text-(--ink)">{dbContext === "production" ? "Live" : "Staging"}</span>.
            {!hasStagingDb && (
              <span className="text-red-700">
                {" "}
                No staging database is set, so both read the same data.
              </span>
            )}
          </p>
          <dl className="mt-4 divide-y divide-(--line) border-t border-(--line) text-[13px]">
            <Row label="Console version" value={APP_VERSION} mono />
            <Row label="Environment" value={ENVIRONMENT} />
            <Row label="Mode" value={readOnly ? "Read-only: no changes can be saved" : "Read and write"} />
            <Row label="Admin URL" value={process.env.NEXTAUTH_URL ?? "Not set"} mono />
          </dl>
        </AdminCard>

        <AdminCard>
          <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Your access</h2>
          <p className="mt-1 text-[12.5px] text-(--ink-soft)">
            Signed in as <span className="font-medium text-(--ink)">{email}</span> as a{" "}
            <span className="font-semibold text-(--ink)">{access.role.replace("_", " ").toLowerCase()}</span>.
          </p>
          <ul className="mt-4 space-y-2">
            {CAPABILITIES.map((c) => {
              const allowed = access.can(c.id);
              return (
                <li key={c.id} className="flex items-center gap-2.5 text-[13px]">
                  {allowed ? (
                    <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Allowed" />
                  ) : (
                    <Minus className="h-4 w-4 shrink-0 text-(--ink-mute)" aria-label="Not allowed" />
                  )}
                  <span className={allowed ? "text-(--ink)" : "text-(--ink-mute)"}>{c.label}</span>
                </li>
              );
            })}
          </ul>
        </AdminCard>

        <AdminCard className="lg:col-span-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-(--ink)">Owners</h2>
          <p className="mt-1 text-[12.5px] text-(--ink-soft)">
            Super admins set in the server config. Manage everyone else on the{" "}
            <Link href="/admin/admins" className="font-semibold text-brand-500 hover:underline">
              Admins page
            </Link>
            .
          </p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {ADMIN_EMAILS.map((owner) => (
              <li
                key={owner}
                className="flex items-center justify-between rounded-xl border border-(--line) bg-[#F7F4EE] px-4 py-2.5"
              >
                <span className="truncate font-mono text-[13px] text-(--ink)">{owner}</span>
                {owner === email ? (
                  <span className="rounded-md bg-(--paper) px-2 py-0.5 text-[11px] font-semibold text-brand-500">You</span>
                ) : null}
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>
    </AdminPage>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-(--ink-mute)">{label}</dt>
      <dd className={mono ? "max-w-[60%] truncate font-mono text-[12px] text-(--ink)" : "text-right font-medium text-(--ink)"}>
        {value}
      </dd>
    </div>
  );
}
