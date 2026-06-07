/**
 * LLM Gateway TypeScript Client SDK
 * Drop-in alternative to direct Anthropic/OpenAI SDK usage.
 * All privacy masking happens transparently on the gateway.
 */

export interface GatewayClientOptions {
  /** Base URL of the LLM Gateway, e.g. "http://localhost:3000" */
  baseUrl: string;
  /** X-Gateway-API-Key value */
  apiKey: string;
  /** Request timeout in ms (default: 120 000) */
  timeoutMs?: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CreateMessageParams {
  model: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  conversationId?: string;
}

export interface MessageResponse {
  content: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  finishReason: string;
  /** Privacy risk score 0–100 */
  privacyRiskScore: number;
  /** LOW | MEDIUM | HIGH | CRITICAL */
  privacyRiskLevel: string;
  /** Count of new PII entities detected in the LLM response */
  newPiiInResponse: number;
}

export class GatewayError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

export class GatewayClient {
  /** Anthropic-SDK-compatible namespace for non-streaming calls. */
  readonly messages: {
    create(params: CreateMessageParams): Promise<MessageResponse>;
    stream(params: CreateMessageParams): AsyncGenerator<string, void, unknown>;
  };

  constructor(private readonly opts: GatewayClientOptions) {
    const self = this;
    this.messages = {
      create(params) {
        return self._create(params);
      },
      stream(params) {
        return self._stream(params);
      },
    };
  }

  private async _create(params: CreateMessageParams): Promise<MessageResponse> {
    const res = await fetch(`${this.opts.baseUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-API-Key': this.opts.apiKey,
      },
      body: JSON.stringify({ ...params, stream: false }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 120_000),
    });

    if (!res.ok) {
      const err = await res
        .json()
        .catch(() => ({ error: res.statusText })) as { error?: string };
      throw new GatewayError(res.status, err.error ?? res.statusText);
    }

    const body = (await res.json()) as Record<string, unknown>;

    return {
      content: body['content'] as string,
      model: body['model'] as string,
      usage: body['usage'] as { inputTokens: number; outputTokens: number },
      finishReason: body['finishReason'] as string,
      privacyRiskScore: Number(res.headers.get('x-privacy-risk-score') ?? 0),
      privacyRiskLevel: res.headers.get('x-privacy-risk-level') ?? 'LOW',
      newPiiInResponse: Number(res.headers.get('x-new-pii-in-response') ?? 0),
    };
  }

  private async *_stream(
    params: CreateMessageParams
  ): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${this.opts.baseUrl}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Gateway-API-Key': this.opts.apiKey,
      },
      body: JSON.stringify({ ...params, stream: true }),
      signal: AbortSignal.timeout(this.opts.timeoutMs ?? 120_000),
    });

    if (!res.ok || !res.body) {
      throw new GatewayError(res.status, res.statusText);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pending = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        pending += decoder.decode(value, { stream: true });
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data) as {
              delta?: string;
              error?: string;
              event?: string;
              safeContent?: string;
            };
            if (parsed.error) throw new GatewayError(500, parsed.error);
            if (parsed.event === 'redact' && parsed.safeContent) {
              // Yield marker so callers can handle redaction if needed
              yield `\x00REDACT:${parsed.safeContent}`;
              return;
            }
            if (parsed.delta) yield parsed.delta;
          } catch (e) {
            if (e instanceof GatewayError) throw e;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
