/** Internal notes about a creator (table from migration V90). Never shown to the creator. */

import { randomUUID } from "node:crypto";
import { pool } from "./index";

export interface CreatorNote {
  id: string;
  author_email: string;
  body: string;
  created_at: Date;
}

export const NOTE_MAX = 2000;

/** Returns null when the notes table has not been created yet (migration V90 not applied). */
export async function listCreatorNotes(userId: string): Promise<CreatorNote[] | null> {
  try {
    const [rows] = await pool.execute<any[]>(
      `SELECT id, author_email, body, created_at FROM admin_creator_notes
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return rows.map((r) => ({
      id: r.id,
      author_email: r.author_email,
      body: r.body,
      created_at: new Date(r.created_at),
    }));
  } catch (error: any) {
    if (error?.code === "ER_NO_SUCH_TABLE") return null;
    throw error;
  }
}

export async function addCreatorNote(userId: string, authorEmail: string, body: string): Promise<void> {
  await pool.execute(
    `INSERT INTO admin_creator_notes (id, user_id, author_email, body, created_at)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP(6))`,
    [randomUUID(), userId, authorEmail, body.slice(0, NOTE_MAX)]
  );
}

/** Deletes a note only if the caller wrote it or may delete anyone's. Returns whether a row was removed. */
export async function deleteCreatorNote(noteId: string, requesterEmail: string, canDeleteAny: boolean): Promise<boolean> {
  const [res] = await pool.execute<any>(
    canDeleteAny
      ? `DELETE FROM admin_creator_notes WHERE id = ?`
      : `DELETE FROM admin_creator_notes WHERE id = ? AND author_email = ?`,
    canDeleteAny ? [noteId] : [noteId, requesterEmail]
  );
  return (res?.affectedRows ?? 0) > 0;
}
