export function head(
  text: string,
  width: number = 40,
): string {
  text = text.trim().toUpperCase();

  if (text.length % 2 === 1) {
    text += ' ';
  }

  const s: number = Math.max(2, width - text.length - 2) / 2;

  return '-'.repeat(s) + ' ' + text + ' ' + '-'.repeat(s);
}
