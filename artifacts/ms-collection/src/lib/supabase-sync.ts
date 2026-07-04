import {
  supabase,
  insertInvoice,
  insertInvoiceItems,
  insertProject,
  updateProjectStatus,
  insertMonthlyReport,
  getAllInvoices,
  getAllProjects,
  getActiveProjects,
  getArchivedProjects,
  getAllMonthlyReports,
  loadAllData,
  verifyOwnerLoginSecure,
  SupabaseInvoice,
  SupabaseInvoiceItem,
  SupabaseProject,
  SupabaseMonthlyReport,
} from "./supabase";
import type { Receipt, OrderItem, Project as LocalProject } from "./db";
import {
  saveReceipt,
  saveProject,
  saveMonthlyHistory,
  savePayment,
  saveSpending,
  getProjects,
  getReceipts,
  getPayments,
  getSpendings,
  getMonthlyHistory,
} from "./db";
import { useReceiptStore } from "@/store/receipts";
import { useFinancialStore } from "@/store/financial";

// ── Check if Supabase is configured ───────────────────────────────────

export function isSupabaseConfigured(): boolean {
  return !!(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}

// ── Phase 1: Save invoice + items to Supabase ─────────────────────────

export async function syncInvoiceToSupabase(
  receipt: Receipt
): Promise<{ invoiceId: string } | null> {
  if (!isSupabaseConfigured()) return null;

  // Check for duplicate receipt code
  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("receipt_code", receipt.receiptCode)
    .maybeSingle();

  if (existing) {
    console.warn(
      "[SupabaseSync] Duplicate invoice number:",
      receipt.receiptCode
    );
    return null;
  }

  // Insert invoice
  const invoice = await insertInvoice({
    receipt_code: receipt.receiptCode,
    client_name: receipt.clientName,
    client_phone: receipt.clientPhone,
    school_or_organization: receipt.schoolOrOrganization,
    date: receipt.date,
    created_at: receipt.createdAt,
    total_price: receipt.totalPrice,
    paid_amount: receipt.paidAmount,
    payment_status: receipt.paymentStatus,
    notes: receipt.notes || null,
  });

  if (!invoice || !invoice.id) {
    console.error("[SupabaseSync] Failed to insert invoice");
    return null;
  }

  // Insert invoice items
  const items: Omit<SupabaseInvoiceItem, "id">[] = receipt.items.map(
    (item: OrderItem) => ({
      invoice_id: invoice.id!,
      product_type: item.productType,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      subtotal: item.subtotal,
      price_mode: item.priceMode || null,
      size_prices: item.sizePrices || null,
    })
  );

  const itemsOk = await insertInvoiceItems(items);
  if (!itemsOk) {
    console.error("[SupabaseSync] Failed to insert invoice items");
  }

  return { invoiceId: invoice.id };
}

// ── Phase 2: Auto-create project when invoice is saved ────────────────

export async function syncProjectToSupabase(
  receipt: Receipt
): Promise<SupabaseProject | null> {
  if (!isSupabaseConfigured()) return null;

  const project = await insertProject({
    project_name: receipt.clientName,
    contract_value: receipt.totalPrice,
    production_cost: 0,
    status: "ACTIVE",
    receipt_code: receipt.receiptCode,
    client_name: receipt.clientName,
    paid_amount: receipt.paidAmount,
    payment_status: receipt.paymentStatus,
  });

  return project;
}

// ── Phase 4: Archive project + create monthly report ──────────────────

export async function syncArchiveToSupabase(
  receiptCode: string,
  projectName: string,
  clientName: string,
  contractValue: number,
  productionCost: number
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;

  const now = new Date();
  const archivedAt = now.toISOString();
  const reportMonth = now.getMonth() + 1;
  const reportYear = now.getFullYear();
  const netProfit = contractValue - productionCost;

  // Update project status to ARCHIVED
  const statusOk = await updateProjectStatus(
    receiptCode,
    "ARCHIVED",
    archivedAt
  );
  if (!statusOk) {
    console.error("[SupabaseSync] Failed to update project status");
    return false;
  }

  // Create monthly report
  const report = await insertMonthlyReport({
    invoice_number: receiptCode,
    client_name: clientName,
    project_name: projectName,
    contract_value: contractValue,
    production_cost: productionCost,
    net_profit: netProfit,
    report_month: reportMonth,
    report_year: reportYear,
    archived_at: archivedAt,
  });

  if (!report) {
    console.error("[SupabaseSync] Failed to create monthly report");
    return false;
  }

  return true;
}

// ── Phase 6: Secure Owner Login ───────────────────────────────────────

export async function verifyOwnerLogin(
  username: string,
  password: string,
  pin: string
): Promise<{ success: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: "Supabase tidak dikonfigurasi" };
  }

  // Use secure RPC-based verification — NEVER exposes password_hash or pin_hash
  return verifyOwnerLoginSecure(username, password, pin);
}

// ── Phase 7: Data Recovery ────────────────────────────────────────────

/**
 * Fetches all data from Supabase and writes it into IndexedDB and zustand stores.
 * This ensures a new device gets fully restored automatically.
 */
export async function recoverDataFromSupabaseAndRestore(): Promise<{
  invoices: number;
  invoiceItems: number;
  projects: number;
  monthlyReports: number;
}> {
  if (!isSupabaseConfigured()) {
    return { invoices: 0, invoiceItems: 0, projects: 0, monthlyReports: 0 };
  }

  const data = await loadAllData();
  const counts = {
    invoices: data.invoices.length,
    invoiceItems: data.invoiceItems.length,
    projects: data.projects.length,
    monthlyReports: data.monthlyReports.length,
  };

  if (counts.invoices === 0 && counts.projects === 0) {
    return counts; // Nothing to recover
  }

  // Write invoices to IndexedDB and update receipt store
  const receiptStore = useReceiptStore.getState();
  const financialStore = useFinancialStore.getState();

  // Convert Supabase invoices to local Receipt format and save
  const localReceipts: Receipt[] = [];
  for (const inv of data.invoices) {
    const invItems = data.invoiceItems.filter(
      (item) => item.invoice_id === inv.id
    );

    const receipt: Receipt = {
      id: inv.receipt_code,
      receiptCode: inv.receipt_code,
      clientName: inv.client_name,
      clientPhone: inv.client_phone,
      schoolOrOrganization: inv.school_or_organization,
      date: inv.date,
      createdAt: inv.created_at,
      items: invItems.map((item) => ({
        productType: item.product_type as any,
        size: item.size as any,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        subtotal: item.subtotal,
        priceMode: (item.price_mode as any) || undefined,
        sizePrices: (item.size_prices || undefined) as any,
      })),
      totalPrice: inv.total_price,
      paidAmount: inv.paid_amount,
      paymentStatus: inv.payment_status,
      notes: inv.notes || undefined,
    };
    localReceipts.push(receipt);
    await saveReceipt(receipt);
  }

  // Convert Supabase projects to local Project format and save
  const localProjects: LocalProject[] = [];
  for (const proj of data.projects) {
    const localProject: LocalProject = {
      id: `proj-${proj.receipt_code || ""}`,
      receiptCode: proj.receipt_code || "",
      projectName: proj.project_name,
      customerName: proj.client_name || "",
      contractValue: proj.contract_value,
      totalRevenueReceived: proj.paid_amount || 0,
      totalExpenses: proj.production_cost || 0,
      profitMargin: (proj.paid_amount || 0) - (proj.production_cost || 0),
      paymentStatus: (proj.payment_status as any) || "UNPAID",
      projectStatus: proj.status === "ARCHIVED" ? ("archived" as any) : ("active" as any),
      createdAt: proj.created_at || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      archived: proj.status === "ARCHIVED",
      archivedAt: proj.archived_at || null,
    };
    localProjects.push(localProject);
    await saveProject(localProject);
  }

  // Convert Supabase monthly_reports to local MonthlyHistory format
  for (const report of data.monthlyReports) {
    const archiveDate = report.archived_at
      ? new Date(report.archived_at)
      : new Date();
    const historyEntry = {
      id: `arch-${report.invoice_number}-${report.report_month}-${report.report_year}`,
      receiptCode: report.invoice_number,
      projectName: report.project_name,
      clientName: report.client_name,
      month: report.report_month,
      year: report.report_year,
      contractValue: report.contract_value,
      revenueReceived: report.contract_value - report.production_cost,
      outstandingBalance: 0,
      totalSpendings: report.production_cost,
      margin: report.net_profit,
      paymentStatus: "PAID",
      archivedAt: report.archived_at || archiveDate.toISOString(),
    };
    await saveMonthlyHistory(historyEntry);
  }

  // Update zustand stores with recovered data
  receiptStore.load();
  financialStore.load();

  console.log(
    "[DataRecovery] Successfully restored",
    counts.invoices,
    "invoices,",
    counts.invoiceItems,
    "items,",
    counts.projects,
    "projects,",
    counts.monthlyReports,
    "reports from Supabase"
  );

  return counts;
}

// ── Dashboard: Get project-based stats from Supabase ──────────────────

export async function getDashboardStatsFromSupabase(): Promise<{
  totalRevenue: number;
  productionCost: number;
  netProfit: number;
  activeProjects: number;
  totalContractValue: number;
  paidProjects: number;
  partialProjects: number;
  unpaidProjects: number;
}> {
  if (!isSupabaseConfigured()) {
    return {
      totalRevenue: 0,
      productionCost: 0,
      netProfit: 0,
      activeProjects: 0,
      totalContractValue: 0,
      paidProjects: 0,
      partialProjects: 0,
      unpaidProjects: 0,
    };
  }

  const projects = await getActiveProjects();
  const totalRevenue = projects.reduce(
    (sum, p) => sum + (p.paid_amount || 0),
    0
  );
  const productionCost = projects.reduce(
    (sum, p) => sum + (p.production_cost || 0),
    0
  );
  const totalContractValue = projects.reduce(
    (sum, p) => sum + (p.contract_value || 0),
    0
  );
  const netProfit = totalRevenue - productionCost;
  const activeProjects = projects.length;
  const paidProjects = projects.filter(
    (p) => p.payment_status === "PAID"
  ).length;
  const partialProjects = projects.filter(
    (p) => p.payment_status === "PARTIALLY_PAID"
  ).length;
  const unpaidProjects = projects.filter(
    (p) => p.payment_status === "UNPAID" || !p.payment_status
  ).length;

  return {
    totalRevenue,
    productionCost,
    netProfit,
    activeProjects,
    totalContractValue,
    paidProjects,
    partialProjects,
    unpaidProjects,
  };
}

// ── Monthly Reports from Supabase ─────────────────────────────────────

export async function getMonthlyReportsFromSupabase(): Promise<
  SupabaseMonthlyReport[]
> {
  if (!isSupabaseConfigured()) return [];
  return getAllMonthlyReports();
}