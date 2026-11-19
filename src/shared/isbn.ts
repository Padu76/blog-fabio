// E:\blog-fabio\src\shared\isbn.ts
// ISBN come stringhe: normalizzazione e checksum ISBN-10/13. Gli EAN non librari (non 978/979) non sono ISBN.

export function normalizeIsbn(raw: string): string {
  return raw.replace(/[\s-]/g, '').toUpperCase();
}

export function isValidIsbn10(s: string): boolean {
  if (!/^[0-9]{9}[0-9X]$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const v = s[i] === 'X' ? 10 : Number(s[i]);
    sum += v * (10 - i);
  }
  return sum % 11 === 0;
}

export function isValidIsbn13(s: string): boolean {
  if (!/^97[89][0-9]{10}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 13; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return sum % 10 === 0;
}

export function isbn10to13(s: string): string | null {
  if (!isValidIsbn10(s)) return null;
  const core = '978' + s.slice(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3);
  return core + String((10 - (sum % 10)) % 10);
}

export type IsbnCheck =
  | { kind: 'isbn13'; value: string }
  | { kind: 'isbn10'; value: string; isbn13: string }
  | { kind: 'invalid'; reason: string }
  | { kind: 'none' };

/** Riconosce se una stringa di ricerca è un ISBN (valido o no). */
export function checkIsbn(raw: string): IsbnCheck {
  const s = normalizeIsbn(raw);
  if (!/^[0-9X]{10,13}$/.test(s)) return { kind: 'none' };
  if (s.length === 13) {
    if (!/^97[89]/.test(s)) return { kind: 'invalid', reason: 'Questo codice a barre non è un ISBN di libro.' };
    return isValidIsbn13(s) ? { kind: 'isbn13', value: s } : { kind: 'invalid', reason: 'ISBN non valido: controlla le cifre.' };
  }
  if (s.length === 10) {
    const i13 = isbn10to13(s);
    return i13 ? { kind: 'isbn10', value: s, isbn13: i13 } : { kind: 'invalid', reason: 'ISBN non valido: controlla le cifre.' };
  }
  return { kind: 'invalid', reason: 'Un ISBN ha 10 o 13 cifre.' };
}

export function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
