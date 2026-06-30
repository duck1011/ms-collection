import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useReceiptStore } from "@/store/receipts";
import { useFinancialStore } from "@/store/financial";
import { Receipt, SpendingCategory, Spending, CashflowType, Project } from "@/lib/db";
import { formatRupiah } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  PieChart,
  Plus,
  Trash2,
  Search,
  Eye,
  ChevronDown,
  ChevronUp,
  Printer,
  Archive,
  History,
  Filter,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  MoreHorizontal,
  ArchiveX,
  RotateCcw,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";

// ── Types ───────────────────────────────────────────────────────────

type MonthYear = { month: number; year: number };
type TabView = "current" | "history" | "archive";

type SortKey = "projectName" | "monthYear" | "totalContractValue" | "totalSpendings" | "margin";
type SortDir = "asc" | "desc";

// Spending categories
const SPENDING_CATEGORIES: { value: SpendingCategory; label: string }[] = [
  { value: "Bahan", label: "Bahan" },
  { value: "Alat", label: "Alat" },
  { value: "Gaji", label: "Gaji" },
  { value: "Transportasi", label: "Transportasi" },
  { value: "Operasional", label: "Operasional" },
  { value: "Marketing", label: "Marketing" },
  { value: "Lainnya", label: "Lainnya" },
];

const CASHFLOW_TYPES: { value: CashflowType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "qris", label: "QRIS" },
  { value: "transfer_bank", label: "Transfer Bank" },
  { value: "e_wallet", label: "E-Wallet" },
  { value: "lainnya", label: "Lainnya" },
];

const BANKS = [
  "BCA", "BNI", "BRI", "Mandiri", "Blu", "Jago", "SeaBank", "CIMB", "OCBC", "Permata", "Lainnya"
];

const E_WALLETS = [
  "Dana", "OVO", "GoPay", "ShopeePay", "LinkAja", "Lainnya"
];

const QRIS_SOURCES = [
  "BCA", "BNI", "BRI", "Mandiri", "Blu", "Jago", "SeaBank", "Dana", "OVO", "GoPay", "ShopeePay", "Lainnya"
];

// ── Helpers ─────────────────────────────────────────────────────────

function isCurrentMonth(d: Date): boolean {
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function formatMonthYear(month: number, year: number): string {
  const d = new Date(year, month - 1);
  return format(d, "MMMM yyyy", { locale: id });
}

function formatMonthYearShort(month: number, year: number): string {
  const d = new Date(year, month - 1);
  return format(d, "MMM yyyy", { locale: id });
}

function getIndonesiaDateString(): string {
  const now = new Date();
  const offset = 7 * 60;
  const localOffset = now.getTimezoneOffset();
  const totalOffset = offset + localOffset;
  const indoDate = new Date(now.getTime() + totalOffset * 60000);
  return indoDate.toISOString().split("T")[0];
}

function formatDateShort(isoString: string): string {
  try {
    return format(parseISO(isoString), "d MMM yyyy", { locale: id });
  } catch {
    return isoString;
  }
}

function getArchiveEligibility(project: Project): { eligible: boolean; reason?: string } {
  if (project.paymentStatus === "PAID") return { eligible: true };
  return { eligible: false, reason: "Proyek belum dapat diarsipkan karena pembayaran belum lunas." };
}

// ── Spending Dialog ─────────────────────────────────────────────────

function SpendingDialog({
  open,
  onOpenChange,
  receiptCode,
  receipt,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receiptCode: string;
  receipt?: Receipt;
  onSave: (spending: Omit<Spending, "id" | "createdAt">) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<SpendingCategory>("Bahan");
  const [cashflowType, setCashflowType] = useState<CashflowType>("cash");
  const [fundingSource, setFundingSource] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getIndonesiaDateString());
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setAmount("");
      setCategory("Bahan");
      setCashflowType("cash");
      setFundingSource("");
      setDescription("");
      setDate(getIndonesiaDateString());
    }
  }, [open]);

  const fundingSourceOptions = useMemo(() => {
    switch (cashflowType) {
      case "transfer_bank": return BANKS;
      case "e_wallet": return E_WALLETS;
      case "qris": return QRIS_SOURCES;
      default: return [];
    }
  }, [cashflowType]);

  useEffect(() => {
    if (fundingSourceOptions.length > 0) setFundingSource(fundingSourceOptions[0]);
    else setFundingSource("");
  }, [fundingSourceOptions]);

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      toast({ title: "Jumlah harus diisi dan lebih dari 0", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await onSave({
        receiptCode,
        amount: Number(amount),
        category,
        description: description.trim() || category,
        date,
        cashflowType,
        fundingSource: cashflowType === "cash" ? null : (fundingSource || null),
      });
      toast({ title: "Biaya berhasil ditambahkan" });
      onOpenChange(false);
    } catch {
      toast({ title: "Gagal menambahkan biaya", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const showFundingSource = cashflowType !== "cash" && cashflowType !== "lainnya";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tambah Biaya</DialogTitle>
          <DialogDescription>
            Nota: <span className="font-mono font-bold">{receiptCode}</span>
            {receipt && <> • {receipt.clientName} • {receipt.schoolOrOrganization}</>}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-1.5"><Label>Jumlah (Rp) *</Label><Input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></div>
          <div className="space-y-1.5">
            <Label>Kategori *</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as SpendingCategory)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPENDING_CATEGORIES.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Tipe Cashflow *</Label>
            <Select value={cashflowType} onValueChange={(v) => setCashflowType(v as CashflowType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CASHFLOW_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {showFundingSource && (
            <div className="space-y-1.5">
              <Label>Sumber Dana *</Label>
              <Select value={fundingSource} onValueChange={setFundingSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {fundingSourceOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5"><Label>Deskripsi (opsional)</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Deskripsi biaya..." rows={2} /></div>
          <div className="space-y-1.5"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Project Action Menu ─────────────────────────────────────────────

function ProjectActionMenu({
  project,
  onAddSpending,
  onArchive,
  onRestore,
}: {
  project: Project;
  onAddSpending: (receiptCode: string) => void;
  onArchive: (project: Project) => void;
  onRestore: (project: Project) => void;
}) {
  const isArchived = project.archived === true;
  const { eligible, reason } = getArchiveEligibility(project);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground cursor-pointer">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {!isArchived && (
          <>
            <DropdownMenuItem onClick={() => onAddSpending(project.receiptCode)} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" /> Tambah Biaya
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {eligible ? (
              <DropdownMenuItem onClick={() => onArchive(project)} className="cursor-pointer">
                <ArchiveX className="w-4 h-4 mr-2" /> Arsipkan Proyek
              </DropdownMenuItem>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild className="w-full">
                    <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none opacity-50">
                      <ArchiveX className="w-4 h-4 mr-2" /> Arsipkan Proyek
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">{reason}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </>
        )}
        {isArchived && (
          <DropdownMenuItem onClick={() => onRestore(project)} className="cursor-pointer">
            <RotateCcw className="w-4 h-4 mr-2" /> Pulihkan Proyek
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Project Card ────────────────────────────────────────────────────

function ProjectCard({
  project,
  receipt,
  spendings,
  onAddSpending,
  onDeleteSpending,
  onArchive,
  onRestore,
  isArchived,
}: {
  project: Project;
  receipt: Receipt | undefined;
  spendings: Spending[];
  onAddSpending: (receiptCode: string) => void;
  onDeleteSpending: (id: string) => void;
  onArchive: (project: Project) => void;
  onRestore: (project: Project) => void;
  isArchived?: boolean;
}) {
  const totalSpendings = spendings.reduce((s, sp) => s + sp.amount, 0);
  const contractValue = receipt?.totalPrice || project.contractValue;
  const revenueReceived = receipt?.paidAmount || project.totalRevenueReceived;
  const outstanding = contractValue - revenueReceived;
  const labaBersih = revenueReceived - totalSpendings;
  const marginPct = revenueReceived > 0 ? (labaBersih / revenueReceived) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border border-border rounded-2xl p-4 md:p-5 space-y-3 ${isArchived ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-foreground text-sm md:text-base truncate">{project.projectName}</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
            <span className="font-mono font-medium">{project.receiptCode}</span>
            <span>•</span>
            <span className="truncate">{project.customerName}</span>
            {isArchived && project.archivedAt && (
              <><span>•</span><span className="text-muted-foreground/60">Diarsipkan {formatDateShort(project.archivedAt)}</span></>
            )}
          </div>
        </div>
        <ProjectActionMenu project={project} onAddSpending={onAddSpending} onArchive={onArchive} onRestore={onRestore} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2.5 text-sm">
        <div><p className="text-[11px] text-muted-foreground">Nilai Kontrak</p><p className="font-semibold text-foreground text-sm">{formatRupiah(contractValue)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Pendapatan Diterima</p><p className={`font-semibold text-sm ${revenueReceived > 0 ? "text-green-500" : "text-muted-foreground"}`}>{formatRupiah(revenueReceived)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Sisa Tagihan</p><p className={`font-semibold text-sm ${outstanding > 0 ? "text-yellow-500" : "text-green-500"}`}>{formatRupiah(outstanding)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Pengeluaran</p><p className={`font-semibold text-sm ${totalSpendings > 0 ? "text-red-500" : "text-muted-foreground"}`}>{formatRupiah(totalSpendings)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Laba Bersih Saat Ini</p><p className={`font-semibold text-sm ${labaBersih >= 0 ? "text-green-500" : "text-red-500"}`}>{formatRupiah(labaBersih)}<span className="text-[10px] ml-1">({marginPct >= 0 ? "+" : ""}{marginPct.toFixed(1)}%)</span></p></div>
        <div><p className="text-[11px] text-muted-foreground">Status</p><StatusBadge status={project.paymentStatus} /></div>
      </div>

      {spendings.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-border">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Riwayat Pengeluaran</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {spendings.map((sp) => (
              <div key={sp.id} className="flex items-center justify-between text-xs bg-red-500/5 rounded-lg px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <ArrowDownRight className="w-3 h-3 text-red-500 shrink-0" />
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">{sp.category}</Badge>
                  {sp.description && <span className="text-muted-foreground truncate max-w-[100px]">{sp.description}</span>}
                  {sp.date && <span className="text-muted-foreground shrink-0">{format(parseISO(sp.date), "d MMM", { locale: id })}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="font-medium text-foreground">{formatRupiah(sp.amount)}</span>
                  {!isArchived && (
                    <button onClick={() => onDeleteSpending(sp.id)} className="text-muted-foreground hover:text-red-500 transition-colors" title="Hapus"><Trash2 className="w-3 h-3" /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Reusable Components ─────────────────────────────────────────────

function Badge({ variant, className, children }: { variant?: string; className?: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
      variant === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
    } ${className || ""}`}>{children}</span>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PAID: { label: "Lunas", className: "text-green-500 bg-green-500/10" },
    PARTIALLY_PAID: { label: "Sebagian", className: "text-yellow-500 bg-yellow-500/10" },
    UNPAID: { label: "Belum Bayar", className: "text-red-500 bg-red-500/10" },
  };
  const fallback = { label: "Unknown", className: "text-gray-500 bg-gray-500/10" };
  const { label, className } = map[status ?? ""] || fallback;
  return <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${className}`}>{label}</span>;
}

// ── KPI Card ────────────────────────────────────────────────────────

function KpiCard({ title, value, subtitle, icon, iconBg, iconColor, valueColor, delay, tooltip }: {
  title: string; value: string; subtitle: string; icon: React.ReactNode; iconBg: string; iconColor: string; valueColor: string; delay: number; tooltip?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs md:text-sm text-muted-foreground font-medium truncate">{title}</p>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground/60 cursor-help shrink-0" /></TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">{tooltip}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className={`w-7 h-7 md:w-8 md:h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}><span className={iconColor}>{icon}</span></div>
      </div>
      <p className={`text-xl md:text-2xl font-bold ${valueColor} leading-tight`}>{value}</p>
      <p className="text-[11px] md:text-xs text-muted-foreground leading-tight">{subtitle}</p>
    </motion.div>
  );
}

// ── Confirm Modal ──────────────────────────────────────────────────

function ConfirmModal({ open, onOpenChange, title, description, confirmLabel, confirmVariant, onConfirm }: {
  open: boolean; onOpenChange: (v: boolean) => void; title: string; description: React.ReactNode; confirmLabel: string; confirmVariant?: "default" | "destructive"; onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const handleConfirm = async () => {
    setLoading(true);
    try { await onConfirm(); onOpenChange(false); } catch { toast({ title: "Gagal memproses", variant: "destructive" }); } finally { setLoading(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription asChild><div className="space-y-2 mt-2">{description}</div></DialogDescription></DialogHeader>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Batal</Button>
          <Button variant={confirmVariant || "default"} onClick={handleConfirm} disabled={loading}>{loading ? "Memproses..." : confirmLabel}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────

export default function FinancialDashboard() {
  const { receipts, load: loadReceipts, loaded: receiptsLoaded } = useReceiptStore();
  const {
    spendings, monthlyHistory, projects, payments,
    load: loadFinancial, loaded: financialLoaded,
    addSpending, removeSpending,
    runMigration, archiveProject, restoreProject, migrateArchiveFields,
  } = useFinancialStore();
  const { toast } = useToast();

  const [spendingDialogReceipt, setSpendingDialogReceipt] = useState<string | null>(null);
  const [spendingDialogReceiptData, setSpendingDialogReceiptData] = useState<Receipt | undefined>(undefined);
  const [tab, setTab] = useState<TabView>("current");
  const [historySearch, setHistorySearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("monthYear");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedMonth, setSelectedMonth] = useState<MonthYear | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Project | null>(null);

  useEffect(() => {
    if (!receiptsLoaded) loadReceipts();
    if (!financialLoaded) loadFinancial();
  }, [receiptsLoaded, financialLoaded, loadReceipts, loadFinancial]);

  useEffect(() => {
    if (financialLoaded) {
      migrateArchiveFields().catch((err) => console.warn('[Dashboard] Archive field migration:', err));
      if (projects.length === 0 && receipts.length > 0) {
        runMigration().then((count) => { if (count > 0) toast({ title: `Migrasi: ${count} proyek dibuat` }); });
      }
    }
  }, [financialLoaded, projects.length, receipts.length, runMigration, toast, migrateArchiveFields]);

  // ── Data Computations ─────────────────────────────────────────────

  const activeProjects = useMemo(() => projects.filter((p) => p.archived !== true), [projects]);
  const archivedProjects = useMemo(() => projects.filter((p) => p.archived === true), [projects]);

  const currentMonthProjects = useMemo(() =>
    activeProjects.filter((p) => { try { return isCurrentMonth(parseISO(p.createdAt)); } catch { return false; } }),
  [activeProjects]);

  const currentMonthSpendings = useMemo(() =>
    spendings.filter((s) => { try { return isCurrentMonth(new Date(s.date)); } catch { return false; } }),
  [spendings]);

  // ── KPIs ──────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const total = currentMonthProjects.length;
    const lunas = currentMonthProjects.filter((p) => p.paymentStatus === "PAID").length;
    const partial = currentMonthProjects.filter((p) => p.paymentStatus === "PARTIALLY_PAID").length;
    const unpaid = currentMonthProjects.filter((p) => p.paymentStatus === "UNPAID").length;
    const menunggu = partial + unpaid;

    let totalContractValue = 0;
    let totalRevenueReceived = 0;
    let totalExpenses = 0;

    for (const p of currentMonthProjects) {
      totalContractValue += p.contractValue;
      totalRevenueReceived += p.totalRevenueReceived;
      totalExpenses += p.totalExpenses;
    }

    const totalOutstanding = totalContractValue - totalRevenueReceived;
    const labaBersihSaatIni = totalRevenueReceived - totalExpenses;
    const marginPct = totalRevenueReceived > 0 ? (labaBersihSaatIni / totalRevenueReceived) * 100 : 0;
    const tertagihPct = totalContractValue > 0 ? Math.round((totalRevenueReceived / totalContractValue) * 100) : 0;

    return { total, lunas, partial, unpaid, menunggu, totalContractValue, totalRevenueReceived, totalExpenses, totalOutstanding, labaBersihSaatIni, marginPct, tertagihPct };
  }, [currentMonthProjects]);

  // ── Cashflow (FIX: use all-time payments from receipt data, not filtered by month) ──

  const cashflowMetrics = useMemo(() => {
    // Kas Masuk = sum of all payments received (from payments table, all time)
    const cashIn = payments.reduce((s, p) => s + p.amount, 0);
    // If payments table is empty, fall back to totalRevenueReceived from projects
    const cashInFallback = cashIn > 0 ? cashIn : projects.reduce((s, p) => s + p.totalRevenueReceived, 0);
    const cashOut = currentMonthSpendings.reduce((s, sp) => s + sp.amount, 0);
    return { cashIn: cashInFallback, cashOut, netCash: cashInFallback - cashOut };
  }, [payments, projects, currentMonthSpendings]);

  const spendingsByReceipt = useMemo(() => {
    const map = new Map<string, Spending[]>();
    for (const sp of spendings) {
      const list = map.get(sp.receiptCode) || [];
      list.push(sp);
      map.set(sp.receiptCode, list);
    }
    return map;
  }, [spendings]);

  // ── Archived Projects Report (NEW: replaces old monthlyHistory) ──

  type ArchiveReportEntry = {
    receiptCode: string;
    projectName: string;
    clientName: string;
    month: number;
    year: number;
    contractValue: number;
    totalSpendings: number;
    labaBersih: number;
  };

  const archivedReport: ArchiveReportEntry[] = useMemo(() => {
    return archivedProjects
      .filter((p) => p.archivedAt) // must have an archive date
      .map((p) => {
        const d = new Date(p.archivedAt!);
        const projectSpendings = spendings.filter((s) => s.receiptCode === p.receiptCode);
        const totalBiaya = projectSpendings.reduce((sum, s) => sum + s.amount, 0);
        const laba = p.contractValue - totalBiaya;
        return {
          receiptCode: p.receiptCode,
          projectName: p.projectName,
          clientName: p.customerName,
          month: d.getMonth() + 1,
          year: d.getFullYear(),
          contractValue: p.contractValue,
          totalSpendings: totalBiaya,
          labaBersih: laba,
        };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month || b.receiptCode.localeCompare(a.receiptCode));
  }, [archivedProjects, spendings]);

  const uniqueReportMonths = useMemo(() => {
    const set = new Set<string>();
    const months: MonthYear[] = [];
    for (const r of archivedReport) {
      const key = `${r.year}-${r.month}`;
      if (!set.has(key)) { set.add(key); months.push({ month: r.month, year: r.year }); }
    }
    return months.sort((a, b) => b.year - a.year || b.month - a.month);
  }, [archivedReport]);

  const filteredArchivedReport = useMemo(() => {
    if (!selectedMonth) return archivedReport;
    return archivedReport.filter((r) => r.month === selectedMonth.month && r.year === selectedMonth.year);
  }, [archivedReport, selectedMonth]);

  // ── Old History (preserved for existing data) ────────────────────

  const filteredHistory = useMemo(() => {
    let list = [...monthlyHistory];
    if (historySearch) {
      const q = historySearch.toLowerCase();
      list = list.filter((h) => h.projectName.toLowerCase().includes(q) || h.clientName.toLowerCase().includes(q) || formatMonthYear(h.month, h.year).toLowerCase().includes(q));
    }
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "projectName": cmp = a.projectName.localeCompare(b.projectName); break;
        case "monthYear": cmp = a.year !== b.year ? a.year - b.year : a.month - b.month; break;
        case "totalContractValue": cmp = a.contractValue - b.contractValue; break;
        case "totalSpendings": cmp = a.totalSpendings - b.totalSpendings; break;
        case "margin": cmp = a.margin - b.margin; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return list;
  }, [monthlyHistory, historySearch, sortKey, sortDir]);

  const uniqueMonths = useMemo(() => {
    const set = new Set<string>();
    const months: MonthYear[] = [];
    for (const h of monthlyHistory) {
      const key = `${h.year}-${h.month}`;
      if (!set.has(key)) { set.add(key); months.push({ month: h.month, year: h.year }); }
    }
    return months.sort((a, b) => b.year - a.year || b.month - a.month);
  }, [monthlyHistory]);

  // ── Handlers ──────────────────────────────────────────────────────

  const handleArchiveProject = useCallback(async (project: Project) => {
    const result = await archiveProject(project.receiptCode);
    if (result) toast({ title: "Proyek diarsipkan", description: `${project.projectName} telah dipindahkan ke arsip.` });
    else toast({ title: "Gagal mengarsipkan", variant: "destructive" });
    setArchiveTarget(null);
  }, [archiveProject, toast]);

  const handleRestoreProject = useCallback(async (project: Project) => {
    const result = await restoreProject(project.receiptCode);
    if (result) toast({ title: "Proyek dipulihkan", description: `${project.projectName} telah kembali ke daftar aktif.` });
    else toast({ title: "Gagal memulihkan", variant: "destructive" });
    setRestoreTarget(null);
  }, [restoreProject, toast]);

  const handlePrint = useCallback(() => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) { toast({ title: "Pop-up diblokir.", variant: "destructive" }); return; }

    const data = filteredArchivedReport;
    const totalKontrak = data.reduce((s, r) => s + r.contractValue, 0);
    const totalBiaya = data.reduce((s, r) => s + r.totalSpendings, 0);
    const totalLaba = data.reduce((s, r) => s + r.labaBersih, 0);

    const rows = data.map((r) =>
      `<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 12px;font-size:14px">${r.projectName}</td>
        <td style="padding:8px 12px;font-size:14px">${formatMonthYearShort(r.month, r.year)}</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right">${formatRupiah(r.contractValue)}</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right">${formatRupiah(r.totalSpendings)}</td>
        <td style="padding:8px 12px;font-size:14px;text-align:right;font-weight:600;color:${r.labaBersih >= 0 ? "#16a34a" : "#dc2626"}">${formatRupiah(r.labaBersih)}</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Laporan Keuangan Bulanan MS Collection</title><style>
      @page{margin:2cm}body{font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;color:#111}
      h1{text-align:center;font-size:24px;margin-bottom:4px}
      .subtitle{text-align:center;font-size:14px;color:#666;margin-bottom:24px}
      .summary{display:flex;justify-content:space-between;margin-bottom:32px}
      .summary-item{text-align:center;padding:16px;border:1px solid #d1d5db;border-radius:8px;flex:1;margin:0 8px}
      .summary-item p:first-child{font-size:12px;color:#666;margin:0 0 4px 0}
      .summary-item .value{font-size:20px;font-weight:700;margin:0}
      table{width:100%;border-collapse:collapse;margin-top:8px}
      th{text-align:left;padding:8px 12px;font-size:12px;font-weight:600;text-transform:uppercase;color:#374151;border-bottom:2px solid #9ca3af}
      td{padding:8px 12px;font-size:14px}
      th:last-child,td:last-child{text-align:right}
      tfoot tr{border-top:2px solid #9ca3af;font-weight:700}
    </style></head><body>
      <h1>LAPORAN KEUANGAN BULANAN</h1>
      <p class="subtitle">MS Collection ${selectedMonth ? formatMonthYear(selectedMonth.month, selectedMonth.year) : "Semua Periode"} • Dicetak ${format(new Date(), "d MMMM yyyy", { locale: id })}</p>
      <div class="summary">
        <div class="summary-item"><p>TOTAL NILAI KONTRAK</p><p class="value">${formatRupiah(totalKontrak)}</p></div>
        <div class="summary-item"><p>TOTAL BIAYA</p><p class="value">${formatRupiah(totalBiaya)}</p></div>
        <div class="summary-item"><p>TOTAL LABA BERSIH</p><p class="value" style="color:${totalLaba >= 0 ? "#16a34a" : "#dc2626"}">${formatRupiah(totalLaba)}</p></div>
      </div>
      <table><thead><tr><th>Proyek</th><th>Periode</th><th style="text-align:right">Nilai Kontrak</th><th style="text-align:right">Total Biaya</th><th style="text-align:right">Laba Bersih</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><td colspan="2" style="padding:8px 12px">Total</td>
          <td style="padding:8px 12px;text-align:right">${formatRupiah(totalKontrak)}</td>
          <td style="padding:8px 12px;text-align:right">${formatRupiah(totalBiaya)}</td>
          <td style="padding:8px 12px;text-align:right;color:${totalLaba >= 0 ? "#16a34a" : "#dc2626"}">${formatRupiah(totalLaba)}</td>
        </tr></tfoot>
      </table>
    </body></html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 500);
  }, [filteredArchivedReport, selectedMonth, toast]);

  const toggleSort = useCallback((key: SortKey) => {
    setSortKey((prev) => { if (prev === key) { setSortDir((d) => d === "asc" ? "desc" : "asc"); return prev; } setSortDir("desc"); return key; });
  }, []);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "desc" ? <ChevronDown className="w-3 h-3 inline ml-1" /> : <ChevronUp className="w-3 h-3 inline ml-1" />;
  };

  const tabButtons = (
    <div className="flex gap-1.5 md:gap-2 shrink-0 no-print">
      {(["current", "history", "archive"] as const).map((t) => (
        <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)} className="h-8 text-xs px-2.5">
          {t === "current" && <><DollarSign className="w-3.5 h-3.5 mr-1" /><span className="hidden sm:inline">Bulan Ini</span><span className="sm:hidden">Kini</span></>}
          {t === "history" && <><Printer className="w-3.5 h-3.5 mr-1" /> Laporan</>}
          {t === "archive" && <><Archive className="w-3.5 h-3.5 mr-1" /> Arsip</>}
        </Button>
      ))}
    </div>
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-5 md:space-y-8">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-bold">Dashboard Keuangan</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Profitabilitas proyek</p>
        </div>
        {tabButtons}
      </div>

      {/* ── CURRENT MONTH TAB ── */}
      {tab === "current" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
            <KpiCard title="Nilai Kontrak" value={formatRupiah(kpis.totalContractValue)} subtitle={`${kpis.total} proyek aktif`} icon={<DollarSign className="w-4 h-4" />} iconBg="bg-blue-500/10" iconColor="text-blue-500" valueColor="text-foreground" delay={0} />
            <KpiCard title="Pendapatan Diterima" value={formatRupiah(kpis.totalRevenueReceived)} subtitle={`${kpis.tertagihPct}% Tertagih • ${kpis.lunas} dari ${kpis.total} proyek lunas`} icon={<TrendingUp className="w-4 h-4" />} iconBg="bg-green-500/10" iconColor="text-green-500" valueColor="text-green-500" delay={0.05} tooltip="Total pembayaran yang telah diterima dari seluruh proyek." />
            <KpiCard title="Sisa Tagihan" value={formatRupiah(kpis.totalOutstanding)} subtitle={`${kpis.menunggu} proyek menunggu pembayaran`} icon={<Banknote className="w-4 h-4" />} iconBg="bg-yellow-500/10" iconColor="text-yellow-500" valueColor="text-yellow-500" delay={0.1} />
            <KpiCard title="Pengeluaran" value={formatRupiah(kpis.totalExpenses)} subtitle={`${currentMonthSpendings.length} transaksi`} icon={<TrendingDown className="w-4 h-4" />} iconBg="bg-red-500/10" iconColor="text-red-500" valueColor="text-red-500" delay={0.15} />
            <KpiCard title="Laba Bersih Saat Ini" value={formatRupiah(kpis.labaBersihSaatIni)} subtitle={`Margin Bersih: ${kpis.marginPct.toFixed(1)}%`} icon={<PieChart className="w-4 h-4" />} iconBg={kpis.labaBersihSaatIni >= 0 ? "bg-green-500/10" : "bg-red-500/10"} iconColor={kpis.labaBersihSaatIni >= 0 ? "text-green-500" : "text-red-500"} valueColor={kpis.labaBersihSaatIni >= 0 ? "text-green-500" : "text-red-500"} delay={0.2} />
          </div>

          {/* Compact Cashflow - FIXED to show actual values */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="bg-card border border-border rounded-2xl p-3.5 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs md:text-sm font-medium text-muted-foreground">Arus Kas</p>
            </div>
            <div className="grid grid-cols-3 gap-3 md:gap-6">
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground">Kas Masuk</p>
                <p className="text-xs md:text-sm font-semibold text-green-500">{formatRupiah(cashflowMetrics.cashIn)}</p>
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground">Kas Keluar (Bulan Ini)</p>
                <p className="text-xs md:text-sm font-semibold text-red-500">{formatRupiah(cashflowMetrics.cashOut)}</p>
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground">Posisi Kas</p>
                <p className={`text-xs md:text-sm font-bold ${cashflowMetrics.netCash >= 0 ? "text-green-500" : "text-red-500"}`}>{formatRupiah(cashflowMetrics.netCash)}</p>
              </div>
            </div>
          </motion.div>

          {/* Active Projects */}
          <div className="space-y-3 md:space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base md:text-lg font-semibold">Daftar Proyek</h2>
              {currentMonthProjects.length > 0 && <span className="text-xs md:text-sm text-muted-foreground">{currentMonthProjects.length} proyek</span>}
            </div>
            {currentMonthProjects.length === 0 ? (
              <div className="text-center py-12 md:py-16 text-muted-foreground bg-card border border-border rounded-2xl">
                <p className="text-sm">Belum ada proyek bulan ini</p>
                <p className="text-xs mt-1">Buat nota baru untuk memulai</p>
              </div>
            ) : (
              currentMonthProjects.map((project) => {
                const receipt = receipts.find((r) => r.receiptCode === project.receiptCode);
                return (
                  <ProjectCard key={project.receiptCode} project={project} receipt={receipt}
                    spendings={spendingsByReceipt.get(project.receiptCode) || []}
                    onAddSpending={(code) => { setSpendingDialogReceipt(code); setSpendingDialogReceiptData(receipts.find((r) => r.receiptCode === code)); }}
                    onDeleteSpending={(id) => { removeSpending(id); toast({ title: "Pengeluaran dihapus" }); }}
                    onArchive={(p) => setArchiveTarget(p)} onRestore={(p) => setRestoreTarget(p)} />
                );
              })
            )}
          </div>
        </>
      )}

      {/* ── LAPORAN BULANAN TAB (from archived projects) ── */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold">Laporan Keuangan Bulanan</h2>
            {archivedReport.length > 0 && (
              <Button size="sm" variant="outline" onClick={handlePrint} className="no-print h-8 text-xs">
                <Printer className="w-3.5 h-3.5 mr-1" /> Cetak
              </Button>
            )}
          </div>

          <div className="flex gap-3 flex-col sm:flex-row no-print">
            <Select value={selectedMonth ? `${selectedMonth.year}-${selectedMonth.month}` : "all"} onValueChange={(v) => {
              if (v === "all") setSelectedMonth(null);
              else { const [year, month] = v.split("-").map(Number); setSelectedMonth({ month, year }); }
            }}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-sm">
                <Filter className="w-3.5 h-3.5 mr-1" /><SelectValue placeholder="Semua Periode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Periode</SelectItem>
                {uniqueReportMonths.map((m) => (
                  <SelectItem key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{formatMonthYear(m.month, m.year)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredArchivedReport.length === 0 ? (
            <div className="text-center py-12 md:py-16 text-muted-foreground bg-card border border-border rounded-2xl">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada laporan</p>
              <p className="text-xs mt-1">Arsipkan proyek yang sudah lunas untuk melihat laporan keuangan bulanan</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap text-xs">Proyek</TableHead>
                    <TableHead className="whitespace-nowrap text-xs">Periode</TableHead>
                    <TableHead className="text-right whitespace-nowrap text-xs">Nilai Kontrak</TableHead>
                    <TableHead className="text-right whitespace-nowrap text-xs">Total Biaya</TableHead>
                    <TableHead className="text-right whitespace-nowrap text-xs">Laba Bersih</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArchivedReport.map((r) => (
                    <TableRow key={r.receiptCode}>
                      <TableCell className="font-medium text-xs">{r.projectName}</TableCell>
                      <TableCell className="text-xs">{formatMonthYearShort(r.month, r.year)}</TableCell>
                      <TableCell className="text-right text-xs">{formatRupiah(r.contractValue)}</TableCell>
                      <TableCell className="text-right text-red-500 text-xs">{formatRupiah(r.totalSpendings)}</TableCell>
                      <TableCell className={`text-right font-medium text-xs ${r.labaBersih >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {formatRupiah(r.labaBersih)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {/* Summary row */}
              <div className="px-4 py-3 border-t border-border text-xs flex justify-between font-semibold">
                <span>Total Nilai Kontrak: {formatRupiah(filteredArchivedReport.reduce((s, r) => s + r.contractValue, 0))}</span>
                <span>Total Biaya: {formatRupiah(filteredArchivedReport.reduce((s, r) => s + r.totalSpendings, 0))}</span>
                <span className={filteredArchivedReport.reduce((s, r) => s + r.labaBersih, 0) >= 0 ? "text-green-500" : "text-red-500"}>
                  Total Laba: {formatRupiah(filteredArchivedReport.reduce((s, r) => s + r.labaBersih, 0))}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ARCHIVE TAB ── */}
      {tab === "archive" && (
        <div className="space-y-3 md:space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base md:text-lg font-semibold">Proyek Diarsipkan</h2>
            {archivedProjects.length > 0 && <span className="text-xs md:text-sm text-muted-foreground">{archivedProjects.length} proyek</span>}
          </div>
          {archivedProjects.length === 0 ? (
            <div className="text-center py-12 md:py-16 text-muted-foreground bg-card border border-border rounded-2xl">
              <Archive className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Belum ada proyek diarsipkan</p>
              <p className="text-xs mt-1">Arsipkan proyek yang sudah lunas</p>
            </div>
          ) : (
            archivedProjects.map((project) => {
              const receipt = receipts.find((r) => r.receiptCode === project.receiptCode);
              return (
                <ProjectCard key={project.receiptCode} project={project} receipt={receipt}
                  spendings={spendingsByReceipt.get(project.receiptCode) || []}
                  onAddSpending={() => {}} onDeleteSpending={() => {}}
                  onArchive={() => {}} onRestore={(p) => setRestoreTarget(p)} isArchived />
              );
            })
          )}
        </div>
      )}

      {/* ── Modals ── */}
      <SpendingDialog open={!!spendingDialogReceipt} onOpenChange={(v) => { if (!v) { setSpendingDialogReceipt(null); setSpendingDialogReceiptData(undefined); } }}
        receiptCode={spendingDialogReceipt || ""} receipt={spendingDialogReceiptData}
        onSave={async (data) => { await addSpending(data); }} />

      {archiveTarget && (
        <ConfirmModal open={!!archiveTarget} onOpenChange={(v) => { if (!v) setArchiveTarget(null); }}
          title="Arsipkan Proyek?"
          description={<div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Kode Proyek:</span> <span className="font-mono font-medium">{archiveTarget.receiptCode}</span></p>
            <p><span className="text-muted-foreground">Klien:</span> <span className="font-medium">{archiveTarget.projectName}</span></p>
            <p className="text-xs text-muted-foreground mt-2">Proyek akan dipindahkan ke Arsip.</p>
            <p className="text-xs text-muted-foreground">Data keuangan tidak akan dihapus. Data dapat dipulihkan kapan saja.</p>
          </div>}
          confirmLabel="Arsipkan" onConfirm={() => handleArchiveProject(archiveTarget)} />
      )}

      {restoreTarget && (
        <ConfirmModal open={!!restoreTarget} onOpenChange={(v) => { if (!v) setRestoreTarget(null); }}
          title="Pulihkan Proyek?"
          description={<div className="space-y-1 text-sm">
            <p><span className="text-muted-foreground">Kode Proyek:</span> <span className="font-mono font-medium">{restoreTarget.receiptCode}</span></p>
            <p><span className="text-muted-foreground">Klien:</span> <span className="font-medium">{restoreTarget.projectName}</span></p>
            <p className="text-xs text-muted-foreground mt-2">Proyek akan kembali ke daftar aktif.</p>
            <p className="text-xs text-muted-foreground">Data keuangan tetap utuh.</p>
          </div>}
          confirmLabel="Pulihkan" onConfirm={() => handleRestoreProject(restoreTarget)} />
      )}
    </div>
  );
}