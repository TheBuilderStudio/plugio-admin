"use server";

/**
 * Plugio Admin: review moderation. Creators report reviews (or hid them before moderation existed); an admin decides.
 * Every action requires a writable admin session and is recorded in the admin audit log.
 */

import { revalidatePath } from "next/cache";
import { requireWritableAdmin } from "@/lib/security";
import { reviewApi } from "@/lib/store-api";
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

export async function hideReviewAction(id: string, reason: string): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    if (!ID_PATTERN.test(id)) return { success: false, message: "Invalid id." };
    const why = reason.trim().slice(0, 300);
    if (why.length < 3) return { success: false, message: "A reason is required; the creator is told why." };
    await reviewApi.hide(adminEmail, id, why);
    logAdminAction({ action: "REVIEW_HIDE", adminEmail, details: `${id} ${why}`.slice(0, 500) });
    revalidatePath("/admin/reviews");
    return { success: true, message: "Review removed. The creator was emailed the reason." };
  } catch (error) {
    return fail(error, "Could not remove the review.");
  }
}

export async function keepReviewAction(id: string, note: string): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const adminEmail = session.user?.email;
    if (!adminEmail) return { success: false, message: "No admin email on session." };
    if (!ID_PATTERN.test(id)) return { success: false, message: "Invalid id." };
    await reviewApi.keep(adminEmail, id, note.trim().slice(0, 300));
    logAdminAction({ action: "REVIEW_KEEP", adminEmail, details: `${id} ${note.trim()}`.slice(0, 500) });
    revalidatePath("/admin/reviews");
    return { success: true, message: "Review kept public." };
  } catch (error) {
    return fail(error, "Could not update the review.");
  }
}
