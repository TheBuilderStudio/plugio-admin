"use server";

/**
 * Plugio Admin — Digital Store actions (payouts, takedown).
 * Every action requires a writable admin session and is recorded in the admin audit log.
 */

import { revalidatePath } from "next/cache";
import { requireWritableAdmin } from "@/lib/security";
import { storeApi } from "@/lib/store-api";
import { logAdminAction } from "@/lib/logger";
import type { ActionResult } from "@/types";

const ID_PATTERN = /^[0-9a-f-]{32,36}$/i;

function fail(error: unknown, fallback: string): ActionResult {
  const message = error instanceof Error ? error.message : fallback;
  if (message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN")) {
    return { success: false, message: "You are not allowed to do this.", error: message };
  }
  return { success: false, message, error: message };
}

function text(value: string, max: number): string {
  return value.trim().slice(0, max);
}

async function run(
  id: string,
  fields: Record<string, string>,
  action: Parameters<typeof logAdminAction>[0]["action"],
  successMessage: string,
  exec: (adminEmail: string, clean: Record<string, string>) => Promise<unknown>
): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    if (!ID_PATTERN.test(id)) return { success: false, message: "Invalid id." };
    const clean: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) {
      clean[key] = text(value, key === "reference" ? 120 : 500);
      if (!clean[key]) return { success: false, message: `${key[0].toUpperCase()}${key.slice(1)} is required.` };
    }
    await exec(adminEmail, clean);
    logAdminAction({ action, adminEmail, details: `${id} ${Object.values(clean).join(" | ")}`.slice(0, 500) });
    revalidatePath("/admin/store");
    return { success: true, message: successMessage };
  } catch (error) {
    return fail(error, "Something went wrong.");
  }
}

const RATE_PATTERN = /^\d{1,2}(\.\d{1,2})?$/;
const MAX_RATE = 50;
const MAX_GATEWAY_RATE = 10;

function parseRate(label: string, raw: string, max = MAX_RATE): { value: number } | { error: string } {
  const text = raw.trim();
  if (!RATE_PATTERN.test(text)) return { error: `${label} must be a number with at most 2 decimal places.` };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > max) return { error: `${label} must be between 0% and ${max}%.` };
  return { value };
}

/** Saves the commission rates and the payment gateway charge. The server re-validates, checks the version and writes the audit trail. */
export async function updateCommissionPolicyAction(digital: string, bookings: string, gateway: string, version: number): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    const d = parseRate("Digital products fee", digital);
    if ("error" in d) return { success: false, message: d.error };
    const b = parseRate("Bookings fee", bookings);
    if ("error" in b) return { success: false, message: b.error };
    const g = parseRate("Payment gateway fee", gateway, MAX_GATEWAY_RATE);
    if ("error" in g) return { success: false, message: g.error };
    if (!Number.isInteger(version) || version < 0) return { success: false, message: "Reload the page and try again." };

    const saved = await storeApi.updateCommissionPolicy(adminEmail, {
      digitalProductsFeePercent: d.value,
      bookingsFeePercent: b.value,
      gatewayFeePercent: g.value,
      version,
    });
    logAdminAction({
      action: "STORE_COMMISSION_UPDATE",
      adminEmail,
      details: `digital=${saved.digitalProductsFeePercent}% bookings=${saved.bookingsFeePercent}% gateway=${saved.gatewayFeePercent ?? 0}% v${saved.version}`,
    });
    revalidatePath("/admin/store");
    return { success: true, message: "Commission policy saved. It applies to new checkouts from now on." };
  } catch (error) {
    return fail(error, "Could not save the commission policy.");
  }
}

/** Saves the minimum payout (whole rupees). The server validates the range, checks the version and audits it. */
export async function updatePayoutSettingsAction(minRupees: string, version: number): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    const text = minRupees.trim();
    if (!/^\d{1,6}$/.test(text)) return { success: false, message: "Enter a whole number of rupees." };
    if (!Number.isInteger(version) || version < 0) return { success: false, message: "Reload the page and try again." };
    const saved = await storeApi.updatePayoutSettings(adminEmail, { minPayoutMinor: Number(text) * 100, version });
    logAdminAction({ action: "STORE_PAYOUT_SETTINGS_UPDATE", adminEmail, details: `min=${saved.minPayoutMinor / 100} v${saved.version}` });
    revalidatePath("/admin/store");
    return { success: true, message: "Minimum payout saved. It applies to new requests now." };
  } catch (error) {
    return fail(error, "Could not save the payout rules.");
  }
}

export async function markPayoutPaidAction(id: string, reference: string): Promise<ActionResult> {
  return run(id, { reference }, "STORE_PAYOUT_PAID", "Payout marked as paid.", (a, c) => storeApi.markPaid(a, id, c.reference));
}

export async function rejectPayoutAction(id: string, reason: string): Promise<ActionResult> {
  return run(id, { reason }, "STORE_PAYOUT_REJECT", "Payout rejected and balance restored.", (a, c) => storeApi.rejectPayout(a, id, c.reason));
}

export async function createSettlementAction(): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    const batch = await storeApi.createSettlement(adminEmail);
    logAdminAction({ action: "STORE_SETTLEMENT_CREATE", adminEmail, details: `${batch.id} payouts=${batch.payoutCount} total=${batch.totalMinor / 100}` });
    revalidatePath("/admin/store");
    return { success: true, message: `Batch created with ${batch.payoutCount} payouts. Download the bank file next.` };
  } catch (error) {
    return fail(error, "Could not create the batch.");
  }
}

export async function settleBatchAction(id: string, reference: string): Promise<ActionResult> {
  return run(id, { reference }, "STORE_SETTLEMENT_SETTLE", "Batch settled. Every open payout in it is now paid.", (a, c) => storeApi.settleBatch(a, id, c.reference));
}

/** `reason` may be empty only while the bank file has not been downloaded; the backend enforces that. */
export async function cancelBatchAction(id: string, reason: string): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    if (!ID_PATTERN.test(id)) return { success: false, message: "Invalid id." };
    const clean = text(reason, 500);
    await storeApi.cancelBatch(adminEmail, id, clean);
    logAdminAction({ action: "STORE_SETTLEMENT_CANCEL", adminEmail, details: `${id} ${clean}`.slice(0, 500) });
    revalidatePath("/admin/store");
    return { success: true, message: "Batch cancelled. Its payouts are open again." };
  } catch (error) {
    return fail(error, "Could not cancel the batch.");
  }
}

export async function approveKycAction(sellerId: string): Promise<ActionResult> {
  return run(sellerId, {}, "STORE_KYC_APPROVE", "Verified. The creator can now request payouts.", (a) => storeApi.approveKyc(a, sellerId));
}

export async function rejectKycAction(sellerId: string, reason: string): Promise<ActionResult> {
  return run(sellerId, { reason }, "STORE_KYC_REJECT", "Rejected. The creator was told why.", (a, c) => storeApi.rejectKyc(a, sellerId, c.reason));
}

export async function dismissExceptionAction(id: string, reason: string): Promise<ActionResult> {
  return run(id, { reason }, "STORE_EXCEPTION_DISMISS", "Closed. The held amount is released to the seller.", (a, c) => storeApi.dismissException(a, id, c.reason));
}

/** One full refund to the customer for a session the creator cancelled. Moves money; Finance or Super admin only. */
export async function refundCancelledSessionAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    if (!ID_PATTERN.test(id)) return { success: false, message: "Invalid id." };
    const out = await storeApi.refundCancelledSession(adminEmail, id);
    logAdminAction({ action: "STORE_SESSION_REFUND", adminEmail, details: `${id} ${out.result}` });
    revalidatePath("/admin/store");
    return {
      success: true,
      message:
        out.result === "REFUNDED"
          ? "Customer refunded in full. The creator's share was debited and the platform fee returned."
          : "Refund approved. The gateway has not confirmed it yet; it is retried every minute and this item closes by itself.",
    };
  } catch (error) {
    return fail(error, "Could not refund this session.");
  }
}

/** A dispute the gateway ruled against us: debits the creator and returns the platform fee. Moves money; Finance or Super admin only. */
export async function confirmDisputeLossAction(id: string): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    if (!ID_PATTERN.test(id)) return { success: false, message: "Invalid id." };
    const out = await storeApi.confirmDisputeLoss(adminEmail, id);
    logAdminAction({ action: "STORE_DISPUTE_LOSS", adminEmail, details: `${id} debited=${out.debitedMinor} fee=${out.feeReturnedMinor}` });
    revalidatePath("/admin/store");
    return {
      success: true,
      message: `Loss confirmed. The creator was debited ₹${out.debitedMinor / 100} and the platform fee (₹${out.feeReturnedMinor / 100}) was returned.${out.accessBlocked ? " Access was blocked." : ""}`,
    };
  } catch (error) {
    return fail(error, "Could not confirm this loss.");
  }
}

export async function suspendProductAction(id: string, reason: string): Promise<ActionResult> {
  return run(id, { reason }, "STORE_PRODUCT_SUSPEND", "Product suspended and downloads blocked.", (a, c) => storeApi.suspend(a, id, c.reason));
}

export async function unsuspendProductAction(id: string): Promise<ActionResult> {
  return run(id, {}, "STORE_PRODUCT_UNSUSPEND", "Product restored to draft.", (a) => storeApi.unsuspend(a, id));
}
