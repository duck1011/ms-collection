import { pdf } from "@react-pdf/renderer";
import { createElement } from "react";
import { Receipt, Settings } from "@/lib/db";
import { formatRupiah, formatDate } from "@/lib/utils";
import logoAssetUrl from "../assets/logo.png";

async function getLogoDataUrl(): Promise<string> {
  try {
    const res = await fetch(logoAssetUrl);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

export async function downloadReceiptPDF(receipt: Receipt, settings: Settings) {
  const { Document, Page, View, Text, Image, StyleSheet } = await import("@react-pdf/renderer");
  const logoDataUrl = await getLogoDataUrl();

  const STATUS_LABEL: Record<string, string> = {
    PAID: "Lunas",
    PARTIALLY_PAID: "Sebagian Dibayar",
    UNPAID: "Belum Dibayar",
  };

  const styles = StyleSheet.create({
    page: {
      padding: 40,
      fontFamily: "Helvetica",
      backgroundColor: "#ffffff",
      fontSize: 10,
    },
    header: {
      marginBottom: 20,
      borderBottom: "1px solid #e5e7eb",
      paddingBottom: 12,
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    logo: {
      width: 36,
      height: 36,
      objectFit: "contain",
    },
    headerText: {
      flexDirection: "column",
      justifyContent: "center",
    },
    businessName: {
      fontSize: 15,
      fontFamily: "Helvetica-Bold",
      color: "#111827",
      marginBottom: 1,
    },
    businessSub: {
      fontSize: 8,
      color: "#6b7280",
    },
    receiptCode: {
      fontSize: 13,
      fontFamily: "Helvetica-Bold",
      color: "#111827",
      textAlign: "right",
    },
    receiptCodeLabel: {
      fontSize: 8,
      color: "#6b7280",
      textAlign: "right",
      marginBottom: 2,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: "#6b7280",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    row: {
      flexDirection: "row",
      marginBottom: 4,
    },
    label: {
      width: 130,
      color: "#6b7280",
    },
    value: {
      flex: 1,
      color: "#111827",
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: "#f9fafb",
      padding: "6 8",
      borderRadius: 4,
      marginBottom: 4,
    },
    tableRow: {
      flexDirection: "row",
      padding: "5 8",
      borderBottom: "1px solid #f3f4f6",
    },
    colProduct: { flex: 3, color: "#111827" },
    colSize: { flex: 1, textAlign: "center" },
    colQty: { flex: 1, textAlign: "center" },
    colPrice: { flex: 2, textAlign: "right" },
    colLabel: { color: "#6b7280", fontFamily: "Helvetica-Bold", fontSize: 9 },
    divider: {
      borderBottom: "1px solid #e5e7eb",
      marginVertical: 12,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 5,
    },
    summaryLabel: { color: "#6b7280" },
    summaryValue: { fontFamily: "Helvetica-Bold", color: "#111827" },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 4,
    },
    totalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#111827" },
    totalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#111827" },
    statusBadge: {
      alignSelf: "flex-start",
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      marginTop: 8,
    },
    statusText: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
    },
    footer: {
      marginTop: 24,
      borderTop: "1px solid #e5e7eb",
      paddingTop: 10,
      color: "#9ca3af",
      fontSize: 8,
      textAlign: "center",
    },
    paidLabel: { color: "#059669" },
    remainLabel: { color: "#dc2626" },
  });

  const statusColor: Record<string, { bg: string; text: string }> = {
    PAID: { bg: "#dcfce7", text: "#166534" },
    PARTIALLY_PAID: { bg: "#fef3c7", text: "#92400e" },
    UNPAID: { bg: "#fee2e2", text: "#991b1b" },
  };

  const remaining = Math.max(0, receipt.totalPrice - receipt.paidAmount);
  const sc = statusColor[receipt.paymentStatus] ?? statusColor["UNPAID"];

  const doc = createElement(
    Document,
    {},
    createElement(
      Page,
      { size: "A5", style: styles.page },

      // Header
      createElement(
        View,
        { style: styles.header },
        // Left: logo + business name
        createElement(
          View,
          { style: styles.headerLeft },
          logoDataUrl
            ? createElement(Image, { style: styles.logo, src: logoDataUrl })
            : null,
          createElement(
            View,
            { style: styles.headerText },
            createElement(Text, { style: styles.businessName }, settings.businessName || "MS Collection"),
            createElement(Text, { style: styles.businessSub }, "School Uniform & Sports Apparel"),
            settings.businessPhone
              ? createElement(Text, { style: styles.businessSub }, settings.businessPhone)
              : null,
            settings.businessAddress
              ? createElement(Text, { style: styles.businessSub }, settings.businessAddress)
              : null
          )
        ),
        // Right: receipt code
        createElement(
          View,
          {},
          createElement(Text, { style: styles.receiptCodeLabel }, "KODE NOTA"),
          createElement(Text, { style: styles.receiptCode }, receipt.receiptCode)
        )
      ),

      // Client Info
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, "Informasi Klien"),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, "Nama"),
          createElement(Text, { style: styles.value }, receipt.clientName)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, "Telepon"),
          createElement(Text, { style: styles.value }, receipt.clientPhone)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, "Sekolah / Organisasi"),
          createElement(Text, { style: styles.value }, receipt.schoolOrOrganization)
        ),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, "Tanggal"),
          createElement(Text, { style: styles.value }, formatDate(receipt.date))
        )
      ),

      // Items Table
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, "Detail Pesanan"),
        createElement(
          View,
          { style: styles.tableHeader },
          createElement(Text, { style: [styles.colProduct, styles.colLabel] }, "Produk"),
          createElement(Text, { style: [styles.colSize, styles.colLabel] }, "Ukuran"),
          createElement(Text, { style: [styles.colQty, styles.colLabel] }, "Qty"),
          createElement(Text, { style: [styles.colPrice, styles.colLabel] }, "Subtotal")
        ),
        ...receipt.items.map((item, i) =>
          createElement(
            View,
            { key: i, style: styles.tableRow },
            createElement(Text, { style: styles.colProduct }, item.productType),
            createElement(Text, { style: styles.colSize }, item.size),
            createElement(Text, { style: styles.colQty }, String(item.quantity)),
            createElement(Text, { style: styles.colPrice }, formatRupiah(item.subtotal))
          )
        )
      ),

      // Summary
      createElement(View, { style: styles.divider }),
      createElement(
        View,
        { style: styles.section },
        createElement(
          View,
          { style: styles.summaryRow },
          createElement(Text, { style: styles.summaryLabel }, "Total"),
          createElement(Text, { style: styles.summaryValue }, formatRupiah(receipt.totalPrice))
        ),
        createElement(
          View,
          { style: styles.summaryRow },
          createElement(Text, { style: styles.summaryLabel }, "Dibayar"),
          createElement(Text, { style: [styles.summaryValue, styles.paidLabel] }, formatRupiah(receipt.paidAmount))
        ),
        createElement(
          View,
          { style: styles.summaryRow },
          createElement(Text, { style: styles.summaryLabel }, "Sisa"),
          createElement(Text, { style: [styles.summaryValue, styles.remainLabel] }, formatRupiah(remaining))
        ),
        createElement(
          View,
          { style: [styles.statusBadge, { backgroundColor: sc.bg }] },
          createElement(
            Text,
            { style: [styles.statusText, { color: sc.text }] },
            STATUS_LABEL[receipt.paymentStatus] ?? receipt.paymentStatus
          )
        )
      ),

      // Notes
      receipt.notes
        ? createElement(
            View,
            { style: styles.section },
            createElement(Text, { style: styles.sectionTitle }, "Catatan"),
            createElement(Text, { style: { color: "#374151" } }, receipt.notes)
          )
        : null,

      // Footer
      createElement(
        Text,
        { style: styles.footer },
        `${settings.businessName || "MS Collection"} — Terima kasih atas kepercayaan Anda`
      )
    )
  );

  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nota-${receipt.receiptCode}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
