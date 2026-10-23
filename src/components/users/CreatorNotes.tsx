"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCreatorNoteAction, deleteCreatorNoteAction } from "@/actions/notes.actions";
import { formatDateTime } from "@/lib/utils";

export interface NoteView {
  id: string;
  author: string;
  body: string;
  at: string;
  mine: boolean;
  canDelete: boolean;
}

/** Internal notes: who spoke to this creator, what was promised. Private to admins. */
export function CreatorNotes({ userId, notes, readOnly }: { userId: string; notes: NoteView[]; readOnly: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mt-4 space-y-4">
      {!readOnly && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addCreatorNoteAction(userId, text);
              setMessage({ ok: r.success, text: r.message });
              if (r.success) {
                setText("");
                router.refresh();
              }
            });
          }}
        >
          <label className="sr-only" htmlFor="creator-note">
            Add a note
          </label>
          <textarea
            id="creator-note"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="What did you talk about? What did you promise?"
            className="admin-input"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] text-(--ink-mute)">Only admins see notes. {text.length}/2000</span>
            <button type="submit" disabled={pending || !text.trim()} className="admin-btn-primary py-2 text-[12.5px]">
              {pending ? "Saving…" : "Add note"}
            </button>
          </div>
          {message && !message.ok && <p className="text-[12px] text-red-700">{message.text}</p>}
        </form>
      )}

      {notes.length === 0 ? (
        <p className="text-[13px] text-(--ink-mute)">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-(--line) bg-[#F7F4EE] px-3.5 py-3">
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-(--ink)">{n.body}</p>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11.5px] text-(--ink-mute)">
                <span>
                  {n.mine ? "You" : n.author} · {formatDateTime(n.at)}
                </span>
                {n.canDelete && !readOnly ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const r = await deleteCreatorNoteAction(userId, n.id);
                        setMessage({ ok: r.success, text: r.message });
                        if (r.success) router.refresh();
                      })
                    }
                    className="font-semibold text-red-700 hover:underline"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
