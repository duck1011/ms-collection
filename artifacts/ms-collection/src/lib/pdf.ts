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

  const styles = StyleSheet.create({
    page: {
      padding: "15mm",
      fontFamily: "Helvetica",
      backgroundColor: "#ffffff",
      fontSize: 10,
      color: "#000000",
    },

    // ── Header ─────────────────────────────────────────────
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 10,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
    },
    logo: {
      width: 52,
      height: 52,
      objectFit: "contain",
    },
    headerText: {
      flexDirection: "column",
      justifyContent: "center",
    },
    businessName: {
      fontSize: 14,
      fontFamily: "Helvetica-Bold",
      color: "#000000",
      marginBottom: 2,
    },
    businessDetail: {
      fontSize: 8.5,
      color: "#333333",
      marginBottom: 1,
    },

    // Header right — client meta (Tgl, Kepada Yth, Tlp)
    headerRight: {
      flexDirection: "column",
      gap: 6,
      minWidth: 160,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      borderBottom: "1px solid #000000",
      paddingBottom: 2,
      gap: 4,
    },
    metaLabel: {
      fontSize: 8.5,
      width: 56,
      color: "#000000",
    },
    metaValue: {
      fontSize: 8.5,
      flex: 1,
      color: "#000000",
    },

    // ── Document title ──────────────────────────────────────
    docTitle: {
      textAlign: "center",
      fontSize: 13,
      fontFamily: "Helvetica-Bold",
      color: "#000000",
      marginVertical: 10,
      borderTop: "1px solid #000000",
      borderBottom: "1px solid #000000",
      paddingVertical: 4,
      letterSpacing: 1,
    },

    // ── Table ───────────────────────────────────────────────
    table: {
      marginBottom: 8,
    },
    tableHeader: {
      flexDirection: "row",
      backgroundColor: "#f4f4f4",
      borderTop: "1px solid #000000",
      borderBottom: "1px solid #000000",
      paddingVertical: 5,
      paddingHorizontal: 4,
    },
    tableRow: {
      flexDirection: "row",
      borderBottom: "1px dashed #cccccc",
      paddingVertical: 6,
      paddingHorizontal: 4,
    },

    colQty: {
      width: 30,
      textAlign: "center",
    },
    colBarang: {
      flex: 1,
      textAlign: "left",
      paddingLeft: 4,
    },
    colHarga: {
      width: 80,
      textAlign: "right",
      paddingRight: 4,
    },
    colJumlah: {
      width: 80,
      textAlign: "right",
    },
    colHeaderText: {
      fontFamily: "Helvetica-Bold",
      fontSize: 9,
      color: "#000000",
    },
    colCellText: {
      fontSize: 9,
      color: "#000000",
    },

    // ── Bottom section ──────────────────────────────────────
    bottomSection: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
      gap: 12,
    },
    bottomLeft: {
      flex: 1,
      flexDirection: "column",
      gap: 4,
    },
    deadlineRow: {
      flexDirection: "row",
      alignItems: "center",
      borderBottom: "1px solid #000000",
      paddingBottom: 2,
      marginBottom: 8,
    },
    deadlineLabel: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: "#000000",
    },
    deadlineValue: {
      fontSize: 9,
      color: "#000000",
      marginLeft: 4,
    },
    bankTitle: {
      fontSize: 8.5,
      fontFamily: "Helvetica-Bold",
      color: "#000000",
      marginBottom: 3,
    },
    bankRow: {
      fontSize: 8.5,
      color: "#000000",
      marginBottom: 2,
    },

    bottomRight: {
      width: 180,
      flexDirection: "column",
      gap: 0,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid #000000",
      paddingVertical: 5,
      paddingHorizontal: 4,
    },
    summaryLabel: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: "#000000",
    },
    summaryValue: {
      fontSize: 9,
      color: "#000000",
    },

    // ── Receipt code ─────────────────────────────────────────
    receiptCodeRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      marginBottom: 4,
    },
    receiptCode: {
      fontSize: 8,
      color: "#555555",
    },

    // ── Footer ──────────────────────────────────────────────
    footer: {
      marginTop: 16,
      borderTop: "1px solid #000000",
      paddingTop: 6,
      fontSize: 8,
      color: "#333333",
    },
    footerTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: 8.5,
      marginBottom: 2,
    },
  });

  const remaining = Math.max(0, receipt.totalPrice - receipt.paidAmount);
  const bankBCA = settings.bankBCA || "—";
  const bankMandiri = settings.bankMandiri || "—";

  const doc = createElement(
    Document,
    {},
    createElement(
      Page,
      { size: "A4", style: styles.page },

      // Receipt code top-right
      createElement(
        View,
        { style: styles.receiptCodeRow },
        createElement(Text, { style: styles.receiptCode }, `No. Nota: ${receipt.receiptCode}`)
      ),

      // ── Header ─────────────────────────────
      createElement(
        View,
        { style: styles.header },

        // Left: logo + company info
        createElement(
          View,
          { style: styles.headerLeft },
          logoDataUrl
            ? createElement(Image, { style: styles.logo, src: logoDataUrl })
            : null,
          createElement(
            View,
            { style: styles.headerText },
            createElement(Text, { style: styles.businessName }, settings.businessName || "CV. Mandiri SEJATI"),
            createElement(Text, { style: styles.businessDetail }, settings.businessAddress || ""),
            createElement(Text, { style: styles.businessDetail }, settings.businessPhone || "")
          )
        ),

        // Right: Tgl / Kepada Yth / Tlp
        createElement(
          View,
          { style: styles.headerRight },
          createElement(
            View,
            { style: styles.metaRow },
            createElement(Text, { style: styles.metaLabel }, "Tgl         :"),
            createElement(Text, { style: styles.metaValue }, formatDate(receipt.date))
          ),
          createElement(
            View,
            { style: styles.metaRow },
            createElement(Text, { style: styles.metaLabel }, "Kepada Yth :"),
            createElement(Text, { style: styles.metaValue }, receipt.clientName)
          ),
          createElement(
            View,
            { style: styles.metaRow },
            createElement(Text, { style: styles.metaLabel }, "Tlp         :"),
            createElement(Text, { style: styles.metaValue }, receipt.clientPhone)
          )
        )
      ),

      // ── Document title ──────────────────────
      createElement(Text, { style: styles.docTitle }, "NOTA / INVOICE"),

      // ── Table ───────────────────────────────
      createElement(
        View,
        { style: styles.table },

        // Header row
        createElement(
          View,
          { style: styles.tableHeader },
          createElement(Text, { style: [styles.colQty, styles.colHeaderText] }, "Qty"),
          createElement(Text, { style: [styles.colBarang, styles.colHeaderText] }, "Barang"),
          createElement(Text, { style: [styles.colHarga, styles.colHeaderText] }, "Harga"),
          createElement(Text, { style: [styles.colJumlah, styles.colHeaderText] }, "Jumlah")
        ),

        // Data rows
        ...receipt.items.map((item, i) =>
          createElement(
            View,
            { key: i, style: styles.tableRow },
            createElement(Text, { style: [styles.colQty, styles.colCellText] }, String(item.quantity)),
            createElement(Text, { style: [styles.colBarang, styles.colCellText] }, `${item.productType} — ${item.size}`),
            createElement(Text, { style: [styles.colHarga, styles.colCellText] }, formatRupiah(item.unitPrice)),
            createElement(Text, { style: [styles.colJumlah, styles.colCellText] }, formatRupiah(item.subtotal))
          )
        ),

        // Empty filler rows (pad to at least 10 rows)
        ...Array.from({ length: Math.max(0, 10 - receipt.items.length) }).map((_, i) =>
          createElement(
            View,
            { key: `empty-${i}`, style: styles.tableRow },
            createElement(Text, { style: [styles.colQty, styles.colCellText] }, " "),
            createElement(Text, { style: [styles.colBarang, styles.colCellText] }, " "),
            createElement(Text, { style: [styles.colHarga, styles.colCellText] }, " "),
            createElement(Text, { style: [styles.colJumlah, styles.colCellText] }, " ")
          )
        )
      ),

      // ── Bottom: bank info (left) + totals (right) ──
      createElement(
        View,
        { style: styles.bottomSection },

        // Left: Deadline + No. Rekening
        createElement(
          View,
          { style: styles.bottomLeft },
          createElement(
            View,
            { style: styles.deadlineRow },
            createElement(Text, { style: styles.deadlineLabel }, "Deadline :"),
            createElement(Text, { style: styles.deadlineValue }, receipt.date ? formatDate(receipt.date) : "")
          ),
          createElement(Text, { style: styles.bankTitle }, "No. Rekening :"),
          createElement(Text, { style: styles.bankRow }, `BCA   a/n  ${bankBCA}`),
          createElement(Text, { style: styles.bankRow }, `Mandiri  a/n  ${bankMandiri}`)
        ),

        // Right: Total / DP / Sisa
        createElement(
          View,
          { style: styles.bottomRight },
          createElement(
            View,
            { style: styles.summaryRow },
            createElement(Text, { style: styles.summaryLabel }, "Total"),
            createElement(Text, { style: styles.summaryValue }, formatRupiah(receipt.totalPrice))
          ),
          createElement(
            View,
            { style: styles.summaryRow },
            createElement(Text, { style: styles.summaryLabel }, "DP"),
            createElement(Text, { style: styles.summaryValue }, formatRupiah(receipt.paidAmount))
          ),
          createElement(
            View,
            { style: styles.summaryRow },
            createElement(Text, { style: styles.summaryLabel }, "Sisa"),
            createElement(Text, { style: styles.summaryValue }, formatRupiah(remaining))
          )
        )
      ),

      // ── Footer ──────────────────────────────
      createElement(
        View,
        { style: styles.footer },
        createElement(Text, { style: styles.footerTitle }, "Perhatian !"),
        createElement(
          Text,
          {},
          "Barang yg sudah dibeli tidak dapat ditukar/dikembalikan kecuali ada perjanjian."
        )
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
