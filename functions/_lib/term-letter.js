export function termLetter(value) {
  const normalized = String(value || '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  const initial = normalized.match(/[\p{L}\p{N}]/u)?.[0] || '';
  if (!initial) return '#';
  if (/\p{N}/u.test(initial)) return '#';
  return initial.toLocaleUpperCase('en-US');
}
