import { useState, useEffect } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useReceiptStore } from "@/store/receipts";
import { Receipt, OrderItem, ProductType, Size } from "@/lib/db";
import { generateReceiptCode, formatRupiah, formatDate } from "@/lib/utils";
import { downloadReceiptPDF } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ChevronLeft, ChevronRight, Check, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PRODUCTS: ProductType[] = [
  "Seragam Sekolah",
  "Jaket Almamater",
  "Seragam Basket",
  "Seragam Voli",
  "Seragam Badminton",
  "Seragam Futsal",
  "Jaket Kelas",
  "Custom Apparel",
];

const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

const clientSchema = z.object({
  clientName: z.string().min(1, "Nama wajib diisi"),
  clientPhone: z.string().min(1, "Nomor telepon wajib diisi"),
  schoolOrOrganization: z.string().min(1, "Sekolah/Organisasi wajib diisi"),
  date: z.string().min(1, "Tanggal wajib diisi"),
});

const itemSchema = z.object({
  productType: z.string().min(1),
  size: z.string().min(1),
  quantity: z.coerce.number().min(1),
  unitPrice: z.coerce.number().min(0),
});

const orderSchema = z.object({
  items: z.array(itemSchema).min(1, "Minimal 1 item"),
});

const paymentSchema = z.object({
  paymentStatus: z.enum(["PAID", "PARTIALLY_PAID", "UNPAID"]),
  paidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type ClientData = z.infer<typeof clientSchema>;
type OrderData = z.infer<typeof orderSchema>;
type PaymentData = z.infer<typeof paymentSchema>;

const STEPS = ["Informasi Klien", "Informasi Pesanan", "Pembayaran", "Konfirmasi"];

export default function CreateReceipt() {
  const [step, setStep] = useState(0);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [saving, setSaving] = useState(false);
  const { receipts, addReceipt, settings, load, loaded } = useReceiptStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (!loaded) load();
  }, [load, loaded]);

  const clientForm = useForm<ClientData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      clientName: "",
      clientPhone: "",
      schoolOrOrganization: "",
      date: new Date().toISOString().split("T")[0],
    },
  });

  const orderForm = useForm<OrderData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      items: [{ productType: "Seragam Sekolah", size: "M", quantity: 1, unitPrice: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: orderForm.control,
    name: "items",
  });

  const paymentForm = useForm<PaymentData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentStatus: "UNPAID", paidAmount: 0, notes: "" },
  });

  const watchItems = orderForm.watch("items");
  const totalPrice = watchItems.reduce((s, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return s + qty * price;
  }, 0);

  const watchStatus = paymentForm.watch("paymentStatus");
  const watchPaid = paymentForm.watch("paidAmount");

  const buildReceipt = (payment: PaymentData): Receipt => {
    const code = generateReceiptCode(receipts.map((r) => r.receiptCode));
    const items: OrderItem[] = orderData!.items.map((i) => ({
      productType: i.productType as ProductType,
      size: i.size as Size,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      subtotal: Number(i.quantity) * Number(i.unitPrice),
    }));
    const total = items.reduce((s, i) => s + i.subtotal, 0);
    let paid = 0;
    if (payment.paymentStatus === "PAID") paid = total;
    else if (payment.paymentStatus === "PARTIALLY_PAID") paid = Number(payment.paidAmount) || 0;

    return {
      id: code,
      receiptCode: code,
      clientName: clientData!.clientName,
      clientPhone: clientData!.clientPhone,
      schoolOrOrganization: clientData!.schoolOrOrganization,
      date: clientData!.date,
      createdAt: new Date().toISOString(),
      items,
      totalPrice: total,
      paidAmount: paid,
      paymentStatus: payment.paymentStatus,
      notes: payment.notes,
    };
  };

  const handleSave = async (withPDF = false) => {
    const payment = paymentForm.getValues();
    const receipt = buildReceipt(payment);
    setSaving(true);
    try {
      await addReceipt(receipt);
      if (withPDF) {
        await downloadReceiptPDF(receipt, settings);
      }
      toast({ title: "Nota berhasil disimpan", description: receipt.receiptCode });
      setLocation("/history");
    } catch (e) {
      toast({ title: "Gagal menyimpan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const previewReceipt = step === 3 && clientData && orderData
    ? buildReceipt(paymentForm.getValues())
    : null;

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Buat Nota</h1>
        <p className="text-sm text-muted-foreground mt-1">Isi informasi pesanan baru</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                i < step
                  ? "bg-green-500 text-white"
                  : i === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-3 h-3" /> : i + 1}
            </div>
            <span
              className={`text-xs font-medium hidden sm:block ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-px ${i < step ? "bg-green-500" : "bg-border"}`} />
            )}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1 */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <form
              onSubmit={clientForm.handleSubmit((data) => {
                setClientData(data);
                setStep(1);
              })}
              className="space-y-5"
            >
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-semibold">Informasi Klien</h2>
                <div className="space-y-1.5">
                  <Label>Nama Klien</Label>
                  <Input {...clientForm.register("clientName")} data-testid="input-client-name" placeholder="Nama lengkap" />
                  {clientForm.formState.errors.clientName && (
                    <p className="text-xs text-red-500">{clientForm.formState.errors.clientName.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Nomor Telepon</Label>
                  <Input {...clientForm.register("clientPhone")} data-testid="input-client-phone" placeholder="08xxxxxxxxxx" type="tel" />
                  {clientForm.formState.errors.clientPhone && (
                    <p className="text-xs text-red-500">{clientForm.formState.errors.clientPhone.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Sekolah / Organisasi</Label>
                  <Input {...clientForm.register("schoolOrOrganization")} data-testid="input-school" placeholder="Nama sekolah atau organisasi" />
                  {clientForm.formState.errors.schoolOrOrganization && (
                    <p className="text-xs text-red-500">{clientForm.formState.errors.schoolOrOrganization.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal</Label>
                  <Input {...clientForm.register("date")} data-testid="input-date" type="date" />
                  {clientForm.formState.errors.date && (
                    <p className="text-xs text-red-500">{clientForm.formState.errors.date.message}</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" data-testid="button-next-step1">
                  Lanjut <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 2 */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <form
              onSubmit={orderForm.handleSubmit((data) => {
                setOrderData(data);
                setStep(2);
              })}
              className="space-y-5"
            >
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Informasi Pesanan</h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="button-add-item"
                    onClick={() =>
                      append({ productType: "Seragam Sekolah", size: "M", quantity: 1, unitPrice: 0 })
                    }
                  >
                    <Plus className="w-3 h-3 mr-1" /> Tambah Item
                  </Button>
                </div>

                {fields.map((field, idx) => (
                  <div key={field.id} className="border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(idx)} className="text-muted-foreground hover:text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <Label>Produk</Label>
                        <Select
                          value={orderForm.watch(`items.${idx}.productType`)}
                          onValueChange={(v) => orderForm.setValue(`items.${idx}.productType`, v)}
                        >
                          <SelectTrigger data-testid={`select-product-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRODUCTS.map((p) => (
                              <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Ukuran</Label>
                        <Select
                          value={orderForm.watch(`items.${idx}.size`)}
                          onValueChange={(v) => orderForm.setValue(`items.${idx}.size`, v)}
                        >
                          <SelectTrigger data-testid={`select-size-${idx}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SIZES.map((s) => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Jumlah</Label>
                        <Input
                          {...orderForm.register(`items.${idx}.quantity`)}
                          data-testid={`input-quantity-${idx}`}
                          type="number"
                          min={1}
                        />
                      </div>
                      <div className="col-span-2 space-y-1.5">
                        <Label>Harga Satuan (Rp)</Label>
                        <Input
                          {...orderForm.register(`items.${idx}.unitPrice`)}
                          data-testid={`input-price-${idx}`}
                          type="number"
                          min={0}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="text-right text-sm font-medium text-foreground">
                      Subtotal:{" "}
                      {formatRupiah(
                        (Number(orderForm.watch(`items.${idx}.quantity`)) || 0) *
                          (Number(orderForm.watch(`items.${idx}.unitPrice`)) || 0)
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-lg font-bold" data-testid="text-total-price">{formatRupiah(totalPrice)}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(0)} data-testid="button-back-step1">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
                </Button>
                <Button type="submit" data-testid="button-next-step2">
                  Lanjut <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 3 */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <form
              onSubmit={paymentForm.handleSubmit(() => setStep(3))}
              className="space-y-5"
            >
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-semibold">Informasi Pembayaran</h2>
                <div className="space-y-1.5">
                  <Label>Status Pembayaran</Label>
                  <Select
                    value={watchStatus}
                    onValueChange={(v) =>
                      paymentForm.setValue("paymentStatus", v as "PAID" | "PARTIALLY_PAID" | "UNPAID")
                    }
                  >
                    <SelectTrigger data-testid="select-payment-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PAID">Lunas</SelectItem>
                      <SelectItem value="PARTIALLY_PAID">Sebagian Dibayar</SelectItem>
                      <SelectItem value="UNPAID">Belum Dibayar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {watchStatus === "PARTIALLY_PAID" && (
                  <div className="space-y-1.5">
                    <Label>Jumlah Dibayar (Rp)</Label>
                    <Input
                      {...paymentForm.register("paidAmount")}
                      data-testid="input-paid-amount"
                      type="number"
                      min={0}
                      max={totalPrice}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Sisa: {formatRupiah(Math.max(0, totalPrice - (Number(watchPaid) || 0)))}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Catatan (opsional)</Label>
                  <Textarea {...paymentForm.register("notes")} data-testid="input-notes" placeholder="Catatan tambahan..." rows={3} />
                </div>
              </div>
              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-back-step2">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
                </Button>
                <Button type="submit" data-testid="button-next-step3">
                  Preview <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 4 - Preview */}
        {step === 3 && previewReceipt && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold">{settings.businessName || "MS Collection"}</h2>
                  {settings.businessAddress && (
                    <p className="text-xs text-muted-foreground">{settings.businessAddress}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Kode Nota</p>
                  <p className="text-sm font-mono font-bold" data-testid="text-receipt-code">{previewReceipt.receiptCode}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Nama</p>
                  <p className="font-medium">{previewReceipt.clientName}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telepon</p>
                  <p className="font-medium">{previewReceipt.clientPhone}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Sekolah/Org</p>
                  <p className="font-medium">{previewReceipt.schoolOrOrganization}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal</p>
                  <p className="font-medium">{formatDate(previewReceipt.date)}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-12 text-xs text-muted-foreground font-medium border-b border-border pb-1">
                  <span className="col-span-5">Produk</span>
                  <span className="col-span-2 text-center">Ukuran</span>
                  <span className="col-span-2 text-center">Qty</span>
                  <span className="col-span-3 text-right">Subtotal</span>
                </div>
                {previewReceipt.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 text-sm">
                    <span className="col-span-5 text-foreground">{item.productType}</span>
                    <span className="col-span-2 text-center text-muted-foreground">{item.size}</span>
                    <span className="col-span-2 text-center text-muted-foreground">{item.quantity}</span>
                    <span className="col-span-3 text-right font-medium">{formatRupiah(item.subtotal)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold">{formatRupiah(previewReceipt.totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dibayar</span>
                  <span className="text-green-500 font-medium">{formatRupiah(previewReceipt.paidAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sisa</span>
                  <span className="text-red-400 font-medium">
                    {formatRupiah(Math.max(0, previewReceipt.totalPrice - previewReceipt.paidAmount))}
                  </span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={previewReceipt.paymentStatus} />
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(2)} data-testid="button-back-step3">
                <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
              </Button>
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleSave(false)}
                  disabled={saving}
                  data-testid="button-save-only"
                >
                  Simpan Saja
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={saving}
                  data-testid="button-save-download"
                >
                  <Download className="w-4 h-4 mr-1" /> Simpan & Unduh PDF
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

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
