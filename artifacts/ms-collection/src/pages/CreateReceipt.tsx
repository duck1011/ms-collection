import { useState, useEffect, useCallback, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useParams } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useReceiptStore } from "@/store/receipts";
import { Receipt, OrderItem, ProductType, Size, PriceMode, SizePrices, ProductCategory, ProductSubcategory } from "@/lib/db";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Trash2, ChevronLeft, ChevronRight, Check, Download, Ruler, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Category / Subcategory data ──────────────────────────────────────

const CATEGORIES: ProductCategory[] = [
  "Seragam / Kemeja",
  "Jersey",
  "Jaket",
  "Attribute",
];

const SUBCATEGORIES: Record<ProductCategory, ProductSubcategory[]> = {
  "Seragam / Kemeja": ["Sekolah", "Olahraga", "Customized"],
  "Jersey": ["Basket", "Voli", "Futsal", "Others"],
  "Jaket": ["Almamater", "Customized"],
  "Attribute": ["Topi", "Kerudung", "Dasi / Hasduk", "Badge", "Paulit", "Sabuk", "Customized"],
};

const SIZES: Size[] = ["XS", "S", "M", "L", "XL", "XXL"];

const clientSchema = z.object({
  clientName: z.string().min(1, "Nama wajib diisi"),
  clientPhone: z.string().min(1, "Nomor telepon wajib diisi"),
  schoolOrOrganization: z.string().min(1, "Sekolah/Organisasi wajib diisi"),
  date: z.string().min(1, "Tanggal wajib diisi"),
});

const sizeBreakdownSchema = z.object({
  XS: z.coerce.number().min(0).default(0),
  S: z.coerce.number().min(0).default(0),
  M: z.coerce.number().min(0).default(0),
  L: z.coerce.number().min(0).default(0),
  XL: z.coerce.number().min(0).default(0),
  XXL: z.coerce.number().min(0).default(0),
});

const sizePricesSchema = z.object({
  XS: z.coerce.number().min(0).default(0),
  S: z.coerce.number().min(0).default(0),
  M: z.coerce.number().min(0).default(0),
  L: z.coerce.number().min(0).default(0),
  XL: z.coerce.number().min(0).default(0),
  XXL: z.coerce.number().min(0).default(0),
});

const entrySchema = z.object({
  category: z.string().min(1, "Pilih kategori"),
  subcategory: z.string().min(1, "Pilih jenis produk"),
  customProductName: z.string().optional(),
  unitPrice: z.coerce.number().min(0, "Harga tidak valid"),
  sizes: sizeBreakdownSchema,
  sizePrices: sizePricesSchema.optional(),
}).refine(
  (data) => {
    if (data.subcategory === "Customized" || data.subcategory === "Others") {
      return data.customProductName && data.customProductName.trim().length > 0;
    }
    return true;
  },
  { message: "Nama produk wajib diisi", path: ["customProductName"] },
);

const orderSchema = z.object({
  entries: z.array(entrySchema).min(1),
});

const paymentSchema = z.object({
  paymentStatus: z.enum(["PAID", "PARTIALLY_PAID", "UNPAID"]),
  paidAmount: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type ClientData = z.infer<typeof clientSchema>;
type OrderData = z.infer<typeof orderSchema>;
type PaymentData = z.infer<typeof paymentSchema>;

const defaultEntry = () => ({
  category: "Seragam / Kemeja" as ProductCategory,
  subcategory: "Sekolah" as ProductSubcategory,
  customProductName: "",
  unitPrice: "" as unknown as number,
  sizes: {
    XS: "" as unknown as number,
    S: "" as unknown as number,
    M: "" as unknown as number,
    L: "" as unknown as number,
    XL: "" as unknown as number,
    XXL: "" as unknown as number,
  },
  sizePrices: {
    XS: "" as unknown as number,
    S: "" as unknown as number,
    M: "" as unknown as number,
    L: "" as unknown as number,
    XL: "" as unknown as number,
    XXL: "" as unknown as number,
  },
});

const STEPS = ["Informasi Klien", "Informasi Pesanan", "Pembayaran", "Konfirmasi"];

// ── Blank initial state for create mode ──────────────────────────────
// Dedicated blank initial-state constant: every new-note action resets the
// forms from here, so nothing from a previously edited/viewed project can
// leak into create mode. Order entries are rebuilt fresh via defaultEntry()
// so no object references are shared between sessions.
const BLANK_CREATE_STATE = {
  client: { clientName: "", clientPhone: "", schoolOrOrganization: "", date: "" },
  payment: { paymentStatus: "UNPAID" as const, paidAmount: 0, notes: "" },
};

/** Fresh client-form values for create mode (tanggal defaults to today). */
const blankClientValues = (): ClientData => ({
  ...BLANK_CREATE_STATE.client,
  date: new Date().toISOString().split("T")[0],
});

/** Fresh payment-form values for create mode. */
const blankPaymentValues = (): PaymentData => ({ ...BLANK_CREATE_STATE.payment });

// ── Calculation helpers ──────────────────────────────────────────────

/** Calculate total qty and subtotal for a single entry (supports both price modes) */
function calcEntryTotal(
  sizes: Record<string, number>,
  unitPrice: number,
  priceMode: PriceMode = "single",
  sizePrices?: Record<string, number>,
) {
  const totalQty = SIZES.reduce((s, sz) => s + (Number(sizes[sz]) || 0), 0);

  let subtotal: number;
  if (priceMode === "bySize" && sizePrices) {
    subtotal = SIZES.reduce((s, sz) => {
      const qty = Number(sizes[sz]) || 0;
      const price = Number(sizePrices[sz]) || 0;
      return s + qty * price;
    }, 0);
  } else {
    subtotal = totalQty * (Number(unitPrice) || 0);
  }

  return { totalQty, subtotal };
}

/** Calculate subtotal for a single size row */
function calcSizeSubtotal(qty: number, price: number): number {
  return (qty || 0) * (price || 0);
}

/** Build a fresh sizePrices record with default empty values */
function emptySizePrices(): Record<string, number> {
  return {
    XS: "" as unknown as number,
    S: "" as unknown as number,
    M: "" as unknown as number,
    L: "" as unknown as number,
    XL: "" as unknown as number,
    XXL: "" as unknown as number,
  };
}

/** Get the display label for a product based on category/subcategory/customProductName */
function getProductDisplayLabel(
  category?: string,
  subcategory?: string,
  customProductName?: string,
): string {
  if (!category) return "";
  if (subcategory === "Customized" || subcategory === "Others") {
    if (customProductName) {
      return `${category} — ${subcategory} (${customProductName})`;
    }
    return `${category} — ${subcategory}`;
  }
  return `${category} — ${subcategory || ""}`;
}

/** Reconstruct order-form entries from flattened receipt items (one row per size) */
function reconstructEntries(items: OrderItem[]): OrderData["entries"] {
  const groups = new Map<
    string,
    { item: OrderItem; sizes: Record<Size, number> }
  >();

  for (const item of items) {
    const key = [
      item.category || "",
      item.subcategory || "",
      item.customProductName || "",
      item.priceMode || "single",
    ].join("|");

    if (!groups.has(key)) {
      groups.set(key, {
        item,
        sizes: { XS: 0, S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
      });
    }
    const group = groups.get(key)!;
    group.sizes[item.size] = (group.sizes[item.size] || 0) + item.quantity;
  }

  return Array.from(groups.values()).map(({ item, sizes }) => {
    const isBySize = item.priceMode === "bySize";
    return {
      category: (item.category || "Seragam / Kemeja") as ProductCategory,
      subcategory: (item.subcategory || "Sekolah") as ProductSubcategory,
      customProductName: item.customProductName || "",
      unitPrice: isBySize ? ("" as unknown as number) : item.unitPrice,
      sizes: {
        XS: sizes.XS,
        S: sizes.S,
        M: sizes.M,
        L: sizes.L,
        XL: sizes.XL,
        XXL: sizes.XXL,
      },
      sizePrices: isBySize
        ? ((item.sizePrices || emptySizePrices()) as unknown as {
            XS: number;
            S: number;
            M: number;
            L: number;
            XL: number;
            XXL: number;
          })
        : undefined,
    };
  });
}

// ── Component ────────────────────────────────────────────────────────

export default function CreateReceipt() {
  const [step, setStep] = useState(0);
  const [clientData, setClientData] = useState<ClientData | null>(null);
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [saving, setSaving] = useState(false);
  const [priceModes, setPriceModes] = useState<PriceMode[]>([]);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState<Receipt | null>(null);
  const { receipts, addReceipt, updateReceipt, settings, load, loaded } = useReceiptStore();
  const [, setLocation] = useLocation();
  // Edit code comes from the route PATH ("/create/edit/:code"), not a query
  // string: wouter's hash navigation strips "?edit=X" out of the hash into
  // window.location.search, where it went stale and leaked between sessions.
  const params = useParams();
  const editCode =
    typeof params.code === "string" && params.code !== "" ? params.code : null;
  const { toast } = useToast();
  // Last handled session: "create" or "edit:<code>". Any incidental effect
  // run that does not change the session (e.g. the receipts store refreshing
  // after a save or a background sync) must never touch the form.
  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loaded) load();
  }, [load, loaded]);

  const clientForm = useForm<ClientData>({
    resolver: zodResolver(clientSchema),
    defaultValues: blankClientValues(),
  });

  const orderForm = useForm<OrderData>({
    resolver: zodResolver(orderSchema),
    defaultValues: { entries: [defaultEntry()] },
  });

  const { fields, append, remove } = useFieldArray({
    control: orderForm.control,
    name: "entries",
  });

  const paymentForm = useForm<PaymentData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: blankPaymentValues(),
  });

  // wouter reuses the same component instance for "/create" and
  // "/create/edit/:code", so mode changes must be handled explicitly here.
  // The session is derived from the route param: navigating to a plain
  // "/create" (Buat Nota) switches the session and resets the form to blank,
  // so a previously edited project can never leak into create mode.
  useEffect(() => {
    if (!loaded) return;

    const mode = editCode ? `edit:${editCode}` : "create";

    // Same session as the last handled navigation (e.g. the receipts store
    // refreshing after a save or a background sync) — leave the form alone.
    if (initializedRef.current === mode) return;

    if (!editCode) {
      // ── CREATE MODE: always reset to a fresh blank form ──
      setEditingCode(null);
      setClientData(null);
      setOrderData(null);
      setPriceModes([]);
      setSuccessOpen(false);
      setSavedReceipt(null);
      setStep(0);

      // Reset all forms from the dedicated blank initial-state constant
      clientForm.reset(blankClientValues());
      orderForm.reset({ entries: [defaultEntry()] });
      paymentForm.reset(blankPaymentValues());

      initializedRef.current = mode;
      return;
    }

    // ── EDIT MODE: only initialize once per code ──

    const existing = receipts.find((r) => r.receiptCode === editCode);
    if (!existing) {
      // Session intentionally NOT marked initialized so hydration can retry
      // once the receipts store finishes loading (same as previous behavior).
      toast({ title: "Nota tidak ditemukan", variant: "destructive" });
      setLocation("/history");
      return;
    }

    initializedRef.current = mode;
    setEditingCode(existing.receiptCode);

    // Prefill client form
    clientForm.setValue("clientName", existing.clientName);
    clientForm.setValue("clientPhone", existing.clientPhone);
    clientForm.setValue("schoolOrOrganization", existing.schoolOrOrganization);
    clientForm.setValue("date", existing.date);

    // Reconstruct order entries from flattened items
    const entries = reconstructEntries(existing.items);
    orderForm.reset({ entries });
    const modes = entries.map((e) =>
      e.sizePrices ? ("bySize" as PriceMode) : ("single" as PriceMode)
    );
    setPriceModes(modes);

    // Prefill payment form
    paymentForm.setValue("paymentStatus", existing.paymentStatus);
    paymentForm.setValue("paidAmount", existing.paidAmount);
    paymentForm.setValue("notes", existing.notes || "");

    // Set client/order data so preview works
    setClientData({
      clientName: existing.clientName,
      clientPhone: existing.clientPhone,
      schoolOrOrganization: existing.schoolOrOrganization,
      date: existing.date,
    });
    setOrderData({ entries });
  }, [editCode, loaded, receipts, clientForm, orderForm, paymentForm, setLocation, toast]);

  const watchEntries = orderForm.watch("entries");

  const grandTotal = watchEntries.reduce((sum, entry, idx) => {
    const mode = priceModes[idx] ?? "single";
    const { subtotal } = calcEntryTotal(
      entry.sizes ?? {},
      entry.unitPrice,
      mode,
      entry.sizePrices,
    );
    return sum + subtotal;
  }, 0);

  const watchStatus = paymentForm.watch("paymentStatus");
  const watchPaid = paymentForm.watch("paidAmount");

  const togglePriceMode = useCallback(
    (idx: number) => {
      setPriceModes((prev) => {
        const next = [...prev];
        const current = next[idx] ?? "single";
        next[idx] = current === "single" ? "bySize" : "single";
        // Initialize sizePrices when turning on
        if (next[idx] === "bySize") {
          const currentSizePrices = orderForm.getValues(`entries.${idx}.sizePrices`);
          if (!currentSizePrices) {
            orderForm.setValue(`entries.${idx}.sizePrices`, {
              XS: "" as unknown as number,
              S: "" as unknown as number,
              M: "" as unknown as number,
              L: "" as unknown as number,
              XL: "" as unknown as number,
              XXL: "" as unknown as number,
            });
          }
        }
        return next;
      });
    },
    [orderForm],
  );

  // Flatten size-breakdown entries into OrderItems (one row per size with qty > 0)
  const flattenEntries = useCallback(
    (entries: OrderData["entries"]): OrderItem[] => {
      const items: OrderItem[] = [];
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const mode = priceModes[i] ?? "single";
        const sizePrices = entry.sizePrices as SizePrices | undefined;

        for (const sz of SIZES) {
          const qty = Number(entry.sizes[sz as Size]) || 0;
          if (qty <= 0) continue;

          if (mode === "bySize" && sizePrices) {
            const sizePrice = Number(sizePrices[sz as Size]) || 0;
            items.push({
              productType: "Custom Apparel" as ProductType,
              size: sz as Size,
              quantity: qty,
              unitPrice: sizePrice,
              subtotal: qty * sizePrice,
              priceMode: "bySize",
              sizePrices,
              category: entry.category as ProductCategory,
              subcategory: entry.subcategory as ProductSubcategory,
              customProductName: entry.customProductName || undefined,
            });
          } else {
            const unitPrice = Number(entry.unitPrice) || 0;
            items.push({
              productType: "Custom Apparel" as ProductType,
              size: sz as Size,
              quantity: qty,
              unitPrice,
              subtotal: qty * unitPrice,
              priceMode: "single",
              category: entry.category as ProductCategory,
              subcategory: entry.subcategory as ProductSubcategory,
              customProductName: entry.customProductName || undefined,
            });
          }
        }
      }
      return items;
    },
    [priceModes],
  );

  const buildReceipt = useCallback(
    (payment: PaymentData): Receipt => {
      const items = flattenEntries(orderData!.entries);
      const total = items.reduce((s, i) => s + i.subtotal, 0);
      let paid = 0;
      if (payment.paymentStatus === "PAID") paid = total;
      else if (payment.paymentStatus === "PARTIALLY_PAID") paid = Number(payment.paidAmount) || 0;

      // Edit mode: preserve original receiptCode, id, and createdAt
      if (editingCode) {
        const existing = receipts.find((r) => r.receiptCode === editingCode);
        return {
          id: existing?.id || editingCode,
          receiptCode: editingCode,
          clientName: clientData!.clientName,
          clientPhone: clientData!.clientPhone,
          schoolOrOrganization: clientData!.schoolOrOrganization,
          date: clientData!.date,
          createdAt: existing?.createdAt || new Date().toISOString(),
          items,
          totalPrice: total,
          paidAmount: paid,
          paymentStatus: payment.paymentStatus,
          notes: payment.notes,
        };
      }

      // Create mode: generate new code
      const code = generateReceiptCode(receipts.map((r) => r.receiptCode));
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
    },
    [receipts, orderData, clientData, flattenEntries, editingCode],
  );

  const handleSave = async () => {
    const payment = paymentForm.getValues();
    const receipt = buildReceipt(payment);
    setSaving(true);
    try {
      if (editingCode) {
        await updateReceipt(receipt);
      } else {
        await addReceipt(receipt);
      }
      setSavedReceipt(receipt);
      setSuccessOpen(true);
    } catch {
      toast({ title: "Gagal menyimpan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!savedReceipt) return;
    try {
      await downloadReceiptPDF(savedReceipt, settings);
    } catch {
      toast({ title: "Gagal mengunduh PDF", variant: "destructive" });
    }
  };

  const handleBackToHistory = () => {
    setSuccessOpen(false);
    setSavedReceipt(null);
    setLocation("/history");
  };

  const previewReceipt =
    step === 3 && clientData && orderData ? buildReceipt(paymentForm.getValues()) : null;

  return (
    <div className="p-6 md:p-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{editingCode ? "Edit Nota" : "Buat Nota"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {editingCode ? `Mengedit nota ${editingCode}` : "Isi informasi pesanan baru"}
        </p>
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
        {/* Step 1 — Client Info */}
        {step === 0 && (
          <motion.div
            key="step0"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form
              onSubmit={clientForm.handleSubmit((data) => {
                setClientData(data);
                setPriceModes(new Array(fields.length).fill("single"));
                setStep(1);
              })}
              className="space-y-5"
            >
              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <h2 className="text-base font-semibold">Informasi Klien</h2>
                <div className="space-y-1.5">
                  <Label>Nama Klien</Label>
                  <Input
                    {...clientForm.register("clientName")}
                    data-testid="input-client-name"
                    placeholder="Nama lengkap"
                  />
                  {clientForm.formState.errors.clientName && (
                    <p className="text-xs text-red-500">
                      {clientForm.formState.errors.clientName.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Nomor Telepon</Label>
                  <Input
                    {...clientForm.register("clientPhone")}
                    data-testid="input-client-phone"
                    placeholder="08xxxxxxxxxx"
                    type="tel"
                  />
                  {clientForm.formState.errors.clientPhone && (
                    <p className="text-xs text-red-500">
                      {clientForm.formState.errors.clientPhone.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Sekolah / Organisasi</Label>
                  <Input
                    {...clientForm.register("schoolOrOrganization")}
                    data-testid="input-school"
                    placeholder="Nama sekolah atau organisasi"
                  />
                  {clientForm.formState.errors.schoolOrOrganization && (
                    <p className="text-xs text-red-500">
                      {clientForm.formState.errors.schoolOrOrganization.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Tanggal</Label>
                  <Input
                    {...clientForm.register("date")}
                    data-testid="input-date"
                    type="date"
                  />
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

        {/* Step 2 — Order Info (Category → Subcategory → Custom Name + size breakdown with optional per-size pricing) */}
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <form
              onSubmit={orderForm.handleSubmit((data) => {
                const hasQty = data.entries.some((e) =>
                  SIZES.some((sz) => (Number(e.sizes[sz as Size]) || 0) > 0),
                );
                if (!hasQty) {
                  toast({
                    title: "Isi minimal 1 ukuran",
                    variant: "destructive",
                  });
                  return;
                }
                setOrderData(data);
                setStep(2);
              })}
              className="space-y-5"
            >
              <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold">Informasi Pesanan</h2>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    data-testid="button-add-product"
                    onClick={() => {
                      append(defaultEntry());
                      setPriceModes((prev) => [...prev, "single"]);
                    }}
                  >
                    <Plus className="w-3 h-3 mr-1" /> Tambah Produk
                  </Button>
                </div>

                {fields.map((field, idx) => {
                  const entry = watchEntries[idx] ?? field;
                  const mode = priceModes[idx] ?? "single";
                  const { totalQty, subtotal } = calcEntryTotal(
                    entry.sizes ?? {},
                    entry.unitPrice,
                    mode,
                    entry.sizePrices,
                  );

                  const selectedCategory = orderForm.watch(`entries.${idx}.category`) as ProductCategory | undefined;
                  const selectedSubcategory = orderForm.watch(`entries.${idx}.subcategory`) as ProductSubcategory | undefined;
                  const availableSubcategories = selectedCategory ? SUBCATEGORIES[selectedCategory] : [];
                  const showCustomName = selectedSubcategory === "Customized" || selectedSubcategory === "Others";

                  return (
                    <div
                      key={field.id}
                      className="border border-border rounded-xl p-4 space-y-4"
                    >
                      {/* Product header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 space-y-1.5">
                          <Label>Kategori Produk</Label>
                          <Select
                            value={selectedCategory}
                            onValueChange={(v) => {
                              orderForm.setValue(`entries.${idx}.category`, v as ProductCategory);
                              // Reset subcategory and custom name when category changes
                              orderForm.setValue(`entries.${idx}.subcategory`, "" as unknown as ProductSubcategory);
                              orderForm.setValue(`entries.${idx}.customProductName`, "");
                            }}
                          >
                            <SelectTrigger data-testid={`select-category-${idx}`}>
                              <SelectValue placeholder="Pilih kategori" />
                            </SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {orderForm.formState.errors.entries?.[idx]?.category && (
                            <p className="text-xs text-red-500">
                              {orderForm.formState.errors.entries[idx]?.category?.message}
                            </p>
                          )}
                        </div>
                        {fields.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              remove(idx);
                              setPriceModes((prev) => {
                                const next = [...prev];
                                next.splice(idx, 1);
                                return next;
                              });
                            }}
                            className="text-muted-foreground hover:text-red-500 transition-colors mt-5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Subcategory dropdown */}
                      <div className="space-y-1.5">
                        <Label>Jenis Produk</Label>
                        <Select
                          value={selectedSubcategory}
                          onValueChange={(v) => {
                            orderForm.setValue(`entries.${idx}.subcategory`, v as ProductSubcategory);
                            // Clear custom name when switching away from Customized/Others
                            if (v !== "Customized" && v !== "Others") {
                              orderForm.setValue(`entries.${idx}.customProductName`, "");
                            }
                          }}
                          disabled={!selectedCategory}
                        >
                          <SelectTrigger data-testid={`select-subcategory-${idx}`}>
                            <SelectValue placeholder={selectedCategory ? "Pilih jenis produk" : "Pilih kategori terlebih dahulu"} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableSubcategories.map((sc) => (
                              <SelectItem key={sc} value={sc}>
                                {sc}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {orderForm.formState.errors.entries?.[idx]?.subcategory && (
                          <p className="text-xs text-red-500">
                            {orderForm.formState.errors.entries[idx]?.subcategory?.message}
                          </p>
                        )}
                      </div>

                      {/* Custom product name (only for Customized or Others) */}
                      <AnimatePresence>
                        {showCustomName && (
                          <motion.div
                            key={`custom-name-${idx}`}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-1.5 overflow-hidden"
                          >
                            <Label>Nama Produk</Label>
                            <Input
                              {...orderForm.register(`entries.${idx}.customProductName`)}
                              data-testid={`input-custom-product-${idx}`}
                              placeholder="Masukkan nama produk..."
                            />
                            {orderForm.formState.errors.entries?.[idx]?.customProductName && (
                              <p className="text-xs text-red-500">
                                {orderForm.formState.errors.entries[idx]?.customProductName?.message}
                              </p>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Price section — toggle + single price OR per-size prices */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Harga</Label>
                          <Button
                            type="button"
                            variant={mode === "bySize" ? "default" : "outline"}
                            size="sm"
                            onClick={() => togglePriceMode(idx)}
                            className="h-8 gap-1.5 text-xs"
                            data-testid={`toggle-price-mode-${idx}`}
                          >
                            <Ruler className="w-3.5 h-3.5" />
                            {mode === "bySize"
                              ? "Harga per Ukuran ON"
                              : "Set Price by Size"}
                          </Button>
                        </div>

                        <AnimatePresence mode="wait">
                          {mode === "single" ? (
                            <motion.div
                              key={`single-price-${idx}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-1.5 overflow-hidden"
                            >
                              <Label className="text-xs text-muted-foreground">
                                Harga Satuan (Rp)
                              </Label>
                              <Input
                                {...orderForm.register(`entries.${idx}.unitPrice`)}
                                data-testid={`input-price-${idx}`}
                                type="number"
                                min={0}
                                placeholder="Masukkan harga..."
                                className="[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                              />
                            </motion.div>
                          ) : (
                            <motion.div
                              key={`size-prices-${idx}`}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="space-y-2 overflow-hidden"
                            >
                              <Label className="text-xs text-muted-foreground">
                                Harga per Ukuran (Rp)
                              </Label>
                              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                {SIZES.map((sz) => (
                                  <div key={sz} className="space-y-1">
                                    <p className="text-xs text-center text-muted-foreground font-medium">
                                      {sz}
                                    </p>
                                    <Input
                                      {...orderForm.register(
                                        `entries.${idx}.sizePrices.${sz as Size}`,
                                      )}
                                      data-testid={`input-size-price-${idx}-${sz}`}
                                      type="number"
                                      min={0}
                                      placeholder="—"
                                      className="text-center px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                                    />
                                    {/* Show per-size subtotal if qty > 0 */}
                                    {(() => {
                                      const qty = Number(entry.sizes?.[sz as Size]) || 0;
                                      const price =
                                        Number(
                                          orderForm.watch(
                                            `entries.${idx}.sizePrices.${sz as Size}`,
                                          ),
                                        ) || 0;
                                      if (qty > 0 && price > 0) {
                                        return (
                                          <p className="text-[10px] text-center text-muted-foreground">
                                            {formatRupiah(calcSizeSubtotal(qty, price))}
                                          </p>
                                        );
                                      }
                                      return null;
                                    })()}
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Size breakdown grid */}
                      <div className="space-y-2">
                        <Label>Ukuran & Jumlah</Label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {SIZES.map((sz) => (
                            <div key={sz} className="space-y-1">
                              <p className="text-xs text-center text-muted-foreground font-medium">
                                {sz}
                              </p>
                              <Input
                                {...orderForm.register(`entries.${idx}.sizes.${sz as Size}`)}
                                data-testid={`input-size-${idx}-${sz}`}
                                type="number"
                                min={0}
                                placeholder="—"
                                className="text-center px-1 [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Entry totals */}
                      <div className="flex items-center justify-between pt-1 border-t border-border text-sm">
                        <span className="text-muted-foreground">
                          Total Jumlah:{" "}
                          <span className="font-semibold text-foreground">
                            {totalQty} pcs
                          </span>
                        </span>
                        <span className="text-muted-foreground">
                          Subtotal:{" "}
                          <span className="font-semibold text-foreground">
                            {formatRupiah(subtotal)}
                          </span>
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Grand total */}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="text-sm font-semibold">Total Keseluruhan</span>
                  <span className="text-lg font-bold" data-testid="text-total-price">
                    {formatRupiah(grandTotal)}
                  </span>
                </div>
              </div>

              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(0)}
                  data-testid="button-back-step1"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
                </Button>
                <Button type="submit" data-testid="button-next-step2">
                  Lanjut <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 3 — Payment */}
        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
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
                      paymentForm.setValue(
                        "paymentStatus",
                        v as "PAID" | "PARTIALLY_PAID" | "UNPAID",
                      )
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
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Sisa: {formatRupiah(Math.max(0, grandTotal - (Number(watchPaid) || 0)))}
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Catatan (opsional)</Label>
                  <Textarea
                    {...paymentForm.register("notes")}
                    data-testid="input-notes"
                    placeholder="Catatan tambahan..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  data-testid="button-back-step2"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Kembali
                </Button>
                <Button type="submit" data-testid="button-next-step3">
                  Preview <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Step 4 — Preview & Confirm */}
        {step === 3 && previewReceipt && (
          <motion.div
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-semibold">
                    {settings.businessName || "MS Collection"}
                  </h2>
                  {settings.businessAddress && (
                    <p className="text-xs text-muted-foreground">
                      {settings.businessAddress}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Kode Nota</p>
                  <p className="text-sm font-mono font-bold" data-testid="text-receipt-code">
                    {previewReceipt.receiptCode}
                  </p>
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
                    <span className="col-span-5 text-foreground">
                      {item.category && item.subcategory
                        ? item.subcategory === "Customized" || item.subcategory === "Others"
                          ? item.customProductName
                            ? `${item.category} — ${item.subcategory} (${item.customProductName})`
                            : `${item.category} — ${item.subcategory}`
                          : `${item.category} — ${item.subcategory}`
                        : item.productType}
                    </span>
                    <span className="col-span-2 text-center text-muted-foreground">
                      {item.size}
                    </span>
                    <span className="col-span-2 text-center text-muted-foreground">
                      {item.quantity}
                    </span>
                    <span className="col-span-3 text-right font-medium">
                      {formatRupiah(item.subtotal)}
                    </span>
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
                  <span className="text-green-500 font-medium">
                    {formatRupiah(previewReceipt.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sisa</span>
                  <span className="text-red-400 font-medium">
                    {formatRupiah(
                      Math.max(0, previewReceipt.totalPrice - previewReceipt.paidAmount),
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={previewReceipt.paymentStatus} />
                </div>
              </div>
            </div>

            {/* Sticky single primary action */}
            <div
              className="sticky bottom-24 md:bottom-0 z-10 -mx-6 md:-mx-8 px-6 md:px-8 pt-3 border-t border-border/60 bg-background/95 backdrop-blur-sm"
              style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
            >
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-full min-h-[48px] text-sm font-semibold"
                data-testid="button-save-only"
              >
                <Check className="w-4 h-4" />
                {editingCode ? "Simpan Perubahan" : "Buat Nota"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Bottom Sheet */}
      <Sheet open={successOpen} onOpenChange={(open) => !open && setSuccessOpen(false)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <div className="flex flex-col items-center pt-2 pb-4">
            <div className="w-14 h-14 rounded-full bg-green-500/15 flex items-center justify-center mb-4">
              <Check className="w-7 h-7 text-green-500" />
            </div>
            <SheetHeader className="text-center">
              <SheetTitle className="text-lg font-semibold">
                {editingCode ? "Perubahan berhasil disimpan" : "Nota berhasil dibuat"}
              </SheetTitle>
              <SheetDescription className="text-sm text-muted-foreground">
                {editingCode ? "Perubahan telah berhasil diperbarui." : "Nota siap digunakan."}
              </SheetDescription>
            </SheetHeader>

            <div className="w-full space-y-3 mt-6">
              <Button
                onClick={handleDownloadPDF}
                className="w-full min-h-[48px] text-sm font-semibold"
                data-testid="button-success-download"
              >
                <Download className="w-4 h-4" /> Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleBackToHistory}
                className="w-full min-h-[48px] text-sm"
                data-testid="button-success-back"
              >
                <ArrowLeft className="w-4 h-4" /> Kembali ke Riwayat
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
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
    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${className}`}>
      {label}
    </span>
  );
}