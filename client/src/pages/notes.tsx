import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

function listStoredNotes(): Array<{ id: string; text: string; updatedAt: number }> {
  const out: Array<{ id: string; text: string; updatedAt: number }> = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) || "";
    if (key.startsWith("ts:note:")) {
      const raw = localStorage.getItem(key) || "";
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          out.push({ id: key.replace("ts:note:", ""), text: parsed.text || "", updatedAt: parsed.updatedAt || Date.now() });
        }
      } catch {
        out.push({ id: key.replace("ts:note:", ""), text: raw, updatedAt: Date.now() });
      }
    }
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}

export default function NotesPage() {
  const [location] = useLocation();
  const [notes, setNotes] = useState(listStoredNotes());
  const [activeId, setActiveId] = useState<string>(() => notes[0]?.id || "quick");
  const [text, setText] = useState<string>(() => notes.find(n => n.id === activeId)?.text || "");

  useEffect(() => {
    const id = activeId || "quick";
    const key = `ts:note:${id}`;
    const payload = JSON.stringify({ text, updatedAt: Date.now() });
    localStorage.setItem(key, payload);
    setNotes(listStoredNotes());
  }, [activeId, text]);

  useEffect(() => {
    setText(notes.find(n => n.id === activeId)?.text || "");
  }, [activeId]);

  const addNewNote = () => {
    const id = `note-${Math.random().toString(36).slice(2, 8)}`;
    setActiveId(id);
    setText("");
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4" style={{ color: 'var(--theme-text-primary)' }}>
      <aside className="w-full lg:w-80 flex-shrink-0">
        <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-secondary)' }}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>Your Notes</h2>
            <button className="ts-accent-btn px-2 py-1 rounded-md text-xs" onClick={addNewNote}>New</button>
          </div>
          <ul className="space-y-1">
            {notes.map(n => (
              <li key={n.id}>
                <button
                  className="w-full text-left px-2 py-1 rounded-md"
                  style={{ backgroundColor: activeId === n.id ? 'color-mix(in oklab, var(--theme-accent-primary) 12%, transparent)' : 'transparent', color: 'var(--theme-text-secondary)' }}
                  onClick={() => setActiveId(n.id)}
                >
                  {n.id} <span className="ml-2 text-[11px]" style={{ color: 'var(--theme-text-secondary)' }}>{new Date(n.updatedAt).toLocaleString()}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border-secondary)' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--theme-text-secondary)' }}>Editing: {activeId}</span>
          </div>
          <textarea
            className="w-full min-h-[220px] rounded-md p-3"
            style={{ backgroundColor: 'var(--theme-bg-primary)', color: 'var(--theme-text-primary)', border: '1px solid var(--theme-border-primary)' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your note..."
          />
          <div className="flex items-center justify-end gap-2">
            <button className="px-3 py-2 rounded-md" style={{ border: '1px solid var(--theme-border-secondary)', color: 'var(--theme-text-secondary)' }} onClick={() => setText("")}>Clear</button>
            <button className="ts-accent-btn px-3 py-2 rounded-md">Save</button>
          </div>
        </div>
      </main>
    </div>
  );
}
