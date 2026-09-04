import React, { useState } from "react";
import { Invoice, PaymentRecord } from "../types";
import { formatRupees, generateId } from "../utils/invoiceUtils";
import { 
  X, 
  CreditCard, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Plus, 
  Trash2, 
  FileText,
  ShieldCheck,
  Check,
  Building2,
  TrendingUp,
  Receipt
} from "lucide-react";

interface RecordPaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onSavePayment: (updatedInvoice: Invoice) => void;
}

export default function RecordPaymentModal({ invoice, onClose, onSavePayment }: RecordPaymentModalProps) {
  // Current payment values
  const totalAmount = invoice.totalAmount;
  const existingPayments = invoice.payments || [];
  const currentPaid = existingPayments.reduce((sum, p) => sum + p.amount, 0);
  const currentBalance = Math.max(0, totalAmount - currentPaid);

  // New Payment Form Inputs
  const [paymentAmount, setPaymentAmount] = useState<number>(currentBalance > 0 ? currentBalance : totalAmount);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque' | 'Credit Card' | 'Other'>("UPI");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Form submission handler
  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!paymentAmount || paymentAmount <= 0) {
      setError("Please enter a valid payment amount greater than zero.");
      return;
    }

    if (paymentAmount > currentBalance && currentBalance > 0) {
      setError(`Payment amount (${formatRupees(paymentAmount)}) exceeds current balance due (${formatRupees(currentBalance)}).`);
      return;
    }

    // Create new payment record
    const newRecord: PaymentRecord = {
      id: "pay-" + generateId(),
      amount: paymentAmount,
      paymentDate: paymentDate || new Date().toISOString().substring(0, 10),
      paymentMethod,
      referenceNumber: referenceNumber.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    const updatedPayments = [...existingPayments, newRecord];
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const newBalanceDue = Math.max(0, totalAmount - newTotalPaid);

    // Determine new status
    let newStatus: Invoice['status'] = 'unpaid';
    let newPaymentStatus: Invoice['paymentStatus'] = 'due';

    if (newBalanceDue <= 0.5) { // rounding tolerance
      newStatus = 'paid';
      newPaymentStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'partially_paid';
      newPaymentStatus = 'partially_paid';
    } else {
      newStatus = 'unpaid';
      newPaymentStatus = 'due';
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      status: newStatus,
      paymentStatus: newPaymentStatus,
      amountPaid: newTotalPaid,
      balanceDue: newBalanceDue,
      payments: updatedPayments
    };

    onSavePayment(updatedInvoice);
  };

  // Remove a payment entry
  const handleDeletePayment = (paymentId: string) => {
    const updatedPayments = existingPayments.filter(p => p.id !== paymentId);
    const newTotalPaid = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
    const newBalanceDue = Math.max(0, totalAmount - newTotalPaid);

    let newStatus: Invoice['status'] = 'unpaid';
    let newPaymentStatus: Invoice['paymentStatus'] = 'due';

    if (newBalanceDue <= 0.5) {
      newStatus = 'paid';
      newPaymentStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'partially_paid';
      newPaymentStatus = 'partially_paid';
    } else {
      newStatus = 'unpaid';
      newPaymentStatus = 'due';
    }

    const updatedInvoice: Invoice = {
      ...invoice,
      status: newStatus,
      paymentStatus: newPaymentStatus,
      amountPaid: newTotalPaid,
      balanceDue: newBalanceDue,
      payments: updatedPayments
    };

    onSavePayment(updatedInvoice);
  };

  const paidPercentage = Math.min(100, Math.round((currentPaid / totalAmount) * 100)) || 0;

  return (
    <div className="fixed inset-0 bg-[#0A0A0B]/85 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in" id="record-payment-modal-overlay">
      <div className="bg-[#111113] border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in" id="record-payment-modal-box">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-[#161618]" id="record-payment-header">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/10 text-emerald-400 p-2 rounded-xl border border-emerald-500/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-display flex items-center space-x-2">
                <span>Record Payment</span>
                <span className="text-xs bg-white/5 text-slate-400 font-mono font-semibold px-2 py-0.5 rounded border border-white/5">
                  {invoice.invoiceNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-400">Customer: <b className="text-slate-200">{invoice.customerName}</b></p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl transition-all cursor-pointer"
            id="close-payment-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6" id="record-payment-body">
          {/* Invoice Financial Progress Card */}
          <div className="bg-[#161618] border border-white/5 rounded-2xl p-5 space-y-4 shadow-inner">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Invoice Total</span>
                <p className="text-sm font-extrabold font-mono text-white">{formatRupees(totalAmount)}</p>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Amount Paid</span>
                <p className="text-sm font-extrabold font-mono text-emerald-400">{formatRupees(currentPaid)}</p>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">Balance Due</span>
                <p className="text-sm font-extrabold font-mono text-amber-400">{formatRupees(currentBalance)}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 font-semibold">Payment Progress</span>
                <span className="text-emerald-400 font-bold font-mono">{paidPercentage}% Cleared</span>
              </div>
              <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500" 
                  style={{ width: `${paidPercentage}%` }}
                />
              </div>
            </div>
          </div>

          {/* Payment Entry Form */}
          {currentBalance > 0 ? (
            <form onSubmit={handleAddPayment} className="space-y-4 bg-[#141416] border border-white/5 p-5 rounded-2xl">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Add Payment Entry</span>
              </h4>

              {/* Quick Amount Buttons */}
              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-medium">Quick Amount:</span>
                <button
                  type="button"
                  onClick={() => setPaymentAmount(currentBalance)}
                  className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  Full Balance ({formatRupees(currentBalance)})
                </button>
                {currentBalance > 1000 && (
                  <button
                    type="button"
                    onClick={() => setPaymentAmount(Math.round(currentBalance / 2))}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    50% ({formatRupees(Math.round(currentBalance / 2))})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Amount */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">Payment Amount (₹)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="number"
                      step="1"
                      min="1"
                      max={currentBalance}
                      value={paymentAmount || ""}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      required
                      className="w-full bg-[#1A1A1D] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                      id="payment-amount-input"
                    />
                  </div>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">Payment Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      className="w-full bg-[#1A1A1D] border border-white/10 rounded-xl py-2 pl-9 pr-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                      id="payment-date-input"
                    />
                  </div>
                </div>

                {/* Method */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">Payment Mode</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full bg-[#1A1A1D] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-semibold"
                    id="payment-method-select"
                  >
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="Cash">Cash</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Credit Card">Credit / Debit Card</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                {/* Reference Number */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 block">Transaction Reference / UTR #</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR102938491 / Cheque #884"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full bg-[#1A1A1D] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    id="payment-ref-input"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 block">Payment Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Received via HDFC corporate account..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#1A1A1D] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                  id="payment-notes-input"
                />
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-xs font-medium flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-all flex items-center space-x-1.5 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95"
                  id="submit-payment-btn"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm & Save Payment</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <h4 className="text-sm font-bold text-emerald-400">Invoice Fully Paid</h4>
              <p className="text-xs text-slate-400">No balance due remains for this invoice record.</p>
            </div>
          )}

          {/* Payment History Log */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Payment History Logs ({existingPayments.length})</span>
              <span className="text-[10px] text-slate-500 font-mono">Immutable Ledger</span>
            </h4>

            {existingPayments.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1" id="payment-history-list">
                {existingPayments.map((p) => (
                  <div key={p.id} className="bg-[#161618] border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs hover:border-white/10 transition-all">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-emerald-400 text-sm">{formatRupees(p.amount)}</span>
                        <span className="bg-white/5 border border-white/5 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                          {p.paymentMethod}
                        </span>
                        <span className="text-slate-500 text-[10px]">{p.paymentDate}</span>
                      </div>
                      {p.referenceNumber && (
                        <p className="text-[10px] text-slate-400 font-mono">Ref #: {p.referenceNumber}</p>
                      )}
                      {p.notes && (
                        <p className="text-[10px] text-slate-500 italic">{p.notes}</p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeletePayment(p.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                      title="Remove Payment Record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 bg-white/5 rounded-xl text-center">
                No payment transactions recorded for this invoice yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
