import { couponRuntimeStatus, couponStatusClass } from "@/lib/coupon-expiry";

export function CouponStatusBadge({
  active,
  expiresAt,
}: {
  active: boolean;
  expiresAt: Date | string | null;
}) {
  const status = couponRuntimeStatus(active, expiresAt);
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${couponStatusClass(status)}`}>
      {status}
    </span>
  );
}
