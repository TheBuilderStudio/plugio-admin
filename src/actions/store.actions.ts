"use server";

/**
 * Plugio Admin — Digital Store actions (payouts, refunds, takedown).
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

export async function markPayoutPaidAction(id: string, reference: string): Promise<ActionResult> {
  return run(id, { reference }, "STORE_PAYOUT_PAID", "Payout marked as paid.", (a, c) => storeApi.markPaid(a, id, c.reference));
}

export async function rejectPayoutAction(id: string, reason: string): Promise<ActionResult> {
  return run(id, { reason }, "STORE_PAYOUT_REJECT", "Payout rejected and balance restored.", (a, c) => storeApi.rejectPayout(a, id, c.reason));
}

export async function refundOrderAction(id: string, reason: string): Promise<ActionResult> {
  return run(id, { reason }, "STORE_REFUND", "Order refunded. The buyer's access has ended.", (a, c) => storeApi.refund(a, id, c.reason));
}

export async function suspendProductAction(id: string, reason: string): Promise<ActionResult> {
  return run(id, { reason }, "STORE_PRODUCT_SUSPEND", "Product suspended and downloads blocked.", (a, c) => storeApi.suspend(a, id, c.reason));
}

export async function unsuspendProductAction(id: string): Promise<ActionResult> {
  return run(id, {}, "STORE_PRODUCT_UNSUSPEND", "Product restored to draft.", (a) => storeApi.unsuspend(a, id));
}
