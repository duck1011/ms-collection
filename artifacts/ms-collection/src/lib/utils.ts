import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(value: number): string {
  return (
    "Rp " +
    Math.floor(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  );
}

export function formatDate(isoString: string): string {
  try {
    return format(parseISO(isoString), "d MMMM yyyy", { locale: id });
  } catch {
    return isoString;
  }
}

export function formatDateShort(isoString: string): string {
  try {
    return format(parseISO(isoString), "d MMM yyyy", { locale: id });
  } catch {
    return isoString;
  }
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

// Format: MS + M (month, no padding) + YY + 3-digit seq
// Example: May 2026 → prefix "MS526", code "MS526001"
export function generateReceiptCode(existingCodes: string[]): string {
  const now = new Date();
  const m = String(now.getMonth() + 1); // no padding
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `MS${m}${yy}`;

  const monthCodes = existingCodes.filter((c) => c.startsWith(prefix));
  const maxSeq = monthCodes.reduce((max, code) => {
    const seq = parseInt(code.slice(prefix.length), 10);
    return isNaN(seq) ? max : Math.max(max, seq);
  }, 0);

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}
