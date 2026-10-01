/**
 * Turns raw bank text into a readable merchant name for display.
 * The raw text is kept on the transaction too, and rules match against both.
 *
 *   "AplPay TRADER JOE S #552   SAN FRANCISCO  CA" → "Trader Joe S"
 *   "REVOLVE 752650      CERRITOS            CA"     → "Revolve"
 *   "ACH Debit: VENMO - PAYMENT"                     → "Venmo - Payment"
 *   "Spotify P1234abcd5"                             → "Spotify"
 */

// Prefixes banks and payment apps add in front of the merchant.
const PREFIXES = [
  /^ach (debit|deposit|credit)\s*:\s*/i,
  /^pos (transaction|purchase)\s*:\s*/i,
  /^descriptive (withdrawal|deposit)\s*:\s*/i,
  /^aplpay\s+/i,
  /^tst\*\s*/i,
  /^sq \*\s*/i,
  /^sp \*?\s*/i,
  /^pp\*\s*/i,
];

function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-/(&])([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}

export function cleanDescription(raw: string): string {
  let s = raw.trim();
  if (!s) return s;

  // Card exports pad a fixed 20-character merchant field, then the city and state.
  if (/\S {2,}\S/.test(s)) s = s.slice(0, 20);

  for (const prefix of PREFIXES) s = s.replace(prefix, '');
  s = s.replace(/\s+/g, ' ').trim();

  // Drop store numbers, card digits and reference codes after the name.
  const tokens = s.split(' ');
  const cut = tokens.findIndex((t, i) => i > 0 && (/\d/.test(t) || /\*{2,}/.test(t)));
  let kept = cut > 0 ? tokens.slice(0, cut) : tokens;
  // Keep a plain-word ending after " - " that the cut removed: "ACME 1234567890 PP - PAYROLL" → "ACME - PAYROLL".
  if (cut > 0) {
    const tail = tokens.slice(cut).join(' ').match(/ - ([A-Za-z][A-Za-z ]*)$/);
    if (tail) kept = [...kept, '-', ...tail[1].trim().split(' ')];
  }
  if (kept.length === 1) kept = [kept[0].replace(/\d{3,}.*$/, '') || kept[0]];
  s = kept.join(' ').replace(/[\s\-*#:]+$/, '').trim();

  if (!s) return raw.trim();
  // Only re-case text that's all capitals, so "iCloud" or "Blue Bottle" stay as they are.
  return s === s.toUpperCase() && /[A-Z]/.test(s) ? titleCase(s) : s;
}
