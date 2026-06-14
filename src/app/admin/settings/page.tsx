import { Server, Database, Globe, Info, Activity } from "lucide-react";
import { requireAdmin } from "@/lib/security";
import { auth } from "@/auth";
import { testConnection } from "@/lib/db";
import { APP_VERSION, ENVIRONMENT, ADMIN_EMAILS } from "@/constants";
import { formatDateTime } from "@/lib/utils";

export const revalidate = 0;

export default async function SettingsPage() {
  const session = await requireAdmin();

  const [dbConnected] = await Promise.all([
    testConnection(),
  ]);

  const backendApiUrl =
    process.env.BACKEND_API_URL ?? process.env.NEXTAUTH_URL ?? "—";

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto min-h-screen space-y-6 lg:space-y-8">
      
      {/* ── Premium Header ── */}
      <div className="relative overflow-hidden rounded-xl p-8 bg-white border border-neutral-200 shadow-sm">
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-50 blur-3xl rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 space-y-2">
          <h1 className="text-3xl font-extrabold text-[#09090B] tracking-tight flex items-center gap-3">
            System Settings
          </h1>
          <p className="text-neutral-500 font-medium">
            Monitor platform health, server configuration, and administrative access.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
        {/* Left Column: Info & Status */}
        <div className="space-y-6 lg:space-y-8">
          
          {/* Application Info */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-7 hover:border-orange-200 transition-colors duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <Info className="w-5 h-5" />
              </div>
              <h2 className="font-extrabold text-[#09090B] text-base">
                Application Profile
              </h2>
            </div>
            <div className="space-y-1">
              <InfoRow label="App Name" value="Plugio Admin" />
              <InfoRow label="Version" value={APP_VERSION} mono />
              <InfoRow label="Environment" value={ENVIRONMENT} badge={ENVIRONMENT === "production" ? "blue" : "orange"} />
              <InfoRow label="Runtime" value="Next.js (Node.js)" />
              <InfoRow label="Admin URL" value={process.env.NEXTAUTH_URL ?? "—"} mono />
            </div>
          </div>

          {/* System Status */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-7 hover:border-orange-200 transition-colors duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                <Activity className="w-5 h-5" />
              </div>
              <h2 className="font-extrabold text-[#09090B] text-base">System Health</h2>
            </div>
            <div className="space-y-4">
              <StatusCard
                icon={Database}
                label="Database Connection"
                status={dbConnected ? "connected" : "error"}
                detail={
                  dbConnected
                    ? `${process.env.DB_HOST}:${process.env.DB_PORT ?? "3306"}`
                    : "Connection failed"
                }
              />
              <StatusCard
                icon={Globe}
                label="Auth Provider"
                status="connected"
                detail="Google OAuth2 (NextAuth v5)"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Admins & Audit */}
        <div className="space-y-6 lg:space-y-8">
          
          {/* Authorized Admins */}
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-7 hover:border-orange-200 transition-colors duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-orange-50 text-[#FF6719] flex items-center justify-center border border-orange-100">
                <Server className="w-5 h-5" />
              </div>
              <h2 className="font-extrabold text-[#09090B] text-base">
                Authorized Access
              </h2>
            </div>
            <div className="space-y-3">
              {ADMIN_EMAILS.map((email) => (
                <div
                  key={email}
                  className={`flex items-center justify-between px-5 py-4 rounded-xl border transition-all ${
                    email === session?.user?.email
                      ? "bg-orange-50 border-orange-200 shadow-inner"
                      : "bg-[#FAFAFA] border-neutral-200"
                  }`}
                >
                  <span className="text-sm font-bold text-[#09090B] font-mono">
                    {email}
                  </span>
                  {email === session?.user?.email && (
                    <span className="text-[10px] font-extrabold text-[#FF6719] uppercase tracking-widest bg-white border border-orange-200 shadow-sm px-2.5 py-1 rounded-md">
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs font-medium text-neutral-500 mt-5 leading-relaxed bg-[#FAFAFA] p-4 rounded-xl border border-neutral-100 shadow-inner">
              To add or remove admins, modify the <code className="font-mono text-xs text-[#09090B] bg-white border border-neutral-200 px-1.5 py-0.5 rounded shadow-sm">ADMIN_EMAILS</code> array in the source code.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  badge = null
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: "blue" | "orange" | null;
}) {
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-neutral-100/60 last:border-0 group">
      <span className="text-[11px] font-extrabold text-neutral-400 uppercase tracking-widest">{label}</span>
      <span
        className={`text-sm text-right font-bold transition-colors ${
          badge 
            ? badge === "orange" 
              ? "bg-orange-50 text-[#FF6719] border border-orange-200 px-2 py-0.5 rounded shadow-sm text-xs"
              : "bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded shadow-sm text-xs"
            : mono 
              ? "font-mono text-xs text-[#09090B] bg-[#FAFAFA] border border-neutral-200 px-1.5 py-0.5 rounded"
              : "text-[#09090B]"
        }`}
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
  icon: React.ElementType;
  label: string;
  status: "connected" | "error" | "warning";
  detail: string;
}) {
  return (
    <div className="flex items-center justify-between p-5 bg-[#FAFAFA] rounded-xl border border-neutral-200 shadow-inner group">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-white shadow-sm border border-neutral-200 flex items-center justify-center">
          <Icon className="w-5 h-5 text-neutral-400 group-hover:text-[#09090B] transition-colors" />
        </div>
        <div>
          <p className="text-sm font-bold text-[#09090B]">{label}</p>
          <p className="text-xs text-neutral-500 mt-1 font-mono">{detail}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-sm">
        <div
          className={`w-2 h-2 rounded-full ${
            status === "connected"
              ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
              : status === "warning"
                ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"
          }`}
        />
        <span
          className={`text-[10px] font-extrabold uppercase tracking-widest ${
            status === "connected"
              ? "text-emerald-700"
              : status === "warning"
                ? "text-amber-700"
                : "text-red-700"
          }`}
        >
          {status === "connected"
            ? "Online"
            : status === "warning"
              ? "Warning"
              : "Offline"}
        </span>
      </div>
    </div>
  );
}
