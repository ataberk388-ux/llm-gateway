# LLM Gateway

Privacy-preserving reverse proxy for cloud LLMs. Masks PII, financial, and medical data on-premise before sending to Claude / GPT-4, then restores values in the response.

```
Client → [mask PII] → Cloud LLM → [restore values] → Client
```

Sensitive data never leaves your infrastructure.

---

## Features

- Detects Turkish ID, IBAN, credit cards, email, phone, ICD-10, medications, custom keywords
- Real-time SSE streaming with token restoration
- Privacy risk scoring (LOW → CRITICAL) per request
- Bidirectional masking — catches new PII hallucinated by the LLM
- Admin stats & compliance report endpoints
- Webhook alerts (Slack / PagerDuty) on CRITICAL risk
- Redis support for distributed deployments
- TypeScript client SDK (`packages/gateway-client`)

---

## Setup

```bash
git clone <repo-url> && cd llm-gateway
npm install
cp .env.example .env   # add your API keys
npm run dev
```

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

---

## Usage

```bash
curl -X POST http://localhost:3000/v1/chat \
  -H "X-Gateway-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"My ID is 12345678950"}]}'
```

Response headers: `X-Privacy-Risk-Score`, `X-Privacy-Risk-Level`, `X-New-Pii-In-Response`

Admin: `GET /admin/stats` · `GET /admin/compliance-report` (requires `X-Admin-Key`)

---

## Stack

Node.js 22 · TypeScript · Fastify 5 · Anthropic SDK · OpenAI SDK · Vitest · Docker

## License

MIT
