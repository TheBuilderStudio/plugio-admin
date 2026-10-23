"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/types";

/**
 * Small inline control: a button that expands to one text field + confirm, then runs a server action.
 * `fieldLabel` null means a plain confirm button with no input.
 */
export function StoreRowAction({
  label,
  fieldLabel,
  placeholder,
  confirmLabel,
  tone = "default",
  disabled,
  action,
}: {
  label: string;
  fieldLabel: string | null;
  placeholder?: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  action: (value: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const btn =
    tone === "danger"
      ? "border-red-300 text-red-700 hover:bg-red-50"
      : "border-(--line) text-(--ink) hover:bg-(--hover)";

  if (!open) {
    return (
      <div className="inline-flex flex-col items-start gap-1">
        <button type="button" disabled={disabled} onClick={() => { setOpen(true); setMessage(null); }}
          className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold disabled:opacity-40 ${btn}`}>
          {label}
        </button>
        {message && <span className={`text-[11px] ${message.ok ? "text-emerald-700" : "text-red-700"}`}>{message.text}</span>}
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const result = await action(value);
          setMessage({ ok: result.success, text: result.message });
          if (result.success) { setOpen(false); setValue(""); router.refresh(); }
        });
      }}
    >
      {fieldLabel && (
        <input
          autoFocus
          required
          aria-label={fieldLabel}
          placeholder={placeholder ?? fieldLabel}
          value={value}
          maxLength={500}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-48 rounded-lg border border-(--line) bg-white px-2 text-[12px]"
        />
      )}
      <button type="submit" disabled={pending}
        className={`rounded-lg border px-2.5 py-1 text-[12px] font-semibold disabled:opacity-50 ${btn}`}>
        {pending ? "Working…" : confirmLabel ?? "Confirm"}
      </button>
      <button type="button" onClick={() => setOpen(false)} disabled={pending} className="text-[12px] text-(--ink-mute)">
        Cancel
      </button>
      {message && !message.ok && <span className="w-full text-[11px] text-red-700">{message.text}</span>}
    </form>
  );
}
