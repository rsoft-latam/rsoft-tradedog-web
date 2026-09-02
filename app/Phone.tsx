"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL;

type LedgerEntry = { ts: string; kind: string; payload: Record<string, unknown> };
type Bubble = { side: "dog" | "me"; text: string; ts: number };

const COMMANDS = [
  { icon: "✅", label: "Status", cmd: "status" },
  { icon: "🛡️", label: "Proteger", cmd: "protect" },
  { icon: "📊", label: "Parte", cmd: "report" },
  { icon: "🛑", label: "Apagar", cmd: "kill", confirm: true },
];

export default function Phone({ ledger }: { ledger: LedgerEntry[] }) {
  const [open, setOpen] = useState(true);
  const [sent, setSent] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

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

  async function run(cmd: string, label: string, needsConfirm?: boolean) {
    if (needsConfirm && confirming !== cmd) {
      setConfirming(cmd);
      setTimeout(() => setConfirming(null), 4000);
      return;
    }
    setConfirming(null);
    setBusy(true);
    const now = Date.now();
    setSent((s) => [...s, { side: "me", text: label, ts: now }]);
    try {
      const r = await fetch(`${API}/api/v1/command`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      const data = await r.json();
      const reply = data.reply ?? data.detail ?? "…";
      setSent((s) => [...s, { side: "dog", text: String(reply), ts: Date.now() }]);
    } catch {
      setSent((s) => [...s, { side: "dog", text: "⚠️ No pude ejecutar eso — revisa la conexión.", ts: Date.now() }]);
    } finally {
      setBusy(false);
    }
  }

  async function ask() {
    const q = draft.trim();
    if (!q || typing) return;
    setDraft("");
    setSent((s) => [...s, { side: "me", text: q, ts: Date.now() }]);
    setTyping(true);
    try {
      const r = await fetch(`${API}/api/v1/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = await r.json();
      setSent((s) => [...s, { side: "dog", text: String(data.reply ?? data.detail ?? "…"), ts: Date.now() }]);
    } catch {
      setSent((s) => [...s, { side: "dog", text: "⚠️ No te escuché bien — revisa la conexión.", ts: Date.now() }]);
    } finally {
      setTyping(false);
    }
  }

  if (!open) {
    return (
      <button className="phone-fab" onClick={() => setOpen(true)} title="Abrir WhatsApp">
        💬
      </button>
    );
  }

  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="phone-notch" />
        <div className="wa-header">
          <button className="wa-close" onClick={() => setOpen(false)}>×</button>
          <span className="wa-avatar">🐕</span>
          <div>
            <div className="wa-name">TradeDog</div>
            <div className="wa-status">en línea · vigilando</div>
          </div>
        </div>
        <div className="wa-chat" ref={chatRef}>
          {bubbles.length === 0 && (
            <div className="wa-day">El perro te escribirá cuando pase algo 🐕</div>
          )}
          {bubbles.map((b, i) => (
            <div key={i} className={`wa-bubble ${b.side === "me" ? "me" : "dog"}`}>
              {b.text}
              <span className="wa-time">
                {new Date(b.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
          {typing && <div className="wa-bubble dog wa-typing">🐕 escribiendo…</div>}
        </div>
        <div className="wa-actions">
          {COMMANDS.map((c) => (
            <button
              key={c.cmd}
              className={`wa-action ${confirming === c.cmd ? "danger" : ""}`}
              disabled={busy}
              onClick={() => run(c.cmd, `${c.icon} ${c.label}`, c.confirm)}
            >
              {confirming === c.cmd ? "¿Seguro? 🛑" : `${c.icon} ${c.label}`}
            </button>
          ))}
        </div>
        <div className="wa-inputbar">
          <input
            className="wa-input"
            placeholder="Pregúntale a TradeDog…"
            value={draft}
            maxLength={500}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask()}
          />
          <button className="wa-send" onClick={ask} disabled={typing || !draft.trim()}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
