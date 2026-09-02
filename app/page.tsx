"use client";

import { useCallback, useEffect, useState } from "react";
import Phone from "./Phone";
import EquityChart, { EquityPoint } from "./EquityChart";

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
    <div className="login">
      <div className="login-brand">
        <div className="big">🐕</div>
        <h1>TradeDog</h1>
        <p className="tag">Datadog watches your servers. TradeDog watches your trading agents.</p>
        <div className="login-feat"><span className="ico">👁️</span> Vigila tu bot cada 60 segundos, 24/7</div>
        <div className="login-feat"><span className="ico">🔧</span> Arregla órdenes atascadas y apaga bots rogue</div>
        <div className="login-feat"><span className="ico">🛡️</span> Asegura tus posiciones con collars de opciones</div>
        <div className="login-feat"><span className="ico">💬</span> Te habla por WhatsApp en cristiano</div>
      </div>
      <div className="login-form">
        <div className="connect-card">
          <h2>Conecta tu cuenta de Alpaca</h2>
          <p className="sub">Paper trading · el guardián se activa al instante</p>
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
    </div>
  );
}

const RANGES = [
  { label: "1H", hours: 1 },
  { label: "6H", hours: 6 },
  { label: "24H", hours: 24 },
];

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [equity, setEquity] = useState<EquityPoint[]>([]);
  const [hours, setHours] = useState(6);
  const [filter, setFilter] = useState("");
  const [apiUp, setApiUp] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [sr, lr, er] = await Promise.all([
        fetch(`${API}/api/v1/status`),
        fetch(`${API}/api/v1/ledger?n=60`),
        fetch(`${API}/api/v1/equity-history?hours=${hours}`),
      ]);
      if (!sr.ok) throw new Error(`status ${sr.status}`);
      setStatus(await sr.json());
      if (lr.ok) setLedger(((await lr.json()).entries ?? []).reverse());
      if (er.ok) setEquity((await er.json()).points ?? []);
      setApiUp(true);
    } catch {
      setApiUp(false);
    }
  }, [hours]);

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
  const shownLedger = filter
    ? ledger.filter((e) => JSON.stringify(e).toLowerCase().includes(filter.toLowerCase()))
    : ledger;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">🐕</div>
        <button className="side-item active" title="Overview">📊</button>
        <button className="side-item" title="Ledger" onClick={() => document.getElementById("ledger")?.scrollIntoView({ behavior: "smooth" })}>📜</button>
        <button className="side-item" title="Posiciones" onClick={() => document.getElementById("positions")?.scrollIntoView({ behavior: "smooth" })}>💼</button>
        <div className="spacer" />
        <button className="side-item" title="Desconectar" onClick={() => { localStorage.removeItem("tradedog_connected"); setConnected(false); }}>⏻</button>
      </aside>

      <div className="main">
        <div className="topbar">
          <span className="crumb"><b>TradeDog</b> / Overview</span>
          <input
            className="search"
            placeholder="Filtrar eventos del ledger…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <span className={`badge ${apiUp ? "" : "off"}`}>
            {apiUp ? "● Guardián activo" : "● API sin conexión"}
          </span>
        </div>

        <div className="content">
          <div className="grid">
            <div className="card">
              <div className="label">Equity</div>
              <div className="value">{usd(status?.equity)}</div>
              <div className="sub">cuenta paper vigilada</div>
            </div>
            <div className="card">
              <div className="label">P&L hoy</div>
              <div className={`value ${pnlClass}`}>{usd(status?.pnl_today)}</div>
              <div className="sub">vs cierre anterior</div>
            </div>
            <div className="card">
              <div className="label">Buying power</div>
              <div className="value">{usd(status?.buying_power)}</div>
              <div className="sub">disponible</div>
            </div>
            <div className="card">
              <div className="label">Risk gates</div>
              <div className="value" style={{ fontSize: 14, lineHeight: 1.7 }}>
                max loss/día: ${status?.gates?.max_daily_loss_usd ?? "—"}
                <br />
                burst: {status?.gates?.order_burst_limit ?? "—"} órdenes/5min
              </div>
            </div>
          </div>

          <div className="widget">
            <div className="widget-head">
              <h2>Equity</h2>
              <span className="hint">un snapshot por tick del guardián</span>
              <div className="range">
                {RANGES.map((r) => (
                  <button key={r.label} className={hours === r.hours ? "on" : ""} onClick={() => setHours(r.hours)}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="widget-body">
              <EquityChart points={equity} />
            </div>
          </div>

          <div className="widget" id="positions">
            <div className="widget-head">
              <h2>Posiciones vigiladas</h2>
              <span className="hint">{status?.positions?.length ?? 0} abiertas</span>
            </div>
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
                    <td>{p.is_option ? "🛡️ opción" : "acción / crypto"}</td>
                  </tr>
                ))}
                {!status?.positions?.length && (
                  <tr>
                    <td colSpan={5} style={{ color: "var(--muted)" }}>Sin posiciones abiertas</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="widget" id="ledger">
            <div className="widget-head">
              <h2>Ledger — cada decisión, auditada</h2>
              <span className="hint">{shownLedger.length} eventos</span>
            </div>
            <div className="feed">
              {shownLedger.map((e, i) => (
                <div className="feed-item" key={i}>
                  <span className="ts">{new Date(e.ts).toLocaleTimeString()}</span>
                  <span className={`kind ${e.kind}`}>{e.kind}</span>
                  <span>
                    {String(
                      (e.payload as { summary?: string; text?: string; detail?: string; reply?: string }).summary ??
                        (e.payload as { text?: string }).text ??
                        (e.payload as { detail?: string }).detail ??
                        (e.payload as { reply?: string }).reply ??
                        JSON.stringify(e.payload).slice(0, 160)
                    )}
                  </span>
                </div>
              ))}
              {!shownLedger.length && (
                <div className="feed-item">
                  <span style={{ color: "var(--muted)" }}>Sin actividad todavía — el perro está oliendo el terreno 🐕</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Phone ledger={ledger} />
    </div>
  );
}
