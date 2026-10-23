"use server";

/** Internal creator notes. Any signed-in admin may add one; only the author (or a super admin) may delete it. */

import { revalidatePath } from "next/cache";
import { requireWritableAdmin, getAdminEmail } from "@/lib/security";
import { getAdminAccess } from "@/lib/admin-access";
import { validateUserId } from "@/lib/validation";
import { addCreatorNote, deleteCreatorNote, NOTE_MAX } from "@/lib/db/notes";
import { getUserEmailById } from "@/lib/db/queries";
import { logAdminAction } from "@/lib/logger";
import type { ActionResult } from "@/types";

function fail(error: unknown): ActionResult {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  if (message.startsWith("UNAUTHORIZED") || message.startsWith("FORBIDDEN")) {
    return { success: false, message: "You are not allowed to do this.", error: message };
  }
  return { success: false, message, error: message };
}

export async function addCreatorNoteAction(userId: string, body: string): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const id = validateUserId(userId);
    const text = body.trim();
    if (!text) return { success: false, message: "Write something first." };
    if (text.length > NOTE_MAX) return { success: false, message: `Notes are limited to ${NOTE_MAX} characters.` };
    const admin = getAdminEmail(session);
    const target = await getUserEmailById(id);
    if (!target) return { success: false, message: "Creator not found." };
    await addCreatorNote(id, admin, text);
    logAdminAction({
      action: "CREATOR_NOTE_ADD",
      adminEmail: admin,
      targetUserId: id,
      targetEmail: target.email,
      details: text.slice(0, 200),
    });
    revalidatePath(`/admin/users/${id}`);
    return { success: true, message: "Note added." };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCreatorNoteAction(userId: string, noteId: string): Promise<ActionResult> {
  try {
    const session = await requireWritableAdmin();
    const id = validateUserId(userId);
    const admin = getAdminEmail(session);
    const access = await getAdminAccess(session);
    const removed = await deleteCreatorNote(noteId, admin, access.can("MANAGE_ADMINS"));
    if (!removed) return { success: false, message: "Only the author or a super admin can delete this note." };
    logAdminAction({ action: "CREATOR_NOTE_DELETE", adminEmail: admin, targetUserId: id, details: noteId });
    revalidatePath(`/admin/users/${id}`);
    return { success: true, message: "Note deleted." };
  } catch (error) {
    return fail(error);
  }
}
