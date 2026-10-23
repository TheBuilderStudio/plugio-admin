import { couponRuntimeStatus } from "@/lib/coupon-expiry";
import { Badge, type Tone } from "@/components/ui/badge";

export function CouponStatusBadge({
  active,
  expiresAt,
}: {
  active: boolean;
  expiresAt: Date | string | null;
}) {
  const status = couponRuntimeStatus(active, expiresAt);
  const tone: Tone = status === "Active" ? "success" : status === "Expired" ? "warning" : "neutral";
  return <Badge tone={tone}>{status}</Badge>;
}
