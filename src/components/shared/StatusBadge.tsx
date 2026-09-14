import { cn } from "@/lib/utils";

type StatusType =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "ACTIVE"
  | "TRIALING"
  | "EXPIRED"
  | "NONE"
  | null
  | undefined;

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  APPROVED: { label: "Approved", className: "badge-approved", dot: "bg-emerald-500" },
  PENDING: { label: "Pending", className: "badge-pending", dot: "bg-amber-500" },
  REJECTED: { label: "Rejected", className: "badge-rejected", dot: "bg-red-500" },
  ACTIVE: { label: "Paid", className: "badge-approved", dot: "bg-emerald-500" },
  TRIALING: { label: "Trial", className: "badge-pending", dot: "bg-orange-400" },
  EXPIRED: { label: "Expired", className: "badge-rejected", dot: "bg-red-500" },
  NONE: { label: "No plan", className: "badge-none", dot: "bg-[#9A948B]" },
};

export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  const key = status ?? "NONE";
  const config = statusConfig[key] ?? { label: key, className: "badge-none", dot: "bg-[#9A948B]" };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold",
        config.className,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} />
      {config.label}
    </span>
  );
}
