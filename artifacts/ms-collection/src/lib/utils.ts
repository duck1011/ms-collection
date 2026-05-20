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

export function generateReceiptCode(existingCodes: string[]): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  const prefix = `MS${dd}${mm}${yy}-`;

  const todayCodes = existingCodes.filter((c) => c.startsWith(prefix));
  const maxSeq = todayCodes.reduce((max, code) => {
    const parts = code.split("-");
    const seq = parseInt(parts[parts.length - 1], 10);
    return isNaN(seq) ? max : Math.max(max, seq);
  }, 0);

  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}
