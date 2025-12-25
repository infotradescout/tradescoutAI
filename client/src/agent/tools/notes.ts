import { openFloatingNote } from "@/lib/floatingNotes";

export async function openFloatingNoteTool(noteId: string = "quick") {
  await openFloatingNote(noteId);
  return { status: "opened", noteId };
}
