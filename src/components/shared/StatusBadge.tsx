import { Badge, type Tone } from "@/components/ui/badge";

type StatusType = "APPROVED" | "PENDING" | "REJECTED" | "ACTIVE" | "TRIALING" | "EXPIRED" | "NONE" | null | undefined;

const statusConfig: Record<string, { label: string; tone: Tone }> = {
  APPROVED: { label: "Approved", tone: "success" },
  PENDING: { label: "Waiting", tone: "warning" },
  REJECTED: { label: "Declined", tone: "danger" },
  ACTIVE: { label: "Paid", tone: "success" },
  TRIALING: { label: "Trial", tone: "info" },
  EXPIRED: { label: "Expired", tone: "danger" },
  NONE: { label: "No plan", tone: "neutral" },
};

export function StatusBadge({ status, className }: { status: StatusType; className?: string }) {
  const key = status ?? "NONE";
  const config = statusConfig[key] ?? { label: key, tone: "neutral" as const };
  return (
    <Badge tone={config.tone} className={className}>
      {config.label}
    </Badge>
  );
}
