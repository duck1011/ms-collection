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
