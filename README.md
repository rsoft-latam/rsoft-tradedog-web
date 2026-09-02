# 🐕 TradeDog Web

Read-only dashboard for [TradeDog](../rsoft-tradedog-api) — the guardian of
trading agents on Alpaca.

- Connect screen (paper API keys; OAuth via Alpaca Connect on the roadmap)
- Live equity / P&L / positions (5s polling — no sockets needed)
- Decision ledger feed: every event, proposal and execution, auditable

## Run

```bash
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

Deploy: Vercel, set `NEXT_PUBLIC_API_URL` to the Lambda URL.
