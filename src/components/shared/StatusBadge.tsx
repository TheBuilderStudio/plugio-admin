import { cn } from "@/lib/utils";

type StatusType = "APPROVED" | "PENDING" | "REJECTED" | "ACTIVE" | "TRIALING" | "EXPIRED" | "NONE" | null | undefined;

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
}

const statusConfig: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  APPROVED: {
    label: "Approved",
    className: "badge-approved",
    dot: "bg-emerald-500",
  },
  PENDING: {
    label: "Pending",
    className: "badge-pending",
    dot: "bg-amber-500",
  },
  REJECTED: {
    label: "Rejected",
    className: "badge-rejected",
    dot: "bg-red-500",
  },
  ACTIVE: {
    label: "Active",
    className: "badge-approved",
    dot: "bg-emerald-500",
  },
  TRIALING: {
    label: "Trial",
    className: "badge-pending",
    dot: "bg-amber-500",
  },
  EXPIRED: {
    label: "Expired",
    className: "badge-rejected",
    dot: "bg-red-500",
  },
  NONE: {
    label: "No Plan",
    className: "badge-none",
    dot: "bg-zinc-400",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const key = status ?? "NONE";
  const config = statusConfig[key] ?? {
    label: key,
    className: "badge-none",
    dot: "bg-zinc-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
        config.className,
        className
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", config.dot)} />
      {config.label}
    </span>
  );
}
