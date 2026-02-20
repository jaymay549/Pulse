import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getVendorNamesFromEntries(
  entries: Array<{ vendorName?: string | null }>,
): string[] {
  return Array.from(
    new Set(
      entries
        .map((e) => e.vendorName?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  );
}
