"use server";

/**
 * Plugio Admin — manage who may use the admin API (super admin only; the backend enforces the role and its
 * guards: nobody changes their own role, the last super admin cannot be removed).
 */

import { revalidatePath } from "next/cache";
import { requireWritableAdmin } from "@/lib/security";
import { adminUsersApi, type AdminRole } from "@/lib/store-api";
import { logAdminAction } from "@/lib/logger";
import type { ActionResult } from "@/types";

const ROLES: readonly AdminRole[] = ["SUPPORT", "FINANCE", "SUPER_ADMIN"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN")) {
    return { success: false, message: "You are not allowed to do this.", error: message };
  }
  return { success: false, message, error: message };
}

async function run(
  rawEmail: string,
  action: "ADMIN_GRANT" | "ADMIN_DEACTIVATE" | "ADMIN_ACTIVATE",
  successMessage: string,
  exec: (actor: string, email: string) => Promise<unknown>,
  detail = "",
): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const actor = session.user?.email;
    if (!actor) return { success: false, message: "No admin email on session." };
    const email = normalizeEmail(rawEmail);
    if (!email) return { success: false, message: "Enter a valid email address." };
    await exec(actor, email);
    logAdminAction({ action, adminEmail: actor, details: `${email}${detail}` });
    revalidatePath("/admin/admins");
    return { success: true, message: successMessage };
  } catch (error) {
    return fail(error);
  }
}

/** Adds an admin, or changes the role of an existing one. */
export async function grantAdminAction(email: string, role: string): Promise<ActionResult> {
  if (!ROLES.includes(role as AdminRole)) return { success: false, message: "Choose a role." };
  return run(email, "ADMIN_GRANT", "Admin saved.", (actor, e) => adminUsersApi.grant(actor, e, role as AdminRole), ` role=${role}`);
}

export async function deactivateAdminAction(email: string): Promise<ActionResult> {
  return run(email, "ADMIN_DEACTIVATE", "Admin deactivated.", (actor, e) => adminUsersApi.deactivate(actor, e));
}

export async function activateAdminAction(email: string): Promise<ActionResult> {
  return run(email, "ADMIN_ACTIVATE", "Admin activated.", (actor, e) => adminUsersApi.activate(actor, e));
}
