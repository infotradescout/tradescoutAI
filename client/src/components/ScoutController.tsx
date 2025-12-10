import React, { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function ScoutController() {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<ChatMessage[]>([]);

  async function handleSend() {
    const trimmed = message.trim();
    if (!trimmed) return;

    const newMessage: ChatMessage = { role: "user", content: trimmed };
    setHistory((h) => [...h, newMessage]);
    setMessage("");

    try {
      const res = await fetch("/api/scout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: trimmed, history }),
      });

      const data = await res.json();
      const assistant: ChatMessage = {
        role: "assistant",
        content: data.message || "No response from Scout.",
      };
      setHistory((h) => [...h, assistant]);
    } catch (err) {
      const assistant: ChatMessage = {
        role: "assistant",
        content:
          "Sorry, I hit an error talking to /api/scout. Please try again in a moment.",
      };
      setHistory((h) => [...h, assistant]);
    }
  }

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-navy-900/60 p-4">
      <div className="mb-4 h-[400px] overflow-y-auto space-y-3">
        {history.map((m, i) => (
          <div
            key={i}
            className={`rounded-lg px-3 py-2 max-w-[80%] text-sm leading-relaxed whitespace-pre-wrap ${
              m.role === "assistant"
                ? "bg-slate-800 text-slate-200"
                : "bg-teal-600 text-white ml-auto"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask anything — local intel, permits, pros, or shortcuts..."
          className="flex-1"
        />
        <Button type="button" onClick={handleSend} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
