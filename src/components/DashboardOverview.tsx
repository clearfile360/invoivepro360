import React from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  AreaChart,
  Area,
  Legend
} from "recharts";
import { Invoice } from "../types";
import { formatRupees, validateInvoice } from "../utils/invoiceUtils";
import { 
  FileText, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  TrendingDown,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  Calendar,
  Wallet,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

interface DashboardOverviewProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onRecordPayment?: (invoice: Invoice) => void;
}

export default function DashboardOverview({ invoices, onSelectInvoice, onRecordPayment }: DashboardOverviewProps) {
  // 1. Calculate Summary Metrics
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const totalTax = invoices.reduce((sum, inv) => sum + inv.taxAmount, 0);

  // Payment Tracking Metrics
  const totalPaidCollected = invoices.reduce((sum, inv) => {
    if (inv.amountPaid !== undefined) return sum + inv.amountPaid;
    return inv.status === 'paid' ? sum + inv.totalAmount : sum;
  }, 0);

  const totalBalanceDue = invoices.reduce((sum, inv) => {
    if (inv.balanceDue !== undefined) return sum + inv.balanceDue;
    return inv.status === 'paid' ? sum : sum + inv.totalAmount;
  }, 0);

  const paidInvoicesCount = invoices.filter(inv => inv.status === 'paid' || inv.paymentStatus === 'paid').length;
  const partiallyPaidInvoicesCount = invoices.filter(inv => inv.status === 'partially_paid' || inv.paymentStatus === 'partially_paid').length;
  const unpaidInvoicesCount = invoices.filter(inv => inv.status === 'unpaid' || inv.status === 'overdue' || inv.paymentStatus === 'due' || inv.paymentStatus === 'overdue').length;

  const collectionRatePercentage = totalInvoiced > 0 ? Math.round((totalPaidCollected / totalInvoiced) * 100) : 0;

  // Outstanding / Unpaid Invoices list for actionable payment table
  const outstandingInvoicesList = invoices.filter(inv => {
    const due = inv.balanceDue !== undefined ? inv.balanceDue : (inv.status === 'paid' ? 0 : inv.totalAmount);
    return due > 0;
  });

  // Run audit validations to find total errors & conflicts across all invoices
  let auditWarnings = 0;
  let auditErrors = 0;
  
  invoices.forEach(inv => {
    const audit = validateInvoice(inv, invoices);
    auditWarnings += audit.warnings.length;
    auditErrors += audit.errors.length;
  });

  // 2. Prepare Data for 6-Month Cash Flow Trend Chart (Monthly Income vs. Expenses)
  const last6MonthsCashFlow = (() => {
    const months: { 
      monthKey: string; 
      monthLabel: string; 
      fullName: string;
      income: number; 
      expenses: number; 
      net: number; 
      invoiceCount: number;
    }[] = [];
    const now = new Date();
    
    // Generate the last 6 months chronologically (from 5 months ago to current month)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const fullName = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      months.push({
        monthKey,
        monthLabel,
        fullName,
        income: 0,
        expenses: 0,
        net: 0,
        invoiceCount: 0
      });
    }

    invoices.forEach(inv => {
      if (!inv.date) return;
      const invDate = new Date(inv.date);
      if (isNaN(invDate.getTime())) return;
      const key = `${invDate.getFullYear()}-${String(invDate.getMonth() + 1).padStart(2, '0')}`;
      const targetMonth = months.find(m => m.monthKey === key);
      if (targetMonth) {
        targetMonth.invoiceCount += 1;
        const isExpense = inv.category === 'Purchase' || inv.category === 'Expense';
        if (isExpense) {
          targetMonth.expenses += inv.totalAmount;
        } else {
          // Default to Sales / Income
          targetMonth.income += inv.totalAmount;
        }
        targetMonth.net = targetMonth.income - targetMonth.expenses;
      }
    });

    return months;
  })();

  const total6MonthIncome = last6MonthsCashFlow.reduce((sum, m) => sum + m.income, 0);
  const total6MonthExpenses = last6MonthsCashFlow.reduce((sum, m) => sum + m.expenses, 0);
  const total6MonthNet = total6MonthIncome - total6MonthExpenses;

  // 3. Prepare Data for Additional Charts
  const clientMap: Record<string, number> = {};
  invoices.forEach(inv => {
    clientMap[inv.customerName] = (clientMap[inv.customerName] || 0) + inv.totalAmount;
  });
  const clientData = Object.entries(clientMap)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  const taxRateMap: Record<string, number> = {};
  invoices.forEach(inv => {
    inv.items.forEach(item => {
      const rateKey = `${item.taxRate}%`;
      const itemTax = item.quantity * item.price * (item.taxRate / 100);
      taxRateMap[rateKey] = (taxRateMap[rateKey] || 0) + itemTax;
    });
  });
  
  const taxColors = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];
  const taxData = Object.entries(taxRateMap).map(([name, value]) => ({ name, value }));

  const sortedInvoices = [...invoices].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const trendData = sortedInvoices.map(inv => ({
    date: new Date(inv.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    Amount: inv.totalAmount,
    Collected: inv.amountPaid ?? (inv.status === 'paid' ? inv.totalAmount : 0),
    invoiceNumber: inv.invoiceNumber
  }));

  const cgstTotal = invoices.reduce((sum, inv) => sum + inv.cgst, 0);
  const sgstTotal = invoices.reduce((sum, inv) => sum + inv.sgst, 0);
  const igstTotal = invoices.reduce((sum, inv) => sum + inv.igst, 0);

  return (
    <div className="space-y-6 animate-fade-in-up" id="dashboard-container">
      {/* Primary Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-metrics-grid">
        {/* Total Invoiced */}
        <div className="bg-[#111113] p-5 rounded-2xl shadow-sm border border-white/5 flex items-center justify-between" id="metric-total-invoiced">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Invoiced</span>
            <h3 className="text-2xl font-bold font-mono text-white">{formatRupees(totalInvoiced)}</h3>
            <div className="flex items-center text-xs text-indigo-400 font-medium space-x-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{invoices.length} total invoices</span>
            </div>
          </div>
          <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-xl border border-indigo-500/10">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Total Collected (Paid) */}
        <div className="bg-[#111113] p-5 rounded-2xl shadow-sm border border-white/5 flex items-center justify-between" id="metric-collected">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Total Collected</span>
            <h3 className="text-2xl font-bold font-mono text-emerald-400">{formatRupees(totalPaidCollected)}</h3>
            <div className="flex items-center text-xs text-emerald-400 font-medium space-x-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{paidInvoicesCount} fully paid ({collectionRatePercentage}%)</span>
            </div>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 p-3 rounded-xl border border-emerald-500/10">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Outstanding Balance */}
        <div className="bg-[#111113] p-5 rounded-2xl shadow-sm border border-white/5 flex items-center justify-between" id="metric-outstanding">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-500">Outstanding Balance</span>
            <h3 className="text-2xl font-bold font-mono text-amber-500">{formatRupees(totalBalanceDue)}</h3>
            <div className="flex items-center text-xs text-amber-400 font-medium space-x-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{unpaidInvoicesCount + partiallyPaidInvoicesCount} pending / partial</span>
            </div>
          </div>
          <div className="bg-amber-500/10 text-amber-400 p-3 rounded-xl border border-amber-500/10">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* GST Liability */}
        <div className="bg-[#111113] p-5 rounded-2xl shadow-sm border border-white/5 flex items-center justify-between" id="metric-gst">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total GST Liability</span>
            <h3 className="text-2xl font-bold font-mono text-slate-200">{formatRupees(totalTax)}</h3>
            <div className="flex items-center text-xs text-indigo-400 font-medium space-x-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Audited CGST/SGST/IGST</span>
            </div>
          </div>
          <div className="bg-white/5 text-slate-300 p-3 rounded-xl border border-white/5">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 6-Month Cash Flow Trend Chart (Monthly Income vs. Expenses) */}
      <div className="bg-[#111113] p-6 rounded-2xl border border-white/5 space-y-5" id="cash-flow-trend-hub">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wallet className="w-4 h-4" />
              </span>
              <h3 className="font-display font-bold text-white text-lg">
                Cash Flow Trend — Last 6 Months
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Monthly breakdown of business income (sales billings) vs. operational expenses & purchases
            </p>
          </div>

          {/* 6-Month Summary Pills */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3" id="cash-flow-summary-pills">
            <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-emerald-400/80 block">6M Income</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{formatRupees(total6MonthIncome)}</span>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-rose-400/80 block">6M Expenses</span>
              <span className="text-xs font-mono font-bold text-rose-400">{formatRupees(total6MonthExpenses)}</span>
            </div>
            <div className={`px-3 py-1.5 rounded-xl border ${
              total6MonthNet >= 0 
                ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-300" 
                : "bg-amber-500/10 border-amber-500/20 text-amber-300"
            }`}>
              <span className="text-[10px] uppercase font-bold text-slate-400 block flex items-center space-x-1">
                <span>Net Cash Flow</span>
                {total6MonthNet >= 0 ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : <ArrowDownRight className="w-3 h-3 text-rose-400" />}
              </span>
              <span className="text-xs font-mono font-bold">
                {total6MonthNet >= 0 ? `+${formatRupees(total6MonthNet)}` : `-${formatRupees(Math.abs(total6MonthNet))}`}
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Cash Flow Chart */}
        <div className="h-72 w-full" id="cash-flow-recharts-container">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={last6MonthsCashFlow}
              margin={{ top: 15, right: 15, left: -10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="incomeBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="expenseBarGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#e11d48" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis 
                dataKey="monthLabel" 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false} 
              />
              <YAxis 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false}
                tickFormatter={(val) => `₹${val >= 1000 ? `${Math.round(val / 1000)}k` : val}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0]?.payload;
                    const income = data?.income || 0;
                    const expenses = data?.expenses || 0;
                    const net = income - expenses;
                    return (
                      <div className="bg-[#18181b] border border-white/10 p-3.5 rounded-xl shadow-2xl space-y-2 text-xs font-sans min-w-[200px]">
                        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                          <span className="font-bold text-white flex items-center space-x-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{data?.fullName || label}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono font-medium">
                            {data?.invoiceCount || 0} invoice{data?.invoiceCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-emerald-400 flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                              <span>Income (Sales):</span>
                            </span>
                            <span className="font-mono font-bold text-white">{formatRupees(income)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-rose-400 flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                              <span>Expenses (Purchases):</span>
                            </span>
                            <span className="font-mono font-bold text-white">{formatRupees(expenses)}</span>
                          </div>
                          <div className="border-t border-white/5 pt-1.5 flex justify-between items-center font-bold">
                            <span className="text-slate-400">Net Flow:</span>
                            <span className={`font-mono ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {net >= 0 ? `+${formatRupees(net)}` : `-${formatRupees(Math.abs(net))}`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend 
                verticalAlign="top" 
                align="right"
                wrapperStyle={{ paddingBottom: '12px' }}
                content={() => (
                  <div className="flex items-center justify-end space-x-4 text-xs font-medium">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
                      <span className="text-slate-300">Income (Sales)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span>
                      <span className="text-slate-300">Expenses / Purchases</span>
                    </div>
                  </div>
                )}
              />
              <Bar 
                dataKey="income" 
                name="Income" 
                fill="url(#incomeBarGradient)" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={42} 
              />
              <Bar 
                dataKey="expenses" 
                name="Expenses" 
                fill="url(#expenseBarGradient)" 
                radius={[4, 4, 0, 0]} 
                maxBarSize={42} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Payment Tracking & Clearance Hub */}
      <div className="bg-[#111113] p-6 rounded-2xl border border-white/5 space-y-5" id="payment-tracking-hub">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h3 className="font-display font-bold text-white text-lg flex items-center space-x-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              <span>Payment Tracking & Ledger Clearance</span>
            </h3>
            <p className="text-xs text-slate-400">
              Real-time monitoring of collected payments, outstanding balances, and partial settlements
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl font-mono">
              Overall Collection Rate: <b className="text-emerald-400">{collectionRatePercentage}%</b>
            </span>
          </div>
        </div>

        {/* Combined Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold">
            <span className="text-slate-400">Payment Clearance Breakdown</span>
            <span className="text-slate-300 font-mono">
              Collected: <span className="text-emerald-400">{formatRupees(totalPaidCollected)}</span> / Due: <span className="text-amber-400">{formatRupees(totalBalanceDue)}</span>
            </span>
          </div>

          <div className="w-full h-3.5 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5 flex">
            <div 
              className="h-full bg-emerald-500 rounded-l-full transition-all duration-500" 
              style={{ width: `${collectionRatePercentage}%` }}
              title={`Collected: ${collectionRatePercentage}%`}
            />
            <div 
              className="h-full bg-amber-500 rounded-r-full transition-all duration-500" 
              style={{ width: `${100 - collectionRatePercentage}%` }}
              title={`Outstanding: ${100 - collectionRatePercentage}%`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              <span className="text-slate-300">Paid Invoices ({paidInvoicesCount})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
              <span className="text-slate-300">Partially Paid ({partiallyPaidInvoicesCount})</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              <span className="text-slate-300">Unpaid / Due ({unpaidInvoicesCount})</span>
            </div>
          </div>
        </div>

        {/* Actionable Outstanding Invoices List */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Outstanding / Unpaid Invoices ({outstandingInvoicesList.length})</span>
            </h4>
            <span className="text-[11px] text-slate-500">Click "Record Payment" to settle</span>
          </div>

          {outstandingInvoicesList.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/5 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3 text-right">Total Amount</th>
                    <th className="p-3 text-right">Amount Paid</th>
                    <th className="p-3 text-right">Balance Due</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-[#161618]">
                  {outstandingInvoicesList.map((inv) => {
                    const paid = inv.amountPaid ?? (inv.status === 'paid' ? inv.totalAmount : 0);
                    const due = inv.balanceDue ?? (inv.status === 'paid' ? 0 : inv.totalAmount);
                    const statusLabel = inv.status === 'partially_paid' ? 'Partially Paid' : inv.status === 'overdue' ? 'Overdue' : 'Unpaid';

                    return (
                      <tr key={inv.id} className="hover:bg-white/5 transition-all">
                        <td className="p-3 font-mono font-bold text-white cursor-pointer" onClick={() => onSelectInvoice(inv)}>
                          {inv.invoiceNumber}
                        </td>
                        <td className="p-3 font-semibold text-slate-200 cursor-pointer" onClick={() => onSelectInvoice(inv)}>
                          {inv.customerName}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-300">
                          {formatRupees(inv.totalAmount)}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400">
                          {formatRupees(paid)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-400">
                          {formatRupees(due)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            inv.status === 'partially_paid'
                              ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                              : inv.status === 'overdue'
                              ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {onRecordPayment && (
                            <button
                              onClick={() => onRecordPayment(inv)}
                              className="bg-emerald-600/90 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition-all flex items-center space-x-1 mx-auto cursor-pointer shadow-sm hover:scale-[1.02]"
                            >
                              <CreditCard className="w-3.5 h-3.5" />
                              <span>Record Payment</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-400 bg-white/5 p-4 rounded-xl text-center italic">
              🎉 All invoices are fully paid! No outstanding balances.
            </p>
          )}
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="dashboard-charts-grid">
        {/* Trend Area Chart */}
        <div className="bg-[#111113] p-5 rounded-2xl shadow-sm border border-white/5 lg:col-span-2 space-y-4" id="chart-trend-card">
          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <h4 className="font-display font-bold text-white text-lg">Sales & Revenue Chronological Trend</h4>
              <p className="text-xs text-slate-400">Visualizing total invoice values and collected amounts over time</p>
            </div>
          </div>
          <div className="h-64" id="trend-chart-container">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#1e293b", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.05)" }}
                    labelStyle={{ color: "#94a3b8", fontWeight: "bold" }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                  <Area type="monotone" dataKey="Amount" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorAmount)" name="Invoiced Total" />
                  <Area type="monotone" dataKey="Collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCollected)" name="Amount Collected" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                No data available. Create some invoices to view trends.
              </div>
            )}
          </div>
        </div>

        {/* Tax Component Distribution Pie */}
        <div className="bg-[#111113] p-5 rounded-2xl shadow-sm border border-white/5 flex flex-col justify-between space-y-4" id="chart-tax-pie-card">
          <div className="space-y-0.5">
            <h4 className="font-display font-bold text-white text-lg">Tax Collected by GST Bracket</h4>
            <p className="text-xs text-slate-400">Breakdown of total CGST, SGST, & IGST shares</p>
          </div>
          
          <div className="flex items-center justify-center h-44 relative" id="tax-pie-container">
            {taxData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taxData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {taxData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={taxColors[index % taxColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => formatRupees(Number(value))}
                    contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}
                    itemStyle={{ color: "#f8fafc" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-slate-500 text-sm">No tax recorded</div>
            )}
            <div className="absolute flex flex-col items-center justify-center" id="pie-center-label">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">GST Total</span>
              <span className="text-base font-bold font-mono text-white">{formatRupees(totalTax)}</span>
            </div>
          </div>

          {/* GST Sub-accounts */}
          <div className="grid grid-cols-3 gap-2 text-center border-t border-white/5 pt-3" id="gst-breakdown-subtotals">
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase font-bold text-slate-400">CGST</p>
              <p className="text-xs font-mono font-bold text-white">{formatRupees(cgstTotal)}</p>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase font-bold text-slate-400">SGST</p>
              <p className="text-xs font-mono font-bold text-white">{formatRupees(sgstTotal)}</p>
            </div>
            <div className="bg-white/5 p-2 rounded-xl border border-white/5">
              <p className="text-[10px] uppercase font-bold text-slate-400">IGST</p>
              <p className="text-xs font-mono font-bold text-white">{formatRupees(igstTotal)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
