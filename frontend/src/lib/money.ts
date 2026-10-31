const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats integer minor units (paise) into INR currency string (e.g., 390344 -> "₹3,903.44").
 * Never uses floating-point arithmetic for calculations; only divides by 100 at display time.
 */
export function formatMinor(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) {
    return inrFormatter.format(0);
  }
  const integerMinor = Math.trunc(minor);
  return inrFormatter.format(integerMinor / 100);
}

/**
 * Converts a user-entered rupee string (e.g. "1062.50" or "500") into integer paise (106250 or 50000)
 * using string splitting to avoid IEEE-754 floating-point precision errors.
 * Returns null if the string is not a valid non-negative decimal with at most 2 decimal places.
 */
export function parseRupeesToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const rupees = parseInt(match[1], 10);
  const paiseRaw = match[2] || '';
  const paisePadded = (paiseRaw + '00').slice(0, 2);
  const paise = parseInt(paisePadded, 10);
  return rupees * 100 + paise;
}

/**
 * Converts minor units (paise) to a plain rupee input string (e.g., 150000 -> "1500.00" or "1500").
 */
export function minorToRupeeInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || Number.isNaN(minor)) return '';
  const intMinor = Math.trunc(minor);
  const whole = Math.trunc(intMinor / 100);
  const rem = Math.abs(intMinor % 100);
  if (rem === 0) return String(whole);
  return `${whole}.${String(rem).padStart(2, '0')}`;
}

/**
 * Formats basis points (1800 = 18%) to a human-readable percentage string ("18%" or "18.5%").
 */
export function formatBpToPercent(rateBp: number | null | undefined): string {
  if (rateBp === null || rateBp === undefined || Number.isNaN(rateBp)) return '0%';
  const intBp = Math.trunc(rateBp);
  const whole = Math.trunc(intBp / 100);
  const rem = Math.abs(intBp % 100);
  if (rem === 0) return `${whole}%`;
  const dec = String(rem).padStart(2, '0').replace(/0+$/, '');
  return `${whole}.${dec}%`;
}

/**
 * Parses a percentage string (e.g. "18" or "18.25") into integer basis points (1800 or 1825).
 */
export function parsePercentToBp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = parseInt(match[1], 10);
  const fracRaw = match[2] || '';
  const fracPadded = (fracRaw + '00').slice(0, 2);
  const frac = parseInt(fracPadded, 10);
  return whole * 100 + frac;
}

export function bpToPercentInput(rateBp: number | null | undefined): string {
  if (rateBp === null || rateBp === undefined || Number.isNaN(rateBp)) return '';
  const intBp = Math.trunc(rateBp);
  const whole = Math.trunc(intBp / 100);
  const rem = Math.abs(intBp % 100);
  if (rem === 0) return String(whole);
  const dec = String(rem).padStart(2, '0').replace(/0+$/, '');
  return `${whole}.${dec}`;
}

export interface PasswordRuleResult {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasSpecial: boolean;
  isValid: boolean;
}

/**
 * Mirrors the server password rule:
 * more than 8 characters (>= 9), one uppercase, one lowercase, one special character.
 */
export function checkPasswordRules(password: string): PasswordRuleResult {
  const minLength = password.length > 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return {
    minLength,
    hasUpper,
    hasLower,
    hasSpecial,
    isValid: minLength && hasUpper && hasLower && hasSpecial,
  };
}

export function todayIsoDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const m = String(month + 1).padStart(2, '0');
  return {
    from: `${year}-${m}-01`,
    to: `${year}-${m}-${String(lastDay).padStart(2, '0')}`,
  };
}
