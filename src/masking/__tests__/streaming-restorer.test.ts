import { describe, it, expect } from 'vitest';
import { StreamingRestorer } from '../streaming-restorer';

function makeRestorer(map: Record<string, string>): StreamingRestorer {
  return new StreamingRestorer(new Map(Object.entries(map)));
}

describe('StreamingRestorer', () => {
  it('tek chunk — tam token geri yazar', () => {
    const r = makeRestorer({ '[EMAIL_1]': 'ali@test.com' });
    expect(r.push('Bana [EMAIL_1] yaz')).toBe('Bana ali@test.com yaz');
    expect(r.finalize()).toBe('');
  });

  it('token iki chunk arasında bölünüyor', () => {
    const r = makeRestorer({ '[EMAIL_1]': 'ali@test.com' });
    // chunk 1: "[EMAI" — hiçbir şey flush edilemez
    expect(r.push('[EMAI')).toBe('');
    // chunk 2: "L_1] sonrası" — token tamamlanır, geri yazar
    expect(r.push('L_1] sonrasi')).toBe('ali@test.com sonrasi');
    expect(r.finalize()).toBe('');
  });

  it('token son anda kapatılıyor — finalize ile flush', () => {
    const r = makeRestorer({ '[IBAN_1]': 'TR33...' });
    expect(r.push('[IBAN_1')).toBe('');
    expect(r.finalize()).toBe('[IBAN_1'); // tamamlanmadı, olduğu gibi bırakılır
  });

  it('birden fazla token aynı chunk\'ta', () => {
    const r = makeRestorer({
      '[EMAIL_1]': 'ali@test.com',
      '[PHONE_1]': '5321234567',
    });
    expect(r.push('[EMAIL_1] ve [PHONE_1]')).toBe('ali@test.com ve 5321234567');
  });

  it('[, token değil — hemen flush eder', () => {
    const r = makeRestorer({ '[EMAIL_1]': 'ali@test.com' });
    // "[abc" — küçük harf, asla token olamaz
    expect(r.push('[abc def')).toBe('[abc def');
  });

  it('bilinmeyen token olduğu gibi bırakılır (halüsinasyon koruması)', () => {
    const r = makeRestorer({ '[EMAIL_1]': 'ali@test.com' });
    expect(r.push('[PERSON_9999] yaptı')).toBe('[PERSON_9999] yaptı');
  });

  it('token tam chunk sınırında kapanıyor', () => {
    const r = makeRestorer({ '[TC_ID_1]': '12345678950' });
    expect(r.push('[TC_ID')).toBe('');
    expect(r.push('_1]')).toBe('12345678950');
    expect(r.finalize()).toBe('');
  });

  it('boş map — metni olduğu gibi geçirir', () => {
    const r = makeRestorer({});
    expect(r.push('normal metin [TOKEN_1]')).toBe('normal metin [TOKEN_1]');
  });

  it('token başlangıcından önce normal metin hemen flush edilir', () => {
    const r = makeRestorer({ '[EMAIL_1]': 'ali@test.com' });
    const out = r.push('Bu bir ');
    expect(out).toBe('Bu bir ');
    const out2 = r.push('[EMAIL_1] adresi');
    expect(out2).toBe('ali@test.com adresi');
  });
});
