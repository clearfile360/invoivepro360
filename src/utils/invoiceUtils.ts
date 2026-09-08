import { Invoice, InvoiceItem, InvoiceValidation } from "../types";

// Generate a random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Format currency in Indian Rupees
export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
}

// Calculate total taxes and sums for an invoice
export function calculateInvoiceTotals(items: Omit<InvoiceItem, 'id' | 'total'>[], supplierGstin?: string, customerGstin?: string): {
  items: InvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  totalAmount: number;
} {
  let subtotal = 0;
  let totalTax = 0;

  const processedItems = items.map(item => {
    const itemTotal = item.quantity * item.price;
    subtotal += itemTotal;
    const itemTax = itemTotal * (item.taxRate / 100);
    totalTax += itemTax;

    return {
      ...item,
      id: (item as any).id || generateId(),
      total: itemTotal
    };
  });

  // Determine state tax rules based on GSTIN (first 2 digits represent state code)
  let isInterstate = false;
  if (supplierGstin && customerGstin && supplierGstin.length >= 2 && customerGstin.length >= 2) {
    const supplierState = supplierGstin.substring(0, 2);
    const customerState = customerGstin.substring(0, 2);
    isInterstate = supplierState !== customerState;
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (isInterstate) {
    igst = totalTax;
  } else {
    cgst = totalTax / 2;
    sgst = totalTax / 2;
  }

  return {
    items: processedItems,
    subtotal,
    cgst,
    sgst,
    igst,
    taxAmount: totalTax,
    totalAmount: subtotal + totalTax
  };
}

// Check if a string is a valid Indian GSTIN (15-character alphanumeric format)
export function isValidGstin(gstin?: string): boolean {
  if (!gstin) return false;
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstinRegex.test(gstin.trim().toUpperCase());
}

// Run deterministic and AI audit validation on an invoice
export function validateInvoice(invoice: Invoice, allInvoices: Invoice[]): InvoiceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  const checks: InvoiceValidation["checks"] = {
    gstin: { passed: true, message: "Valid GSTIN format" },
    math: { passed: true, message: "Calculations are accurate" },
    taxPercent: { passed: true, message: "Standard GST rates are applied" },
    duplicates: { passed: true, message: "No duplicates found" },
    missingFields: { passed: true, message: "All required fields are present" },
    stateTax: { passed: true, message: "Correct tax classification (CGST/SGST vs IGST)" }
  };

  // 1. Missing Fields Check
  const missing: string[] = [];
  if (!invoice.invoiceNumber) missing.push("Invoice Number");
  if (!invoice.supplierName) missing.push("Supplier Name");
  if (!invoice.customerName) missing.push("Customer Name");
  if (!invoice.date) missing.push("Invoice Date");
  if (!invoice.items || invoice.items.length === 0) missing.push("Line Items");

  if (missing.length > 0) {
    checks.missingFields = {
      passed: false,
      message: `Missing fields: ${missing.join(", ")}`
    };
    errors.push(`Required information missing: ${missing.join(", ")}`);
  }

  // 2. GSTIN Format Check
  const isSupplierGstValid = !invoice.supplierGstin || isValidGstin(invoice.supplierGstin);
  const isCustomerGstValid = !invoice.customerGstin || isValidGstin(invoice.customerGstin);

  if (!isSupplierGstValid || !isCustomerGstValid) {
    const badFields = [];
    if (!isSupplierGstValid) badFields.push("Supplier GSTIN");
    if (!isCustomerGstValid) badFields.push("Customer GSTIN");

    checks.gstin = {
      passed: false,
      message: `Invalid format for ${badFields.join(", ")}`,
      details: "GSTIN must be a 15-character alphanumeric string matching Indian GST format (e.g., 27AAPCS1030F1Z4)."
    };
    warnings.push(`Formatting error: ${badFields.join(", ")} does not match standard 15-character GSTIN pattern.`);
  }

  // 3. Math Accuracy Check
  let calculatedSubtotal = 0;
  let calculatedTaxAmount = 0;

  invoice.items.forEach(item => {
    calculatedSubtotal += item.quantity * item.price;
    calculatedTaxAmount += (item.quantity * item.price) * (item.taxRate / 100);
  });

  const calculatedTotal = calculatedSubtotal + calculatedTaxAmount;
  const mathMargin = 1.0; // Allow slight rounding discrepancies under 1 rupee

  const isSubtotalOff = Math.abs(invoice.subtotal - calculatedSubtotal) > mathMargin;
  const isTaxOff = Math.abs(invoice.taxAmount - calculatedTaxAmount) > mathMargin;
  const isTotalOff = Math.abs(invoice.totalAmount - calculatedTotal) > mathMargin;

  if (isSubtotalOff || isTaxOff || isTotalOff) {
    checks.math = {
      passed: false,
      message: "Mathematical discrepancy in totals",
      details: `Expected subtotal: ${formatRupees(calculatedSubtotal)}, expected tax: ${formatRupees(calculatedTaxAmount)}, expected total: ${formatRupees(calculatedTotal)}.`
    };
    errors.push(`Math Error: Stated invoice total (${formatRupees(invoice.totalAmount)}) does not match recalculated sum (${formatRupees(calculatedTotal)}).`);
  }

  // 4. Tax Percent Validation
  const standardRates = [0, 5, 12, 18, 28];
  const hasCustomRates = invoice.items.some(item => !standardRates.includes(item.taxRate));

  if (hasCustomRates) {
    checks.taxPercent = {
      passed: false,
      message: "Non-standard GST rate detected",
      details: "In India, typical GST brackets are 0%, 5%, 12%, 18%, or 28%. Custom rates should be verified."
    };
    warnings.push("Tax warning: Non-standard tax rate found. Please verify if this falls under specialized brackets.");
  }

  // 5. State Tax Classification Check
  if (invoice.supplierGstin && invoice.customerGstin && isSupplierGstValid && isCustomerGstValid) {
    const supplierState = invoice.supplierGstin.trim().substring(0, 2);
    const customerState = invoice.customerGstin.trim().substring(0, 2);
    const isInterstate = supplierState !== customerState;

    if (isInterstate && (invoice.cgst > 0 || invoice.sgst > 0)) {
      checks.stateTax = {
        passed: false,
        message: "Wrong tax type charged for inter-state transaction",
        details: `Inter-state (State ${supplierState} to State ${customerState}) should incur IGST instead of CGST/SGST.`
      };
      errors.push(`Tax Classification Audit: Inter-state invoice uses CGST/SGST. Must be revised to IGST.`);
    } else if (!isInterstate && invoice.igst > 0) {
      checks.stateTax = {
        passed: false,
        message: "Wrong tax type charged for intra-state transaction",
        details: `Intra-state (Same state ${supplierState}) should incur CGST/SGST instead of IGST.`
      };
      errors.push(`Tax Classification Audit: Intra-state invoice uses IGST. Must be revised to equal CGST and SGST.`);
    }
  }

  // 6. Duplicate Detection
  const duplicate = allInvoices.find(inv => 
    inv.id !== invoice.id &&
    inv.invoiceNumber.trim().toLowerCase() === invoice.invoiceNumber.trim().toLowerCase() &&
    inv.supplierName.trim().toLowerCase() === invoice.supplierName.trim().toLowerCase()
  );

  if (duplicate) {
    checks.duplicates = {
      passed: false,
      message: "Duplicate invoice detected",
      details: `Invoice number ${invoice.invoiceNumber} from ${invoice.supplierName} already exists in the system.`
    };
    warnings.push(`Duplicate Alert: Invoice ${invoice.invoiceNumber} from ${invoice.supplierName} has been recorded previously.`);
  }

  const passed = errors.length === 0;

  return {
    passed,
    checks,
    warnings,
    errors
  };
}

// Convert invoice list to Standard CSV format
export function convertToStandardCSV(invoices: Invoice[]): string {
  const headers = [
    "Invoice Number",
    "Date",
    "Supplier Name",
    "Supplier GSTIN",
    "Customer Name",
    "Customer GSTIN",
    "Category",
    "Subtotal",
    "CGST",
    "SGST",
    "IGST",
    "Tax Amount",
    "Total Amount",
    "Status"
  ];

  const rows = invoices.map(inv => [
    `"${inv.invoiceNumber}"`,
    inv.date,
    `"${inv.supplierName}"`,
    `"${inv.supplierGstin || ''}"`,
    `"${inv.customerName}"`,
    `"${inv.customerGstin || ''}"`,
    inv.category || "Sales",
    inv.subtotal,
    inv.cgst,
    inv.sgst,
    inv.igst,
    inv.taxAmount,
    inv.totalAmount,
    inv.status
  ]);

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

// Convert invoice list to GST Ready format (GSTR-1 B2B-style layout)
export function convertToGstReadyCSV(invoices: Invoice[]): string {
  const headers = [
    "Receiver GSTIN/UIN",
    "Receiver Name",
    "Invoice Number",
    "Invoice Date",
    "Invoice Value (Total)",
    "Place Of Supply (State Code)",
    "Reverse Charge (Y/N)",
    "Applicable % of Tax Rate",
    "Invoice Type",
    "E-Commerce GSTIN",
    "Taxable Value (Subtotal)",
    "Integrated Tax (IGST)",
    "Central Tax (CGST)",
    "State/UT Tax (SGST)"
  ];

  const rows: any[] = [];

  invoices.forEach(inv => {
    const placeOfSupply = inv.customerGstin ? inv.customerGstin.substring(0, 2) : "";
    const isReverse = "N";
    const invoiceType = "Regular";

    // Split items by tax rates if multi-rate to match GSTR-1 format properly,
    // or group them. For simplicity in a single-row CSV export:
    rows.push([
      `"${inv.customerGstin || 'URP'}"`, // URP = Unregistered Person
      `"${inv.customerName}"`,
      `"${inv.invoiceNumber}"`,
      inv.date,
      inv.totalAmount,
      `"${placeOfSupply}"`,
      `"${isReverse}"`,
      "", // Multi-rate summary
      `"${invoiceType}"`,
      "",
      inv.subtotal,
      inv.igst,
      inv.cgst,
      inv.sgst
    ]);
  });

  return [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
}

// Download a text file in the browser
export function triggerFileDownload(filename: string, content: string, mimeType = "text/csv") {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Calculate payment totals and derive payment status
export function calculatePaymentTotals(invoice: Invoice): Invoice {
  const payments = invoice.payments || [];
  const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(0, invoice.totalAmount - amountPaid);

  let status = invoice.status;
  let paymentStatus: 'paid' | 'partially_paid' | 'due' | 'overdue' = 'due';

  if (balanceDue <= 0.5) {
    status = 'paid';
    paymentStatus = 'paid';
  } else if (amountPaid > 0) {
    status = 'partially_paid';
    paymentStatus = 'partially_paid';
  } else if (invoice.status === 'overdue') {
    paymentStatus = 'overdue';
  } else {
    status = 'unpaid';
    paymentStatus = 'due';
  }

  return {
    ...invoice,
    status,
    paymentStatus,
    amountPaid,
    balanceDue,
    payments
  };
}

// Helper to prefill and suggest natural language creation templates
export const sampleCreationTemplates = [
  {
    title: "Steel Supplies (ABC)",
    prompt: "Create an invoice for ABC Traders. Supplier GSTIN: 27AAPCS1030F1Z4. Customer: Tata Projects Ltd, GSTIN: 27AAACT2901G1Z2. Items: 15 Steel Rods at ₹600 each with 18% GST, and 10 Galvanized beams at ₹2200 each with 18% GST. Invoice Date is 2026-07-18."
  },
  {
    title: "Software Consultation",
    prompt: "Generate consulting invoice for Techflow LLP to Client: Reliance Industries, GSTIN 27AAACR1283D1Z9. 25 hours of Senior Dev Consulting at ₹4500 per hour, tax rate 18% GST. Date is today."
  },
  {
    title: "Office Electronics Purchase",
    prompt: "Generate an expense invoice DL-2026-991 from Delhi Retailers CP to John Doe Enterprises. 2 Projectors at ₹35,000 each with 28% GST. HSN is 8471. Add a note requesting payment within 15 days."
  }
];

// Simulated base64 sample images (high contrast SVG mock placeholders representing actual scan documents)
// These allow testing OCR extraction instantaneously with extremely high-fidelity outputs
export const sampleOcrInvoices = [
  {
    name: "Apex_Office_Supplies_Scan.png",
    supplier: "Apex Office Supplies Ltd (GSTIN: 07AAACA4401G1Z3)",
    customer: "Vardhaman & Sons",
    amount: "₹18,500",
    // We pass structured placeholder content along with the image so the OCR handler can mock parse or real parse
    prompt: "Apex Office Supplies Ltd. GSTIN: 07AAACA4401G1Z3. Customer: Vardhaman & Sons. Invoice #: AO-88421. Date: 2026-07-14. Items: 10 ergonomic desk chairs at ₹1500 each with 18% GST, and 5 metal paper bins at ₹700 each with 12% GST."
  },
  {
    name: "Pharma_Wholesale_Bill.jpg",
    supplier: "Metropolis Biotech (GSTIN: 27AAPCM2201F1Z2)",
    customer: "LifeCare Pharma Dist",
    amount: "₹1,12,000",
    prompt: "Metropolis Biotech. GSTIN: 27AAPCM2201F1Z2. Customer: LifeCare Pharma Dist, GSTIN: 27AABCL0912D1Z4. Invoice #: MB-9901. Date: 2026-07-12. Items: 100 Vaccine boxes at ₹1000 each with 12% GST (HSN 3004)."
  }
];
