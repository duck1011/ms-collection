import { create } from "zustand";
import {
  Receipt,
  Settings,
  Project,
  getReceipts,
  saveReceipt,
  deleteReceipt,
  getSettings,
  saveSettings,
  seedDB,
  getProjects,
  saveProject,
  cascadeDeleteReceipt,
  migrateExistingReceiptsToProjects,
  recalculateProject,
} from "@/lib/db";

interface ReceiptStore {
  receipts: Receipt[];
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  addReceipt: (receipt: Receipt) => Promise<void>;
  updateReceipt: (receipt: Receipt) => Promise<void>;
  removeReceipt: (receiptCode: string) => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
}

const DEFAULT_SETTINGS: Settings = {
  businessName: "CV. Mandiri SEJATI",
  businessPhone: "085 - 6494 - 15696",
  businessAddress: "Jl. Mayjend Sungkono No.17, RT.06 RN.03 Buiring, Kedungkandang, MALANG",
  defaultNotes: "",
  bankBCA: "Grrrito Tuan",
  bankMandiri: "Grrrito Tuan",
};

export const useReceiptStore = create<ReceiptStore>((set, get) => ({
  receipts: [],
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    try {
      await seedDB();
      // Run migration for existing receipts to create projects
      try {
        await migrateExistingReceiptsToProjects();
      } catch (err) {
        console.warn('[ReceiptStore] Migration error (non-fatal):', err);
      }
      const [receipts, settings] = await Promise.all([
        getReceipts(),
        getSettings(),
      ]);
      set({
        receipts: receipts || [],
        settings: settings ?? DEFAULT_SETTINGS,
        loaded: true,
      });
    } catch (err) {
      console.error('[ReceiptStore] Error loading data:', err);
      set({
        receipts: [],
        settings: DEFAULT_SETTINGS,
        loaded: true,
      });
    }
  },

  addReceipt: async (receipt) => {
    await saveReceipt(receipt);
    
    // Auto-create project when a receipt is created
    const project: Project = {
      id: `proj-${receipt.receiptCode}`,
      receiptCode: receipt.receiptCode,
      projectName: receipt.clientName,
      customerName: receipt.schoolOrOrganization,
      contractValue: receipt.totalPrice,
      totalRevenueReceived: receipt.paidAmount,
      totalExpenses: 0,
      profitMargin: receipt.paidAmount, // Initially = revenue (no expenses yet)
      paymentStatus: receipt.paymentStatus,
      projectStatus: "active",
      createdAt: receipt.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await saveProject(project);

    set((s) => ({ receipts: [...s.receipts, receipt] }));
  },

  updateReceipt: async (receipt) => {
    await saveReceipt(receipt);
    
    // Recalculate project - this handles all project fields including profitMargin
    await recalculateProject(receipt.receiptCode);
    
    set((s) => ({
      receipts: s.receipts.map((r) =>
        r.receiptCode === receipt.receiptCode ? receipt : r
      ),
    }));
  },

  removeReceipt: async (receiptCode) => {
    // Cascade delete: receipt, spendings, payments, project
    await cascadeDeleteReceipt(receiptCode);
    set((s) => ({
      receipts: s.receipts.filter((r) => r.receiptCode !== receiptCode),
    }));
  },

  updateSettings: async (settings) => {
    await saveSettings(settings);
    set({ settings });
  },
}));