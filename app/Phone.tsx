"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type LedgerEntry = { ts: string; kind: string; payload: Record<string, unknown> };
type Bubble = { side: "dog" | "me"; text: string; ts: number };

const COMMANDS = [
  { cmd: "/status", desc: "Equity, P&L and positions right now" },
  { cmd: "/protect", desc: "Collar your biggest unprotected position" },
  { cmd: "/report", desc: "Full daily report" },
  { cmd: "/kill", desc: "Emergency stop — cancel everything" },
  { cmd: "/help", desc: "List commands" },
];

const HELP_TEXT =
  "🐕 I understand these commands:\n" +
  COMMANDS.map(c => `${c.cmd} — ${c.desc}`).join("\n") +
  "\n\nAnything else you type, I'll just answer as your guardian.";

export default function Phone({ ledger }: { ledger: LedgerEntry[] }) {
  const [open, setOpen] = useState(true);
  const [sent, setSent] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  function onDragStart(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest(".wa-close")) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStart.current = { px: e.clientX, py: e.clientY, x: rect.left, y: rect.top };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // synthetic events / odd browsers: drag still works without capture
    }
    setDragging(true);
  }

  function onDragMove(e: React.PointerEvent) {
    const s = dragStart.current;
    if (!s) return;
    const w = wrapRef.current?.offsetWidth ?? 340;
    const h = wrapRef.current?.offsetHeight ?? 660;
    setPos({
      x: Math.min(Math.max(s.x + e.clientX - s.px, 8 - w * 0.5), window.innerWidth - w * 0.5),
      y: Math.min(Math.max(s.y + e.clientY - s.py, 0), window.innerHeight - h * 0.25),
    });
  }

  function onDragEnd() {
    dragStart.current = null;
    setDragging(false);
  }

  const incoming: Bubble[] = ledger
    .filter((e) => e.kind === "alert" || e.kind === "report")
    .map((e) => ({
      side: "dog" as const,
      text: String((e.payload as { text?: string }).text ?? ""),
      ts: new Date(e.ts).getTime(),
    }))
    .filter((b) => b.text);

  // merge + dedupe (optimistic replies also land in the ledger later)
  const seen = new Set<string>();
  const bubbles = [...incoming, ...sent]
    .sort((a, b) => a.ts - b.ts)
    .filter((b) => {
      const key = b.side + "|" + b.text;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-30);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [bubbles.length]);

  function pushMe(text: string) {
    setSent((s) => [...s, { side: "me", text, ts: Date.now() }]);
  }
  function pushDog(text: string) {
    setSent((s) => [...s, { side: "dog", text, ts: Date.now() }]);
  }

  async function callApi(path: string, body: unknown): Promise<string> {
    const r = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    return String(data.reply ?? data.detail ?? "…");
  }

  async function send() {
    const q = draft.trim();
    if (!q || typing) return;
    setDraft("");
    pushMe(q);

    // slash commands — like a real WhatsApp/Telegram bot
    if (q.startsWith("/")) {
      const [cmd, ...rest] = q.toLowerCase().split(/\s+/);
      if (cmd === "/help") return pushDog(HELP_TEXT);
      if (cmd === "/kill" && rest[0] !== "confirm") {
        return pushDog(
          "⚠️ /kill cancels every order and closes ALL positions. This is the emergency stop.\n\nIf you're sure, type: /kill confirm",
        );
      }
      const map: Record<string, string> = {
        "/status": "status",
        "/protect": "protect",
        "/report": "report",
        "/kill": "kill",
      };
      const command = map[cmd];
      if (!command) return pushDog(`🐕 I don't know ${cmd}. Type /help to see what I can do.`);
      setTyping(true);
      try {
        pushDog(await callApi("/api/v1/command", { command }));
      } catch {
        pushDog("⚠️ Couldn't run that — check the connection.");
      } finally {
        setTyping(false);
      }
      return;
    }

    // free-form chat
    setTyping(true);
    try {
      pushDog(await callApi("/api/v1/chat", { message: q }));
    } catch {
      pushDog("⚠️ Didn't catch that — check the connection.");
    } finally {
      setTyping(false);
    }
  }

  const showMenu = draft.startsWith("/") && !draft.includes(" ");
  const menuItems = COMMANDS.filter((c) => c.cmd.startsWith(draft.toLowerCase()));

  if (!open) {
    return (
      <button className="phone-fab" onClick={() => setOpen(true)} title="Open WhatsApp">
        💬
      </button>
    );
  }

  return (
    <div
      className="phone-wrap"
      ref={wrapRef}
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
    >
      <div className="phone">
        <div className="phone-notch" />
        <div
          className={`wa-header ${dragging ? "dragging" : ""}`}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <button className="wa-close" onClick={() => setOpen(false)}>×</button>
          <span className="wa-avatar">🐕</span>
          <div>
            <div className="wa-name">TradeDog</div>
            <div className="wa-status">online · watching</div>
          </div>
        </div>
        <div className="wa-chat" ref={chatRef}>
          {bubbles.length === 0 && (
            <div className="wa-day">The dog will text you when something happens 🐕 · type /help</div>
          )}
          {bubbles.map((b, i) => (
            <div key={i} className={`wa-bubble ${b.side === "me" ? "me" : "dog"}`}>
              {b.text}
              <span className="wa-time">
                {new Date(b.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
          {typing && <div className="wa-bubble dog wa-typing">🐕 typing…</div>}
        </div>
        <div className="wa-inputwrap">
          {showMenu && menuItems.length > 0 && (
            <div className="wa-cmdmenu">
              {menuItems.map((c) => (
                <button key={c.cmd} className="wa-cmditem" onClick={() => setDraft(c.cmd + " ")}>
                  <span className="wa-cmd">{c.cmd}</span>
                  <span className="wa-cmddesc">{c.desc}</span>
                </button>
              ))}
            </div>
          )}
          <div className="wa-inputbar">
            <input
              className="wa-input"
              placeholder="Message · /help for commands"
              value={draft}
              maxLength={500}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button className="wa-send" onClick={send} disabled={typing || !draft.trim()}>
              ➤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
