import React, { useState, useRef } from "react";
import { 
  Sparkles, 
  Upload, 
  FileText, 
  Loader2, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Info
} from "lucide-react";
import { Invoice, CompanySettings } from "../types";
import { sampleCreationTemplates, sampleOcrInvoices, generateId, calculateInvoiceTotals } from "../utils/invoiceUtils";
import { safeFetchJson } from "../utils/apiUtils";

interface InvoiceCreatorProps {
  onInvoiceCreated: (invoice: Invoice) => void;
  onClose: () => void;
  companySettings?: CompanySettings;
}

type CreatorMode = "text" | "ocr";

export default function InvoiceCreator({ onInvoiceCreated, onClose, companySettings }: InvoiceCreatorProps) {
  const [activeMode, setActiveMode] = useState<CreatorMode>("text");
  
  // Text Generator States
  const [textPrompt, setTextPrompt] = useState("");
  const [textGenerating, setTextGenerating] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  // OCR Scanner States
  const [isDragging, setIsDragging] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Handle Natural Language Prompt generation
  const handleGenerateFromText = async (promptToUse = textPrompt) => {
    if (!promptToUse.trim()) return;
    
    setTextGenerating(true);
    setTextError(null);

    let enrichedPrompt = promptToUse;
    if (companySettings) {
      enrichedPrompt += `\n\n[Instruction: If appropriate, use my business settings as the supplier or billed from party (or customer if specified): Name: "${companySettings.name}", Address: "${companySettings.address}", GSTIN: "${companySettings.gstin}"].`;
    }

    try {
      const generatedData = await safeFetchJson("/api/invoice/create-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: enrichedPrompt })
      });
      
      // Complete calculations (taxes, igst, cgst, sgst, subtotal, totals)
      const mathResult = calculateInvoiceTotals(
        generatedData.items, 
        generatedData.supplierGstin, 
        generatedData.customerGstin
      );

      const finalInvoice: Invoice = {
        id: "inv-" + generateId(),
        invoiceNumber: generatedData.invoiceNumber || `INV-2026-${Math.floor(1000 + Math.random() * 9000)}`,
        supplierName: generatedData.supplierName || "Draft Supplier",
        supplierGstin: generatedData.supplierGstin || "",
        supplierAddress: generatedData.supplierAddress || "",
        customerName: generatedData.customerName || "Draft Customer",
        customerGstin: generatedData.customerGstin || "",
        customerAddress: generatedData.customerAddress || "",
        date: generatedData.date || new Date().toISOString().substring(0, 10),
        items: mathResult.items,
        subtotal: mathResult.subtotal,
        cgst: mathResult.cgst,
        sgst: mathResult.sgst,
        igst: mathResult.igst,
        taxAmount: mathResult.taxAmount,
        totalAmount: mathResult.totalAmount,
        status: "unpaid",
        category: "Sales",
        notes: generatedData.notes || "Generated from natural language prompt.",
        createdAt: new Date().toISOString()
      };

      onInvoiceCreated(finalInvoice);
    } catch (err: any) {
      console.error("AI invoice generation error:", err);
      setTextError(err.message || "AI invoice generation failed. Please check the Gemini API configuration.");
    } finally {
      setTextGenerating(false);
    }
  };

  // 2. OCR base64 processing
  const processBase64Ocr = async (base64Data: string, mimeType: string, fileName: string) => {
    setOcrLoading(true);
    setOcrError(null);

    try {
      const extracted = await safeFetchJson("/api/invoice/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64: base64Data, mimeType })
      });

      // Complete calculations safely
      const mathResult = calculateInvoiceTotals(
        extracted.items, 
        extracted.supplierGstin, 
        extracted.customerGstin
      );

      const finalInvoice: Invoice = {
        id: "inv-" + generateId(),
        invoiceNumber: extracted.invoiceNumber || `OCR-${Math.floor(1000 + Math.random() * 9000)}`,
        supplierName: extracted.supplierName || "Extracted Supplier",
        supplierGstin: extracted.supplierGstin || "",
        supplierAddress: extracted.supplierAddress || "",
        customerName: extracted.customerName || "Extracted Customer",
        customerGstin: extracted.customerGstin || "",
        customerAddress: extracted.customerAddress || "",
        date: extracted.date || new Date().toISOString().substring(0, 10),
        items: mathResult.items,
        subtotal: mathResult.subtotal,
        cgst: mathResult.cgst,
        sgst: mathResult.sgst,
        igst: mathResult.igst,
        taxAmount: mathResult.taxAmount,
        totalAmount: mathResult.totalAmount,
        status: "unpaid",
        category: "Purchase", // uploaded invoices are typically purchases/expenses
        ocrSource: fileName,
        notes: extracted.notes || `Processed via OCR from ${fileName}.`,
        createdAt: new Date().toISOString()
      };

      onInvoiceCreated(finalInvoice);
    } catch (err: any) {
      console.error("AI OCR error:", err);
      setOcrError(err.message || "Could not parse details from image. Try another file or template.");
    } finally {
      setOcrLoading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (file: File) => {
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setOcrError("Please upload an image file (PNG, JPG) or PDF document.");
      return;
    }

    const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);
    setSelectedFile({ name: file.name, size: `${sizeInMB} MB` });

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(",")[1];
      processBase64Ocr(base64String, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  // Simulate OCR with sample demo documents
  const handleSelectDemoOcr = async (sample: typeof sampleOcrInvoices[0]) => {
    setOcrLoading(true);
    setOcrError(null);
    setSelectedFile({ name: sample.name, size: "Demo Document" });

    try {
      const parsed = await safeFetchJson("/api/invoice/create-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `This is extracted from an OCR document scan: ${sample.prompt}` })
      });

      const mathResult = calculateInvoiceTotals(parsed.items, parsed.supplierGstin, parsed.customerGstin);

      const finalInvoice: Invoice = {
        id: "inv-" + generateId(),
        invoiceNumber: parsed.invoiceNumber || "AO-88421",
        supplierName: parsed.supplierName || "Sample Supplier",
        supplierGstin: parsed.supplierGstin || "",
        supplierAddress: parsed.supplierAddress || "",
        customerName: parsed.customerName || "Sample Customer",
        customerGstin: parsed.customerGstin || "",
        customerAddress: parsed.customerAddress || "",
        date: parsed.date || new Date().toISOString().substring(0, 10),
        items: mathResult.items,
        subtotal: mathResult.subtotal,
        cgst: mathResult.cgst,
        sgst: mathResult.sgst,
        igst: mathResult.igst,
        taxAmount: mathResult.taxAmount,
        totalAmount: mathResult.totalAmount,
        status: "unpaid",
        category: "Purchase",
        ocrSource: sample.name,
        notes: `Simulated OCR scan from demo catalog.`,
        createdAt: new Date().toISOString()
      };

      // Add delay to mimic scanning feeling
      setTimeout(() => {
        onInvoiceCreated(finalInvoice);
        setOcrLoading(false);
      }, 1500);

    } catch (e: any) {
      console.error("Demo OCR parsing error:", e);
      setOcrError(e.message || "Demo parsing failed. Please check backend API.");
      setOcrLoading(false);
    }
  };

  return (
    <div className="bg-[#111113] rounded-2xl border border-white/5 overflow-hidden" id="creator-workspace">
      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-white/5 bg-[#0A0A0B]/50" id="creator-mode-tabs">
        <button 
          onClick={() => { setActiveMode("text"); setTextError(null); }}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeMode === "text" 
              ? "border-indigo-500 text-indigo-400 bg-[#111113]" 
              : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
          }`}
          id="text-mode-tab"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Voice & Text Generator</span>
        </button>

        <button 
          onClick={() => { setActiveMode("ocr"); setOcrError(null); }}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeMode === "ocr" 
              ? "border-indigo-500 text-indigo-400 bg-[#111113]" 
              : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
          }`}
          id="ocr-mode-tab"
        >
          <Upload className="w-4 h-4" />
          <span>AI OCR Scan & Upload</span>
        </button>
      </div>

      <div className="p-6" id="creator-content">
        {/* TAB 1: TEXT GENERATOR */}
        {activeMode === "text" && (
          <div className="space-y-6" id="text-generator-panel">
            <div className="space-y-1">
              <h4 className="font-display font-bold text-white text-base flex items-center space-x-1.5">
                <Sparkles className="w-4.5 h-4.5 text-indigo-400" />
                <span>Create invoice with natural language</span>
              </h4>
              <p className="text-xs text-slate-400">
                Type details about suppliers, items, pricing, and taxes. Our AI compiles everything into a perfectly balanced ledger record.
              </p>
            </div>

            {/* Input prompt area */}
            <div className="space-y-2">
              <textarea 
                rows={5}
                placeholder="Describe your invoice. E.g.: 'Create an invoice for ABC Traders. 15 Steel Rods at ₹600 each, 18% GST. HSN 7214. Stated Supplier GSTIN is 27AAPCS1030F1Z4. Buyer is Tata Projects...'"
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                disabled={textGenerating}
                className="w-full p-4 bg-white/5 border border-white/5 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] text-slate-200 resize-none transition-all placeholder:text-slate-500"
                id="invoice-generator-textarea"
              />

              {textError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs flex items-start space-x-2 animate-fade-in-up" id="text-generator-error">
                  <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                  <span>{textError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center space-x-1 text-slate-500">
                  <Info className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Tax balances & state classification auto-computed</span>
                </div>

                <button 
                  onClick={() => handleGenerateFromText()}
                  disabled={textGenerating || !textPrompt.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-white/10 disabled:text-slate-600 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all flex items-center space-x-1.5 shadow-sm cursor-pointer"
                  id="submit-text-generator"
                >
                  {textGenerating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Gemini is Creating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Compile Invoice with AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Predefined prompts list */}
            <div className="space-y-2.5 border-t border-white/5 pt-5" id="template-suggestions">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                <span>Quick start prompts (Select to load)</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3" id="templates-grid">
                {sampleCreationTemplates.map((tmpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => { setTextPrompt(tmpl.prompt); setTextError(null); }}
                    disabled={textGenerating}
                    className="text-left p-3 rounded-xl border border-white/5 bg-white/5 hover:border-indigo-500 hover:bg-white/10 transition-all space-y-1 group cursor-pointer"
                  >
                    <p className="text-xs font-bold text-slate-300 group-hover:text-indigo-400 flex items-center justify-between">
                      <span>{tmpl.title}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400" />
                    </p>
                    <p className="text-[10px] text-slate-500 line-clamp-2 leading-relaxed">
                      {tmpl.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: OCR SCANNER */}
        {activeMode === "ocr" && (
          <div className="space-y-6" id="ocr-generator-panel">
            <div className="space-y-1">
              <h4 className="font-display font-bold text-white text-base flex items-center space-x-1.5">
                <Upload className="w-4.5 h-4.5 text-indigo-400" />
                <span>Invoice OCR Extractor</span>
              </h4>
              <p className="text-xs text-slate-400">
                Upload physical receipt photos, PDFs, or mobile scans. Gemini parses invoice tables, total rates, merchant GSTINs, and items instantaneously.
              </p>
            </div>

            {/* Drop Zone */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all ${
                isDragging 
                  ? "border-indigo-500 bg-indigo-500/10" 
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
              id="ocr-dropzone"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={ocrLoading}
                className="hidden" 
                accept="image/*"
              />

              {ocrLoading ? (
                <div className="text-center space-y-2 py-4" id="ocr-loader">
                  <Loader2 className="w-10 h-10 text-indigo-400 animate-spin mx-auto" />
                  <div>
                    <p className="text-sm font-semibold text-white">Analyzing document...</p>
                    <p className="text-xs text-slate-500">Gemini is extracting tabular values and tax structures</p>
                  </div>
                </div>
              ) : selectedFile ? (
                <div className="text-center space-y-2 py-4" id="ocr-file-selected">
                  <FileText className="w-10 h-10 text-emerald-400 mx-auto" />
                  <div>
                    <p className="text-sm font-bold text-white truncate max-w-xs">{selectedFile.name}</p>
                    <p className="text-xs text-slate-500">{selectedFile.size}</p>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="text-xs font-semibold text-rose-400 hover:underline cursor-pointer"
                  >
                    Remove File
                  </button>
                </div>
              ) : (
                <div className="text-center space-y-2 py-2" id="ocr-empty-prompt">
                  <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-2xl w-12 h-12 flex items-center justify-center mx-auto border border-indigo-500/10">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Drag & drop your invoice here</p>
                    <p className="text-xs text-slate-500">Supports PNG, JPG, or PDF files up to 15MB</p>
                  </div>
                  <span className="inline-block bg-[#111113] border border-white/10 shadow-sm text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold mt-1">
                    Select File from Device
                  </span>
                </div>
              )}
            </div>

            {ocrError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs flex items-start space-x-2 animate-fade-in-up" id="ocr-error-banner">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{ocrError}</span>
              </div>
            )}

            {/* Predefined OCR demo scans */}
            <div className="space-y-2.5 border-t border-white/5 pt-5" id="demo-ocr-scans">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                <span>Interactive sample scans (Click to test OCR)</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="demo-scans-grid">
                {sampleOcrInvoices.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectDemoOcr(sample)}
                    disabled={ocrLoading}
                    className="text-left p-3.5 rounded-xl border border-white/5 bg-white/5 hover:border-indigo-500 hover:bg-indigo-500/10 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-200 group-hover:text-indigo-400 truncate max-w-[200px]">
                        {sample.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {sample.supplier}
                      </p>
                    </div>
                    <div className="text-right shrink-0 pl-2">
                      <span className="text-xs font-semibold text-indigo-400 block">{sample.amount}</span>
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold">Demo Scan</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
