/** Small display helpers for creators' identity documents in the review screen. */

const KIND_LABEL: Record<string, string> = {
  PAN_CARD: "PAN card",
  BANK_PROOF: "Account proof",
};

export function kycKindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

/** 1536 -> "1.5 KB", 1_200_000 -> "1.1 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Document links are always absolute https URLs; anything else (http, javascript:, data:, a relative path) is not shown as a link. */
export function isSafeDocumentUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
