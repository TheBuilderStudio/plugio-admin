import type { ElementType } from "react";
import { Server, Database, Globe, Info, Activity } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { testConnection, getActiveDbContext, hasDistinctStagingDb } from "@/lib/db";
import { APP_VERSION, ENVIRONMENT, ADMIN_EMAILS } from "@/constants";
import { AdminPage, AdminCard } from "@/components/ui/page-shell";
import { DatabaseSwitch } from "@/components/shared/DatabaseSwitch";

export const revalidate = 0;

export default async function SettingsPage() {
  const session = await requireAdmin();

  const [dbConnected, dbContext] = await Promise.all([
    testConnection(),
    getActiveDbContext(),
  ]);
  const hasStagingDb = hasDistinctStagingDb();

  return (
    <AdminPage>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <AdminCard>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[#F7F4EE] text-[var(--ink-soft)]">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">
                Database
              </h2>
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                Switch which Plugio database this console reads and writes.
              </p>
            </div>
          </div>
          <DatabaseSwitch />
          <p className="mt-3 text-[12.5px] text-[var(--ink-soft)]">
            Now on <span className="font-semibold text-[var(--ink)]">{dbContext === "production" ? "Production" : "Staging"}</span>
            {hasStagingDb
              ? "."
              : ". Staging env vars are not set separately, so both sides use the active connection until they are."}
          </p>
        </AdminCard>

        <AdminCard>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[#F7F4EE] text-[var(--ink-soft)]">
              <Info className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">
              Application
            </h2>
          </div>
          <InfoRow label="App" value="Plugio Console" />
          <InfoRow label="Version" value={APP_VERSION} mono />
          <InfoRow
            label="Environment"
            value={ENVIRONMENT}
            badge={ENVIRONMENT === "production" ? "blue" : "orange"}
          />
          <InfoRow label="Runtime" value="Next.js (Node.js)" />
          <InfoRow label="Admin URL" value={process.env.NEXTAUTH_URL ?? "—"} mono />
        </AdminCard>

        <AdminCard>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[#F7F4EE] text-[var(--ink-soft)]">
              <Activity className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">Health</h2>
          </div>
          <div className="space-y-3">
            <StatusCard
              icon={Database}
              label="Database"
              status={dbConnected ? "connected" : "error"}
              detail={
                dbConnected
                  ? `${(process.env.DB_HOST ?? "").split(".")[0]}… :${process.env.DB_PORT ?? "3306"}`
                  : "Connection failed"
              }
            />
            <StatusCard
              icon={Globe}
              label="Auth"
              status="connected"
              detail="Google OAuth2 (NextAuth v5)"
            />
          </div>
        </AdminCard>

        <AdminCard className="lg:col-span-2">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--line)] bg-[#F7F4EE] text-[var(--ink-soft)]">
              <Server className="h-4 w-4" />
            </div>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--ink)]">
              Authorized operators
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {ADMIN_EMAILS.map((email) => (
              <div
                key={email}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  email === session?.user?.email
                    ? "border-orange-200 bg-orange-50"
                    : "border-[var(--line)] bg-[#F7F4EE]"
                }`}
              >
                <span className="font-mono text-[13px] font-medium text-[var(--ink)]">{email}</span>
                {email === session?.user?.email ? (
                  <span className="rounded-md bg-[var(--paper)] px-2 py-0.5 text-[11px] font-semibold text-[#FF6719]">
                    You
                  </span>
                ) : null}
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
            To add or remove operators, change the{" "}
            <code className="rounded-md border border-[var(--line)] bg-white px-1.5 py-0.5 font-mono text-[12px]">
              ADMIN_EMAILS
            </code>{" "}
            array in source and redeploy.
          </p>
        </AdminCard>
      </div>
    </AdminPage>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  badge = null,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: "blue" | "orange" | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--line)] py-2.5 last:border-0">
      <span className="text-[12.5px] font-medium text-[var(--ink-mute)]">{label}</span>
      <span
        className={
          badge
            ? badge === "orange"
              ? "rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[12px] font-semibold text-[#FF6719]"
              : "rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[12px] font-semibold text-sky-700"
            : mono
              ? "max-w-[60%] truncate rounded-md border border-[var(--line)] bg-[#F7F4EE] px-1.5 py-0.5 font-mono text-[12px] text-[var(--ink)]"
              : "text-[13.5px] font-medium text-[var(--ink)]"
        }
      >
        {value}
      </span>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  status,
  detail,
}: {
  icon: ElementType;
  label: string;
  status: "connected" | "error" | "warning";
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[#F7F4EE] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-[var(--paper)]">
          <Icon className="h-4 w-4 text-[var(--ink-soft)]" />
        </div>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--ink)]">{label}</p>
          <p className="truncate font-mono text-[11px] text-[var(--ink-soft)]">{detail}</p>
        </div>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          status === "connected"
            ? "badge-approved"
            : status === "warning"
              ? "badge-pending"
              : "badge-rejected"
        }`}
      >
        {status === "connected" ? "Online" : status === "warning" ? "Warning" : "Offline"}
      </span>
    </div>
  );
}


