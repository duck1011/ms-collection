import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { useReceiptStore } from "@/store/receipts";
import { Receipt } from "@/lib/db";
import { formatRupiah, formatDateShort, cn } from "@/lib/utils";
import { downloadReceiptPDF } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Search,
  Download,
  Trash2,
  Pencil,
  Wallet,
  MoreVertical,
  SlidersHorizontal,
  Check,
  CheckCircle2,
  CircleDashed,
  TriangleAlert,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  ChevronLeft,
  ChevronRight,
  ScanSearch,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StatusFilter = "ALL" | "PAID" | "PARTIALLY_PAID" | "UNPAID";
type TimeFilter = "ALL_TIME" | "THIS_MONTH";
type SortFilter = "NEWEST" | "OLDEST";

const PAGE_SIZE = 8;

const FILTER_CHIPS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "UNPAID", label: "Belum Bayar" },
  { value: "PAID", label: "Lunas" },
  { value: "PARTIALLY_PAID", label: "Sebagian" },
];

const STATUS_PILL: Record<
  Receipt["paymentStatus"],
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  PAID: {
    label: "Lunas",
    icon: CheckCircle2,
    className: "border-[#2E5C50]/50 bg-[#1B3A35]/60 text-[#79C0B3]",
  },
  PARTIALLY_PAID: {
    label: "Sebagian",
    icon: CircleDashed,
    className: "border-[#5A4B24]/50 bg-[#3A3119]/50 text-[#D2B27A]",
  },
  UNPAID: {
    label: "Belum Bayar",
    icon: TriangleAlert,
    className: "border-[#5A3128]/50 bg-[#3A211D]/50 text-[#D89386]",
  },
};

function StatusPill({ status }: { status: Receipt["paymentStatus"] }) {
  const { label, className, icon: Icon } = STATUS_PILL[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none whitespace-nowrap ${className}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {label}
    </span>
  );
}

function ReceiptActionsMenu({
  code,
  showPayment,
  align = "end",
  onEdit,
  onPayment,
  onDownload,
  onDelete,
}: {
  code: string;
  showPayment: boolean;
  align?: "start" | "center" | "end";
  onEdit: () => void;
  onPayment: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          data-testid={`button-detail-more-${code}`}
          aria-label="Menu aksi"
          className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-[#8FA4A6] transition-colors hover:text-[#EAF1EF] hover:bg-[#16242B] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60 focus-visible:bg-[#16242B]"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className="w-48 bg-[#0D161C] border-[#1E2C33] text-[#EAF1EF]"
      >
        <DropdownMenuItem
          onClick={onEdit}
          data-testid={`button-detail-edit-${code}`}
          className="cursor-pointer min-h-[44px]"
        >
          <Pencil className="w-4 h-4" /> Edit Invoice
        </DropdownMenuItem>
        {showPayment && (
          <DropdownMenuItem
            onClick={onPayment}
            className="cursor-pointer min-h-[44px]"
            data-testid={`button-detail-payment-${code}`}
          >
            <Wallet className="w-4 h-4" /> Pembayaran
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={onDownload}
          className="cursor-pointer min-h-[44px]"
          data-testid={`button-detail-download-${code}`}
        >
          <Download className="w-4 h-4" /> Export PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          className="text-[#D89386] focus:text-[#D89386] focus:bg-[#3A211D]/50 cursor-pointer min-h-[44px]"
          data-testid={`button-detail-delete-${code}`}
        >
          <Trash2 className="w-4 h-4" /> Hapus
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function ReceiptDetailModal({
  receipt,
  onClose,
  onEdit,
  onPayment,
  onDownload,
  onDelete,
}: {
  receipt: Receipt;
  onClose: () => void;
  onEdit: () => void;
  onPayment: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  return (
    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto bg-[#0C141A] border-[#1E2C33] text-[#EAF1EF]">
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between gap-2 pr-10">
          <span className="truncate">Detail Nota — {receipt.receiptCode}</span>
          <ReceiptActionsMenu
            code={receipt.receiptCode}
            showPayment={receipt.paymentStatus !== "PAID"}
            onEdit={onEdit}
            onPayment={onPayment}
            onDownload={onDownload}
            onDelete={onDelete}
          />
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-5 mt-2">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[#8FA4A6]">Nama</p>
            <p className="font-medium">{receipt.clientName}</p>
          </div>
          <div>
            <p className="text-xs text-[#8FA4A6]">Telepon</p>
            <p className="font-medium">{receipt.clientPhone}</p>
          </div>
          <div>
            <p className="text-xs text-[#8FA4A6]">Sekolah/Org</p>
            <p className="font-medium">{receipt.schoolOrOrganization}</p>
          </div>
          <div>
            <p className="text-xs text-[#8FA4A6]">Tanggal</p>
            <p className="font-medium">{formatDateShort(receipt.date)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#8FA4A6] uppercase tracking-wide">Item Pesanan</p>
          <div className="space-y-1.5">
            {receipt.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-[#8FA4A6]">
                  {item.category && item.subcategory
                    ? item.subcategory === "Customized" || item.subcategory === "Others"
                      ? item.customProductName
                        ? `${item.category} — ${item.subcategory} (${item.customProductName})`
                        : `${item.category} — ${item.subcategory}`
                      : `${item.category} — ${item.subcategory}`
                    : item.productType} ({item.size}) × {item.quantity}
                </span>
                <span className="font-medium">{formatRupiah(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#1E2C33] pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[#8FA4A6]">Total</span>
            <span className="font-bold">{formatRupiah(receipt.totalPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8FA4A6]">Dibayar</span>
            <span className="text-[#79C0B3] font-medium">{formatRupiah(receipt.paidAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8FA4A6]">Sisa</span>
            <span className="text-[#D89386] font-medium">
              {formatRupiah(Math.max(0, receipt.totalPrice - receipt.paidAmount))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#8FA4A6]">Status</span>
            <StatusPill status={receipt.paymentStatus} />
          </div>
        </div>

        {receipt.notes && (
          <div>
            <p className="text-xs text-[#8FA4A6]">Catatan</p>
            <p className="text-sm">{receipt.notes}</p>
          </div>
        )}
      </div>
    </DialogContent>
  );
}
function EditPaymentModal({
  receipt,
  onClose,
  onSave,
}: {
  receipt: Receipt;
  onClose: () => void;
  onSave: (r: Receipt) => Promise<void>;
}) {
  const [status, setStatus] = useState<Receipt["paymentStatus"]>(receipt.paymentStatus);
  const [paid, setPaid] = useState(String(receipt.paidAmount));
  const [saving, setSaving] = useState(false);

  const availableStatuses: Array<{ value: Receipt["paymentStatus"]; label: string }> = (() => {
    if (receipt.paymentStatus === "UNPAID") {
      return [
        { value: "UNPAID", label: "Belum Dibayar" },
        { value: "PARTIALLY_PAID", label: "Sebagian Dibayar" },
        { value: "PAID", label: "Lunas" },
      ];
    }
    if (receipt.paymentStatus === "PARTIALLY_PAID") {
      return [
        { value: "PARTIALLY_PAID", label: "Sebagian Dibayar" },
        { value: "PAID", label: "Lunas" },
      ];
    }
    return [{ value: "PAID", label: "Lunas" }];
  })();

  const newPaidAmount =
    status === "PAID"
      ? receipt.totalPrice
      : status === "UNPAID"
      ? 0
      : Number(paid) || 0;

  const handleSave = async () => {
    setSaving(true);
    const updated: Receipt = {
      ...receipt,
      paymentStatus: status,
      paidAmount: newPaidAmount,
    };
    await onSave(updated);
    setSaving(false);
    onClose();
  };

  return (
    <DialogContent className="max-w-sm bg-[#0C141A] border-[#1E2C33] text-[#EAF1EF]">
      <DialogHeader>
        <DialogTitle>Edit Pembayaran</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        <div>
          <p className="text-xs text-[#8FA4A6] mb-1">Total Tagihan</p>
          <p className="font-bold">{formatRupiah(receipt.totalPrice)}</p>
        </div>
        <div className="space-y-1.5">
          <Label>Status Pembayaran</Label>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as Receipt["paymentStatus"])}
          >
            <SelectTrigger data-testid="select-edit-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0D161C] border-[#1E2C33] text-[#EAF1EF]">
              {availableStatuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {status === "PARTIALLY_PAID" && (
          <div className="space-y-1.5">
            <Label>Jumlah Dibayar (Rp)</Label>
            <Input
              type="number"
              min={0}
              max={receipt.totalPrice}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              data-testid="input-edit-paid"
            />
            <p className="text-xs text-[#8FA4A6]">
              Sisa: {formatRupiah(Math.max(0, receipt.totalPrice - (Number(paid) || 0)))}
            </p>
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={saving} data-testid="button-save-payment">
            Simpan
          </Button>
        </div>
      </div>
    </DialogContent>
  );
}

export default function History() {
  const { receipts, load, loaded, updateReceipt, removeReceipt, settings } = useReceiptStore();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("ALL_TIME");
  const [sortFilter, setSortFilter] = useState<SortFilter>("NEWEST");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!loaded) load();
  }, [load, loaded]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, timeFilter, sortFilter]);

  const filtered = useMemo(() => {
    let list = [...receipts].sort((a, b) =>
      sortFilter === "NEWEST"
        ? b.createdAt.localeCompare(a.createdAt)
        : a.createdAt.localeCompare(b.createdAt)
    );
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.receiptCode.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          r.schoolOrOrganization.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.paymentStatus === statusFilter);
    }
    if (timeFilter !== "ALL_TIME") {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      list = list.filter((r) => {
        const d = new Date(r.date);
        return d.getFullYear() === y && d.getMonth() === m;
      });
    }
    return list;
  }, [receipts, search, statusFilter, timeFilter, sortFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage]
  );

  const visibleCodes = paginated.map((r) => r.receiptCode);
  const allVisibleSelected = visibleCodes.length > 0 && visibleCodes.every((c) => selected.has(c));
  const someVisibleSelected = visibleCodes.some((c) => selected.has(c));
  const selectedCount = selected.size;

  const toggleRow = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) visibleCodes.forEach((c) => next.delete(c));
      else visibleCodes.forEach((c) => next.add(c));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleDelete = async () => {
    if (!deleteCode) return;
    await removeReceipt(deleteCode);
    toast({ title: "Nota dihapus" });
    setDeleteCode(null);
  };

  const handleBulkDelete = async () => {
    for (const code of selected) {
      await removeReceipt(code);
    }
    toast({ title: `${selected.size} nota dihapus` });
    setSelected(new Set());
    setBulkDeleteOpen(false);
  };

  const handleBulkMarkPaid = async () => {
    for (const code of selected) {
      const r = receipts.find((x) => x.receiptCode === code);
      if (r && r.paymentStatus !== "PAID") {
        await updateReceipt({ ...r, paymentStatus: "PAID", paidAmount: r.totalPrice });
      }
    }
    toast({ title: "Pembayaran diperbarui" });
    setSelected(new Set());
  };

  const handleDownload = async (r: Receipt) => {
    try {
      await downloadReceiptPDF(r, settings);
    } catch {
      toast({ title: "Gagal mengunduh PDF", variant: "destructive" });
    }
  };

  const activeFilterCount =
    (statusFilter !== "ALL" ? 1 : 0) + (timeFilter !== "ALL_TIME" ? 1 : 0);

  return (
    <div className="min-h-full bg-[#0A1117] text-[#EAF1EF] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* ── Page header ─────────────────────────────────────── */}
        <header className="pt-2 pb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Riwayat Nota</h1>
          <p className="mt-1.5 text-sm text-[#8FA4A6]" data-testid="text-invoice-count">
            {receipts.length} invoice tercatat
          </p>
        </header>

        {/* ── List container ──────────────────────────────────── */}
        <section className="rounded-2xl border border-[#1E2C33] bg-[#0E161D] overflow-hidden">
          {/* Toolbar */}
          <div className="px-4 py-4 sm:px-6 border-b border-[#1E2C33]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h2 className="text-base font-semibold">Semua invoice</h2>
                <p className="mt-0.5 text-xs text-[#8FA4A6]" data-testid="text-result-count">
                  {filtered.length} dari {receipts.length} invoice ditampilkan
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8FA4A6] pointer-events-none" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nomor, pelanggan, sekolah..."
                    aria-label="Cari invoice"
                    className="pl-9 h-10 bg-[#0A1117] border-[#1E2C33] text-[#EAF1EF] placeholder:text-[#5E7275] focus-visible:ring-[#72B8AD]/60 sm:w-64"
                    data-testid="input-search"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(true)}
                    data-testid="button-filter"
                    aria-label="Filter invoice"
                    className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-[#1E2C33] bg-[#0A1117] text-sm text-[#8FA4A6] transition-colors hover:text-[#EAF1EF] hover:border-[#2A3D45] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filter
                    {activeFilterCount > 0 && (
                      <span className="inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#72B8AD]/20 text-[10px] font-semibold text-[#79C0B3]">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortFilter((s) => (s === "NEWEST" ? "OLDEST" : "NEWEST"))}
                    data-testid="button-sort"
                    aria-label="Ubah urutan"
                    className="inline-flex items-center gap-2 h-10 px-3 rounded-lg border border-[#1E2C33] bg-[#0A1117] text-sm text-[#8FA4A6] transition-colors hover:text-[#EAF1EF] hover:border-[#2A3D45] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60"
                  >
                    {sortFilter === "NEWEST" ? (
                      <ArrowDownWideNarrow className="w-4 h-4" />
                    ) : (
                      <ArrowUpWideNarrow className="w-4 h-4" />
                    )}
                    {sortFilter === "NEWEST" ? "Terbaru" : "Terlama"}
                  </button>
                </div>
              </div>
            </div>
          </div>



          {/* Bulk selection bar */}
          {selectedCount > 0 && (
            <div
              className="flex items-center justify-between gap-3 px-4 sm:px-6 py-2.5 bg-[#122229] border-b border-[#1E2C33]"
              data-testid="bulk-selection-bar"
            >
              <p className="text-sm text-[#79C0B3] font-medium">{selectedCount} dipilih</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkMarkPaid}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-[#79C0B3] hover:bg-[#1B3A35] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60"
                  data-testid="button-bulk-paid"
                >
                  <Check className="w-3.5 h-3.5" /> Tandai Lunas
                </button>
                <button
                  type="button"
                  onClick={() => setBulkDeleteOpen(true)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium text-[#D89386] hover:bg-[#3A211D]/60 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#D89386]/60"
                  data-testid="button-bulk-delete"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="h-8 px-2 rounded-lg text-xs text-[#8FA4A6] hover:text-[#EAF1EF] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60"
                  aria-label="Bersihkan pilihan"
                >
                  Bersihkan
                </button>
              </div>
            </div>
          )}

          {/* Column header (desktop) */}
          {paginated.length > 0 && (
            <div className="hidden md:grid grid-cols-[32px_minmax(0,1fr)_140px_120px_150px_48px] gap-4 items-center px-6 py-2.5 border-b border-[#1E2C33] text-[11px] font-medium uppercase tracking-wider text-[#5E7275]">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Pilih semua invoice"
                data-testid="checkbox-select-all"
                className="border-[#2A3D45] data-[state=checked]:bg-[#72B8AD] data-[state=checked]:border-[#72B8AD] data-[state=checked]:text-[#0A1117]"
              />
              <span>Invoice</span>
              <span>Status</span>
              <span>Tanggal</span>
              <span className="text-right">Jumlah</span>
              <span className="sr-only">Aksi</span>
            </div>
          )}

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="py-16 px-6 text-center" data-testid="empty-state">
              <div className="mx-auto w-10 h-10 rounded-full border border-[#1E2C33] flex items-center justify-center mb-3">
                <ScanSearch className="w-5 h-5 text-[#5E7275]" />
              </div>
              <p className="text-sm text-[#8FA4A6]">
                {search || statusFilter !== "ALL" || timeFilter !== "ALL_TIME"
                  ? "Tidak ada invoice yang cocok"
                  : "Belum ada invoice tercatat"}
              </p>
            </div>
          ) : (

              <ul className="divide-y divide-[#1E2C33]/70">
                {paginated.map((r) => {
                  const isSelected = selected.has(r.receiptCode);
                  const menu = (
                    <ReceiptActionsMenu
                      code={r.receiptCode}
                      showPayment={r.paymentStatus !== "PAID"}
                      onEdit={() => setLocation(`/create/edit/${r.receiptCode}`)}
                      onPayment={() => setEditReceipt(r)}
                      onDownload={() => handleDownload(r)}
                      onDelete={() => setDeleteCode(r.receiptCode)}
                    />
                  );
                  return (
                    <li key={r.receiptCode}>
                      {/* Desktop row */}
                      <div
                        className={`hidden md:grid grid-cols-[32px_minmax(0,1fr)_140px_120px_150px_48px] gap-4 items-center px-6 py-4 transition-colors ${
                          isSelected ? "bg-[#122229]" : "hover:bg-[#101B22]"
                        }`}
                        data-testid={`row-receipt-${r.receiptCode}`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(r.receiptCode)}
                          aria-label={`Pilih invoice ${r.receiptCode}`}
                          data-testid={`checkbox-receipt-${r.receiptCode}`}
                          className="border-[#2A3D45] data-[state=checked]:bg-[#72B8AD] data-[state=checked]:border-[#72B8AD] data-[state=checked]:text-[#0A1117]"
                        />
                        <button
                          type="button"
                          onClick={() => setViewReceipt(r)}
                          className="text-left min-w-0 rounded-lg -my-1 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60"
                          data-testid={`button-view-${r.receiptCode}`}
                        >
                          <p className="font-mono text-xs text-[#8FA4A6]">{r.receiptCode}</p>
                          <p className="mt-0.5 text-sm font-medium text-[#EAF1EF] truncate">
                            {r.clientName}
                          </p>
                          <p className="mt-0.5 text-xs text-[#8FA4A6] truncate">
                            {r.schoolOrOrganization}
                          </p>
                        </button>
                        <div><StatusPill status={r.paymentStatus} /></div>
                        <p className="text-sm text-[#8FA4A6]">{formatDateShort(r.date)}</p>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">
                            {formatRupiah(r.totalPrice)}
                          </p>
                          {r.paymentStatus !== "PAID" && (
                            <p className="mt-0.5 text-xs text-[#D2B27A] tabular-nums">
                              Dibayar {formatRupiah(r.paidAmount)}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-end">{menu}</div>
                      </div>

                      {/* Mobile card */}
                      <div
                        className={`md:hidden p-4 transition-colors ${
                          isSelected ? "bg-[#122229]" : "hover:bg-[#101B22]"
                        }`}
                        data-testid={`card-receipt-${r.receiptCode}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="pt-0.5">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleRow(r.receiptCode)}
                              aria-label={`Pilih invoice ${r.receiptCode}`}
                              data-testid={`checkbox-receipt-${r.receiptCode}`}
                              className="border-[#2A3D45] data-[state=checked]:bg-[#72B8AD] data-[state=checked]:border-[#72B8AD] data-[state=checked]:text-[#0A1117]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setViewReceipt(r)}
                            className="flex-1 min-w-0 text-left rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60"
                            data-testid={`button-view-${r.receiptCode}`}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs text-[#8FA4A6]">
                                {r.receiptCode}
                              </span>
                              <StatusPill status={r.paymentStatus} />
                            </div>
                            <p className="mt-1 text-sm font-medium text-[#EAF1EF] truncate">
                              {r.clientName}
                            </p>
                            <p className="mt-0.5 text-xs text-[#8FA4A6] truncate">
                              {r.schoolOrOrganization}
                            </p>
                            <p className="mt-1 text-xs text-[#8FA4A6]">
                              {formatDateShort(r.date)}
                            </p>
                          </button>
                          <div className="shrink-0 flex flex-col items-end gap-1.5">
                            <p className="text-sm font-semibold tabular-nums">
                              {formatRupiah(r.totalPrice)}
                            </p>
                            {r.paymentStatus !== "PAID" && (
                              <p className="text-xs text-[#D2B27A] tabular-nums">
                                Dibayar {formatRupiah(r.paidAmount)}
                              </p>
                            )}
                            {menu}
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

          {/* Pagination */}
          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-t border-[#1E2C33]">
              <p className="text-xs text-[#8FA4A6]" data-testid="text-pagination-info">
                Halaman {safePage} dari {totalPages} · {filtered.length} invoice
              </p>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label="Halaman sebelumnya"
                  data-testid="button-prev-page"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-[#1E2C33] text-[#8FA4A6] transition-colors hover:text-[#EAF1EF] hover:border-[#2A3D45] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  aria-label="Halaman berikutnya"
                  data-testid="button-next-page"
                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-[#1E2C33] text-[#8FA4A6] transition-colors hover:text-[#EAF1EF] hover:border-[#2A3D45] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ── Filters sheet ─────────────────────────────────────── */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent
          side="bottom"
          className="bg-[#0E161D] border-[#1E2C33] text-[#EAF1EF] rounded-t-2xl"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Filter invoice</SheetTitle>
          </SheetHeader>
          <div className="space-y-5 mt-2 pb-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#8FA4A6] uppercase tracking-wide">Status</p>
              <div className="flex flex-wrap gap-2">
                {FILTER_CHIPS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setStatusFilter(c.value)}
                    data-testid={`chip-filter-${c.value}`}
                    className={cn(
                      "inline-flex items-center h-9 px-3.5 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60",
                      statusFilter === c.value
                        ? "border-[#72B8AD]/50 bg-[#1B3A35]/60 text-[#79C0B3]"
                        : "border-[#1E2C33] text-[#8FA4A6] hover:text-[#EAF1EF] hover:border-[#2A3D45]"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[#8FA4A6] uppercase tracking-wide">Periode</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: "ALL_TIME", label: "Semua waktu" },
                    { value: "THIS_MONTH", label: "Bulan ini" },
                  ] as Array<{ value: TimeFilter; label: string }>
                ).map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setTimeFilter(c.value)}
                    data-testid={`chip-time-${c.value}`}
                    className={cn(
                      "inline-flex items-center h-9 px-3.5 rounded-full border text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#72B8AD]/60",
                      timeFilter === c.value
                        ? "border-[#72B8AD]/50 bg-[#1B3A35]/60 text-[#79C0B3]"
                        : "border-[#1E2C33] text-[#8FA4A6] hover:text-[#EAF1EF] hover:border-[#2A3D45]"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStatusFilter("ALL");
                  setTimeFilter("ALL_TIME");
                }}
              >
                Reset
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Terapkan</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── View Modal ────────────────────────────────────────── */}
      <Dialog open={!!viewReceipt} onOpenChange={() => setViewReceipt(null)}>
        {viewReceipt && (
          <ReceiptDetailModal
            receipt={viewReceipt}
            onClose={() => setViewReceipt(null)}
            onEdit={() => {
              setLocation(`/create/edit/${viewReceipt.receiptCode}`);
              setViewReceipt(null);
            }}
            onPayment={() => {
              setEditReceipt(viewReceipt);
              setViewReceipt(null);
            }}
            onDownload={() => handleDownload(viewReceipt)}
            onDelete={() => {
              setDeleteCode(viewReceipt.receiptCode);
              setViewReceipt(null);
            }}
          />
        )}
      </Dialog>

      {/* ── Edit Modal ────────────────────────────────────────── */}
      <Dialog open={!!editReceipt} onOpenChange={() => setEditReceipt(null)}>
        {editReceipt && (
          <EditPaymentModal
            receipt={editReceipt}
            onClose={() => setEditReceipt(null)}
            onSave={async (updated) => {
              await updateReceipt(updated);
              toast({ title: "Pembayaran diperbarui" });
              setEditReceipt(null);
            }}
          />
        )}
      </Dialog>

      {/* ── Delete Confirm ────────────────────────────────────── */}
      <AlertDialog open={!!deleteCode} onOpenChange={() => setDeleteCode(null)}>
        <AlertDialogContent className="bg-[#0E161D] border-[#1E2C33] text-[#EAF1EF]">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Nota?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8FA4A6]">
              Nota <strong>{deleteCode}</strong> akan dihapus permanen. Tindakan ini tidak bisa
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#1E2C33] text-[#EAF1EF] hover:bg-[#16242B] hover:text-[#EAF1EF]">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-[#3A211D] hover:bg-[#4A2A24] text-[#D89386]"
              data-testid="button-confirm-delete"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Delete Confirm ───────────────────────────────── */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent className="bg-[#0E161D] border-[#1E2C33] text-[#EAF1EF]">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selected.size} Nota?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8FA4A6]">
              Semua nota yang dipilih akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#1E2C33] text-[#EAF1EF] hover:bg-[#16242B] hover:text-[#EAF1EF]">
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-[#3A211D] hover:bg-[#4A2A24] text-[#D89386]"
              data-testid="button-confirm-bulk-delete"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
