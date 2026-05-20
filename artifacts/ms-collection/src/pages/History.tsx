import { useState, useEffect, useMemo } from "react";
import { useReceiptStore } from "@/store/receipts";
import { Receipt } from "@/lib/db";
import { formatRupiah, formatDateShort } from "@/lib/utils";
import { downloadReceiptPDF } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Search, Download, Trash2, Eye, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type StatusFilter = "ALL" | "PAID" | "PARTIALLY_PAID" | "UNPAID";

function StatusBadge({ status }: { status: Receipt["paymentStatus"] }) {
  const map = {
    PAID: { label: "Lunas", className: "text-green-500 bg-green-500/10" },
    PARTIALLY_PAID: { label: "Sebagian", className: "text-yellow-500 bg-yellow-500/10" },
    UNPAID: { label: "Belum Bayar", className: "text-red-500 bg-red-500/10" },
  };
  const { label, className } = map[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${className}`}>{label}</span>
  );
}

function ReceiptDetailModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  return (
    <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Detail Nota — {receipt.receiptCode}</DialogTitle>
      </DialogHeader>
      <div className="space-y-5 mt-2">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Nama</p>
            <p className="font-medium">{receipt.clientName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telepon</p>
            <p className="font-medium">{receipt.clientPhone}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sekolah/Org</p>
            <p className="font-medium">{receipt.schoolOrOrganization}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tanggal</p>
            <p className="font-medium">{formatDateShort(receipt.date)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Item Pesanan</p>
          <div className="space-y-1.5">
            {receipt.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.productType} ({item.size}) × {item.quantity}
                </span>
                <span className="font-medium">{formatRupiah(item.subtotal)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-border pt-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold">{formatRupiah(receipt.totalPrice)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Dibayar</span>
            <span className="text-green-500 font-medium">{formatRupiah(receipt.paidAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sisa</span>
            <span className="text-red-400 font-medium">
              {formatRupiah(Math.max(0, receipt.totalPrice - receipt.paidAmount))}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Status</span>
            <StatusBadge status={receipt.paymentStatus} />
          </div>
        </div>

        {receipt.notes && (
          <div>
            <p className="text-xs text-muted-foreground">Catatan</p>
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
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Edit Pembayaran</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 mt-2">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Total Tagihan</p>
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
            <SelectContent>
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
            <p className="text-xs text-muted-foreground">
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);
  const [deleteCode, setDeleteCode] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!loaded) load();
  }, [load, loaded]);

  const filtered = useMemo(() => {
    let list = [...receipts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
    return list;
  }, [receipts, search, statusFilter]);

  const handleDelete = async () => {
    if (!deleteCode) return;
    await removeReceipt(deleteCode);
    toast({ title: "Nota dihapus" });
    setDeleteCode(null);
  };

  const handleDownload = async (r: Receipt) => {
    try {
      await downloadReceiptPDF(r, settings);
    } catch {
      toast({ title: "Gagal mengunduh PDF", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Riwayat Nota</h1>
        <p className="text-sm text-muted-foreground mt-1">{receipts.length} nota tersimpan</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode nota, nama, sekolah..."
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Semua Status</SelectItem>
            <SelectItem value="PAID">Lunas</SelectItem>
            <SelectItem value="PARTIALLY_PAID">Sebagian</SelectItem>
            <SelectItem value="UNPAID">Belum Bayar</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">Tidak ada nota ditemukan</p>
          </div>
        ) : (
          filtered.map((r, i) => (
            <motion.div
              key={r.receiptCode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-card border border-border rounded-2xl p-5"
              data-testid={`card-receipt-${r.receiptCode}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-bold text-foreground">{r.receiptCode}</span>
                    <StatusBadge status={r.paymentStatus} />
                  </div>
                  <p className="text-sm font-medium text-foreground">{r.clientName}</p>
                  <p className="text-xs text-muted-foreground">{r.schoolOrOrganization}</p>
                  <p className="text-xs text-muted-foreground">{formatDateShort(r.date)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{formatRupiah(r.totalPrice)}</p>
                  {r.paymentStatus !== "PAID" && (
                    <p className="text-xs text-muted-foreground">
                      Dibayar: {formatRupiah(r.paidAmount)}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 mt-4 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setViewReceipt(r)}
                  data-testid={`button-view-${r.receiptCode}`}
                >
                  <Eye className="w-3 h-3 mr-1" /> Lihat
                </Button>
                {r.paymentStatus !== "PAID" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditReceipt(r)}
                    data-testid={`button-edit-${r.receiptCode}`}
                  >
                    <Pencil className="w-3 h-3 mr-1" /> Edit Bayar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDownload(r)}
                  data-testid={`button-download-${r.receiptCode}`}
                >
                  <Download className="w-3 h-3 mr-1" /> PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 hover:text-red-500 hover:bg-red-500/10"
                  onClick={() => setDeleteCode(r.receiptCode)}
                  data-testid={`button-delete-${r.receiptCode}`}
                >
                  <Trash2 className="w-3 h-3 mr-1" /> Hapus
                </Button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* View Modal */}
      <Dialog open={!!viewReceipt} onOpenChange={() => setViewReceipt(null)}>
        {viewReceipt && <ReceiptDetailModal receipt={viewReceipt} onClose={() => setViewReceipt(null)} />}
      </Dialog>

      {/* Edit Modal */}
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

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteCode} onOpenChange={() => setDeleteCode(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Nota?</AlertDialogTitle>
            <AlertDialogDescription>
              Nota <strong>{deleteCode}</strong> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
              data-testid="button-confirm-delete"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
