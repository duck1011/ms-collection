import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type ProductType =
  | "Seragam Sekolah"
  | "Jaket Almamater"
  | "Seragam Basket"
  | "Seragam Voli"
  | "Seragam Badminton"
  | "Seragam Futsal"
  | "Jaket Kelas"
  | "Custom Apparel";

export type Size = "XS" | "S" | "M" | "L" | "XL" | "XXL";

export type PriceMode = "single" | "bySize";

export type SizePrices = Record<Size, number>;

export interface OrderItem {
  productType: ProductType;
  size: Size;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  /** Price mode used when the order was created — "single" for backward compat */
  priceMode?: PriceMode;
  /** Per-size prices if priceMode is "bySize" */
  sizePrices?: SizePrices;
}

export interface Receipt {
  id: string;
  receiptCode: string;
  clientName: string;
  clientPhone: string;
  schoolOrOrganization: string;
  date: string;
  createdAt: string;
  items: OrderItem[];
  totalPrice: number;
  paidAmount: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  notes?: string;
}

export interface Settings {
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  defaultNotes: string;
  bankBCA: string;
  bankMandiri: string;
}

interface MSDB extends DBSchema {
  receipts: {
    key: string;
    value: Receipt;
    indexes: {
      'by-date': string;
      'by-createdAt': string;
    };
  };
  settings: {
    key: string;
    value: Settings;
  };
}

const DB_NAME = 'ms-collection-db';
const DB_VERSION = 1;

export async function initDB(): Promise<IDBPDatabase<MSDB>> {
  return openDB<MSDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('receipts')) {
        const store = db.createObjectStore('receipts', { keyPath: 'receiptCode' });
        store.createIndex('by-date', 'date');
        store.createIndex('by-createdAt', 'createdAt');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    },
  });
}

// Data Access
export async function getReceipts(): Promise<Receipt[]> {
  const db = await initDB();
  return db.getAll('receipts');
}

export async function getReceipt(receiptCode: string): Promise<Receipt | undefined> {
  const db = await initDB();
  return db.get('receipts', receiptCode);
}

export async function saveReceipt(receipt: Receipt): Promise<void> {
  const db = await initDB();
  await db.put('receipts', receipt);
}

export async function deleteReceipt(receiptCode: string): Promise<void> {
  const db = await initDB();
  await db.delete('receipts', receiptCode);
}

export async function getSettings(): Promise<Settings | undefined> {
  const db = await initDB();
  return db.get('settings', 'main');
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await initDB();
  await db.put('settings', settings, 'main');
}

export async function seedDB() {
  const receipts = await getReceipts();
  if (receipts.length === 0) {
    const now = new Date();
    const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000).toISOString();

    const seed: Receipt[] = [
      {
        id: 'MS010525-001',
        receiptCode: 'MS010525-001',
        clientName: 'Budi Santoso',
        clientPhone: '081234567890',
        schoolOrOrganization: 'SMA Negeri 1 Jakarta',
        date: daysAgo(5),
        createdAt: daysAgo(5),
        items: [
          { productType: 'Seragam Sekolah', size: 'M', quantity: 3, unitPrice: 150000, subtotal: 450000 },
          { productType: 'Seragam Sekolah', size: 'L', quantity: 2, unitPrice: 150000, subtotal: 300000 },
        ],
        totalPrice: 750000,
        paidAmount: 750000,
        paymentStatus: 'PAID',
        notes: 'Lunas',
      },
      {
        id: 'MS030525-001',
        receiptCode: 'MS030525-001',
        clientName: 'Siti Rahayu',
        clientPhone: '082345678901',
        schoolOrOrganization: 'SMAN 3 Bandung',
        date: daysAgo(3),
        createdAt: daysAgo(3),
        items: [
          { productType: 'Jaket Almamater', size: 'M', quantity: 10, unitPrice: 250000, subtotal: 2500000 },
          { productType: 'Jaket Almamater', size: 'L', quantity: 5, unitPrice: 250000, subtotal: 1250000 },
        ],
        totalPrice: 3750000,
        paidAmount: 2000000,
        paymentStatus: 'PARTIALLY_PAID',
        notes: 'DP 2.000.000, sisa pelunasan minggu depan',
      },
      {
        id: 'MS040525-001',
        receiptCode: 'MS040525-001',
        clientName: 'Ahmad Fauzi',
        clientPhone: '083456789012',
        schoolOrOrganization: 'Tim Basket SMPN 2 Surabaya',
        date: daysAgo(2),
        createdAt: daysAgo(2),
        items: [
          { productType: 'Seragam Basket', size: 'S', quantity: 2, unitPrice: 200000, subtotal: 400000 },
          { productType: 'Seragam Basket', size: 'M', quantity: 6, unitPrice: 200000, subtotal: 1200000 },
          { productType: 'Seragam Basket', size: 'L', quantity: 4, unitPrice: 200000, subtotal: 800000 },
        ],
        totalPrice: 2400000,
        paidAmount: 2400000,
        paymentStatus: 'PAID',
      },
      {
        id: 'MS050525-001',
        receiptCode: 'MS050525-001',
        clientName: 'Dewi Lestari',
        clientPhone: '084567890123',
        schoolOrOrganization: 'OSIS SMAN 5 Yogyakarta',
        date: daysAgo(1),
        createdAt: daysAgo(1),
        items: [
          { productType: 'Jaket Kelas', size: 'M', quantity: 15, unitPrice: 230000, subtotal: 3450000 },
          { productType: 'Jaket Kelas', size: 'L', quantity: 10, unitPrice: 230000, subtotal: 2300000 },
          { productType: 'Jaket Kelas', size: 'XL', quantity: 5, unitPrice: 230000, subtotal: 1150000 },
        ],
        totalPrice: 6900000,
        paidAmount: 0,
        paymentStatus: 'UNPAID',
        notes: 'Jaket kelas XII IPA 1',
      },
      {
        id: 'MS050525-002',
        receiptCode: 'MS050525-002',
        clientName: 'Rizki Pratama',
        clientPhone: '085678901234',
        schoolOrOrganization: 'Tim Futsal SMK Telkom',
        date: daysAgo(0),
        createdAt: daysAgo(0),
        items: [
          { productType: 'Seragam Futsal', size: 'S', quantity: 3, unitPrice: 185000, subtotal: 555000 },
          { productType: 'Seragam Futsal', size: 'M', quantity: 7, unitPrice: 185000, subtotal: 1295000 },
          { productType: 'Seragam Futsal', size: 'L', quantity: 5, unitPrice: 185000, subtotal: 925000 },
        ],
        totalPrice: 2775000,
        paidAmount: 2775000,
        paymentStatus: 'PAID',
      },
    ];
    for (const r of seed) {
      await saveReceipt(r);
    }
  }
}