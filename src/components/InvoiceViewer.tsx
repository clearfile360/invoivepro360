import React, { useState } from "react";
import { Invoice, InvoiceItem } from "../types";
import { validateInvoice, formatRupees, calculateInvoiceTotals, isValidGstin } from "../utils/invoiceUtils";
import { 
  X, 
  Printer, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Edit3, 
  FileText, 
  Sparkles, 
  ArrowRight,
  Plus,
  Trash2,
  AlertCircle,
  Mail,
  QrCode,
  CreditCard
} from "lucide-react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { CompanySettings } from "../types";
import { logoColorsMap, logoIconsMap } from "./CompanySettings";

interface InvoiceViewerProps {
  invoice: Invoice;
  allInvoices: Invoice[];
  onClose: () => void;
  onUpdateInvoice: (updated: Invoice) => void;
  companySettings?: CompanySettings;
  onDeleteInvoice?: (id: string) => void;
  onRecordPayment?: (invoice: Invoice) => void;
}

export default function InvoiceViewer({ 
  invoice, 
  allInvoices, 
  onClose, 
  onUpdateInvoice,
  companySettings,
  onDeleteInvoice,
  onRecordPayment
}: InvoiceViewerProps) {
  const renderInvoiceLogo = (settings?: CompanySettings) => {
    if (!settings) {
      return (
        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>
      );
    }

    if (settings.logoType === "upload" && (settings.logoBase64 || settings.logoUrl)) {
      return (
        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-[#161618] p-1 flex items-center justify-center shrink-0 shadow-sm">
          <img 
            src={settings.logoBase64 || settings.logoUrl} 
            alt="Company Logo" 
            className="w-full h-full object-contain rounded-lg"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            referrerPolicy="no-referrer"
          />
        </div>
      );
    }

    if (settings.logoType === "url" && settings.logoUrl) {
      return (
        <img 
          src={settings.logoUrl} 
          alt="Brand Logo" 
          className="w-12 h-12 rounded-xl object-contain border border-white/10 bg-white/5 p-1 shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
          referrerPolicy="no-referrer"
        />
      );
    }

    if (settings.logoType === "initials" && settings.logoInitials) {
      const activeColorConf = logoColorsMap[settings.logoColor] || logoColorsMap.indigo;
      return (
        <div className={`w-12 h-12 rounded-xl ${activeColorConf.bg} border ${activeColorConf.border} ${activeColorConf.text} flex items-center justify-center font-extrabold text-sm tracking-tight shadow-sm shrink-0`}>
          {settings.logoInitials}
        </div>
      );
    }

    // Default: icon
    const IconComponent = logoIconsMap[settings.logoIcon] || Sparkles;
    const activeColorConf = logoColorsMap[settings.logoColor] || logoColorsMap.indigo;
    return (
      <div className={`w-12 h-12 rounded-xl ${activeColorConf.bg} border ${activeColorConf.border} ${activeColorConf.text} flex items-center justify-center shrink-0`}>
        <IconComponent className="w-6 h-6" />
      </div>
    );
  };

  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  
  // UPI QR & Modal state
  const [showUpiModal, setShowUpiModal] = useState(false);
  const [upiQrCodeUrl, setUpiQrCodeUrl] = useState("");
  
  // Edit Form States
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
  const [date, setDate] = useState(invoice.date);
  const [supplierName, setSupplierName] = useState(invoice.supplierName);
  const [supplierGstin, setSupplierGstin] = useState(invoice.supplierGstin || "");
  const [supplierAddress, setSupplierAddress] = useState(invoice.supplierAddress || "");
  const [customerName, setCustomerName] = useState(invoice.customerName);
  const [customerGstin, setCustomerGstin] = useState(invoice.customerGstin || "");
  const [customerAddress, setCustomerAddress] = useState(invoice.customerAddress || "");
  const [status, setStatus] = useState(invoice.status);
  const [category, setCategory] = useState(invoice.category || "Sales");
  const [notes, setNotes] = useState(invoice.notes || "");
  const [items, setItems] = useState<InvoiceItem[]>(invoice.items);

  // AI Auditor Validation for current state
  const auditReport = validateInvoice(invoice, allInvoices);

  // Auto-Fix Math Discrepancies
  const handleAutoFixMath = () => {
    // Re-calculate math properly using standard helper
    const fixedTotals = calculateInvoiceTotals(items, supplierGstin, customerGstin);
    const updated: Invoice = {
      ...invoice,
      items: fixedTotals.items,
      subtotal: fixedTotals.subtotal,
      cgst: fixedTotals.cgst,
      sgst: fixedTotals.sgst,
      igst: fixedTotals.igst,
      taxAmount: fixedTotals.taxAmount,
      totalAmount: fixedTotals.totalAmount,
      notes: (invoice.notes || "") + "\n[AI Auto-Fix applied: Corrected mathematical totals and rounding discrepancies.]"
    };
    onUpdateInvoice(updated);
  };

  // Auto-Fix State Tax Mismatches (CGST/SGST vs IGST)
  const handleAutoFixStateTax = () => {
    const supplierState = (supplierGstin || "").substring(0, 2);
    const customerState = (customerGstin || "").substring(0, 2);
    const isInterstate = supplierState !== customerState;

    const fixedTotals = calculateInvoiceTotals(items, supplierGstin, customerGstin);
    const updated: Invoice = {
      ...invoice,
      cgst: fixedTotals.cgst,
      sgst: fixedTotals.sgst,
      igst: fixedTotals.igst,
      taxAmount: fixedTotals.taxAmount,
      totalAmount: fixedTotals.totalAmount,
      notes: (invoice.notes || "") + `\n[AI Auto-Fix applied: Reclassified tax rule correctly based on state codes (${isInterstate ? "IGST Interstate" : "CGST/SGST Local"}).]`
    };
    onUpdateInvoice(updated);
  };

  // Form items management
  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];
    const item = { ...updatedItems[index], [field]: value };
    
    // Recompute total for that item
    if (field === "quantity" || field === "price") {
      const q = field === "quantity" ? Number(value) : item.quantity;
      const p = field === "price" ? Number(value) : item.price;
      item.total = q * p;
    }
    
    updatedItems[index] = item;
    setItems(updatedItems);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: Math.random().toString(36).substring(2, 9),
        description: "New Item",
        quantity: 1,
        price: 100,
        taxRate: 18,
        hsn: "9983",
        total: 100
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Save manual modifications
  const handleSaveChanges = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Complete calculation math
    const mathResult = calculateInvoiceTotals(items, supplierGstin, customerGstin);

    const updated: Invoice = {
      ...invoice,
      invoiceNumber,
      date,
      supplierName,
      supplierGstin: supplierGstin || undefined,
      supplierAddress: supplierAddress || undefined,
      customerName,
      customerGstin: customerGstin || undefined,
      customerAddress: customerAddress || undefined,
      status,
      category,
      notes,
      items: mathResult.items,
      subtotal: mathResult.subtotal,
      cgst: mathResult.cgst,
      sgst: mathResult.sgst,
      igst: mathResult.igst,
      taxAmount: mathResult.taxAmount,
      totalAmount: mathResult.totalAmount
    };

    onUpdateInvoice(updated);
    setActiveTab("preview");
  };

  // Trigger print view in browser
  const handlePrint = () => {
    window.print();
  };

  // Format rupees specifically for PDF (replaces Rupee symbol with 'Rs.' to avoid font encoding boxes in default helvetica)
  const formatRupeesPDF = (val: number) => {
    return "Rs. " + val.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  // Pre-filled mailto share link generator
  const handleShareEmail = () => {
    const subject = `Invoice ${invoice.invoiceNumber} from ${invoice.supplierName}`;
    
    const itemsSummary = invoice.items
      .map(
        (item) =>
          `- ${item.description} (HSN: ${item.hsn || "—"}) x${item.quantity}: ${formatRupeesPDF(item.price)} each (Total: ${formatRupeesPDF(item.quantity * item.price)})`
      )
      .join("\n");

    const taxDetails = [];
    if (invoice.cgst > 0) taxDetails.push(`CGST: ${formatRupeesPDF(invoice.cgst)}`);
    if (invoice.sgst > 0) taxDetails.push(`SGST: ${formatRupeesPDF(invoice.sgst)}`);
    if (invoice.igst > 0) taxDetails.push(`IGST: ${formatRupeesPDF(invoice.igst)}`);

    const bodyText = `Dear Customer,

Here is the billing summary of Tax Invoice No: ${invoice.invoiceNumber} issued on ${invoice.date}.

Supplier Details:
----------------
Name: ${invoice.supplierName}
GSTIN: ${invoice.supplierGstin || "—"}

Customer Details:
----------------
Name: ${invoice.customerName}
GSTIN: ${invoice.customerGstin || "—"}

Order Details:
-------------
${itemsSummary}

Financial Summary:
-----------------
Subtotal (Taxable Value): ${formatRupeesPDF(invoice.subtotal)}
Tax Amount: ${formatRupeesPDF(invoice.taxAmount)} (${taxDetails.join(", ")})
Grand Total Value: ${formatRupeesPDF(invoice.totalAmount)}

Payment Status: ${invoice.status.toUpperCase()}

Regards,
${invoice.supplierName}
Powered by InvoicePro 360 AI Workspace (Unikorn360 AI Solutions)`;

    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    window.location.href = mailtoUrl;
  };

  // Dynamic PDF exporter using jsPDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    
    // Set Header Brand
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    // Dynamic brand color
    const activeColor = companySettings ? (logoColorsMap[companySettings.logoColor]?.rawHex || "#4F46E5") : "#4F46E5";
    const hexToRgb = (hex: string) => {
      const match = hex.replace('#', '').match(/.{1,2}/g);
      return match ? {
        r: parseInt(match[0], 16),
        g: parseInt(match[1], 16),
        b: parseInt(match[2], 16)
      } : { r: 79, g: 70, b: 229 };
    };
    const rgb = hexToRgb(activeColor);
    doc.setTextColor(rgb.r, rgb.g, rgb.b);

    let brandTextX = 14;
    // Check if custom uploaded logo image is available for embedding in PDF
    if (companySettings?.logoBase64 && (companySettings.logoType === "upload" || companySettings.logoType === "url")) {
      try {
        const isPng = companySettings.logoBase64.includes("image/png") || companySettings.logoBase64.includes("image/webp");
        doc.addImage(companySettings.logoBase64, isPng ? "PNG" : "JPEG", 14, 12, 14, 14);
        brandTextX = 32;
      } catch (err) {
        console.warn("Could not embed logo image in PDF:", err);
      }
    }

    doc.text(companySettings?.name.toUpperCase() || "INVOICEPRO 360", brandTextX, 22);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(companySettings ? `Corporate Identity: ${companySettings.gstin || "Registered Supplier"}` : "A Product of Unikorn360 AI Solutions", brandTextX, 27);
    
    // Invoice Title & Info
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("TAX INVOICE", 140, 22);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, 140, 28);
    doc.text(`Date: ${invoice.date}`, 140, 33);
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 140, 38);
    doc.text(`Category: ${invoice.category || "Sales"}`, 140, 43);
    
    // Separator line
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(14, 48, 196, 48);
    
    // Parties details Grid
    // Billed From (Supplier) - Left
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("FROM (SUPPLIER)", 14, 56);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(invoice.supplierName, 14, 62);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const supplierAddrLines = doc.splitTextToSize(invoice.supplierAddress || "No address specified.", 80);
    doc.text(supplierAddrLines, 14, 67);
    
    const supplierGstinY = 67 + (supplierAddrLines.length * 4.5);
    if (invoice.supplierGstin) {
      doc.setFont("helvetica", "bold");
      doc.text(`GSTIN: ${invoice.supplierGstin}`, 14, supplierGstinY);
    }
    
    // Billed To (Customer) - Right
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text("TO (CUSTOMER)", 110, 56);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(invoice.customerName, 110, 62);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const customerAddrLines = doc.splitTextToSize(invoice.customerAddress || "No address specified.", 80);
    doc.text(customerAddrLines, 110, 67);
    
    const customerGstinY = 67 + (customerAddrLines.length * 4.5);
    if (invoice.customerGstin) {
      doc.setFont("helvetica", "bold");
      doc.text(`GSTIN: ${invoice.customerGstin}`, 110, customerGstinY);
    } else {
      doc.setFont("helvetica", "italic");
      doc.text("Unregistered Consumer", 110, customerGstinY);
    }
    
    const startTableY = Math.max(supplierGstinY, customerGstinY) + 12;
    
    // Items List Table Header
    doc.setDrawColor(15, 23, 42);
    doc.setLineWidth(0.8);
    doc.line(14, startTableY - 4, 196, startTableY - 4);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text("Description", 14, startTableY);
    doc.text("HSN", 95, startTableY, { align: "center" });
    doc.text("Qty", 115, startTableY, { align: "center" });
    doc.text("Rate", 135, startTableY, { align: "right" });
    doc.text("GST %", 160, startTableY, { align: "center" });
    doc.text("Amount", 196, startTableY, { align: "right" });
    
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.5);
    doc.line(14, startTableY + 2, 196, startTableY + 2);
    
    let curY = startTableY + 8;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85); // slate-700
    
    invoice.items.forEach((item) => {
      // Dynamic description cell split
      const descLines = doc.splitTextToSize(item.description, 75);
      doc.text(descLines, 14, curY);
      doc.text(item.hsn || "—", 95, curY, { align: "center" });
      doc.text(String(item.quantity), 115, curY, { align: "center" });
      doc.text(formatRupeesPDF(item.price), 135, curY, { align: "right" });
      doc.text(`${item.taxRate}%`, 160, curY, { align: "center" });
      doc.text(formatRupeesPDF(item.quantity * item.price), 196, curY, { align: "right" });
      
      const descHeight = descLines.length * 4.5;
      curY += Math.max(descHeight, 8);
      
      // Horizontal row divider line
      doc.setDrawColor(241, 245, 249);
      doc.line(14, curY - 3, 196, curY - 3);
    });
    
    curY += 5;
    
    // Page check for totals area
    if (curY > 235) {
      doc.addPage();
      curY = 25;
    }
    
    // Draw Totals section
    const totalsX = 130;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    
    doc.text("Subtotal (Taxable Value):", totalsX, curY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupeesPDF(invoice.subtotal), 196, curY, { align: "right" });
    curY += 5;
    
    if (invoice.cgst > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("CGST (Central Tax):", totalsX, curY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(formatRupeesPDF(invoice.cgst), 196, curY, { align: "right" });
      curY += 5;
    }
    if (invoice.sgst > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("SGST (State Tax):", totalsX, curY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(formatRupeesPDF(invoice.sgst), 196, curY, { align: "right" });
      curY += 5;
    }
    if (invoice.igst > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text("IGST (Integrated Tax):", totalsX, curY);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42);
      doc.text(formatRupeesPDF(invoice.igst), 196, curY, { align: "right" });
      curY += 5;
    }
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Total GST Tax Amount:", totalsX, curY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(formatRupeesPDF(invoice.taxAmount), 196, curY, { align: "right" });
    curY += 2;
    
    doc.setDrawColor(79, 70, 229); // indigo accent
    doc.setLineWidth(0.8);
    doc.line(totalsX, curY, 196, curY);
    curY += 5;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229);
    doc.text("Grand Total Value:", totalsX, curY);
    doc.text(formatRupeesPDF(invoice.totalAmount), 196, curY, { align: "right" });
    
    // Terms & Notes
    let notesY = curY - 20;
    if (notesY < startTableY + 20) {
      notesY = curY + 12;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("TERMS & NOTES", 14, notesY);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    const notesLines = doc.splitTextToSize(invoice.notes || "No special terms specified.", 100);
    doc.text(notesLines, 14, notesY + 4);
    
    // Footer credit
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("This is an electronically generated compliance-ready document. Powered by Unikorn360 AI Solutions.", 105, 285, { align: "center" });
    
    // Save to download triggering browser UI
    doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
  };

  // UPI QR Code Generator
  const generateUpiQr = async () => {
    try {
      // Standard BHIM / UPI Protocol Link
      const upiLink = `upi://pay?pa=payments.invoicepro360@okaxis&pn=${encodeURIComponent(invoice.supplierName)}&am=${invoice.totalAmount}&tn=${encodeURIComponent("Inv-" + invoice.invoiceNumber)}&cu=INR`;
      const url = await QRCode.toDataURL(upiLink, {
        width: 250,
        margin: 1.5,
        color: {
          dark: "#111113",
          light: "#FFFFFF"
        }
      });
      setUpiQrCodeUrl(url);
      setShowUpiModal(true);
    } catch (err) {
      console.error("Failed to generate UPI QR code:", err);
      alert("Could not generate UPI payment QR code at this time.");
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0A0A0B]/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in-up" id="invoice-viewer-modal">
      <div className="bg-[#111113] rounded-2xl border border-white/10 shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden" id="modal-container">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#0A0A0B]/50" id="modal-header">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-xl border border-indigo-500/10">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-white text-base">
                Invoice {invoice.invoiceNumber}
              </h3>
              <p className="text-xs text-slate-400">
                Created on {invoice.date} • Category: {invoice.category}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2" id="modal-actions">
            {/* View Tab Selectors */}
            <div className="bg-[#1c1c1e] p-0.5 border border-white/5 rounded-xl flex">
              <button 
                onClick={() => setActiveTab("preview")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                  activeTab === "preview" 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-white"
                }`}
                id="preview-tab-btn"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Invoice & Audit Report</span>
              </button>
              <button 
                onClick={() => setActiveTab("edit")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-all cursor-pointer ${
                  activeTab === "edit" 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "text-slate-400 hover:text-white"
                }`}
                id="edit-tab-btn"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Fields</span>
              </button>
            </div>

            {onDeleteInvoice && (
              <button
                onClick={() => {
                  onDeleteInvoice(invoice.id);
                  onClose();
                }}
                className="p-1.5 bg-rose-500/10 text-rose-400 hover:text-rose-300 hover:bg-[#201012] rounded-xl border border-rose-500/20 transition-colors cursor-pointer"
                title="Delete Invoice"
                id="delete-modal-btn"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-1.5 bg-white/5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 border border-white/5 transition-colors cursor-pointer"
              id="close-modal-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Workspace */}
        <div className="flex-1 overflow-hidden" id="modal-main-workspace">
          {activeTab === "preview" ? (
            <div className="h-full grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden" id="preview-workspace-split">
              {/* LEFT: Printable Beautiful Corporate Invoice Document */}
              <div className="lg:col-span-7 bg-[#0A0A0B]/55 p-6 overflow-y-auto border-r border-white/5 flex justify-center relative" id="printable-invoice-wrapper">
                {/* Floating Print Action Icon */}
                <button 
                  type="button"
                  onClick={handlePrint}
                  className="absolute top-4 right-4 z-20 bg-indigo-600/90 hover:bg-indigo-600 active:scale-95 text-white p-2.5 rounded-full shadow-lg border border-indigo-400/20 transition-all cursor-pointer flex items-center justify-center print:hidden hover:shadow-indigo-500/35"
                  title="Print Invoice"
                  id="floating-print-button"
                >
                  <Printer className="w-4 h-4" />
                </button>

                <div 
                  className="bg-[#161618] w-full max-w-[21cm] p-8 shadow-2xl border border-white/10 rounded-xl relative overflow-hidden flex flex-col justify-between text-slate-300"
                  id="printable-document"
                >
                  <div>
                    {/* Invoice Banner & Stamp */}
                    <div className="flex justify-between items-start border-b border-white/5 pb-6">
                      <div className="flex items-center space-x-3.5">
                        {renderInvoiceLogo(companySettings)}
                        <div className="space-y-1">
                          <span className="text-[10px] uppercase font-extrabold tracking-widest text-indigo-400 block">
                            {companySettings ? companySettings.name : "InvoicePro 360 Workspace"}
                          </span>
                          <h2 className="text-xl font-bold text-white font-display leading-tight">TAX INVOICE</h2>
                          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 text-slate-400 text-xs">
                            <p>Invoice Number: <span className="font-mono font-bold text-slate-200">{invoice.invoiceNumber}</span></p>
                            <p className="hidden sm:inline-block text-slate-600">•</p>
                            <p>Date: <span className="font-bold text-slate-200">{invoice.date}</span></p>
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <span className={`inline-block border-2 ${
                          invoice.status === 'paid' 
                            ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" 
                            : invoice.status === 'unpaid'
                            ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                            : "border-rose-500/50 text-rose-400 bg-rose-500/10"
                        } px-3 py-1 rounded-lg text-xs uppercase font-extrabold tracking-wider rotate-6`}>
                          {invoice.status}
                        </span>
                        <div className="pt-2">
                          <span className="text-[10px] bg-white/5 text-slate-400 px-2 py-0.5 rounded-full font-bold border border-white/5">
                            {invoice.category || "Sales"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Parties Grid (Addresses) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-white/5 text-xs">
                      {/* Supplier */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Billed From (Supplier)</p>
                        <p className="font-bold text-white text-sm">{invoice.supplierName}</p>
                        <p className="text-slate-400 leading-relaxed">{invoice.supplierAddress || "No address specified."}</p>
                        {invoice.supplierGstin && (
                          <p className="font-mono pt-1 text-slate-300">
                            <b>GSTIN:</b> {invoice.supplierGstin}
                          </p>
                        )}
                      </div>

                      {/* Customer */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Billed To (Customer)</p>
                        <p className="font-bold text-white text-sm">{invoice.customerName}</p>
                        <p className="text-slate-400 leading-relaxed">{invoice.customerAddress || "No address specified."}</p>
                        {invoice.customerGstin ? (
                          <p className="font-mono pt-1 text-slate-300">
                            <b>GSTIN:</b> {invoice.customerGstin}
                          </p>
                        ) : (
                          <p className="text-amber-400 pt-1 font-semibold text-[10px] italic">Unregistered/Consumer Customer</p>
                        )}
                      </div>
                    </div>

                    {/* Items List Table */}
                    <div className="py-6">
                      <table className="w-full text-left text-xs border-collapse" id="preview-items-table">
                        <thead>
                          <tr className="border-b border-white/5 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-2">Description</th>
                            <th className="py-2 text-center">HSN</th>
                            <th className="py-2 text-center">Qty</th>
                            <th className="py-2 text-right">Price</th>
                            <th className="py-2 text-center">GST Rate</th>
                            <th className="py-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {invoice.items.map((item, idx) => (
                            <tr key={item.id || idx} className="py-2">
                              <td className="py-3 font-medium text-white max-w-[200px]">{item.description}</td>
                              <td className="py-3 text-center font-mono text-slate-400">{item.hsn || "—"}</td>
                              <td className="py-3 text-center font-mono text-slate-300">{item.quantity}</td>
                              <td className="py-3 text-right font-mono text-slate-300">{formatRupees(item.price)}</td>
                              <td className="py-3 text-center font-mono text-slate-400">{item.taxRate}%</td>
                              <td className="py-3 text-right font-mono font-semibold text-white">{formatRupees(item.quantity * item.price)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Calculations and Totals */}
                  <div className="border-t border-white/5 pt-4 mt-auto">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      {/* Left Side: Notes & Extra Info */}
                      <div className="space-y-1.5 text-slate-500">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Terms & Notes</p>
                        <p className="italic leading-relaxed whitespace-pre-wrap text-slate-400">{invoice.notes || "No special terms specified."}</p>
                      </div>

                      {/* Right Side: Totals Card */}
                      <div className="bg-white/5 p-4 rounded-xl space-y-2 border border-white/5 text-slate-400 font-medium">
                        <div className="flex justify-between">
                          <span>Subtotal (Taxable Value):</span>
                          <span className="font-mono font-semibold text-white">{formatRupees(invoice.subtotal)}</span>
                        </div>

                        {invoice.cgst > 0 && (
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Central Tax (CGST 9%):</span>
                            <span className="font-mono">{formatRupees(invoice.cgst)}</span>
                          </div>
                        )}
                        {invoice.sgst > 0 && (
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>State Tax (SGST 9%):</span>
                            <span className="font-mono">{formatRupees(invoice.sgst)}</span>
                          </div>
                        )}
                        {invoice.igst > 0 && (
                          <div className="flex justify-between text-[11px] text-slate-500">
                            <span>Integrated Tax (IGST 18%):</span>
                            <span className="font-mono">{formatRupees(invoice.igst)}</span>
                          </div>
                        )}

                        <div className="flex justify-between border-t border-white/5 pt-2 text-slate-400">
                          <span>Total Tax amount:</span>
                          <span className="font-mono">{formatRupees(invoice.taxAmount)}</span>
                        </div>

                        <div className="flex justify-between border-t border-white/5 pt-2 text-white font-bold text-sm">
                          <span>Grand Total Value:</span>
                          <span className="font-mono text-base text-indigo-400">{formatRupees(invoice.totalAmount)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Invoice Footer */}
                    <div className="text-center text-[10px] text-slate-500 border-t border-white/5 pt-4 mt-6">
                      This is an electronically generated document. Powered by Unikorn360 AI Solutions.
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT: AI Auditor Verification Report */}
              <div className="lg:col-span-5 bg-[#0A0A0B]/40 p-6 overflow-y-auto flex flex-col justify-between border-l border-white/5" id="ai-auditor-report-panel">
                <div className="space-y-6">
                  {/* Title and Audit Status */}
                  <div className="space-y-1">
                    <h4 className="font-display font-bold text-white text-base flex items-center space-x-1.5">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      <span>AI Smart Auditor Report</span>
                    </h4>
                    <p className="text-xs text-slate-400">
                      Real-time assessment of invoice format validity, tax classifications, and calculation accuracy.
                    </p>
                  </div>

                  {/* Audit Card Score */}
                  <div className={`p-4 rounded-xl border flex items-center justify-between ${
                    auditReport.passed 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                  }`} id="audit-score-card">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wider opacity-80">Audit Clearance</p>
                      <h4 className="text-lg font-bold font-display">
                        {auditReport.passed ? "✔ Invoice Cleared" : "✘ Compliance Issues Found"}
                      </h4>
                      <p className="text-[11px] opacity-75">
                        {auditReport.passed 
                          ? "All compliance audits successfully passed. Safe to export." 
                          : `${auditReport.errors.length} serious error(s) and ${auditReport.warnings.length} warning(s) require review.`}
                      </p>
                    </div>
                    <div className="shrink-0 pl-3">
                      {auditReport.passed ? (
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="w-10 h-10 text-rose-400" />
                      )}
                    </div>
                  </div>

                  {/* Individual Checks Feed */}
                  <div className="space-y-3" id="audit-checks-feed">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Core Compliance Checks</p>
                    
                    {/* GSTIN FORMAT CHECK */}
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-start space-x-3 text-xs text-slate-300">
                      {auditReport.checks.gstin.passed ? (
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <p className="font-bold text-white">GSTIN Format Auditing</p>
                        <p className="text-slate-400 text-[11px] leading-relaxed">{auditReport.checks.gstin.message}</p>
                        {auditReport.checks.gstin.details && (
                          <p className="text-[10px] text-slate-500 italic pt-1">{auditReport.checks.gstin.details}</p>
                        )}
                      </div>
                    </div>

                    {/* MATHEMATICS DISCREPANCY */}
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-start space-x-3 text-xs text-slate-300">
                      {auditReport.checks.math.passed ? (
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-white">Mathematical Audit</p>
                          {!auditReport.checks.math.passed && (
                            <button 
                              type="button"
                              onClick={handleAutoFixMath}
                              className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[9px] font-bold flex items-center space-x-0.5 cursor-pointer"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                              <span>Auto-Fix</span>
                            </button>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">{auditReport.checks.math.message}</p>
                        {auditReport.checks.math.details && (
                          <p className="text-[10px] text-rose-400 font-mono bg-rose-500/10 border border-rose-500/10 p-1.5 rounded mt-1.5 leading-relaxed">{auditReport.checks.math.details}</p>
                        )}
                      </div>
                    </div>

                    {/* STATE TAX CLASSIFICATION */}
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-start space-x-3 text-xs text-slate-300">
                      {auditReport.checks.stateTax.passed ? (
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-white">State Code Tax Classification</p>
                          {!auditReport.checks.stateTax.passed && (
                            <button 
                              type="button"
                              onClick={handleAutoFixStateTax}
                              className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded text-[9px] font-bold flex items-center space-x-0.5 cursor-pointer"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                              <span>Auto-Fix</span>
                            </button>
                          )}
                        </div>
                        <p className="text-slate-400 text-[11px] leading-relaxed">{auditReport.checks.stateTax.message}</p>
                        {auditReport.checks.stateTax.details && (
                          <p className="text-[10px] text-rose-400 font-mono bg-rose-500/10 border border-rose-500/10 p-1.5 rounded mt-1.5 leading-relaxed">{auditReport.checks.stateTax.details}</p>
                        )}
                      </div>
                    </div>

                    {/* DUPLICATE DETECTOR */}
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 flex items-start space-x-3 text-xs text-slate-300">
                      {auditReport.checks.duplicates.passed ? (
                        <CheckCircle className="w-4.5 h-4.5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <p className="font-bold text-white">Ledger Duplicate Scanner</p>
                        <p className="text-slate-400 text-[11px] leading-relaxed">{auditReport.checks.duplicates.message}</p>
                        {auditReport.checks.duplicates.details && (
                          <p className="text-[10px] text-slate-500 italic pt-1">{auditReport.checks.duplicates.details}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Invoice Actions, Exports & Payments */}
                <div className="border-t border-white/5 pt-4 mt-6 space-y-3" id="actions-and-exports">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Exports & Payment Actions</p>
                    {onRecordPayment && (
                      <button
                        type="button"
                        onClick={() => onRecordPayment(invoice)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                        id="action-record-payment"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Record Payment</span>
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={handleDownloadPDF}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 font-semibold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      id="action-download-pdf"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Download PDF</span>
                    </button>

                    <button 
                      type="button"
                      onClick={handleShareEmail}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 font-semibold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      id="action-share-email"
                    >
                      <Mail className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Share via Email</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={handlePrint}
                      className="bg-white/5 hover:bg-white/10 text-white border border-white/10 hover:border-white/20 font-semibold py-2.5 px-3 rounded-xl text-xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                      id="action-print-invoice"
                    >
                      <Printer className="w-3.5 h-3.5 text-amber-400" />
                      <span>Print Invoice</span>
                    </button>

                    <button 
                      type="button"
                      onClick={generateUpiQr}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-indigo-600/20 hover:scale-[1.01] active:scale-[0.99]"
                      id="action-pay-now"
                    >
                      <QrCode className="w-3.5 h-3.5 text-white" />
                      <span>Pay Now (UPI)</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: MANUAL EDIT FIELDS FORM */
            <form onSubmit={handleSaveChanges} className="h-full overflow-y-auto p-6 space-y-6" id="invoice-edit-form">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" id="edit-metadata-grid">
                {/* Invoice Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Invoice Number</label>
                  <input 
                    type="text" 
                    value={invoiceNumber} 
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] focus:text-white transition-all"
                  />
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Invoice Date</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] focus:text-white transition-all"
                  />
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">Payment Status</label>
                  <select 
                    value={status} 
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B]"
                  >
                    <option value="draft" className="bg-[#111113]">Draft</option>
                    <option value="paid" className="bg-[#111113]">Paid</option>
                    <option value="unpaid" className="bg-[#111113]">Unpaid</option>
                    <option value="overdue" className="bg-[#111113]">Overdue</option>
                  </select>
                </div>
              </div>

              {/* Parties Block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-white/5 pt-5" id="edit-parties-grid">
                {/* Supplier Detail Edit */}
                <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Supplier Information</h4>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Supplier Name</label>
                      <input 
                        type="text" 
                        value={supplierName} 
                        onChange={(e) => setSupplierName(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 bg-[#111113]/70 border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Supplier GSTIN (15 Alphanumeric)</label>
                      <input 
                        type="text" 
                        value={supplierGstin} 
                        onChange={(e) => setSupplierGstin(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#111113]/70 border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Supplier Address</label>
                      <textarea 
                        rows={2}
                        value={supplierAddress} 
                        onChange={(e) => setSupplierAddress(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#111113]/70 border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B]"
                      />
                    </div>
                  </div>
                </div>

                {/* Customer Detail Edit */}
                <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                  <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider">Customer Information</h4>
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Customer Name</label>
                      <input 
                        type="text" 
                        value={customerName} 
                        onChange={(e) => setCustomerName(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 bg-[#111113]/70 border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Customer GSTIN (15 Alphanumeric)</label>
                      <input 
                        type="text" 
                        value={customerGstin} 
                        onChange={(e) => setCustomerGstin(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#111113]/70 border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500">Customer Address</label>
                      <textarea 
                        rows={2}
                        value={customerAddress} 
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        className="w-full px-3 py-1.5 bg-[#111113]/70 border border-white/5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Items Edit */}
              <div className="border-t border-white/5 pt-5 space-y-3" id="edit-items-section">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-400 uppercase">Invoice Line Items</h4>
                  <button 
                    type="button" 
                    onClick={handleAddItem}
                    className="bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 px-3 py-1 rounded-lg text-xs font-bold flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Line Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-2" id="edit-items-list">
                  {items.map((item, idx) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 bg-[#0A0A0B]/30 p-2.5 rounded-xl items-center border border-white/5 text-xs">
                      <div className="col-span-4 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Item Description</label>
                        <input 
                          type="text" 
                          value={item.description} 
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          required
                          className="w-full px-2 py-1 bg-white/5 border border-white/5 rounded text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">HSN Code</label>
                        <input 
                          type="text" 
                          value={item.hsn || ""} 
                          onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                          className="w-full px-2 py-1 bg-white/5 border border-white/5 rounded font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="col-span-1 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Qty</label>
                        <input 
                          type="number" 
                          value={item.quantity} 
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          required
                          className="w-full px-2 py-1 bg-white/5 border border-white/5 rounded font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Price</label>
                        <input 
                          type="number" 
                          value={item.price} 
                          onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                          required
                          className="w-full px-2 py-1 bg-white/5 border border-white/5 rounded font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="col-span-1.5 space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">GST %</label>
                        <select 
                          value={item.taxRate} 
                          onChange={(e) => handleItemChange(idx, "taxRate", Number(e.target.value))}
                          className="w-full px-2 py-1 bg-[#0a0a0b] border border-white/5 rounded font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value={0}>0%</option>
                          <option value={5}>5%</option>
                          <option value={12}>12%</option>
                          <option value={18}>18%</option>
                          <option value={28}>28%</option>
                        </select>
                      </div>

                      <div className="col-span-1 text-center self-end pb-1.5">
                        <button 
                          type="button" 
                          onClick={() => handleRemoveItem(idx)}
                          className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extra notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Extra Notes & Payment Terms</label>
                <textarea 
                  rows={2} 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B]"
                />
              </div>

              {/* Form Actions Footer */}
              <div className="border-t border-white/5 pt-4 flex items-center justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setActiveTab("preview")}
                  className="bg-white/5 hover:bg-white/10 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition-colors border border-white/5 cursor-pointer"
                >
                  Discard Changes
                </button>
                <button 
                  type="submit" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm cursor-pointer"
                >
                  Save Invoice Changes
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* UPI QR Modal Overlay */}
      {showUpiModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in" id="upi-qr-modal">
          <div className="bg-[#111113] border border-white/10 p-6 rounded-2xl max-w-sm w-full text-center space-y-6 relative shadow-2xl animate-scale-up">
            <button 
              type="button"
              onClick={() => setShowUpiModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
              id="close-upi-modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1.5">
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/20 inline-block uppercase tracking-wider">
                Secure UPI Gateway
              </span>
              <h3 className="font-display font-bold text-white text-lg">UPI Dynamic Payment QR</h3>
              <p className="text-xs text-slate-400 font-medium">Scan using any UPI App (GPay, PhonePe, Paytm, BHIM)</p>
            </div>

            {upiQrCodeUrl ? (
              <div className="bg-white p-3 rounded-xl inline-block border-4 border-indigo-500/30 shadow-inner">
                <img 
                  src={upiQrCodeUrl} 
                  alt="UPI QR Code" 
                  className="w-44 h-44 mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <div className="w-44 h-44 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center mx-auto animate-pulse">
                <p className="text-xs text-slate-500 font-mono">Generating secure QR...</p>
              </div>
            )}

            <div className="bg-[#18181b] p-4 rounded-xl border border-white/5 text-left text-xs space-y-2.5">
              <div className="flex justify-between items-center text-slate-400">
                <span>Payee Name:</span>
                <span className="font-bold text-white text-right max-w-[180px] truncate">{invoice.supplierName}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>VPA Address:</span>
                <span className="font-mono text-[11px] text-slate-300 font-bold">payments.invoicepro360@okaxis</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Invoice No:</span>
                <span className="font-mono text-slate-300 font-bold">{invoice.invoiceNumber}</span>
              </div>
              <div className="border-t border-white/5 pt-2.5 flex justify-between items-center font-bold text-sm">
                <span className="text-slate-400">Amount Payable:</span>
                <span className="text-indigo-400 text-base font-mono">{formatRupees(invoice.totalAmount)}</span>
              </div>
            </div>

            <p className="text-[10px] text-slate-500 leading-relaxed">
              This QR contains encoded UPI payment instructions linking directly to your verified ledger ID. Keep secure.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
