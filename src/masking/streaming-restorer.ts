/**
 * Chunk-by-chunk SSE token restoration.
 *
 * Problem: LLM streams text in small pieces. A token like "[EMAIL_1]" can
 * arrive split across chunks: "[EMAIL" then "_1]". We must buffer the
 * potential token start and flush only when we know it's safe to do so.
 *
 * State machine:
 *   NORMAL  → see '[' → BUFFERING
 *   BUFFERING → valid token chars → keep buffering
 *   BUFFERING → ']' after valid pattern → restore token, flush, go NORMAL
 *   BUFFERING → invalid char → flush '[' + buffered, go NORMAL
 */
export class StreamingRestorer {
  private buffer = '';

  constructor(private readonly tokenMap: ReadonlyMap<string, string>) {}

  /** Feed a new chunk; returns immediately-safe restored text. */
  push(chunk: string): string {
    this.buffer += chunk;
    return this.drain();
  }

  /** Call at end of stream to flush any remaining buffered content. */
  finalize(): string {
    const result = this.restoreAll(this.buffer);
    this.buffer = '';
    return result;
  }

  private drain(): string {
    let output = '';

    while (this.buffer.length > 0) {
      const bracketIdx = this.buffer.indexOf('[');

      if (bracketIdx === -1) {
        // No '[' anywhere — safe to flush everything
        output += this.buffer;
        this.buffer = '';
        break;
      }

      // Flush everything that comes before the potential token start
      output += this.buffer.slice(0, bracketIdx);
      this.buffer = this.buffer.slice(bracketIdx);

      // Check for a complete token at the start of the buffer
      const complete = /^\[([A-Z_]+)_(\d+)\]/.exec(this.buffer);
      if (complete) {
        const token = complete[0];
        output += this.tokenMap.get(token) ?? token;
        this.buffer = this.buffer.slice(token.length);
        continue;
      }

      // Check if buffer could still become a valid token (incomplete prefix)
      // Valid prefix: '[' followed only by uppercase letters, underscores, digits (no ']' yet)
      if (/^\[[A-Z0-9_]*$/.test(this.buffer)) {
        break; // wait for more chunks
      }

      // '[' followed by something that can never be a token — flush the '['
      output += '[';
      this.buffer = this.buffer.slice(1);
    }

    return output;
  }

  private restoreAll(text: string): string {
    return text.replace(/\[[A-Z_]+_\d+\]/g, (t) => this.tokenMap.get(t) ?? t);
  }
}
