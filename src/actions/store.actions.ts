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

function parseRate(label: string, raw: string): { value: number } | { error: string } {
  const text = raw.trim();
  if (!RATE_PATTERN.test(text)) return { error: `${label} must be a number with at most 2 decimal places.` };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > MAX_RATE) return { error: `${label} must be between 0% and ${MAX_RATE}%.` };
  return { value };
}

/** Saves both commission rates. The server re-validates, checks the version and writes the audit trail. */
export async function updateCommissionPolicyAction(digital: string, bookings: string, version: number): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    const d = parseRate("Digital products fee", digital);
    if ("error" in d) return { success: false, message: d.error };
    const b = parseRate("Bookings fee", bookings);
    if ("error" in b) return { success: false, message: b.error };
    if (!Number.isInteger(version) || version < 0) return { success: false, message: "Reload the page and try again." };

    const saved = await storeApi.updateCommissionPolicy(adminEmail, {
      digitalProductsFeePercent: d.value,
      bookingsFeePercent: b.value,
      version,
    });
    logAdminAction({
      action: "STORE_COMMISSION_UPDATE",
      adminEmail,
      details: `digital=${saved.digitalProductsFeePercent}% bookings=${saved.bookingsFeePercent}% v${saved.version}`,
    });
    revalidatePath("/admin/store");
    return { success: true, message: "Commission policy saved. It applies to new checkouts from now on." };
  } catch (error) {
    return fail(error, "Could not save the commission policy.");
  }
}

export async function markPayoutPaidAction(id: string, reference: string): Promise<ActionResult> {
  return run(id, { reference }, "STORE_PAYOUT_PAID", "Payout marked as paid.", (a, c) => storeApi.markPaid(a, id, c.reference));
}

export async function rejectPayoutAction(id: string, reason: string): Promise<ActionResult> {
  return run(id, { reason }, "STORE_PAYOUT_REJECT", "Payout rejected and balance restored.", (a, c) => storeApi.rejectPayout(a, id, c.reason));
}

export async function suspendProductAction(id: string, reason: string): Promise<ActionResult> {
  return run(id, { reason }, "STORE_PRODUCT_SUSPEND", "Product suspended and downloads blocked.", (a, c) => storeApi.suspend(a, id, c.reason));
}

export async function unsuspendProductAction(id: string): Promise<ActionResult> {
  return run(id, {}, "STORE_PRODUCT_UNSUSPEND", "Product restored to draft.", (a) => storeApi.unsuspend(a, id));
}
