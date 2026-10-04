import { describe, expect, it } from 'vitest';
import { normalizePhone, resolveApiUrl, validateMessage } from './validation';

describe('MAX input validation', () => {
  it('normalizes Russian numbers, including domestic 8', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567');
    expect(normalizePhone('8 999 123 45 67')).toBe('79991234567');
    expect(normalizePhone('9991234567')).toBe('79991234567');
  });
  it('accepts Belarusian international numbers', () => {
    expect(normalizePhone('+375 (29) 123-45-67')).toBe('375291234567');
  });
  it('rejects unsupported or malformed numbers', () => {
    for (const value of ['123', '+1 555 123 4567', 'номер79991234567', '799912345678']) {
      expect(() => normalizePhone(value)).toThrow();
    }
  });
  it('rejects whitespace and limits the original payload to 4000 characters', () => {
    expect(() => validateMessage(' \n ')).toThrow();
    expect(validateMessage('  Привет!\nКак дела?  ')).toBe('  Привет!\nКак дела?  ');
    expect(validateMessage('а'.repeat(4000))).toHaveLength(4000);
    expect(() => validateMessage('а'.repeat(4001))).toThrow();
  });
  it('derives the GREEN-API cluster without arbitrary token destinations', () => {
    expect(resolveApiUrl({ idInstance: '310000001' })).toBe('https://3100.api.green-api.com');
    expect(resolveApiUrl({ idInstance: '350200001', apiUrl: 'https://3502.api.green-api.com/v3/' })).toBe('https://3502.api.green-api.com/v3');
    expect(() => resolveApiUrl({ idInstance: '310000001', apiUrl: 'https://example.com' })).toThrow();
    expect(() => resolveApiUrl({ idInstance: '310000001', apiUrl: 'http://3100.api.green-api.com' })).toThrow();
    expect(() => resolveApiUrl({ idInstance: '310000001', apiUrl: 'https://api.green-api.com@evil.com' })).toThrow();
  });
});
