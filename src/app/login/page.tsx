import type { Metadata } from "next";
import { signIn } from "@/auth";

export const metadata: Metadata = {
  title: "Sign In — Plugio Admin",
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error;
  const callbackUrl = params.callbackUrl ?? "/admin/dashboard";

  const isUnauthorized = error === "AccessDenied" || error === "unauthorized";

  return (
    <div className="min-h-screen bg-[#18181b] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-sm animate-slide-up">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#18181b] to-[#27272a] px-8 py-8 text-center">
            {/* Logo */}
            <div className="inline-flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <span className="text-white font-black text-lg leading-none">
                  P
                </span>
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-xl leading-none">
                  Plugio
                </p>
                <p className="text-orange-400 text-xs font-semibold tracking-widest uppercase mt-0.5">
                  Admin
                </p>
              </div>
            </div>
            <h1 className="text-white font-bold text-xl">Internal Panel</h1>
            <p className="text-zinc-400 text-sm mt-1">
              Authorized personnel only
            </p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {/* Error message */}
            {isUnauthorized && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-3 h-3 text-red-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-red-800 font-semibold text-sm">
                      Access Denied
                    </p>
                    <p className="text-red-600 text-sm mt-0.5">
                      Your Google account is not authorized to access this
                      panel.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Sign in form */}
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: callbackUrl });
              }}
            >
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-3 bg-white border-2 border-zinc-200 hover:border-orange-300 hover:bg-orange-50/50 rounded-xl px-5 py-3.5 text-zinc-700 font-semibold text-sm transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                {/* Google icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
            </form>

            <p className="text-center text-zinc-400 text-xs mt-6">
              Only whitelisted Plugio team members can access this panel.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-zinc-600 text-xs mt-6">
          © {new Date().getFullYear()} Plugio · Internal Use Only
        </p>
      </div>
    </div>
  );
}
