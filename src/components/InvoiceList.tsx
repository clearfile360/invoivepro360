import React, { useState } from "react";
import { Invoice } from "../types";
import { formatRupees, validateInvoice, convertToStandardCSV, convertToGstReadyCSV, triggerFileDownload } from "../utils/invoiceUtils";
import { 
  Search, 
  Filter, 
  FileSpreadsheet, 
  Trash2, 
  Eye, 
  AlertCircle, 
  CheckCircle, 
  PlusCircle,
  FileDown,
  Calendar,
  Layers,
  CreditCard
} from "lucide-react";

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDeleteInvoice: (id: string) => void;
  onOpenCreateModal: () => void;
  searchFilter: string;
  onRecordPayment?: (invoice: Invoice) => void;
}

export default function InvoiceList({ 
  invoices, 
  onSelectInvoice, 
  onDeleteInvoice, 
  onOpenCreateModal,
  searchFilter,
  onRecordPayment
}: InvoiceListProps) {
  const [searchTerm, setSearchTerm] = useState(searchFilter);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [exportDropdownOpen, setExportDropdownOpen] = useState(false);

  // Sync internal search with parent filter if modified
  React.useEffect(() => {
    if (searchFilter !== searchTerm) {
      setSearchTerm(searchFilter);
    }
  }, [searchFilter]);

  // Apply filters
  const filteredInvoices = invoices.filter(inv => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchLower) ||
      inv.supplierName.toLowerCase().includes(searchLower) ||
      inv.customerName.toLowerCase().includes(searchLower) ||
      (inv.supplierGstin && inv.supplierGstin.toLowerCase().includes(searchLower)) ||
      (inv.customerGstin && inv.customerGstin.toLowerCase().includes(searchLower)) ||
      (inv.category && inv.category.toLowerCase().includes(searchLower));

    const matchesStatus = statusFilter === "all" || inv.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || inv.category === categoryFilter;

    return matchesSearch && matchesStatus && matchesCategory;
  });

  // Handle Export actions
  const handleExportStandard = () => {
    const csvContent = convertToStandardCSV(filteredInvoices);
    const dateStr = new Date().toISOString().substring(0, 10);
    triggerFileDownload(`InvoicePro_Standard_Export_${dateStr}.csv`, csvContent);
    setExportDropdownOpen(false);
  };

  const handleExportGst = () => {
    const csvContent = convertToGstReadyCSV(filteredInvoices);
    const dateStr = new Date().toISOString().substring(0, 10);
    triggerFileDownload(`InvoicePro_GSTR1_Ready_${dateStr}.csv`, csvContent);
    setExportDropdownOpen(false);
  };

  return (
    <div className="bg-[#111113] rounded-2xl border border-white/5 animate-fade-in-up" id="invoice-list-card">
      {/* Header and Controls */}
      <div className="p-5 border-b border-white/5 space-y-4" id="invoice-list-header">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-display font-bold text-white text-lg">Invoices Ledger</h3>
            <p className="text-xs text-slate-400">Manage, review, validate, and download active business records</p>
          </div>

          <div className="flex items-center space-x-2 self-start sm:self-auto relative">
            {/* Export Dropdown */}
            <button 
              onClick={() => setExportDropdownOpen(!exportDropdownOpen)}
              className="bg-white/5 text-slate-300 hover:bg-white/10 px-3 py-2 rounded-xl text-sm font-medium border border-white/5 transition-all flex items-center space-x-1.5"
              id="export-dropdown-button"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Ledger</span>
            </button>

            {exportDropdownOpen && (
              <div className="absolute right-0 top-11 bg-[#1e1e21] border border-white/10 rounded-xl shadow-lg p-2 z-30 w-52 space-y-1 animate-fade-in-up" id="export-options-dropdown">
                <button 
                  onClick={handleExportStandard}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg flex items-center space-x-2"
                >
                  <FileDown className="w-3.5 h-3.5 text-slate-500" />
                  <div>
                    <p className="font-semibold text-white">Standard CSV Ledger</p>
                    <p className="text-[10px] text-slate-500">All fields, readable table</p>
                  </div>
                </button>
                <button 
                  onClick={handleExportGst}
                  className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-white/5 rounded-lg flex items-center space-x-2"
                >
                  <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                  <div>
                    <p className="font-semibold text-emerald-400">GST GSTR-1 Compatible</p>
                    <p className="text-[10px] text-slate-500">Ready for GSTR-1 utility filing</p>
                  </div>
                </button>
              </div>
            )}

            <button 
              onClick={onOpenCreateModal}
              className="bg-indigo-600 text-white hover:bg-indigo-700 px-3.5 py-2 rounded-xl text-sm font-medium transition-all flex items-center space-x-1.5 shadow-sm"
              id="create-invoice-button"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Invoice</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3" id="invoice-filters-row">
          {/* Search Box */}
          <div className="relative md:col-span-2">
            <Search className="absolute left-3.5 top-2.5 w-4.5 h-4.5 text-slate-500" />
            <input 
              type="text"
              placeholder="Search by Invoice #, Supplier, Customer, GSTIN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] transition-all"
              id="invoice-search-input"
            />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] appearance-none"
              id="status-filter-select"
            >
              <option value="all" className="bg-[#111113]">All Payment Statuses</option>
              <option value="paid" className="bg-[#111113]">Paid Only</option>
              <option value="unpaid" className="bg-[#111113]">Unpaid Only</option>
              <option value="overdue" className="bg-[#111113]">Overdue Only</option>
              <option value="draft" className="bg-[#111113]">Drafts</option>
            </select>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Layers className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/5 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] appearance-none"
              id="category-filter-select"
            >
              <option value="all" className="bg-[#111113]">All Document Types</option>
              <option value="Sales" className="bg-[#111113]">Sales (Inward)</option>
              <option value="Purchase" className="bg-[#111113]">Purchase (Outward)</option>
              <option value="Expense" className="bg-[#111113]">Expense</option>
              <option value="Credit Note" className="bg-[#111113]">Credit Note</option>
              <option value="Debit Note" className="bg-[#111113]">Debit Note</option>
              <option value="Advance" className="bg-[#111113]">Advance</option>
              <option value="Export" className="bg-[#111113]">Export</option>
              <option value="Import" className="bg-[#111113]">Import</option>
            </select>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="overflow-x-auto" id="invoice-table-wrapper">
        <table className="w-full text-left border-collapse" id="invoice-main-table">
          <thead>
            <tr className="bg-white/5 text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-white/5" id="table-head-row">
              <th className="py-3.5 px-5">Invoice Number & Date</th>
              <th className="py-3.5 px-5">Supplier & Customer Details</th>
              <th className="py-3.5 px-5">Type / Category</th>
              <th className="py-3.5 px-5 text-right">Taxable Value</th>
              <th className="py-3.5 px-5 text-right">Total Invoice Value</th>
              <th className="py-3.5 px-5 text-center">AI Tax Auditor Status</th>
              <th className="py-3.5 px-5 text-center">Payment Status</th>
              <th className="py-3.5 px-5 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5" id="table-body">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv) => {
                const audit = validateInvoice(inv, invoices);
                return (
                  <tr 
                    key={inv.id}
                    className="hover:bg-white/5 transition-colors group"
                    id={`invoice-row-${inv.id}`}
                  >
                    {/* Invoice ID & Date */}
                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        <span className="font-mono text-sm font-bold text-white tracking-tight block">
                          {inv.invoiceNumber}
                        </span>
                        <div className="flex items-center text-[11px] text-slate-500 space-x-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{inv.date}</span>
                        </div>
                      </div>
                    </td>

                    {/* Supplier & Customer */}
                    <td className="py-4 px-5">
                      <div className="space-y-1 max-w-[240px]">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-400 mr-1 text-[10px] uppercase">From:</span>
                          <span className="font-medium text-slate-200">{inv.supplierName}</span>
                          {inv.supplierGstin && (
                            <span className="font-mono text-[9px] bg-white/5 border border-white/5 text-slate-400 px-1 py-0.5 rounded block mt-0.5 max-w-[120px] truncate">
                              {inv.supplierGstin}
                            </span>
                          )}
                        </div>
                        <div className="text-xs border-t border-dashed border-white/5 pt-1">
                          <span className="font-semibold text-slate-400 mr-1 text-[10px] uppercase">To:</span>
                          <span className="font-medium text-slate-200">{inv.customerName}</span>
                          {inv.customerGstin && (
                            <span className="font-mono text-[9px] bg-white/5 border border-white/5 text-slate-400 px-1 py-0.5 rounded block mt-0.5 max-w-[120px] truncate">
                              {inv.customerGstin}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-4 px-5">
                      <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        inv.category === 'Sales' || inv.category === 'Export'
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : inv.category === 'Purchase' || inv.category === 'Expense'
                          ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                          : "bg-white/5 text-slate-300 border border-white/5"
                      }`}>
                        {inv.category || "Sales"}
                      </span>
                    </td>

                    {/* Subtotal */}
                    <td className="py-4 px-5 text-right font-mono text-xs font-semibold text-slate-400">
                      {formatRupees(inv.subtotal)}
                    </td>

                    {/* Total Amount */}
                    <td className="py-4 px-5 text-right font-mono text-sm font-bold text-white">
                      {formatRupees(inv.totalAmount)}
                    </td>

                    {/* AI Auditor Checks */}
                    <td className="py-4 px-5 text-center">
                      {audit.passed ? (
                        <div className="inline-flex items-center space-x-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg text-[10px] font-bold">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Passed</span>
                        </div>
                      ) : (
                        <div 
                          onClick={() => onSelectInvoice(inv)}
                          className="inline-flex items-center space-x-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-rose-500/20 transition-colors"
                          title={audit.errors.join("\n")}
                        >
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                          <span>{audit.errors.length + audit.warnings.length} Issues</span>
                        </div>
                      )}
                    </td>

                    {/* Payment Status */}
                    <td className="py-4 px-5 text-center">
                      <div className="space-y-1">
                        <span className={`inline-flex items-center text-[10px] uppercase font-bold px-2 py-0.5 rounded-md ${
                          inv.status === 'paid' 
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" 
                            : inv.status === 'partially_paid'
                            ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/20"
                            : inv.status === 'unpaid'
                            ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                            : inv.status === 'overdue'
                            ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                            : "bg-white/10 text-slate-400 border border-white/5"
                        }`}>
                          {inv.status === 'partially_paid' ? 'Partially Paid' : inv.status}
                        </span>
                        {inv.balanceDue !== undefined && inv.balanceDue > 0 && (
                          <span className="block text-[9px] font-mono text-amber-400">
                            Due: {formatRupees(inv.balanceDue)}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions Column */}
                    <td className="py-4 px-5 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        {onRecordPayment && inv.status !== 'paid' && (
                          <button
                            onClick={() => onRecordPayment(inv)}
                            className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 p-1.5 rounded-lg border border-emerald-500/20 transition-all cursor-pointer"
                            title="Record Payment"
                            id={`record-payment-btn-${inv.id}`}
                          >
                            <CreditCard className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onSelectInvoice(inv)}
                          className="bg-white/5 text-slate-300 hover:bg-indigo-500/25 hover:text-indigo-400 p-1.5 rounded-lg border border-white/5 transition-all cursor-pointer"
                          title="View Details & Audit Report"
                          id={`view-btn-${inv.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteInvoice(inv.id)}
                          className="bg-white/5 text-slate-400 hover:bg-rose-500/25 hover:text-rose-400 p-1.5 rounded-lg border border-white/5 transition-all cursor-pointer"
                          title="Delete Record"
                          id={`delete-btn-${inv.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-sm">
                  <div className="max-w-md mx-auto space-y-2">
                    <p className="font-semibold text-white">No invoices match your search or filter</p>
                    <p className="text-xs text-slate-500">
                      Try searching with a different phrase, clearing your filters, or generate a brand new invoice with AI!
                    </p>
                    <button 
                      onClick={onOpenCreateModal}
                      className="inline-flex items-center space-x-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-xl text-xs font-semibold mt-2 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Create New Invoice</span>
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer / Summary */}
      <div className="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between text-xs text-slate-500" id="ledger-summary-footer">
        <span>Showing <b>{filteredInvoices.length}</b> of <b>{invoices.length}</b> records</span>
        <span className="font-mono text-[10px]">InvoicePro LEDGER ENGINE v1.0</span>
      </div>
    </div>
  );
}
