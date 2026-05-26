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
      color: "#333333",
    },

    // ── Header: two-column borderless layout ─────────────────
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 10,
    },

    // LEFT column — brand identity
    headerLeft: {
      flexDirection: "row",
      alignItems: "flex-start",
      flex: 1,
    },
    logo: {
      width: 52,
      height: 52,
      objectFit: "contain",
      marginRight: 12,
    },
    brandBlock: {
      flexDirection: "column",
      justifyContent: "flex-start",
    },
    businessName: {
      fontSize: 15,
      fontFamily: "Helvetica-Bold",
      color: "#000000",
      letterSpacing: 0.5,
      marginBottom: 3,
    },
    addressLine: {
      fontSize: 8.5,
      color: "#666666",
      lineHeight: 1.5,
      marginBottom: 1,
    },
    phoneLine: {
      fontSize: 8.5,
      color: "#666666",
      marginTop: 2,
    },

    // RIGHT column — invoice meta
    headerRight: {
      flexDirection: "column",
      alignItems: "flex-end",
      justifyContent: "flex-start",
      gap: 4,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    metaLabel: {
      fontSize: 9,
      fontFamily: "Helvetica-Bold",
      color: "#333333",
    },
    metaValue: {
      fontSize: 9,
      color: "#333333",
    },

    // ── Separator line ───────────────────────────────────────
    separator: {
      borderBottom: "1px solid #e0e0e0",
      marginBottom: 8,
    },

    // ── Recipient block ──────────────────────────────────────
    recipientBlock: {
      marginBottom: 12,
    },
    recipientName: {
      fontSize: 9.5,
      fontFamily: "Helvetica-Bold",
      color: "#333333",
      marginBottom: 2,
    },
    recipientPhone: {
      fontSize: 8.5,
      color: "#666666",
    },

    // ── Document title ───────────────────────────────────────
    docTitle: {
      textAlign: "center",
      fontSize: 13,
      fontFamily: "Helvetica-Bold",
      color: "#000000",
      marginBottom: 10,
      borderTop: "1px solid #000000",
      borderBottom: "1px solid #000000",
      paddingVertical: 4,
      letterSpacing: 1,
    },

    // ── Table ────────────────────────────────────────────────
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
    colQty: { width: 30, textAlign: "center" },
    colBarang: { flex: 1, textAlign: "left", paddingLeft: 4 },
    colHarga: { width: 80, textAlign: "right", paddingRight: 4 },
    colJumlah: { width: 80, textAlign: "right" },
    colHeaderText: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#000000" },
    colCellText: { fontSize: 9, color: "#333333" },

    // ── Bottom section ───────────────────────────────────────
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
      color: "#333333",
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
      color: "#333333",
      marginBottom: 2,
    },

    bottomRight: {
      width: 180,
      flexDirection: "column",
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderBottom: "1px solid #000000",
      paddingVertical: 5,
      paddingHorizontal: 4,
    },
    summaryLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#000000" },
    summaryValue: { fontSize: 9, color: "#333333" },

    // ── Footer ───────────────────────────────────────────────
    footer: {
      marginTop: 16,
      borderTop: "1px solid #e0e0e0",
      paddingTop: 6,
      fontSize: 8,
      color: "#666666",
    },
    footerTitle: {
      fontFamily: "Helvetica-Bold",
      fontSize: 8.5,
      color: "#333333",
      marginBottom: 2,
    },
  });

  const remaining = Math.max(0, receipt.totalPrice - receipt.paidAmount);
  const bankBCA = settings.bankBCA || "—";
  const bankMandiri = settings.bankMandiri || "—";

  // Parse address into up to 3 lines
  const rawAddress = settings.businessAddress || "";
  const [addrLine1 = "", addrLine2 = "", addrLine3 = ""] = rawAddress
    .split(/,\s*/)
    .reduce<string[]>((acc, part, i) => {
      if (i === 0) acc.push(part);
      else if (i === 1) acc.push(part);
      else acc[acc.length - 1] = (acc[acc.length - 1] || "") + ", " + part;
      return acc;
    }, []);

  const doc = createElement(
    Document,
    {},
    createElement(
      Page,
      { size: "A4", style: styles.page },

      // ── Header ─────────────────────────────────────────────
      createElement(
        View,
        { style: styles.header },

        // LEFT: logo + brand
        createElement(
          View,
          { style: styles.headerLeft },
          logoDataUrl
            ? createElement(Image, { style: styles.logo, src: logoDataUrl })
            : null,
          createElement(
            View,
            { style: styles.brandBlock },
            createElement(Text, { style: styles.businessName }, (settings.businessName || "CV. Mandiri SEJATI").toUpperCase()),
            addrLine1
              ? createElement(Text, { style: styles.addressLine }, addrLine1)
              : null,
            addrLine2
              ? createElement(Text, { style: styles.addressLine }, addrLine2)
              : null,
            addrLine3
              ? createElement(Text, { style: styles.addressLine }, addrLine3)
              : null,
            createElement(Text, { style: styles.phoneLine }, settings.businessPhone || "")
          )
        ),

        // RIGHT: invoice no + date
        createElement(
          View,
          { style: styles.headerRight },
          createElement(
            View,
            { style: styles.metaRow },
            createElement(Text, { style: styles.metaLabel }, "No. Nota:"),
            createElement(Text, { style: styles.metaValue }, receipt.receiptCode)
          ),
          createElement(
            View,
            { style: styles.metaRow },
            createElement(Text, { style: styles.metaLabel }, "Tgl"),
            createElement(Text, { style: styles.metaValue }, formatDate(receipt.date))
          )
        )
      ),

      // ── Separator ──────────────────────────────────────────
      createElement(View, { style: styles.separator }),

      // ── Recipient ──────────────────────────────────────────
      createElement(
        View,
        { style: styles.recipientBlock },
        createElement(Text, { style: styles.recipientName }, `Kepada Yth: ${receipt.clientName}`),
        createElement(Text, { style: styles.recipientPhone }, `Tlp: ${receipt.clientPhone}`)
      ),

      // ── Document title ─────────────────────────────────────
      createElement(Text, { style: styles.docTitle }, "NOTA / INVOICE"),

      // ── Table ──────────────────────────────────────────────
      createElement(
        View,
        { style: styles.table },
        createElement(
          View,
          { style: styles.tableHeader },
          createElement(Text, { style: [styles.colQty, styles.colHeaderText] }, "Qty"),
          createElement(Text, { style: [styles.colBarang, styles.colHeaderText] }, "Barang"),
          createElement(Text, { style: [styles.colHarga, styles.colHeaderText] }, "Harga"),
          createElement(Text, { style: [styles.colJumlah, styles.colHeaderText] }, "Jumlah")
        ),
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

      // ── Bottom: bank info + totals ──────────────────────────
      createElement(
        View,
        { style: styles.bottomSection },

        // Left: Deadline + bank accounts
        createElement(
          View,
          { style: styles.bottomLeft },
          createElement(
            View,
            { style: styles.deadlineRow },
            createElement(Text, { style: styles.deadlineLabel }, "Deadline :"),
            createElement(Text, { style: styles.deadlineValue }, formatDate(receipt.date))
          ),
          createElement(Text, { style: styles.bankTitle }, "No. Rekening :"),
          createElement(Text, { style: styles.bankRow }, `BCA      a/n  ${bankBCA}`),
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

      // ── Footer ─────────────────────────────────────────────
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
