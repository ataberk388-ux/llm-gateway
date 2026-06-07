import { describe, it, expect, beforeEach } from 'vitest';
import { MaskingEngine } from '../engine';
import { Tokenizer } from '../tokenizer';
import { SessionStore } from '../../session/store';
import { EmailDetector } from '../detectors/turkish-pii';
import { IbanDetector } from '../detectors/financial';
import { KeywordDetector } from '../detectors/keyword';

function buildEngine(detectors: import('../types').IDetector[]) {
  const store = new SessionStore(300);
  const tokenizer = new Tokenizer(store);
  return { engine: new MaskingEngine(detectors, tokenizer, store), store };
}

describe('MaskingEngine.mask', () => {
  it('email adresini maskeler ve geri yazar', () => {
    const { engine } = buildEngine([new EmailDetector(true)]);
    const { maskedText } = engine.mask('Bana test@example.com adresinden yaz', 'sess-1');
    expect(maskedText).toBe('Bana [EMAIL_1] adresinden yaz');
    const restored = engine.restore(maskedText, 'sess-1');
    expect(restored).toBe('Bana test@example.com adresinden yaz');
  });

  it('aynı değer için aynı token üretir', () => {
    const { engine } = buildEngine([new EmailDetector(true)]);
    const r1 = engine.mask('test@x.com burada', 'sess-2');
    const r2 = engine.mask('test@x.com orada', 'sess-2');
    expect(r1.maskedText).toContain('[EMAIL_1]');
    expect(r2.maskedText).toContain('[EMAIL_1]');
  });

  it('farklı değerler için artan token numarası üretir', () => {
    const { engine } = buildEngine([new EmailDetector(true)]);
    const { maskedText } = engine.mask('a@b.com ve c@d.com', 'sess-3');
    expect(maskedText).toContain('[EMAIL_1]');
    expect(maskedText).toContain('[EMAIL_2]');
  });

  it('çakışan span\'leri tekilleştirir (uzun olan kazanır)', () => {
    const { engine } = buildEngine([
      new IbanDetector(true),
      new KeywordDetector(true, ['TR33'], false),
    ]);
    // IBAN TR33..., keyword detector TR33 ile çakışır
    // IBAN daha uzun olduğu için kazanmalı
    const { maskedText } = engine.mask('IBAN: TR330006100519786457841326', 'sess-4');
    expect(maskedText).not.toContain('[KEYWORD_1]');
    expect(maskedText).toContain('[IBAN_1]');
  });

  it('entityCounts doğru sayar', () => {
    const { engine } = buildEngine([new EmailDetector(true)]);
    const { entityCounts } = engine.mask('a@b.com ve c@d.com', 'sess-5');
    expect(entityCounts.EMAIL).toBe(2);
  });
});

describe('MaskingEngine.restore', () => {
  it('bilinmeyen token\'ları olduğu gibi bırakır (halüsinasyon koruması)', () => {
    const { engine } = buildEngine([new EmailDetector(true)]);
    engine.mask('a@b.com', 'sess-6');
    const restored = engine.restore('[EMAIL_1] ve [EMAIL_9999]', 'sess-6');
    expect(restored).toBe('a@b.com ve [EMAIL_9999]');
  });

  it('session bulunamazsa metni değiştirmez', () => {
    const { engine } = buildEngine([]);
    const text = '[PERSON_1] adına işlem';
    expect(engine.restore(text, 'nonexistent-session')).toBe(text);
  });
});

describe('MaskingEngine.maskMessages', () => {
  it('tüm mesaj içeriklerini maskeler', () => {
    const { engine } = buildEngine([new EmailDetector(true)]);
    const messages = [
      { role: 'user', content: 'Bana a@b.com yaz' },
      { role: 'assistant', content: 'c@d.com adresine yazdım' },
    ];
    const { maskedMessages, aggregatedCounts } = engine.maskMessages(messages, 'sess-7');
    expect(maskedMessages[0].content).toContain('[EMAIL_1]');
    expect(maskedMessages[1].content).toContain('[EMAIL_2]');
    expect(aggregatedCounts.EMAIL).toBe(2);
  });
});
