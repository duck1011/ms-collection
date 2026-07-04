import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Supabase features will be disabled."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);

// ── Type helpers ──────────────────────────────────────────────────────

export interface SupabaseInvoice {
  id?: string;
  receipt_code: string;
  client_name: string;
  client_phone: string;
  school_or_organization: string;
  date: string;
  created_at: string;
  total_price: number;
  paid_amount: number;
  payment_status: "PAID" | "PARTIALLY_PAID" | "UNPAID";
  notes?: string | null;
}

export interface SupabaseInvoiceItem {
  id?: string;
  invoice_id: string;
  product_type: string;
  size: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  price_mode?: string | null;
  size_prices?: Record<string, number> | null;
}

export interface SupabaseProject {
  id?: string;
  project_name: string;
  contract_value: number;
  production_cost: number;
  status: "ACTIVE" | "ARCHIVED";
  receipt_code?: string | null;
  client_name?: string | null;
  paid_amount?: number | null;
  payment_status?: string | null;
  archived_at?: string | null;
  created_at?: string;
}

export interface SupabaseMonthlyReport {
  id?: string;
  invoice_number: string;
  client_name: string;
  project_name: string;
  contract_value: number;
  production_cost: number;
  net_profit: number;
  report_month: number;
  report_year: number;
  archived_at?: string;
  created_at?: string;
}

export interface SupabaseOwner {
  id?: string;
  username: string;
  created_at?: string;
}

// ── Invoices ──────────────────────────────────────────────────────────

export async function insertInvoice(
  invoice: Omit<SupabaseInvoice, "id">
): Promise<SupabaseInvoice | null> {
  const { data, error } = await supabase
    .from("invoices")
    .insert(invoice)
    .select()
    .single();
  if (error) {
    console.error("[Supabase] insertInvoice error:", error);
    return null;
  }
  return data;
}

export async function getInvoiceByCode(
  receiptCode: string
): Promise<SupabaseInvoice | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .eq("receipt_code", receiptCode)
    .maybeSingle();
  if (error) {
    console.error("[Supabase] getInvoiceByCode error:", error);
    return null;
  }
  return data;
}

export async function getAllInvoices(): Promise<SupabaseInvoice[]> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[Supabase] getAllInvoices error:", error);
    return [];
  }
  return data || [];
}

// ── Invoice Items ─────────────────────────────────────────────────────

export async function insertInvoiceItems(
  items: Omit<SupabaseInvoiceItem, "id">[]
): Promise<boolean> {
  const { error } = await supabase.from("invoice_items").insert(items);
  if (error) {
    console.error("[Supabase] insertInvoiceItems error:", error);
    return false;
  }
  return true;
}

export async function getInvoiceItemsByInvoiceId(
  invoiceId: string
): Promise<SupabaseInvoiceItem[]> {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId);
  if (error) {
    console.error("[Supabase] getInvoiceItemsByInvoiceId error:", error);
    return [];
  }
  return data || [];
}

// ── Projects ──────────────────────────────────────────────────────────

export async function insertProject(
  project: Omit<SupabaseProject, "id">
): Promise<SupabaseProject | null> {
  const { data, error } = await supabase
    .from("projects")
    .insert(project)
    .select()
    .single();
  if (error) {
    console.error("[Supabase] insertProject error:", error);
    return null;
  }
  return data;
}

export async function updateProjectStatus(
  receiptCode: string,
  status: "ACTIVE" | "ARCHIVED",
  archivedAt?: string
): Promise<boolean> {
  const updateData: Record<string, string> = { status };
  if (archivedAt) updateData.archived_at = archivedAt;
  const { error } = await supabase
    .from("projects")
    .update(updateData)
    .eq("receipt_code", receiptCode);
  if (error) {
    console.error("[Supabase] updateProjectStatus error:", error);
    return false;
  }
  return true;
}

export async function getAllProjects(): Promise<SupabaseProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[Supabase] getAllProjects error:", error);
    return [];
  }
  return data || [];
}

export async function getActiveProjects(): Promise<SupabaseProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("status", "ACTIVE");
  if (error) {
    console.error("[Supabase] getActiveProjects error:", error);
    return [];
  }
  return data || [];
}

export async function getArchivedProjects(): Promise<SupabaseProject[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("status", "ARCHIVED");
  if (error) {
    console.error("[Supabase] getArchivedProjects error:", error);
    return [];
  }
  return data || [];
}

// ── Monthly Reports ───────────────────────────────────────────────────

export async function insertMonthlyReport(
  report: Omit<SupabaseMonthlyReport, "id">
): Promise<SupabaseMonthlyReport | null> {
  const { data, error } = await supabase
    .from("monthly_reports")
    .insert(report)
    .select()
    .single();
  if (error) {
    console.error("[Supabase] insertMonthlyReport error:", error);
    return null;
  }
  return data;
}

export async function getAllMonthlyReports(): Promise<SupabaseMonthlyReport[]> {
  const { data, error } = await supabase
    .from("monthly_reports")
    .select("*")
    .order("report_year", { ascending: false })
    .order("report_month", { ascending: false });
  if (error) {
    console.error("[Supabase] getAllMonthlyReports error:", error);
    return [];
  }
  return data || [];
}

// ── Secure Owner Login (RPC-based, never exposes hashes) ──────────────

/**
 * Securely verifies owner credentials via a Supabase RPC call.
 * The RPC function should accept (username, password, pin) and return
 * { success: boolean, message: string } without exposing password_hash or pin_hash.
 * 
 * If the RPC function does not exist, falls back to a client-side check
 * that only compares against a hashed format (never exposes raw hashes).
 */
export async function verifyOwnerLoginSecure(
  username: string,
  password: string,
  pin: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Try RPC first — this is the secure path
    const { data, error } = await supabase.rpc("verify_owner_login", {
      p_username: username,
      p_password: password,
      p_pin: pin,
    });

    if (!error && data) {
      return {
        success: data.success === true,
        message: data.message || (data.success ? "Login berhasil" : "Login gagal"),
      };
    }

    // If RPC doesn't exist, use a secure select (only returns public fields, not hashes)
    // This requires the owners table to have RLS enabled
    if (error && error.message?.includes("function") === false) {
      console.warn("[Supabase] RPC error:", error);
    }

    // Fallback: query owner without password_hash/pin_hash fields
    const { data: owner, error: selectError } = await supabase
      .from("owners")
      .select("id, username")
      .eq("username", username)
      .maybeSingle();

    if (selectError || !owner) {
      return { success: false, message: "Username tidak ditemukan" };
    }

    // Verify via a second RPC that checks the credentials
    const { data: checkData, error: checkError } = await supabase.rpc(
      "check_owner_credentials",
      {
        p_username: username,
        p_password: password,
        p_pin: pin,
      }
    );

    if (!checkError && checkData !== null) {
      return {
        success: checkData === true,
        message: checkData ? "Login berhasil" : "Kredensial salah",
      };
    }

    return { success: false, message: "Login tidak tersedia saat ini" };
  } catch (err) {
    console.error("[Supabase] verifyOwnerLoginSecure error:", err);
    return { success: false, message: "Gagal terhubung ke server" };
  }
}

// ── Data Recovery ─────────────────────────────────────────────────────

export async function loadAllData(): Promise<{
  invoices: SupabaseInvoice[];
  invoiceItems: SupabaseInvoiceItem[];
  projects: SupabaseProject[];
  monthlyReports: SupabaseMonthlyReport[];
}> {
  const [invoices, projects, monthlyReports] = await Promise.all([
    getAllInvoices(),
    getAllProjects(),
    getAllMonthlyReports(),
  ]);

  // Load invoice items for all invoices (batch if possible)
  const invoiceItems: SupabaseInvoiceItem[] = [];
  const invoiceIds = invoices.filter((inv) => inv.id).map((inv) => inv.id!);
  
  if (invoiceIds.length > 0) {
    // Batch query all items at once
    const { data: allItems, error } = await supabase
      .from("invoice_items")
      .select("*")
      .in("invoice_id", invoiceIds);
    
    if (error) {
      console.error("[Supabase] loadAllData batch items error:", error);
      // Fallback to individual queries
      for (const inv of invoices) {
        if (inv.id) {
          const items = await getInvoiceItemsByInvoiceId(inv.id);
          invoiceItems.push(...items);
        }
      }
    } else if (allItems) {
      invoiceItems.push(...allItems);
    }
  }

  return { invoices, invoiceItems, projects, monthlyReports };
}