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
  priceMode?: PriceMode;
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

export type SpendingCategory =
  | "Bahan"
  | "Alat"
  | "Gaji"
  | "Transportasi"
  | "Operasional"
  | "Marketing"
  | "Lainnya";

export type CashflowType = "cash" | "qris" | "transfer_bank" | "e_wallet" | "lainnya";

export interface Spending {
  id: string;
  receiptCode: string;
  amount: number;
  category: SpendingCategory;
  customCategoryName?: string;
  description: string;
  date: string;
  createdAt: string;
  cashflowType?: CashflowType;
  fundingSource?: string | null;
}

export interface MonthlyHistory {
  id: string;
  receiptCode: string;
  projectName: string;
  clientName: string;
  month: number;
  year: number;
  contractValue: number;
  revenueReceived: number;
  outstandingBalance: number;
  totalSpendings: number;
  margin: number;
  paymentStatus: string;
  archivedAt: string;
}

export interface Project {
  id: string;
  receiptCode: string;
  projectName: string;
  customerName: string;
  contractValue: number;
  totalRevenueReceived: number;
  totalExpenses: number;
  profitMargin: number;
  paymentStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  projectStatus: "active" | "archived" | "completed";
  createdAt: string;
  updatedAt: string;
  // Archive fields (optional for backward compatibility)
  archived?: boolean;
  archivedAt?: string | null;
}

export interface Payment {
  id: string;
  receiptCode: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  note: string;
  createdAt: string;
}

export type ProjectStatus = "active" | "archived" | "completed";

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
  spendings: {
    key: string;
    value: Spending;
    indexes: {
      'by-receiptCode': string;
      'by-date': string;
    };
  };
  monthlyHistory: {
    key: string;
    value: MonthlyHistory;
    indexes: {
      'by-month-year': [number, number];
      'by-receiptCode': string;
    };
  };
  projects: {
    key: string;
    value: Project;
    indexes: {
      'by-receiptCode': string;
      'by-status': string;
    };
  };
  payments: {
    key: string;
    value: Payment;
    indexes: {
      'by-receiptCode': string;
      'by-date': string;
    };
  };
}

const DB_NAME = 'ms-collection-db';
const DB_VERSION = 6; // Keep at v6 - new fields are optional, backward compatible

export async function initDB(): Promise<IDBPDatabase<MSDB>> {
  return openDB<MSDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      console.log(`[DB] Upgrading from v${oldVersion} to v${newVersion}`);

      if (oldVersion < 6) {
        console.log('[DB] Performing clean store recreation for v6 schema');
        
        const storesToRecreate: ('receipts' | 'settings' | 'spendings' | 'monthlyHistory' | 'projects' | 'payments')[] = 
          ['payments', 'projects', 'monthlyHistory', 'spendings', 'receipts', 'settings'];
        for (const name of storesToRecreate) {
          if (db.objectStoreNames.contains(name)) {
            db.deleteObjectStore(name);
            console.log(`[DB] Deleted store: ${name}`);
          }
        }
      }

      if (!db.objectStoreNames.contains('receipts')) {
        const store = db.createObjectStore('receipts', { keyPath: 'receiptCode' });
        store.createIndex('by-date', 'date');
        store.createIndex('by-createdAt', 'createdAt');
        console.log('[DB] Created receipts store');
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
        console.log('[DB] Created settings store');
      }
      
      if (!db.objectStoreNames.contains('spendings')) {
        const spendingsStore = db.createObjectStore('spendings', { keyPath: 'id' });
        spendingsStore.createIndex('by-receiptCode', 'receiptCode');
        spendingsStore.createIndex('by-date', 'date');
        console.log('[DB] Created spendings store');
      }
      if (!db.objectStoreNames.contains('monthlyHistory')) {
        const historyStore = db.createObjectStore('monthlyHistory', { keyPath: 'id' });
        historyStore.createIndex('by-month-year', ['month', 'year']);
        historyStore.createIndex('by-receiptCode', 'receiptCode');
        console.log('[DB] Created monthlyHistory store');
      }

      if (!db.objectStoreNames.contains('projects')) {
        const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
        projectStore.createIndex('by-receiptCode', 'receiptCode');
        projectStore.createIndex('by-status', 'projectStatus');
        console.log('[DB] Created projects store');
      }
      if (!db.objectStoreNames.contains('payments')) {
        const paymentStore = db.createObjectStore('payments', { keyPath: 'id' });
        paymentStore.createIndex('by-receiptCode', 'receiptCode');
        paymentStore.createIndex('by-date', 'paymentDate');
        console.log('[DB] Created payments store');
      }

      console.log(`[DB] Schema v${newVersion} ready`);
    },
  });
}

// ── Safe helpers ────────────────────────────────────────────────────

function safeString(val: unknown, fallback: string = ''): string {
  if (typeof val === 'string' && val.length > 0) return val;
  return fallback;
}

function safeNumber(val: unknown, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  const n = Number(val);
  return !isNaN(n) ? n : fallback;
}

// ── Migration: Ensure all projects have archive fields ──────────────

export async function migrateProjectArchiveFields(): Promise<void> {
  try {
    const db = await initDB();
    const projects = await db.getAll('projects').catch(() => [] as Project[]);
    let updated = 0;

    for (const project of projects) {
      try {
        if (project && project.id && project.archived === undefined) {
          const updatedProject: Project = {
            ...project,
            archived: false,
            archivedAt: null,
          };
          await db.put('projects', updatedProject);
          updated++;
        }
      } catch (err) {
        console.warn('[Migration] Error updating project archive fields:', project?.id, err);
      }
    }

    if (updated > 0) {
      console.log(`[Migration] Updated ${updated} projects with archive fields`);
    }
  } catch (err) {
    console.error('[Migration] Error migrating project archive fields:', err);
  }
}

// ── Migration: Create projects from existing receipts ─────────────────

export async function migrateExistingReceiptsToProjects(): Promise<number> {
  try {
    const db = await initDB();
    const receipts = await db.getAll('receipts').catch(() => [] as Receipt[]);
    const existingProjects = await db.getAll('projects').catch(() => [] as Project[]);
    const existingCodes = new Set(existingProjects.map((p) => p.receiptCode));
    let migrated = 0;
    let skipped = 0;

    for (const receipt of receipts) {
      try {
        if (!receipt || !receipt.receiptCode) {
          console.warn('[Migration] Skipping receipt with missing receiptCode:', receipt?.id);
          skipped++;
          continue;
        }

        if (existingCodes.has(receipt.receiptCode)) {
          continue;
        }

        const projectId = `proj-${receipt.receiptCode}`;
        
        if (!projectId || projectId === 'proj-') {
          console.warn('[Migration] Skipping receipt with invalid receiptCode:', receipt.receiptCode);
          skipped++;
          continue;
        }

        const project: Project = {
          id: projectId,
          receiptCode: receipt.receiptCode,
          projectName: safeString(receipt.clientName, receipt.receiptCode),
          customerName: safeString(receipt.schoolOrOrganization, ''),
          contractValue: safeNumber(receipt.totalPrice),
          totalRevenueReceived: safeNumber(receipt.paidAmount),
          totalExpenses: 0,
          profitMargin: safeNumber(receipt.paidAmount),
          paymentStatus: receipt.paymentStatus === 'PAID' || receipt.paymentStatus === 'PARTIALLY_PAID' 
            ? receipt.paymentStatus 
            : 'UNPAID',
          projectStatus: 'active',
          createdAt: safeString(receipt.createdAt, new Date().toISOString()),
          updatedAt: new Date().toISOString(),
          archived: false,
          archivedAt: null,
        };

        try {
          const spendings = await db.getAll('spendings').catch(() => [] as Spending[]);
          const projectSpendings = spendings.filter((s) => s && s.receiptCode === receipt.receiptCode);
          project.totalExpenses = projectSpendings.reduce((sum, s) => sum + safeNumber(s.amount), 0);
          project.profitMargin = project.totalRevenueReceived - project.totalExpenses;
        } catch (err) {
          console.warn('[Migration] Error calculating expenses for', receipt.receiptCode, err);
        }

        await db.put('projects', project);
        migrated++;
      } catch (err) {
        console.warn('[Migration] Error migrating receipt', receipt?.receiptCode, err);
        skipped++;
      }
    }

    console.log(`[Migration] Complete: ${migrated} migrated, ${skipped} skipped`);
    return migrated;
  } catch (err) {
    console.error('[Migration] Fatal error:', err);
    return 0;
  }
}

// ── Archive / Restore Project ───────────────────────────────────────

export async function archiveProject(receiptCode: string): Promise<Project | null> {
  try {
    const db = await initDB();
    const index = db.transaction('projects').store.index('by-receiptCode');
    const projects = await index.getAll(receiptCode);
    const project = projects.find(Boolean);
    if (!project) return null;

    const updated: Project = {
      ...project,
      archived: true,
      archivedAt: new Date().toISOString(),
      projectStatus: 'archived',
      updatedAt: new Date().toISOString(),
    };
    await db.put('projects', updated);
    return updated;
  } catch (err) {
    console.error('[DB] Error archiving project:', receiptCode, err);
    return null;
  }
}

export async function restoreProject(receiptCode: string): Promise<Project | null> {
  try {
    const db = await initDB();
    const index = db.transaction('projects').store.index('by-receiptCode');
    const projects = await index.getAll(receiptCode);
    const project = projects.find(Boolean);
    if (!project) return null;

    const updated: Project = {
      ...project,
      archived: false,
      archivedAt: null,
      projectStatus: 'active',
      updatedAt: new Date().toISOString(),
    };
    await db.put('projects', updated);
    return updated;
  } catch (err) {
    console.error('[DB] Error restoring project:', receiptCode, err);
    return null;
  }
}

// ── Receipt Data Access ──────────────────────────────────────────────

export async function getReceipts(): Promise<Receipt[]> {
  try {
    const db = await initDB();
    return (await db.getAll('receipts')).filter(Boolean);
  } catch (err) {
    console.error('[DB] Error getting receipts:', err);
    return [];
  }
}

export async function getReceipt(receiptCode: string): Promise<Receipt | undefined> {
  try {
    const db = await initDB();
    return db.get('receipts', receiptCode);
  } catch {
    return undefined;
  }
}

export async function saveReceipt(receipt: Receipt): Promise<void> {
  const db = await initDB();
  await db.put('receipts', receipt);
}

export async function deleteReceipt(receiptCode: string): Promise<void> {
  const db = await initDB();
  await db.delete('receipts', receiptCode);
}

// ── Settings Data Access ─────────────────────────────────────────────

export async function getSettings(): Promise<Settings | undefined> {
  try {
    const db = await initDB();
    return db.get('settings', 'main');
  } catch {
    return undefined;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const db = await initDB();
  await db.put('settings', settings, 'main');
}

// ── Spending Data Access ─────────────────────────────────────────────

export async function getSpendings(): Promise<Spending[]> {
  try {
    const db = await initDB();
    return (await db.getAll('spendings')).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getSpendingsByReceipt(receiptCode: string): Promise<Spending[]> {
  try {
    const db = await initDB();
    const index = db.transaction('spendings').store.index('by-receiptCode');
    return (await index.getAll(receiptCode)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveSpending(spending: Spending): Promise<void> {
  const db = await initDB();
  await db.put('spendings', spending);
}

export async function deleteSpending(id: string): Promise<void> {
  try {
    const db = await initDB();
    await db.delete('spendings', id);
  } catch (err) {
    console.warn('[DB] Error deleting spending:', id, err);
  }
}

export async function deleteSpendingsByReceipt(receiptCode: string): Promise<void> {
  try {
    const db = await initDB();
    const spendings = await db.getAll('spendings').catch(() => [] as Spending[]);
    const toDelete = spendings.filter((s) => s && s.receiptCode === receiptCode);
    const tx = db.transaction('spendings', 'readwrite');
    for (const spending of toDelete) {
      if (spending && spending.id) {
        await tx.store.delete(spending.id);
      }
    }
    await tx.done;
  } catch (err) {
    console.warn('[DB] Error deleting spendings by receipt:', receiptCode, err);
  }
}

// ── Monthly History Data Access ──────────────────────────────────────

export async function getMonthlyHistory(): Promise<MonthlyHistory[]> {
  try {
    const db = await initDB();
    return (await db.getAll('monthlyHistory')).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getMonthlyHistoryByMonthYear(month: number, year: number): Promise<MonthlyHistory[]> {
  try {
    const db = await initDB();
    const index = db.transaction('monthlyHistory').store.index('by-month-year');
    return (await index.getAll([month, year])).filter(Boolean);
  } catch {
    return [];
  }
}

export async function saveMonthlyHistory(history: MonthlyHistory): Promise<void> {
  const db = await initDB();
  await db.put('monthlyHistory', history);
}

export async function deleteMonthlyHistory(id: string): Promise<void> {
  try {
    const db = await initDB();
    await db.delete('monthlyHistory', id);
  } catch (err) {
    console.warn('[DB] Error deleting monthly history:', id, err);
  }
}

// ── Project Data Access ──────────────────────────────────────────────

export async function getProjects(): Promise<Project[]> {
  try {
    const db = await initDB();
    return (await db.getAll('projects')).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getProject(receiptCode: string): Promise<Project | undefined> {
  try {
    const db = await initDB();
    const index = db.transaction('projects').store.index('by-receiptCode');
    const projects = await index.getAll(receiptCode);
    return projects.find(Boolean);
  } catch {
    return undefined;
  }
}

export async function saveProject(project: Project): Promise<void> {
  if (!project || !project.id) {
    console.warn('[DB] Cannot save project without id:', project);
    return;
  }
  try {
    const db = await initDB();
    await db.put('projects', project);
  } catch (err) {
    console.error('[DB] Error saving project:', err, project);
  }
}

export async function updateProject(project: Project): Promise<void> {
  if (!project || !project.id) {
    console.warn('[DB] Cannot update project without id:', project);
    return;
  }
  try {
    const db = await initDB();
    project.updatedAt = new Date().toISOString();
    await db.put('projects', project);
  } catch (err) {
    console.error('[DB] Error updating project:', err, project);
  }
}

export async function deleteProject(id: string): Promise<void> {
  try {
    const db = await initDB();
    await db.delete('projects', id);
  } catch (err) {
    console.warn('[DB] Error deleting project:', id, err);
  }
}

export async function deleteProjectByReceipt(receiptCode: string): Promise<void> {
  try {
    const db = await initDB();
    const index = db.transaction('projects').store.index('by-receiptCode');
    const projects = await index.getAll(receiptCode);
    const tx = db.transaction('projects', 'readwrite');
    for (const project of projects) {
      if (project && project.id) {
        await tx.store.delete(project.id);
      }
    }
    await tx.done;
  } catch (err) {
    console.warn('[DB] Error deleting project by receipt:', receiptCode, err);
  }
}

// ── Payment Data Access ──────────────────────────────────────────────

export async function getPayments(): Promise<Payment[]> {
  try {
    const db = await initDB();
    return (await db.getAll('payments')).filter(Boolean);
  } catch {
    return [];
  }
}

export async function getPaymentsByReceipt(receiptCode: string): Promise<Payment[]> {
  try {
    const db = await initDB();
    const index = db.transaction('payments').store.index('by-receiptCode');
    return (await index.getAll(receiptCode)).filter(Boolean);
  } catch {
    return [];
  }
}

export async function savePayment(payment: Payment): Promise<void> {
  if (!payment || !payment.id) {
    console.warn('[DB] Cannot save payment without id:', payment);
    return;
  }
  try {
    const db = await initDB();
    await db.put('payments', payment);
  } catch (err) {
    console.error('[DB] Error saving payment:', err, payment);
  }
}

export async function deletePayment(id: string): Promise<void> {
  try {
    const db = await initDB();
    await db.delete('payments', id);
  } catch (err) {
    console.warn('[DB] Error deleting payment:', id, err);
  }
}

export async function deletePaymentsByReceipt(receiptCode: string): Promise<void> {
  try {
    const payments = await getPaymentsByReceipt(receiptCode);
    const db = await initDB();
    const tx = db.transaction('payments', 'readwrite');
    for (const payment of payments) {
      if (payment && payment.id) {
        await tx.store.delete(payment.id);
      }
    }
    await tx.done;
  } catch (err) {
    console.warn('[DB] Error deleting payments by receipt:', receiptCode, err);
  }
}

// ── Cascading Delete ─────────────────────────────────────────────────

export async function cascadeDeleteReceipt(receiptCode: string): Promise<void> {
  try {
    const db = await initDB();
    
    try { await db.delete('receipts', receiptCode); } catch {}
    
    try {
      const spendings = await db.getAll('spendings').catch(() => [] as Spending[]);
      const toDeleteSpendings = spendings.filter((s) => s && s.receiptCode === receiptCode);
      const txSpendings = db.transaction('spendings', 'readwrite');
      for (const spending of toDeleteSpendings) {
        if (spending && spending.id) {
          await txSpendings.store.delete(spending.id);
        }
      }
      await txSpendings.done;
    } catch {}
    
    try {
      const payments = await getPaymentsByReceipt(receiptCode);
      const txPayments = db.transaction('payments', 'readwrite');
      for (const payment of payments) {
        if (payment && payment.id) {
          await txPayments.store.delete(payment.id);
        }
      }
      await txPayments.done;
    } catch {}

    try {
      await deleteProjectByReceipt(receiptCode);
    } catch {}
  } catch (err) {
    console.error('[DB] Error in cascade delete:', err);
  }
}

// ── Calculate Project Revenue from Payments ──────────────────────────

export async function calculateProjectRevenue(receiptCode: string): Promise<number> {
  try {
    const payments = await getPaymentsByReceipt(receiptCode);
    return payments.reduce((sum, p) => sum + safeNumber(p.amount), 0);
  } catch {
    return 0;
  }
}

// ── Update Project from Receipt data and Spendings ───────────────────

export async function recalculateProject(receiptCode: string): Promise<Project | null> {
  try {
    if (!receiptCode) return null;

    const project = await getProject(receiptCode);
    if (!project) return null;

    const receipt = await getReceipt(receiptCode);
    if (!receipt) return null;

    const revenueReceived = safeNumber(receipt.paidAmount);
    const spendings = await getSpendingsByReceipt(receiptCode);
    const totalExpenses = spendings.reduce((sum, s) => sum + safeNumber(s.amount), 0);
    const profitMargin = revenueReceived - totalExpenses;
    const paymentStatus: "PAID" | "PARTIALLY_PAID" | "UNPAID" = receipt.paymentStatus;

    const updated: Project = {
      ...project,
      totalRevenueReceived: revenueReceived,
      totalExpenses,
      profitMargin,
      paymentStatus,
      contractValue: receipt.totalPrice,
      projectName: receipt.clientName,
      customerName: receipt.schoolOrOrganization,
      updatedAt: new Date().toISOString(),
    };

    await saveProject(updated);
    return updated;
  } catch (err) {
    console.error('[DB] Error recalculating project:', receiptCode, err);
    return null;
  }
}

// ── Seed ─────────────────────────────────────────────────────────────

export async function seedDB() {
  try {
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
        try {
          await saveReceipt(r);
          const project: Project = {
            id: `proj-${r.receiptCode}`,
            receiptCode: r.receiptCode,
            projectName: r.clientName,
            customerName: r.schoolOrOrganization,
            contractValue: r.totalPrice,
            totalRevenueReceived: r.paidAmount,
            totalExpenses: 0,
            profitMargin: r.paidAmount,
            paymentStatus: r.paymentStatus,
            projectStatus: "active" as ProjectStatus,
            createdAt: r.createdAt,
            updatedAt: new Date().toISOString(),
            archived: false,
            archivedAt: null,
          };
          await saveProject(project);
        } catch (err) {
          console.warn('[Seed] Error seeding receipt:', r.receiptCode, err);
        }
      }
    }
  } catch (err) {
    console.error('[Seed] Error:', err);
  }
}