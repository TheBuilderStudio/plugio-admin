import type { Metadata } from "next";
import { signOut } from "@/auth";

export const metadata: Metadata = {
  title: "Unauthorized — Plugio Console",
};

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0A0908] px-6">
      <div className="max-w-sm text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#FF6719]">
          Restricted
        </p>
        <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-white">
          You are not on the operator list
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-white/50">
          This Google account cannot open the Plugio console. Sign out and use an authorized team account.
        </p>
        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="admin-btn-primary mx-auto">
            Sign out and try another account
          </button>
        </form>
      </div>
    </div>
  );
}
