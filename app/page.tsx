"use client";

import { useCallback, useEffect, useState } from "react";
import Phone from "./Phone";

const API = process.env.NEXT_PUBLIC_API_URL;

type Position = {
  symbol: string;
  qty: string;
  market_value: number;
  unrealized_pl: number;
  is_option: boolean;
};

type Status = {
  guardian: string;
  equity: number;
  pnl_today: number;
  buying_power: number;
  positions: Position[];
  gates: Record<string, number>;
};

type LedgerEntry = { ts: string; kind: string; payload: Record<string, unknown> };

function usd(n: number | undefined | null) {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function ConnectScreen({ onConnected }: { onConnected: () => void }) {
  const [key, setKey] = useState("");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`${API}/api/v1/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alpaca_api_key: key, alpaca_secret_key: secret }),
      });
      if (!r.ok) throw new Error((await r.json()).detail ?? "connection failed");
      localStorage.setItem("tradedog_connected", "1");
      onConnected();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="card connect-card">
        <h2>🐕 Conecta tu cuenta de Alpaca (paper)</h2>
        <p className="sub">TradeDog vigilará tu bot 24/7</p>
        <div className="perm">✅ Leer posiciones y órdenes</div>
        <div className="perm">✅ Ejecutar protecciones (collars, cancelaciones)</div>
        <div className="perm">❌ Nunca retira fondos</div>
        <br />
        {error && <div className="error">{error}</div>}
        <input placeholder="API Key" value={key} onChange={(e) => setKey(e.target.value)} />
        <input
          placeholder="API Secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
        <button onClick={connect} disabled={busy || !key || !secret}>
          {busy ? "Conectando..." : "Conectar guardián"}
        </button>
        <p className="note">ℹ️ Production roadmap: OAuth via Alpaca Connect (scoped, revocable)</p>
      </div>
    </div>
  );
}

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [apiUp, setApiUp] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [sr, lr] = await Promise.all([
        fetch(`${API}/api/v1/status`),
        fetch(`${API}/api/v1/ledger?n=30`),
      ]);
      if (!sr.ok) throw new Error(`status ${sr.status}`);
      const s = await sr.json();
      setStatus(s);
      if (lr.ok) {
        const l = await lr.json();
        setLedger((l.entries ?? []).reverse());
      }
      setApiUp(true);
    } catch {
      setApiUp(false);
    }
  }, []);

  useEffect(() => {
    setConnected(!!localStorage.getItem("tradedog_connected"));
  }, []);

  useEffect(() => {
    if (!connected) return;
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [connected, refresh]);

  if (!connected) return <ConnectScreen onConnected={() => setConnected(true)} />;

  const pnlClass = (status?.pnl_today ?? 0) >= 0 ? "green" : "red";

  return (
    <div className="container">
      <div className="header">
        <h1>🐕 TradeDog</h1>
        <span className="tagline">Datadog watches your servers. TradeDog watches your trading agents.</span>
        <span className={`badge ${apiUp ? "" : "off"}`}>
          {apiUp ? "● Guardián activo" : "● API sin conexión"}
        </span>
      </div>

      <div className="grid">
        <div className="card">
          <div className="label">Equity</div>
          <div className="value">{status ? usd(status.equity) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">P&L hoy</div>
          <div className={`value ${pnlClass}`}>{status ? usd(status.pnl_today) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">Buying power</div>
          <div className="value">{status ? usd(status.buying_power) : "—"}</div>
        </div>
        <div className="card">
          <div className="label">Gates</div>
          <div className="value" style={{ fontSize: 14, lineHeight: 1.7 }}>
            max loss/día: ${status?.gates?.max_daily_loss_usd ?? "—"}
            <br />
            burst: {status?.gates?.order_burst_limit ?? "—"} órdenes/5min
          </div>
        </div>
      </div>

      <div className="section">
        <h2>Posiciones vigiladas</h2>
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Símbolo</th>
                <th>Qty</th>
                <th>Valor</th>
                <th>P&L no realizado</th>
                <th>Tipo</th>
              </tr>
            </thead>
            <tbody>
              {(status?.positions ?? []).map((p) => (
                <tr key={p.symbol}>
                  <td>{p.symbol}</td>
                  <td>{p.qty}</td>
                  <td>{usd(p.market_value)}</td>
                  <td style={{ color: p.unrealized_pl >= 0 ? "var(--green)" : "var(--red)" }}>
                    {usd(p.unrealized_pl)}
                  </td>
                  <td>{p.is_option ? "🛡️ opción" : "acción"}</td>
                </tr>
              ))}
              {!status?.positions?.length && (
                <tr>
                  <td colSpan={5} style={{ color: "var(--muted)" }}>
                    Sin posiciones abiertas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="section">
        <h2>Ledger — cada decisión, auditada</h2>
        <div className="feed">
          {ledger.map((e, i) => (
            <div className="feed-item" key={i}>
              <span className="ts">{new Date(e.ts).toLocaleTimeString()}</span>
              <span className={`kind ${e.kind}`}>{e.kind}</span>
              <span>
                {String(
                  (e.payload as { summary?: string; text?: string; detail?: string }).summary ??
                    (e.payload as { text?: string }).text ??
                    (e.payload as { detail?: string }).detail ??
                    JSON.stringify(e.payload).slice(0, 140)
                )}
              </span>
            </div>
          ))}
          {!ledger.length && (
            <div className="feed-item">
              <span style={{ color: "var(--muted)" }}>Sin actividad todavía — el perro está oliendo el terreno 🐕</span>
            </div>
          )}
        </div>
      </div>

      <Phone ledger={ledger} />
    </div>
  );
}
