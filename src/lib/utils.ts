import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Money is stored as integer paise everywhere. Format only at the edge.
 * Whole rupees render without decimals (₹280, not ₹280.00).
 */
/**
 * "280" / "280.50" / "₹1,280" → integer paise. Null if it isn't a valid price.
 *
 * Parsed as strings, never via parseFloat * 100 — 19.99 * 100 is 1998.9999…
 * in IEEE 754, and Math.round would paper over that rather than prevent it.
 */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.trim().replace(/[₹,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatPaise(paise: number): string {
  const hasPaise = paise % 100 !== 0;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  }).format(paise / 100);
}
