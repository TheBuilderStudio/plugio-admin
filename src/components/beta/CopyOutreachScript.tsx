"use client";

import { useState } from "react";
import { Check, Copy, Mail, MessageCircle } from "lucide-react";

type Props = {
  script: string;
  couponCode?: string | null;
};

export function CopyOutreachScript({ script, couponCode }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const wa = `https://wa.me/?text=${encodeURIComponent(script)}`;
  const mailto = `mailto:?subject=${encodeURIComponent("You're in Plugio beta")}&body=${encodeURIComponent(script)}`;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--line)] bg-[var(--paper)] p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#FF6719]">
          Send this now
        </p>
        {couponCode ? (
          <p className="mt-1 text-[13px] font-medium text-[var(--ink)]">
            Coupon in script: <span className="font-mono font-semibold">{couponCode}</span>
          </p>
        ) : (
          <p className="mt-1 text-[13px] font-medium text-amber-800">
            No unused coupon in Coupons. Add a code there, then send it with this script.
          </p>
        )}
      </div>
      <textarea
        readOnly
        value={script}
        rows={10}
        className="admin-input resize-none font-normal leading-relaxed"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void copy()} className="admin-btn-primary py-2 text-[12px]">
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <a href={wa} target="_blank" rel="noreferrer" className="admin-btn-ghost py-2 text-[12px]">
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
        <a href={mailto} className="admin-btn-ghost py-2 text-[12px]">
          <Mail className="h-3.5 w-3.5" />
          Email
        </a>
      </div>
    </div>
  );
}
