"use client";

import { GrantAccessPanel } from "@/components/billing/GrantAccessPanel";
import { GrantHistoryPanel } from "@/components/billing/GrantHistoryPanel";
import type { AdminAccessGrantRow } from "@/types";

interface BillingActionsProps {
  userId: string;
  activeGrant?: AdminAccessGrantRow | null;
  grantHistory?: AdminAccessGrantRow[];
}

/**
 * Billing control surface for the user detail page.
 * Complimentary grant/extend/change/revoke + history.
 * Revoke only removes admin grants — never force-expires paid subscriptions.
 */
export function BillingActions({
  userId,
  activeGrant,
  grantHistory = [],
}: BillingActionsProps) {
  return (
    <div>
      <GrantAccessPanel userId={userId} activeGrant={activeGrant} />
      <GrantHistoryPanel grants={grantHistory} />
    </div>
  );
}
