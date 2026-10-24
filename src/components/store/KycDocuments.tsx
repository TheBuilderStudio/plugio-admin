"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import type { ActionResult, KycDocumentLink } from "@/types";
import { formatFileSize, isSafeDocumentUrl, kycKindLabel } from "@/lib/kyc-documents";

/**
 * Opens a creator's identity documents for review. Nothing is fetched until the reviewer asks, because each request
 * is recorded in the audit trail; the links it returns work for only a few minutes and open in a new tab.
 */
export function KycDocuments({
  sellerId,
  complete,
  action,
}: {
  sellerId: string;
  /** Both the PAN card and the account proof are uploaded. */
  complete: boolean;
  action: (sellerId: string) => Promise<ActionResult>;
}) {
  const [links, setLinks] = useState<KycDocumentLink[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-1.5 text-[12px]">
      <p className={complete ? "font-semibold text-emerald-700" : "font-semibold text-red-700"}>
        {complete ? "PAN card and account proof uploaded" : "Documents missing. Cannot be approved yet."}
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await action(sellerId);
            setMessage({ ok: result.success, text: result.message });
            setLinks(result.success ? (result.kycDocuments ?? []) : null);
          })
        }
        className="inline-flex items-center gap-1.5 rounded-lg border border-(--line) px-2.5 py-1 font-semibold text-(--ink) hover:bg-(--hover) disabled:opacity-40"
      >
        <FileText className="size-3.5" aria-hidden="true" />
        {pending ? "Opening…" : links ? "Refresh links" : "View documents"}
      </button>
      {message && <p className={message.ok ? "text-(--ink-soft)" : "text-red-700"}>{message.text}</p>}
      {links && links.length > 0 && (
        <ul className="space-y-1">
          {links.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{kycKindLabel(d.kind)}</span>
              <span className="text-(--ink-mute)">{formatFileSize(d.sizeBytes)}</span>
              {isSafeDocumentUrl(d.url) ? (
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-500 hover:underline">
                  Open
                </a>
              ) : (
                <span className="text-red-700">Link unavailable</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
