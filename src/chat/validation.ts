export function normalizePhone(input: string): string {
  if (!/^[\d\s()+-]+$/.test(input.trim())) throw new Error('Введите номер телефона цифрами.');
  let digits = input.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('9')) digits = `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (!/^7\d{10}$|^375\d{9}$/.test(digits)) {
    throw new Error('Укажите номер РФ (+7) или Беларуси (+375) в международном формате.');
  }
  return digits;
}

export function validateMessage(text: string): string {
  if (!text.trim()) throw new Error('Напишите сообщение.');
  if (text.length > 4000) throw new Error('В сообщении может быть не больше 4000 символов.');
  return text;
}

export function resolveApiUrl(credentials: { idInstance: string; apiUrl?: string }): string {
  if (!/^\d{8,20}$/.test(credentials.idInstance)) throw new Error('Проверьте idInstance: нужны только цифры.');
  const base = credentials.apiUrl?.trim() || `https://${credentials.idInstance.slice(0, 4)}.api.green-api.com`;
  let url: URL;
  try { url = new URL(base); } catch { throw new Error('Проверьте адрес apiUrl из кабинета GREEN-API.'); }
  if (url.protocol !== 'https:' || !/^(?:\d{4}\.)?api\.green-api\.com$/.test(url.hostname)
    || url.username || url.password || url.port || url.search || url.hash || !/^\/?(?:v3\/?)?$/.test(url.pathname)) {
    throw new Error('Используйте HTTPS-адрес apiUrl из кабинета GREEN-API.');
  }
  return url.href.replace(/\/$/, '');
}
