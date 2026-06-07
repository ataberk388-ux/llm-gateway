import { describe, it, expect } from 'vitest';
import { TcIdDetector, PhoneDetector, EmailDetector } from '../detectors/turkish-pii';
import { IbanDetector, CreditCardDetector } from '../detectors/financial';
import { KeywordDetector } from '../detectors/keyword';

// --- TC Kimlik No ---
describe('TcIdDetector', () => {
  const detector = new TcIdDetector(true);

  it('geçerli TC No tespit eder', () => {
    // 12345678950: d10 = (7*(1+3+5+7+9) - (2+4+6+8)) % 10 = 155%10 = 5 ✓, d11 = 50%10 = 0 ✓
    const results = detector.detect('TC No: 12345678950 işlem yapıldı');
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe('12345678950');
    expect(results[0].entityType).toBe('TC_ID');
  });

  it('geçersiz checksum olan 11 haneyi redder', () => {
    // 12345678900: d[9]=0 ≠ 5 (beklenen), checksum hatası
    const results = detector.detect('Numara: 12345678900');
    expect(results).toHaveLength(0);
  });

  it('0 ile başlayan numarayı redder', () => {
    const results = detector.detect('Numara: 01234567890');
    expect(results).toHaveLength(0);
  });

  it('10 haneli numarayı redder', () => {
    const results = detector.detect('Numara: 1234567890');
    expect(results).toHaveLength(0);
  });

  it('12 haneli numarayı (bitişik) yok sayar', () => {
    // 12 haneli — (?<!\d) ve (?!\d) sayesinde eşleşmemeli
    const results = detector.detect('123456789060');
    expect(results).toHaveLength(0);
  });
});

// --- IBAN ---
describe('IbanDetector', () => {
  const detector = new IbanDetector(true);

  it('geçerli TR IBAN tespit eder', () => {
    const results = detector.detect('IBAN: TR330006100519786457841326');
    expect(results).toHaveLength(1);
    expect(results[0].entityType).toBe('IBAN');
  });

  it('boşluklu IBAN formatını da yakalar', () => {
    const results = detector.detect('TR33 0006 1005 1978 6457 8413 26');
    expect(results).toHaveLength(1);
  });

  it('yanlış checksum olan IBAN\'ı redder', () => {
    const results = detector.detect('TR330006100519786457841300');
    expect(results).toHaveLength(0);
  });

  it('TR dışı IBAN\'ı yok sayar', () => {
    const results = detector.detect('DE89370400440532013000');
    expect(results).toHaveLength(0);
  });
});

// --- Kredi Kartı (Luhn) ---
describe('CreditCardDetector', () => {
  const detector = new CreditCardDetector(true);

  it('geçerli Visa kartı tespit eder', () => {
    // Luhn geçerli test kartı
    const results = detector.detect('Kart: 4532015112830366');
    expect(results).toHaveLength(1);
    expect(results[0].entityType).toBe('CREDIT_CARD');
  });

  it('Luhn hatası olan numarayı redder', () => {
    const results = detector.detect('4532015112830367');
    expect(results).toHaveLength(0);
  });

  it('tire ile ayrılmış kart numarasını yakalar', () => {
    const results = detector.detect('4532-0151-1283-0366');
    expect(results).toHaveLength(1);
  });
});

// --- Email ---
describe('EmailDetector', () => {
  const detector = new EmailDetector(true);

  it('standart email adresi tespit eder', () => {
    const results = detector.detect('İletişim: test@example.com adresine yazın');
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe('test@example.com');
  });

  it('birden fazla email tespit eder', () => {
    const results = detector.detect('a@b.com ve c@d.org');
    expect(results).toHaveLength(2);
  });
});

// --- Telefon ---
describe('PhoneDetector', () => {
  const detector = new PhoneDetector(true);

  it('+90 ile başlayan mobil numarayı tespit eder', () => {
    const results = detector.detect('Tel: +90 532 123 45 67');
    expect(results).toHaveLength(1);
    expect(results[0].entityType).toBe('PHONE');
  });

  it('0 ile başlayan format tespit eder', () => {
    const results = detector.detect('Arayın: 0532 123 4567');
    expect(results).toHaveLength(1);
  });
});

// --- Keyword ---
describe('KeywordDetector', () => {
  it('büyük/küçük harf duyarsız eşleşme yapar', () => {
    const detector = new KeywordDetector(true, ['AcmeCorp', 'Gizli'], false);
    const results = detector.detect('Bu acmecorp projesi gizli kalmalı');
    expect(results).toHaveLength(2);
  });

  it('büyük/küçük harf duyarlı eşleşme yapar', () => {
    const detector = new KeywordDetector(true, ['AcmeCorp'], true);
    const results = detector.detect('acmecorp bulunamaz ama AcmeCorp bulunur');
    expect(results).toHaveLength(1);
    expect(results[0].value).toBe('AcmeCorp');
  });

  it('boş blocklist ile hiçbir şey eşleştirmez', () => {
    const detector = new KeywordDetector(true, [], false);
    const results = detector.detect('herhangi bir metin');
    expect(results).toHaveLength(0);
  });
});
