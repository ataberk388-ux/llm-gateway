# LLM Gateway

A privacy-preserving reverse proxy that sits between your applications and cloud LLMs (Anthropic Claude, OpenAI). It automatically detects and masks sensitive data before the prompt leaves your infrastructure, then restores the original values in the response — so the LLM never sees raw PII.

```
Your App  →  [Gateway: mask PII]  →  Cloud LLM
                                          ↓
Your App  ←  [Gateway: restore]  ←  Response
```

Designed for KVKK, GDPR, and HIPAA compliance.

---

## Why

Sending prompts directly to Anthropic or OpenAI means customer names, Turkish IDs, IBANs, medical records, and internal keywords leave your servers as plain text. This gateway removes that risk without giving up the quality of frontier models.

---

## What Gets Detected

| Category | Entities |
|----------|----------|
| Turkish PII | TC Kimlik No (with checksum), phone, email, full name |
| Financial | IBAN (TR, MOD-97 validated), credit/debit cards (Luhn) |
| Medical | ICD-10 diagnosis codes, medication names, patient IDs |
| Custom | Company-specific keyword blocklist (configurable) |

Each detected value is replaced with a deterministic session token like `[TC_ID_1]`, `[IBAN_1]`, `[EMAIL_2]`. Same value → same token within a session.

---

## Features

- **Streaming support** — Real-time SSE with chunk-level token restoration
- **Privacy risk scoring** — 0–100 score + LOW / MEDIUM / HIGH / CRITICAL level per request
- **Bidirectional masking** — Scans LLM responses and redacts any new PII the model hallucinated
- **Admin dashboard** — Live request stats and compliance report via REST endpoints
- **Webhook alerts** — Slack / PagerDuty notifications on CRITICAL risk or new PII in response
- **Multi-provider routing** — Block CRITICAL-risk requests or route to cheaper models automatically
- **Redis session store** — Distributed token mappings for multi-instance deployments
- **Rate limiting** — Per client-ID request throttling
- **TypeScript client SDK** — Drop-in replacement for the Anthropic SDK (`packages/gateway-client`)

---

## Quick Start

**Requirements:** Node.js 22+

```bash
git clone https://github.com/ataberk388-ux/llm-gateway.git
cd llm-gateway
npm install
cp .env.example .env
```

Edit `.env` and fill in your API keys, then:

```bash
npm run dev
```

```bash
curl http://localhost:3000/health
# → {"status":"ok"}
```

---

## Sending a Request

```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "Content-Type: application/json" \
  -H "X-Gateway-API-Key: your-key" \
  -d '{
    "messages": [
      { "role": "user", "content": "Customer TC: 12345678950, IBAN: TR330006100519786457841326. Summarize." }
    ]
  }'
```

The LLM receives:
```
Customer TC: [TC_ID_1], IBAN: [IBAN_1]. Summarize.
```

Response headers:
```
X-Privacy-Risk-Score: 75
X-Privacy-Risk-Level: CRITICAL
X-New-Pii-In-Response: 0
```

---

## Admin Endpoints

```bash
# Live stats
curl http://localhost:3000/admin/stats \
  -H "X-Admin-Key: your-admin-key"

# Compliance report (KVKK / GDPR / HIPAA status)
curl http://localhost:3000/admin/compliance-report \
  -H "X-Admin-Key: your-admin-key"
```

---

## Client SDK

```typescript
import { GatewayClient } from '@llm-gateway/client';

const client = new GatewayClient({
  baseUrl: 'http://localhost:3000',
  apiKey: process.env.GW_API_KEY!,
});

const res = await client.messages.create({
  model: 'claude-opus-4-8',
  messages: [{ role: 'user', content: 'Hello' }],
});

console.log(res.content);
console.log(res.privacyRiskLevel); // "LOW"
```

Streaming:

```typescript
for await (const chunk of client.messages.stream({ model: '...', messages: [...] })) {
  process.stdout.write(chunk);
}
```

---

## Configuration

| File | Purpose |
|------|---------|
| `config/gateway.yaml` | Provider, auth keys, rate limits, routing rules, alerts |
| `config/masking.yaml` | Detector toggles, keyword blocklist |

Routing example:

```yaml
routing:
  rejectCritical: true           # Return 451 for CRITICAL-risk requests
  costOptimize: true             # Use cheaper model when no PII detected
  cheapModel: "claude-haiku-4-5-20251001"
```

Alert example:

```yaml
alerts:
  enabled: true
  webhooks:
    - name: "slack"
      url: "${SLACK_WEBHOOK_URL}"
      events: ["CRITICAL_RISK", "NEW_PII_IN_RESPONSE"]
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Anthropic Claude API key |
| `OPENAI_API_KEY` | Yes* | OpenAI API key |
| `GW_API_KEY_1` | **Yes** | Gateway access key (`X-Gateway-API-Key` header) |
| `GW_ADMIN_KEY` | No | Admin endpoint key (empty = open in dev mode) |
| `REDIS_URL` | No | Redis URL for distributed sessions |
| `SLACK_WEBHOOK_URL` | No | Slack webhook for alerts |

*Fill in the one matching your configured provider (`anthropic` or `openai`).

---

## Docker

```bash
docker compose up --build
```

Config files are mounted read-only. Secrets are injected via environment variables — never baked into the image.

---

## Tech Stack

Node.js 22 · TypeScript · Fastify 5 · Anthropic SDK · OpenAI SDK · Redis · Vitest · Docker

---

## License

MIT
