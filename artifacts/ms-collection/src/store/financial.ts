import { create } from "zustand";
import {
  Spending,
  SpendingCategory,
  CashflowType,
  MonthlyHistory,
  Receipt,
  Project,
  Payment,
  getSpendings,
  saveSpending,
  deleteSpending as deleteSpendingDB,
  getMonthlyHistory,
  deleteMonthlyHistory as deleteMonthlyHistoryDB,
  getProjects,
  saveProject,
  updateProject,
  getProject,
  getPayments,
  savePayment,
  deletePayment as deletePaymentDB,
  recalculateProject,
  cascadeDeleteReceipt,
  deleteSpendingsByReceipt,
  migrateExistingReceiptsToProjects,
  archiveProject as archiveProjectDB,
  restoreProject as restoreProjectDB,
  migrateProjectArchiveFields,
} from "@/lib/db";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface FinancialStore {
  spendings: Spending[];
  monthlyHistory: MonthlyHistory[];
  projects: Project[];
  payments: Payment[];
  loaded: boolean;

  load: () => Promise<void>;
  runMigration: () => Promise<number>;
  addSpending: (spending: Omit<Spending, "id" | "createdAt">) => Promise<void>;
  removeSpending: (id: string) => Promise<void>;
  getSpendingsByReceipt: (receiptCode: string) => Spending[];
  getMonthlySpendings: () => Spending[];

  // Project management
  addProject: (project: Omit<Project, "id" | "createdAt" | "updatedAt">) => Promise<Project>;
  updateProject: (project: Project) => Promise<void>;
  removeProject: (receiptCode: string) => Promise<void>;
  getProjectByReceipt: (receiptCode: string) => Project | undefined;
  recalculateProject: (receiptCode: string) => Promise<Project | null>;
  archiveProject: (receiptCode: string) => Promise<Project | null>;
  restoreProject: (receiptCode: string) => Promise<Project | null>;
  migrateArchiveFields: () => Promise<void>;

  // Payment management
  addPayment: (payment: Omit<Payment, "id" | "createdAt">) => Promise<void>;
  removePayment: (id: string) => Promise<void>;
  getPaymentsByReceipt: (receiptCode: string) => Payment[];
  getTotalPaymentsByReceipt: (receiptCode: string) => number;

  // History management (preserved for existing data, no longer written to)
  getHistoryForMonth: (month: number, year: number) => MonthlyHistory[];
  getAllHistory: () => MonthlyHistory[];
  deleteHistoryEntry: (id: string) => Promise<void>;
}

export const useFinancialStore = create<FinancialStore>((set, get) => ({
  spendings: [],
  monthlyHistory: [],
  projects: [],
  payments: [],
  loaded: false,

  load: async () => {
    try {
      const [spendings, monthlyHistory, projects, payments] = await Promise.all([
        getSpendings(),
        getMonthlyHistory(),
        getProjects(),
        getPayments(),
      ]);
      set({ spendings, monthlyHistory, projects, payments, loaded: true });
    } catch (err) {
      console.error('[FinancialStore] Error loading data:', err);
      set({ spendings: [], monthlyHistory: [], projects: [], payments: [], loaded: true });
    }
  },

  runMigration: async () => {
    const count = await migrateExistingReceiptsToProjects();
    const projects = await getProjects();
    set({ projects });
    return count;
  },

  addSpending: async (spendingData) => {
    const spending: Spending = {
      ...spendingData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    await saveSpending(spending);
    set((s) => ({ spendings: [...s.spendings, spending] }));
    await get().recalculateProject(spendingData.receiptCode);
  },

  removeSpending: async (id) => {
    const spending = get().spendings.find((s) => s.id === id);
    await deleteSpendingDB(id);
    set((s) => ({ spendings: s.spendings.filter((sp) => sp.id !== id) }));
    if (spending) {
      await get().recalculateProject(spending.receiptCode);
    }
  },

  getSpendingsByReceipt: (receiptCode) => {
    return get().spendings.filter((s) => s.receiptCode === receiptCode);
  },

  getMonthlySpendings: () => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    return get().spendings.filter((s) => {
      const d = new Date(s.date);
      return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
    });
  },

  // ── Project Management ───────────────────────────────────────────

  addProject: async (projectData) => {
    const project: Project = {
      ...projectData,
      id: `proj-${projectData.receiptCode}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await saveProject(project);
    set((s) => ({ projects: [...s.projects, project] }));
    return project;
  },

  updateProject: async (project) => {
    await updateProject(project);
    set((s) => ({
      projects: s.projects.map((p) =>
        p.receiptCode === project.receiptCode ? { ...project, updatedAt: new Date().toISOString() } : p
      ),
    }));
  },

  removeProject: async (receiptCode: string) => {
    await cascadeDeleteReceipt(receiptCode);
    set((s) => ({
      projects: s.projects.filter((p) => p.receiptCode !== receiptCode),
      spendings: s.spendings.filter((sp) => sp.receiptCode !== receiptCode),
      payments: s.payments.filter((p) => p.receiptCode !== receiptCode),
    }));
  },

  getProjectByReceipt: (receiptCode) => {
    return get().projects.find((p) => p.receiptCode === receiptCode);
  },

  recalculateProject: async (receiptCode) => {
    const updated = await recalculateProject(receiptCode);
    if (updated) {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.receiptCode === receiptCode ? updated : p
        ),
      }));
    }
    return updated;
  },

  // ── Archive / Restore ────────────────────────────────────────────

  migrateArchiveFields: async () => {
    await migrateProjectArchiveFields();
    const projects = await getProjects();
    set({ projects });
  },

  archiveProject: async (receiptCode) => {
    const updated = await archiveProjectDB(receiptCode);
    if (updated) {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.receiptCode === receiptCode ? updated : p
        ),
      }));
    }
    return updated;
  },

  restoreProject: async (receiptCode) => {
    const updated = await restoreProjectDB(receiptCode);
    if (updated) {
      set((s) => ({
        projects: s.projects.map((p) =>
          p.receiptCode === receiptCode ? updated : p
        ),
      }));
    }
    return updated;
  },

  // ── Payment Management ───────────────────────────────────────────

  addPayment: async (paymentData) => {
    const payment: Payment = {
      ...paymentData,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    await savePayment(payment);
    set((s) => ({ payments: [...s.payments, payment] }));
    await get().recalculateProject(paymentData.receiptCode);
  },

  removePayment: async (id) => {
    const payment = get().payments.find((p) => p.id === id);
    await deletePaymentDB(id);
    set((s) => ({ payments: s.payments.filter((p) => p.id !== id) }));
    if (payment) {
      await get().recalculateProject(payment.receiptCode);
    }
  },

  getPaymentsByReceipt: (receiptCode) => {
    return get().payments.filter((p) => p.receiptCode === receiptCode);
  },

  getTotalPaymentsByReceipt: (receiptCode) => {
    const payments = get().payments.filter((p) => p.receiptCode === receiptCode);
    return payments.reduce((sum, p) => sum + p.amount, 0);
  },

  // ── History (read-only, existing data preserved) ────────────────

  getHistoryForMonth: (month: number, year: number) => {
    return get().monthlyHistory.filter(
      (h) => h.month === month && h.year === year
    );
  },

  getAllHistory: () => {
    return [...get().monthlyHistory].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  },

  deleteHistoryEntry: async (id) => {
    await deleteMonthlyHistoryDB(id);
    set((s) => ({
      monthlyHistory: s.monthlyHistory.filter((h) => h.id !== id),
    }));
  },
}));