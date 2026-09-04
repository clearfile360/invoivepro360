export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  price: number;
  taxRate: number; // e.g. 18 for 18% GST
  hsn?: string;
  total: number;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  paymentDate: string;
  paymentMethod: 'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Credit Card' | 'Other';
  referenceNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface Invoice {
  id: string;
  userId?: string;
  invoiceNumber: string;
  supplierName: string;
  supplierGstin?: string;
  supplierAddress?: string;
  customerName: string;
  customerGstin?: string;
  customerAddress?: string;
  date: string;
  dueDate?: string;
  items: InvoiceItem[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  totalAmount: number;
  status: 'draft' | 'paid' | 'unpaid' | 'overdue' | 'partially_paid';
  paymentStatus?: 'paid' | 'partially_paid' | 'due' | 'overdue';
  amountPaid?: number;
  balanceDue?: number;
  payments?: PaymentRecord[];
  category?: 'Sales' | 'Purchase' | 'Expense' | 'Credit Note' | 'Debit Note' | 'Advance' | 'Export' | 'Import';
  notes?: string;
  ocrSource?: string; // filename or scan tag if parsed via OCR
  createdAt: string;
}

export interface ValidationCheckDetail {
  passed: boolean;
  message: string;
  details?: string;
}

export interface InvoiceValidation {
  passed: boolean;
  checks: {
    gstin: ValidationCheckDetail;
    math: ValidationCheckDetail;
    taxPercent: ValidationCheckDetail;
    duplicates: ValidationCheckDetail;
    missingFields: ValidationCheckDetail;
    stateTax: ValidationCheckDetail;
  };
  warnings: string[];
  errors: string[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  createdAt: string;
  // If the message returned or updated invoices or shows specific invoices
  suggestedAction?: {
    type: 'highlight_invoice' | 'create_invoice' | 'filter';
    invoiceId?: string;
    filterQuery?: string;
  };
}

export interface CompanySettings {
  name: string;
  address: string;
  gstin: string;
  logoType: 'icon' | 'url' | 'initials';
  logoIcon: string;
  logoColor: string;
  logoUrl: string;
  logoInitials: string;
}

