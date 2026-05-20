import { create } from "zustand";
import {
  Receipt,
  Settings,
  getReceipts,
  saveReceipt,
  deleteReceipt,
  getSettings,
  saveSettings,
  seedDB,
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
  businessName: "MS Collection",
  businessPhone: "",
  businessAddress: "",
  defaultNotes: "",
};

export const useReceiptStore = create<ReceiptStore>((set, get) => ({
  receipts: [],
  settings: DEFAULT_SETTINGS,
  loaded: false,

  load: async () => {
    await seedDB();
    const [receipts, settings] = await Promise.all([
      getReceipts(),
      getSettings(),
    ]);
    set({
      receipts,
      settings: settings ?? DEFAULT_SETTINGS,
      loaded: true,
    });
  },

  addReceipt: async (receipt) => {
    await saveReceipt(receipt);
    set((s) => ({ receipts: [...s.receipts, receipt] }));
  },

  updateReceipt: async (receipt) => {
    await saveReceipt(receipt);
    set((s) => ({
      receipts: s.receipts.map((r) =>
        r.receiptCode === receipt.receiptCode ? receipt : r
      ),
    }));
  },

  removeReceipt: async (receiptCode) => {
    await deleteReceipt(receiptCode);
    set((s) => ({
      receipts: s.receipts.filter((r) => r.receiptCode !== receiptCode),
    }));
  },

  updateSettings: async (settings) => {
    await saveSettings(settings);
    set({ settings });
  },
}));
