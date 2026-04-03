import React, { useEffect, useMemo, useState } from "react";
import { safeStorage } from "../utils/safeStorage";
import { useLocation } from "wouter";
import { Page } from "@/components/layout/PagePrimitives";

type NoteRecord = {
  id: string;
  text: string;
  updatedAt: number;
  type: "quick" | "project" | "general";
  jobTitle?: string;
};

function listStoredNotes(): Array<NoteRecord> {
  const out: Array<NoteRecord> = [];
  if (typeof window !== "undefined") {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || "";
      if (key.startsWith("ts:note:")) {
        const raw = safeStorage.get(key) || "";
        try {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === "object") {
            out.push({
              id: key.replace("ts:note:", ""),
              text: parsed.text || "",
              updatedAt: parsed.updatedAt || Date.now(),
              type: parsed.type === "project" || parsed.type === "quick" ? parsed.type : "general",
              jobTitle: parsed.jobTitle,
            });
          }
        } catch {
          out.push({
            id: key.replace("ts:note:", ""),
            text: raw,
            updatedAt: Date.now(),
            type: "general",
          });
        }
      }
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

function deriveNoteTitle(note: NoteRecord): string {
  if (note.jobTitle && note.jobTitle.trim()) {
    return note.jobTitle.trim();
  }

  const raw = (note.text || "").trim();
  if (raw) {
    const words = raw.split(/\s+/);
    const head = words.slice(0, 5).join(" ");
    return words.length > 5 ? `${head}…` : head;
  }

  const d = new Date(note.updatedAt || Date.now());
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const prefix = note.type === "quick" ? "Quick note" : "Note";
  return `${prefix} – ${time}`;
}

export default function NotesPage() {
  const [location, navigate] = useLocation();
  const [notes, setNotes] = useState(listStoredNotes());
  const [activeId, setActiveId] = useState<string>(() => notes[0]?.id || "quick");
  const [text, setText] = useState<string>(() => notes.find((n) => n.id === activeId)?.text || "");
  const [noteType, setNoteType] = useState<NoteRecord["type"]>(
    () => notes.find((n) => n.id === activeId)?.type || "general"
  );
  const [jobTitle, setJobTitle] = useState<string>(
    () => notes.find((n) => n.id === activeId)?.jobTitle || ""
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(
    () => notes.find((n) => n.id === activeId)?.updatedAt ?? null
  );
  const channel = useMemo(() => new BroadcastChannel("ts-floating-notes"), []);

  useEffect(() => {
    const id = activeId || "quick";
    const key = `ts:note:${id}`;
    const payload = JSON.stringify({
      text,
      updatedAt: Date.now(),
      type: noteType,
      jobTitle: jobTitle || undefined,
    });
    safeStorage.set(key, payload);
    setNotes(listStoredNotes());
    setLastSavedAt(Date.now());
    try {
      channel.postMessage({ type: "update", id, text, noteType, jobTitle });
    } catch {}
  }, [activeId, text, noteType, jobTitle]);

  useEffect(() => {
    const current = notes.find((n) => n.id === activeId);
    setText(current?.text || "");
    setNoteType(current?.type || "general");
    setJobTitle(current?.jobTitle || "");
    setLastSavedAt(current?.updatedAt ?? null);
  }, [activeId, notes]);

  const addNewNote = (type: NoteRecord["type"] = "general") => {
    const id = `note-${Math.random().toString(36).slice(2, 8)}`;
    setActiveId(id);
    setText("");
    setNoteType(type);
    setJobTitle("");
  };

  const handleSave = () => {
    const id = activeId || "quick";
    const key = `ts:note:${id}`;
    try {
      const payload = JSON.stringify({
        text,
        updatedAt: Date.now(),
        type: noteType,
        jobTitle: jobTitle || undefined,
      });
      safeStorage.set(key, payload);
      setNotes(listStoredNotes());
      setLastSavedAt(Date.now());
      channel.postMessage({ type: "update", id, text, noteType, jobTitle });
    } catch {}
  };

  const handleStartJobFlow = async () => {
    const id = activeId || "quick";
    const payload = { text, type: noteType, jobTitle: jobTitle || undefined, noteId: id };
    try {
      await fetch("/api/finances/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "NOTE_CAPTURE",
          title: jobTitle || `Note ${id}`,
          content: text,
          meta: { noteType, noteId: id },
        }),
      });
    } catch (err) {
      console.warn("Unable to start job flow from note", err);
    }
    // Navigate to finances workspace to complete the job/doc flow
    navigate("/finances?from=notes&noteId=" + encodeURIComponent(id));
  };

  const activeNote = notes.find((n) => n.id === activeId);
  const activeTitle = activeNote
    ? deriveNoteTitle(activeNote)
    : activeId === "quick"
      ? "Quick note"
      : activeId;

  return (
    <Page>
      <div
        className="flex flex-col lg:flex-row gap-4"
        style={{ color: "var(--theme-text-primary)" }}
      >
      <aside className="w-full lg:w-80 flex-shrink-0">
        <div
          className="rounded-xl p-3"
          style={{
            backgroundColor: "var(--theme-bg-secondary)",
            border: "1px solid var(--theme-border-secondary)",
          }}
        >
          <div className="flex items-center justify-between mb-2 gap-2">
            <div>
              <h2 className="text-sm font-medium" style={{ color: "var(--theme-text-secondary)" }}>
                Saved notes
              </h2>
              <p className="text-[11px]" style={{ color: "var(--theme-text-muted)" }}>
                Tap to open in the editor
              </p>
            </div>
            <div className="flex gap-1">
              <button
                className="ts-accent-btn px-2 py-1 rounded-md text-xs"
                onClick={() => addNewNote("general")}
              >
                New
              </button>
              <button
                className="px-2 py-1 rounded-md text-xs"
                style={{
                  border: "1px solid var(--theme-border-secondary)",
                  color: "var(--theme-text-secondary)",
                }}
                onClick={() => addNewNote("quick")}
              >
                Quick
              </button>
              <button
                className="px-2 py-1 rounded-md text-xs"
                style={{
                  border: "1px solid var(--theme-border-secondary)",
                  color: "var(--theme-text-secondary)",
                }}
                onClick={() => addNewNote("project")}
              >
                Project
              </button>
            </div>
          </div>
          <ul className="space-y-1">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  className="w-full text-left px-2 py-1 rounded-md"
                  style={{
                    backgroundColor:
                      activeId === n.id
                        ? "color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)"
                        : "transparent",
                    color: "var(--theme-text-secondary)",
                  }}
                  onClick={() => setActiveId(n.id)}
                >
                  <div className="flex flex-col">
                    <span
                      className="font-semibold truncate"
                      style={{ color: "var(--theme-text-primary)" }}
                    >
                      {deriveNoteTitle(n)}
                    </span>
                    <span className="text-[11px]" style={{ color: "var(--theme-text-secondary)" }}>
                      <span className="uppercase mr-1">{n.type}</span>
                      <span>
                        {new Date(n.updatedAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div
          className="rounded-xl p-4 space-y-2"
          style={{
            backgroundColor: "var(--theme-bg-secondary)",
            border: "1px solid var(--theme-border-secondary)",
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm" style={{ color: "var(--theme-text-secondary)" }}>
              Editing: {activeTitle}
            </span>
            <div
              className="flex items-center gap-2 text-xs"
              style={{ color: "var(--theme-text-secondary)" }}
            >
              <label className="flex items-center gap-1">
                <span>Type</span>
                <select
                  value={noteType}
                  onChange={(e) => setNoteType(e.target.value as NoteRecord["type"])}
                  className="border rounded px-1 py-0.5 text-xs"
                  style={{
                    borderColor: "var(--theme-border-secondary)",
                    backgroundColor: "var(--theme-bg-primary)",
                    color: "var(--theme-text-primary)",
                  }}
                >
                  <option value="general">General</option>
                  <option value="quick">Quick</option>
                  <option value="project">Project</option>
                </select>
              </label>
              {noteType === "project" && (
                <input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="border rounded px-2 py-1 text-xs"
                  placeholder="Job / project title"
                  style={{
                    borderColor: "var(--theme-border-secondary)",
                    backgroundColor: "var(--theme-bg-primary)",
                    color: "var(--theme-text-primary)",
                  }}
                />
              )}
              {lastSavedAt && (
                <span className="ml-2" style={{ color: "var(--theme-text-muted)" }}>
                  Saved at{" "}
                  {new Date(lastSavedAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
          </div>
          <textarea
            className="w-full min-h-[220px] rounded-md p-3"
            style={{
              backgroundColor: "var(--theme-bg-primary)",
              color: "var(--theme-text-primary)",
              border: "1px solid var(--theme-border-primary)",
            }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your note..."
          />
          <div className="flex items-center justify-end gap-2">
            <button
              className="px-3 py-2 rounded-md"
              style={{
                border: "1px solid var(--theme-border-secondary)",
                color: "var(--theme-text-secondary)",
              }}
              onClick={() => setText("")}
            >
              Clear
            </button>
            <button
              className="px-3 py-2 rounded-md"
              style={{
                border: "1px solid var(--theme-border-secondary)",
                color: "var(--theme-text-secondary)",
              }}
              onClick={handleStartJobFlow}
            >
              Start job flow → finances
            </button>
            <button className="ts-accent-btn px-3 py-2 rounded-md" onClick={handleSave}>
              Save
            </button>
          </div>
        </div>
      </main>
      </div>
    </Page>
  );
}
