const NOTES_CHANNEL = "ts-floating-notes";
const STORAGE_KEY_PREFIX = "ts:note:";

function storageKey(id: string) {
  return `${STORAGE_KEY_PREFIX}${id}`;
}

export function openPopupNote(noteId = "quick") {
  if (typeof window === "undefined") return;
  const w = window.open(
    "",
    `ts-note-${noteId}`,
    "width=420,height=320,menubar=no,toolbar=no,location=no,status=no"
  );
  if (!w) {
    alert("Popup blocked. Allow popups for floating notes.");
    return;
  }

  const doc = w.document;
  doc.write("<!doctype html><title>TradeScout Note</title>");
  const style = doc.createElement("style");
  style.textContent =
    "body{margin:0;background:#0b0f1a;font-family:Inter,system-ui,sans-serif}" +
    ".wrap{display:flex;flex-direction:column;gap:8px;padding:12px;height:100vh;box-sizing:border-box}" +
    "h1{color:#ffb26b;font-weight:600;font-size:13px;margin:0}" +
    "textarea{flex:1;width:100%;resize:none;border-radius:12px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;padding:12px;font-size:13px;outline:none}" +
    ".footer{display:flex;gap:8px;justify-content:space-between;align-items:center}" +
    ".status{color:#94a3b8;font-size:12px}" +
    "button{border:none;border-radius:999px;padding:8px 12px;background:#334155;color:#e2e8f0;font-size:12px;cursor:pointer}";
  doc.head.append(style);

  const wrap = doc.createElement("div");
  wrap.className = "wrap";
  const h1 = doc.createElement("h1");
  h1.textContent = "TradeScout Note";
  const ta = doc.createElement("textarea");
  ta.placeholder = "Type your note…";
  const footer = doc.createElement("div");
  footer.className = "footer";
  const status = doc.createElement("span");
  status.className = "status";
  status.textContent = "Saved";
  const closeBtn = doc.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.onclick = () => w.close();
  footer.append(status, closeBtn);
  wrap.append(h1, ta, footer);
  doc.body.append(wrap);

  const key = storageKey(noteId);
  try {
    const raw = localStorage.getItem(key) ?? "";
    try {
      const parsed = JSON.parse(raw);
      ta.value = typeof parsed?.text === "string" ? parsed.text : raw;
    } catch {
      ta.value = raw;
    }
  } catch {
    ta.value = "";
  }

  const channel = new BroadcastChannel(NOTES_CHANNEL);

  ta.addEventListener("input", () => {
    const payload = JSON.stringify({ text: ta.value, updatedAt: Date.now() });
    try {
      localStorage.setItem(key, payload);
    } catch {
      // ignore storage errors
    }
    status.textContent = "Saved";
    channel.postMessage({ type: "update", id: noteId, text: ta.value });
  });

  channel.addEventListener("message", (ev) => {
    const d = (ev as MessageEvent).data || {};
    if (d.type === "update" && d.id === noteId && doc.activeElement !== ta) {
      ta.value = d.text || "";
      status.textContent = "Synced";
    }
  });

  w.addEventListener("beforeunload", () => channel.close());
}

export async function openFloatingNote(noteId = "quick") {
  if (typeof window === "undefined") return;
  const pipApi = (window as any).documentPictureInPicture;
  const supports = pipApi && typeof pipApi.requestWindow === "function";
  if (!supports) return openPopupNote(noteId);

  let pipWin: Window | null = null;
  try {
    pipWin = await pipApi.requestWindow({ width: 420, height: 320 });
  } catch {
    return openPopupNote(noteId);
  }
  if (!pipWin) return openPopupNote(noteId);

  const doc = pipWin.document;
  doc.body.style.margin = "0";
  doc.body.style.background = "#0b0f1a";
  doc.body.style.fontFamily = "Inter, system-ui, sans-serif";

  const container = doc.createElement("div");
  container.style.cssText = [
    "display:flex",
    "flex-direction:column",
    "gap:8px",
    "padding:12px",
    "width:100%",
    "height:100%",
    "box-sizing:border-box",
  ].join(";");

  const header = doc.createElement("div");
  header.textContent = "TradeScout Note";
  header.style.cssText = "color:#ffb26b;font-weight:600;font-size:13px";

  const textarea = doc.createElement("textarea");
  textarea.placeholder = "Type your note…";
  textarea.style.cssText = [
    "flex:1",
    "width:100%",
    "resize:none",
    "border-radius:12px",
    "border:1px solid #334155",
    "background:#0f172a",
    "color:#e2e8f0",
    "padding:12px",
    "font-size:13px",
    "outline:none",
  ].join(";");

  const footer = doc.createElement("div");
  footer.style.cssText = "display:flex;gap:8px;justify-content:space-between;align-items:center";
  const status = doc.createElement("span");
  status.style.cssText = "color:#94a3b8;font-size:12px";
  status.textContent = "Saved";

  const closeBtn = doc.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.cssText = [
    "border:none",
    "border-radius:999px",
    "padding:8px 12px",
    "background:#334155",
    "color:#e2e8f0",
    "font-size:12px",
    "cursor:pointer",
  ].join(";");
  closeBtn.addEventListener("click", () => pipWin?.close());

  footer.append(status, closeBtn);
  container.append(header, textarea, footer);
  doc.body.append(container);

  try {
    const raw = localStorage.getItem(storageKey(noteId)) ?? "";
    try {
      const parsed = JSON.parse(raw);
      textarea.value = typeof parsed?.text === "string" ? parsed.text : raw;
    } catch {
      textarea.value = raw;
    }
  } catch {
    textarea.value = "";
  }

  const channel = new BroadcastChannel(NOTES_CHANNEL);
  const postUpdate = (text: string) => channel.postMessage({ type: "update", id: noteId, text });

  const save = (text: string) => {
    const payload = JSON.stringify({ text, updatedAt: Date.now() });
    try {
      localStorage.setItem(storageKey(noteId), payload);
    } catch {
      // ignore
    }
    status.textContent = "Saved";
    postUpdate(text);
  };

  textarea.addEventListener("input", () => {
    status.textContent = "Saving…";
    save(textarea.value);
  });

  channel.addEventListener("message", (ev) => {
    const data = (ev as MessageEvent).data || {};
    if (data.type === "update" && data.id === noteId) {
      if (doc.activeElement !== textarea) {
        textarea.value = data.text || "";
        status.textContent = "Synced";
      }
    }
  });

  pipWin.addEventListener("pagehide", () => channel.close());
}
