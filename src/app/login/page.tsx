import type { Metadata } from "next";
import { signIn } from "@/auth";

export const metadata: Metadata = {
  title: "Sign in — Plugio Console",
};

function safeAdminCallbackUrl(raw: string | undefined): string {
  if (!raw) return "/admin/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/admin/dashboard";
  if (!raw.startsWith("/admin")) return "/admin/dashboard";
  if (raw.includes("\\") || raw.includes("@")) return "/admin/dashboard";
  return raw;
}

interface LoginPageProps {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = safeAdminCallbackUrl(params.callbackUrl);
  const isUnauthorized = error === "AccessDenied" || error === "unauthorized";

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#0A0908] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-[#FF6719]/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-orange-700/10 blur-3xl"
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF6719]">
              <span className="text-lg font-black text-white">P</span>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">Plugio</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/40">
                Operations
              </p>
            </div>
          </div>
          <h1 className="mt-16 max-w-lg text-[34px] font-semibold leading-[1.15] tracking-tight xl:text-[40px]">
            The desk for who gets in, who pays, and what is live.
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-white/55">
            Beta access, trial coupons, Creator/Pro billing, and the audit trail — one console, production-grade.
          </p>
        </div>
        <ul className="relative space-y-2 text-[13px] text-white/45">
          <li>Approve access. Never grant a plan from here.</li>
          <li>Coupons start trial. Payments keep the workspace.</li>
          <li>Every operator action is logged.</li>
        </ul>
      </section>

      <section className="flex items-center justify-center bg-[var(--canvas)] px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF6719]">
                <span className="font-black text-white">P</span>
              </div>
              <p className="text-sm font-semibold">Plugio Console</p>
            </div>
          </div>

          <p className="admin-kicker">Restricted</p>
          <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-[var(--ink)]">
            Sign in to operate
          </h2>
          <p className="mt-2 text-[14px] text-[var(--ink-soft)]">
            Google accounts on the operator list only.
          </p>

          {isUnauthorized && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-800">
              This Google account is not on the operator list. Sign out and try another.
            </div>
          )}

          <form
            className="mt-8"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: callbackUrl });
            }}
          >
            <button type="submit" className="admin-btn-ghost h-12 w-full bg-[var(--paper)] text-[14px]">
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="mt-8 text-center text-[12px] text-[var(--ink-mute)]">
            © {new Date().getFullYear()} Plugio · Internal use
          </p>
        </div>
      </section>
    </div>
  );
}
