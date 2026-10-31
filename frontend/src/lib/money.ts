/**
 * Money formatting and calculations
 * All money stored as minor units (paise/INR cents) to avoid float issues
 */

export type Money = {
  minor: number;  // in minor units (e.g., paise for INR)
  major: number;  // in main units (e.g., rupees for INR)
  currency: string;
};

/** Convert minor units to formatted string */
export function formatMoney(minor: number, currency: string = "INR"): string {
  if (minor === 0 || minor === null || minor === undefined) {
    return "0.00";
  }
  const major = minor / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(major);
}

/** Parse a money string like "₹1,234.56" or "$12.34" back to minor units */
export function parseMoney(value: string): { minor: number; major: number; currency: string } | null {
  if (!value) return null;
  
  // Remove currency symbol and format
  const clean = value.replace(/[₹$£€]/g, "").replace(/,/g, "").trim();
  const num = parseFloat(clean);
  
  if (isNaN(num)) return null;
  
  return {
    minor: Math.round(num * 100),
    major: num,
    currency: "INR",
  };
}

/** Add two money amounts (in minor units) */
export function addMoney(a: Money, b: Money): Money {
  return {
    minor: a.minor + b.minor,
    major: (a.minor + b.minor) / 100,
    currency: a.currency,
  };
}

/** Subtract two money amounts (in minor units) */
export function subtractMoney(a: Money, b: Money): Money {
  return {
    minor: a.minor - b.minor,
    major: (a.minor - b.minor) / 100,
    currency: a.currency,
  };
}

/** Multiply money by a decimal factor (e.g., tax rate) */
export function multiplyMoney(minor: number, factor: number): number {
  // round_half_up: add 0.5 before dividing for positive numbers
  return Math.round((minor * factor + 0.5) / 100);
}