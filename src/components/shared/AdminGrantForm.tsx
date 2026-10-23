"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { grantAdminAction } from "@/actions/admins.actions";

const ROLES = [
  { value: "SUPPORT", label: "Support: view, suspend or restore products" },
  { value: "FINANCE", label: "Finance: payouts, refunds, disputes" },
  { value: "SUPER_ADMIN", label: "Super admin: everything, manages admins" },
];

/** Add an admin by Google email. The same form changes the role of an existing admin. */
export function AdminGrantForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("SUPPORT");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await grantAdminAction(email, role);
          setMessage({ ok: result.success, text: result.message });
          if (result.success) {
            setEmail("");
            router.refresh();
          }
        });
      }}
    >
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-(--ink-soft)">
        Google email
        <input
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@gmail.com"
          className="h-9 w-64 rounded-lg border border-(--line) bg-white px-2.5 text-[13px] font-normal text-(--ink)"
        />
      </label>
      <label className="flex flex-col gap-1 text-[12px] font-semibold text-(--ink-soft)">
        Role
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-9 rounded-lg border border-(--line) bg-white px-2 text-[13px] font-normal text-(--ink)"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-9 rounded-lg bg-brand-500 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Add or update"}
      </button>
      {message && <span className={`text-[12px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
    </form>
  );
}
