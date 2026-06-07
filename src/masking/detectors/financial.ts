import { RegexDetector } from './base';
import type { EntityType } from '../types';

function validateTRIban(raw: string): boolean {
  const iban = raw.replace(/\s/g, '').toUpperCase();
  if (!/^TR\d{24}$/.test(iban)) return false;
  // ISO 7064 MOD-97-10: move first 4 chars to end, replace letters with numbers
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) =>
    String(ch.charCodeAt(0) - 55)
  );
  return BigInt(numeric) % 97n === 1n;
}

function validateLuhn(raw: string): boolean {
  const digits = raw.replace(/\D/g, '').split('').map(Number).reverse();
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i];
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export class IbanDetector extends RegexDetector {
  readonly entityType: EntityType = 'IBAN';
  protected readonly patterns = [
    // TR + 2 check digits + (5×4 digits) + 2 digits = TR + 24 digits total
    /\bTR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/gi,
  ];

  protected validate(value: string): boolean {
    return validateTRIban(value);
  }
}

export class CreditCardDetector extends RegexDetector {
  readonly entityType: EntityType = 'CREDIT_CARD';
  protected readonly patterns = [
    /\b4\d{3}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,       // Visa 16
    /\b5[1-5]\d{2}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g,  // Mastercard
    /\b3[47]\d{2}[\s\-]?\d{6}[\s\-]?\d{5}\b/g,                // Amex 15
    /\b6(?:011|5\d{2})[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, // Discover
  ];

  protected validate(value: string): boolean {
    return validateLuhn(value);
  }
}
