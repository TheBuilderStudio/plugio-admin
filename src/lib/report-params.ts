import type { TransactionFilter } from "@/lib/store-api";

const KINDS = ["STORE", "BOOKING", "SUBSCRIPTION"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const STATUS = /^[A-Z_]{2,24}$/;
const MAX_Q = 100;

type Raw = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim();
  return t ? t : undefined;
}

function date(v: string | string[] | undefined): string | undefined {
  const s = one(v);
  if (!s || !DATE.test(s) || Number.isNaN(Date.parse(s))) return undefined;
  return s;
}

/** Turns untrusted query-string values into a filter the backend will accept; anything odd is dropped, never forwarded. */
export function parseTransactionFilter(raw: Raw): TransactionFilter {
  const kind = one(raw.kind)?.toUpperCase();
  const status = one(raw.status)?.toUpperCase();
  const q = one(raw.q);
  return {
    kind: kind && KINDS.includes(kind) ? kind : undefined,
    status: status && STATUS.test(status) ? status : undefined,
    from: date(raw.from),
    to: date(raw.to),
    q: q ? q.slice(0, MAX_Q) : undefined,
  };
}

export function parseRange(raw: Raw): { from?: string; to?: string } {
  const { from, to } = parseTransactionFilter(raw);
  return { from, to };
}

export const REPORT_NAMES = ["transactions", "revenue", "commission", "payouts"] as const;
export type ReportName = (typeof REPORT_NAMES)[number];

export function isReportName(v: string): v is ReportName {
  return (REPORT_NAMES as readonly string[]).includes(v);
}
