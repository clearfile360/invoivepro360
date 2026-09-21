import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  Upload, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  ClipboardList,
  Info,
  Camera,
  CameraOff,
  SwitchCamera,
  Plus,
  Trash2,
  Layers,
  ArrowRight,
  FileCheck2,
  X,
  Smartphone
} from "lucide-react";
import { Invoice, CompanySettings } from "../types";
import { sampleCreationTemplates, sampleOcrInvoices, generateId, calculateInvoiceTotals, formatRupees } from "../utils/invoiceUtils";
import { safeFetchJson } from "../utils/apiUtils";

interface InvoiceCreatorProps {
  onInvoiceCreated: (invoice: Invoice) => void;
  onBatchInvoicesCreated?: (invoices: Invoice[]) => void;
  onClose: () => void;
  companySettings?: CompanySettings;
}

type CreatorMode = "text" | "ocr" | "batch";

interface BatchQueueItem {
  id: string;
  fileName: string;
  fileSize: string;
  mimeType: string;
  base64Data: string;
  previewUrl?: string;
  source: "camera" | "upload";
  status: "pending" | "processing" | "completed" | "error";
  errorMessage?: string;
  extractedInvoice?: Invoice;
}

export default function InvoiceCreator({ onInvoiceCreated, onBatchInvoicesCreated, onClose, companySettings }: InvoiceCreatorProps) {
  const [activeMode, setActiveMode] = useState<CreatorMode>("text");
  
  // Text Generator States
  const [textPrompt, setTextPrompt] = useState("");
  const [textGenerating, setTextGenerating] = useState(false);
  const [textError, setTextError] = useState<string | null>(null);

  // Single OCR Scanner States
  const [isDragging, setIsDragging] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batch & Camera Scanner States
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [isBatchDragging, setIsBatchDragging] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; stage: string }>({ current: 0, total: 0, stage: "" });
  const [batchGeneralError, setBatchGeneralError] = useState<string | null>(null);
  
  // Live Camera states
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraFlash, setCameraFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);

  // Clean up camera stream when component unmounts or camera is closed
  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async (facing: "environment" | "user" = cameraFacingMode) => {
    setCameraError(null);
    stopCameraStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported on this browser or environment.");
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraOpen(true);
    } catch (err: any) {
      console.warn("Could not start environment camera, attempting fallback:", err);
      try {
        // Fallback to any available video stream
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = fallbackStream;
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
          videoRef.current.play();
        }
        setIsCameraOpen(true);
      } catch (fallbackErr: any) {
        console.error("Camera access failed:", fallbackErr);
        setCameraError(
          fallbackErr.name === "NotAllowedError" || fallbackErr.name === "PermissionDeniedError"
            ? "Camera permission was denied. Please allow camera access in your browser settings or use file upload."
            : fallbackErr.message || "Failed to initialize camera. You can upload photos directly from your device."
        );
      }
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setIsCameraOpen(false);
    setCameraError(null);
  };

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacingMode === "environment" ? "user" : "environment";
    setCameraFacingMode(nextFacing);
    if (isCameraOpen) {
      startCamera(nextFacing);
    }
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Trigger visual flash
    setCameraFlash(true);
    setTimeout(() => setCameraFlash(false), 200);

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const base64Data = dataUrl.split(",")[1];

    const captureId = generateId();
    const newItem: BatchQueueItem = {
      id: "snap-" + captureId,
      fileName: `Camera_Scan_${new Date().toISOString().substring(11, 19).replace(/:/g, "-")}.jpg`,
      fileSize: `${(base64Data.length * 0.75 / 1024).toFixed(1)} KB`,
      mimeType: "image/jpeg",
      base64Data: base64Data,
      previewUrl: dataUrl,
      source: "camera",
      status: "pending"
    };

    setBatchQueue(prev => [...prev, newItem]);
  };

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

  // 2. Single OCR base64 processing
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
        category: "Purchase",
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

  // Drag and drop handlers for Single OCR
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

  // 3. Batch File Upload Handlers (Images & PDFs)
  const addFilesToBatch = async (files: FileList | File[]) => {
    setBatchGeneralError(null);
    const validFiles = Array.from(files).filter(f => f.type.startsWith("image/") || f.type === "application/pdf");
    
    if (validFiles.length === 0) {
      setBatchGeneralError("Please select valid image files (PNG, JPG, WebP) or PDF documents.");
      return;
    }

    const newItems: BatchQueueItem[] = [];

    for (const file of validFiles) {
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(",")[1]);
        };
        reader.readAsDataURL(file);
      });

      const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      const sizeInMB = (file.size / (1024 * 1024)).toFixed(2);

      newItems.push({
        id: "batch-" + generateId(),
        fileName: file.name,
        fileSize: `${sizeInMB} MB`,
        mimeType: file.type,
        base64Data,
        previewUrl,
        source: "upload",
        status: "pending"
      });
    }

    setBatchQueue(prev => [...prev, ...newItems]);
  };

  const handleBatchFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToBatch(e.target.files);
    }
  };

  const handleBatchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsBatchDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToBatch(e.dataTransfer.files);
    }
  };

  const removeBatchItem = (id: string) => {
    setBatchQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearBatchQueue = () => {
    setBatchQueue([]);
    setBatchGeneralError(null);
  };

  // 4. Batch OCR Processing Engine
  const processBatchQueue = async () => {
    const pendingItems = batchQueue.filter(item => item.status === "pending" || item.status === "error");
    if (pendingItems.length === 0) return;

    setIsProcessingBatch(true);
    setBatchGeneralError(null);
    setBatchProgress({ current: 0, total: pendingItems.length, stage: "Starting OCR batch..." });

    let processedCount = 0;

    for (const item of pendingItems) {
      processedCount++;
      setBatchProgress({
        current: processedCount,
        total: pendingItems.length,
        stage: `Analyzing document ${processedCount} of ${pendingItems.length}: ${item.fileName}`
      });

      // Mark individual item as processing
      setBatchQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: "processing" } : q));

      try {
        const extracted = await safeFetchJson("/api/invoice/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileBase64: item.base64Data, mimeType: item.mimeType })
        });

        const mathResult = calculateInvoiceTotals(
          extracted.items || [], 
          extracted.supplierGstin || "", 
          extracted.customerGstin || ""
        );

        const finalInvoice: Invoice = {
          id: "inv-" + generateId(),
          invoiceNumber: extracted.invoiceNumber || `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
          supplierName: extracted.supplierName || "Scanned Supplier",
          supplierGstin: extracted.supplierGstin || "",
          supplierAddress: extracted.supplierAddress || "",
          customerName: extracted.customerName || (companySettings?.name || "Target Customer"),
          customerGstin: extracted.customerGstin || (companySettings?.gstin || ""),
          customerAddress: extracted.customerAddress || (companySettings?.address || ""),
          date: extracted.date || new Date().toISOString().substring(0, 10),
          items: mathResult.items,
          subtotal: mathResult.subtotal,
          cgst: mathResult.cgst,
          sgst: mathResult.sgst,
          igst: mathResult.igst,
          taxAmount: mathResult.taxAmount,
          totalAmount: mathResult.totalAmount,
          status: "unpaid",
          category: "Purchase",
          ocrSource: item.fileName,
          notes: extracted.notes || `Extracted in batch from ${item.fileName} (${item.source === "camera" ? "Live Camera" : "File Upload"}).`,
          createdAt: new Date().toISOString()
        };

        setBatchQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: "completed", 
          extractedInvoice: finalInvoice,
          errorMessage: undefined 
        } : q));

      } catch (err: any) {
        console.error(`Error processing batch item ${item.fileName}:`, err);
        setBatchQueue(prev => prev.map(q => q.id === item.id ? { 
          ...q, 
          status: "error", 
          errorMessage: err?.message || "Failed to extract invoice data" 
        } : q));
      }
    }

    setIsProcessingBatch(false);
  };

  // Commit all successfully extracted invoices to ledger
  const commitBatchToLedger = () => {
    const completedItems = batchQueue.filter(item => item.status === "completed" && item.extractedInvoice);
    const extractedInvoices = completedItems.map(item => item.extractedInvoice!);

    if (extractedInvoices.length === 0) return;

    if (onBatchInvoicesCreated) {
      onBatchInvoicesCreated(extractedInvoices);
    } else {
      extractedInvoices.forEach(inv => onInvoiceCreated(inv));
    }
  };

  // Test OCR extraction with sample catalog documents
  const handleSelectSampleOcr = async (sample: typeof sampleOcrInvoices[0]) => {
    setOcrLoading(true);
    setOcrError(null);
    setSelectedFile({ name: sample.name, size: "Sample Document" });

    try {
      const parsed = await safeFetchJson("/api/invoice/create-from-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: `Extract and structure this scanned invoice: ${sample.prompt}` })
      });

      const mathResult = calculateInvoiceTotals(parsed.items, parsed.supplierGstin, parsed.customerGstin);

      const finalInvoice: Invoice = {
        id: "inv-" + generateId(),
        invoiceNumber: parsed.invoiceNumber || "INV-001",
        supplierName: parsed.supplierName || "Supplier",
        supplierGstin: parsed.supplierGstin || "",
        supplierAddress: parsed.supplierAddress || "",
        customerName: parsed.customerName || "Customer",
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
        notes: `Extracted via Gemini AI parser.`,
        createdAt: new Date().toISOString()
      };

      onInvoiceCreated(finalInvoice);
      setOcrLoading(false);

    } catch (e: any) {
      console.error("OCR parsing error:", e);
      setOcrError(e.message || "Parsing failed. Please check backend API.");
      setOcrLoading(false);
    }
  };

  const completedInvoicesCount = batchQueue.filter(i => i.status === "completed").length;
  const totalBatchExtractedAmount = batchQueue
    .filter(i => i.status === "completed" && i.extractedInvoice)
    .reduce((sum, i) => sum + (i.extractedInvoice?.totalAmount || 0), 0);

  return (
    <div className="bg-[#111113] rounded-2xl border border-white/5 overflow-hidden" id="creator-workspace">
      {/* Hidden off-screen canvas for camera snaps */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Mode Switcher Tabs */}
      <div className="flex border-b border-white/5 bg-[#0A0A0B]/50" id="creator-mode-tabs">
        <button 
          onClick={() => { setActiveMode("text"); setTextError(null); }}
          className={`flex-1 py-3.5 text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeMode === "text" 
              ? "border-indigo-500 text-indigo-400 bg-[#111113]" 
              : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
          }`}
          id="text-mode-tab"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Prompt Creator</span>
        </button>

        <button 
          onClick={() => { setActiveMode("ocr"); setOcrError(null); }}
          className={`flex-1 py-3.5 text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeMode === "ocr" 
              ? "border-indigo-500 text-indigo-400 bg-[#111113]" 
              : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
          }`}
          id="ocr-mode-tab"
        >
          <Upload className="w-4 h-4 shrink-0" />
          <span>Single OCR</span>
        </button>

        <button 
          onClick={() => { setActiveMode("batch"); setBatchGeneralError(null); }}
          className={`flex-1 py-3.5 text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeMode === "batch" 
              ? "border-indigo-500 text-indigo-400 bg-[#111113]" 
              : "border-transparent text-slate-500 hover:text-slate-300 hover:bg-white/5"
          }`}
          id="batch-mode-tab"
        >
          <Camera className="w-4 h-4 shrink-0" />
          <span className="flex items-center space-x-1.5">
            <span>Batch & Camera Upload</span>
            {batchQueue.length > 0 && (
              <span className="bg-indigo-500 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {batchQueue.length}
              </span>
            )}
          </span>
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

        {/* TAB 2: SINGLE OCR SCANNER */}
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
                accept="image/*,application/pdf"
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

            {/* Sample OCR Scans */}
            <div className="space-y-2.5 border-t border-white/5 pt-5" id="sample-ocr-scans">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
                <ClipboardList className="w-3.5 h-3.5 text-slate-500" />
                <span>Sample Document Prompts (Click to test OCR parsing)</span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="sample-scans-grid">
                {sampleOcrInvoices.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSampleOcr(sample)}
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
                      <span className="text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold">Sample Prompt</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BATCH UPLOAD & LIVE CAMERA SCANNER */}
        {activeMode === "batch" && (
          <div className="space-y-6" id="batch-generator-panel">
            {/* Header & Description */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <h4 className="font-display font-bold text-white text-base flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-indigo-400" />
                  <span>Batch Invoice Upload & Live Camera Scanner</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Capture multiple receipts via live camera or upload several PDF / image invoices simultaneously to batch process into the ledger.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                {!isCameraOpen ? (
                  <button
                    onClick={() => startCamera()}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                    id="open-camera-btn"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Open Live Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={closeCamera}
                    className="bg-rose-600/90 hover:bg-rose-600 text-white font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                    id="close-camera-btn"
                  >
                    <CameraOff className="w-4 h-4" />
                    <span>Close Camera</span>
                  </button>
                )}

                <button
                  onClick={() => batchFileInputRef.current?.click()}
                  className="bg-white/10 hover:bg-white/15 text-slate-200 font-semibold px-3.5 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all cursor-pointer"
                  id="browse-batch-files-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Files</span>
                </button>
              </div>
            </div>

            {/* Hidden File Inputs */}
            <input 
              type="file" 
              ref={batchFileInputRef}
              onChange={handleBatchFileChange}
              multiple
              disabled={isProcessingBatch}
              className="hidden" 
              accept="image/*,application/pdf"
            />
            <input 
              type="file" 
              ref={mobileCameraInputRef}
              onChange={handleBatchFileChange}
              disabled={isProcessingBatch}
              className="hidden" 
              accept="image/*"
              capture="environment"
            />

            {/* Camera Error banner if any */}
            {cameraError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs flex items-start space-x-2 animate-fade-in-up">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">{cameraError}</p>
                  <p className="text-[11px] text-rose-400/80">You can also use the "Add Files" button or Mobile Camera Capture button below.</p>
                </div>
              </div>
            )}

            {/* LIVE CAMERA VIEWFINDER (When Camera is Active) */}
            {isCameraOpen && (
              <div className="bg-[#0A0A0B] border border-indigo-500/30 rounded-2xl p-4 space-y-3 relative overflow-hidden shadow-2xl animate-fade-in-up" id="live-camera-viewfinder">
                {/* Visual Flash Effect on Capture */}
                {cameraFlash && (
                  <div className="absolute inset-0 bg-white/40 z-30 pointer-events-none transition-opacity duration-150" />
                )}

                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-bold text-indigo-400 flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse inline-block"></span>
                    <span>Live Document Scanner Viewfinder</span>
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={toggleCameraFacing}
                      className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-slate-300 text-xs flex items-center space-x-1 transition-all cursor-pointer"
                      title="Switch Camera (Front/Rear)"
                    >
                      <SwitchCamera className="w-3.5 h-3.5" />
                      <span className="text-[10px]">Switch ({cameraFacingMode})</span>
                    </button>
                    <button
                      onClick={closeCamera}
                      className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Video Container with Invoice Frame Overlay */}
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-[360px] flex items-center justify-center">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                  />

                  {/* Document Alignment Frame */}
                  <div className="absolute inset-4 border-2 border-dashed border-indigo-400/60 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                    <div className="flex justify-between text-[10px] font-mono text-indigo-300/80 uppercase font-bold">
                      <span>┌ Top Edge</span>
                      <span>┐</span>
                    </div>
                    <p className="text-center text-[11px] font-medium text-white/70 bg-black/50 py-1 px-3 rounded-full mx-auto backdrop-blur-sm">
                      Align invoice inside border & click Snap Photo
                    </p>
                    <div className="flex justify-between text-[10px] font-mono text-indigo-300/80 uppercase font-bold">
                      <span>└</span>
                      <span>Bottom Edge ┘</span>
                    </div>
                  </div>
                </div>

                {/* Camera Capture Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2">
                  <span className="text-[11px] text-slate-400">
                    Snap multiple documents consecutively — each photo will be queued below.
                  </span>

                  <button
                    onClick={captureCameraPhoto}
                    className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 shadow-lg shadow-emerald-900/30 transition-all transform hover:scale-[1.02] active:scale-95 cursor-pointer"
                    id="snap-photo-btn"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap & Add to Batch Queue</span>
                  </button>
                </div>
              </div>
            )}

            {/* BATCH DROPZONE */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsBatchDragging(true); }}
              onDragLeave={() => setIsBatchDragging(false)}
              onDrop={handleBatchDrop}
              onClick={() => batchFileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 cursor-pointer transition-all ${
                isBatchDragging 
                  ? "border-indigo-500 bg-indigo-500/10" 
                  : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
              id="batch-dropzone"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-indigo-500/10 text-indigo-400 p-3 rounded-2xl border border-indigo-500/10">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Drag & drop multiple invoices here</p>
                  <p className="text-xs text-slate-500">Supports multiple PNG, JPG, or PDF files simultaneously</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                <span className="bg-[#111113] border border-white/10 text-slate-300 px-3 py-1.5 rounded-xl text-xs font-semibold">
                  Browse Files
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); mobileCameraInputRef.current?.click(); }}
                  className="bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Mobile Camera Upload</span>
                </button>
              </div>
            </div>

            {/* General Batch Error Banner */}
            {batchGeneralError && (
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3.5 rounded-xl text-xs flex items-start space-x-2 animate-fade-in-up">
                <AlertCircle className="w-4.5 h-4.5 text-rose-400 shrink-0 mt-0.5" />
                <span>{batchGeneralError}</span>
              </div>
            )}

            {/* BATCH QUEUE SECTION */}
            {batchQueue.length > 0 && (
              <div className="space-y-4 border-t border-white/5 pt-5" id="batch-queue-container">
                {/* Batch Queue Header & Stats */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h5 className="font-bold text-white text-sm flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>Queued Invoices ({batchQueue.length} items)</span>
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      {completedInvoicesCount} of {batchQueue.length} extracted successfully
                      {completedInvoicesCount > 0 && ` (Total Value: ${formatRupees(totalBatchExtractedAmount)})`}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={clearBatchQueue}
                      disabled={isProcessingBatch}
                      className="text-xs text-rose-400 hover:text-rose-300 disabled:opacity-50 px-2.5 py-1.5 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                      Clear Queue
                    </button>

                    <button
                      onClick={processBatchQueue}
                      disabled={isProcessingBatch || batchQueue.every(i => i.status === "completed")}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-white/10 disabled:text-slate-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition-all shadow-sm cursor-pointer"
                      id="process-batch-btn"
                    >
                      {isProcessingBatch ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Processing Batch...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Process All with Gemini AI ({batchQueue.filter(i => i.status !== "completed").length})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Progress Bar (During Batch Extraction) */}
                {isProcessingBatch && (
                  <div className="bg-[#18181b] border border-indigo-500/20 p-3.5 rounded-xl space-y-2 animate-fade-in-up">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-indigo-400 font-semibold flex items-center space-x-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>{batchProgress.stage}</span>
                      </span>
                      <span className="font-mono text-slate-300">
                        {batchProgress.current} / {batchProgress.total} ({Math.round((batchProgress.current / batchProgress.total) * 100)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                        style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Queue Items List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="batch-queue-grid">
                  {batchQueue.map((item, index) => (
                    <div 
                      key={item.id}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between space-x-3 ${
                        item.status === "completed"
                          ? "bg-emerald-950/20 border-emerald-500/30"
                          : item.status === "error"
                          ? "bg-rose-950/20 border-rose-500/30"
                          : item.status === "processing"
                          ? "bg-indigo-950/20 border-indigo-500/40 animate-pulse"
                          : "bg-white/5 border-white/5 hover:border-white/10"
                      }`}
                    >
                      {/* Left: Thumbnail & Info */}
                      <div className="flex items-center space-x-3 min-w-0">
                        <div className="w-12 h-12 rounded-lg bg-black/40 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                          {item.previewUrl ? (
                            <img src={item.previewUrl} alt="Preview" className="w-full h-full object-cover" />
                          ) : (
                            <FileText className="w-6 h-6 text-indigo-400" />
                          )}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <p className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-[220px]">
                            {item.fileName}
                          </p>
                          <div className="flex items-center space-x-2 text-[10px] text-slate-400">
                            <span>{item.fileSize}</span>
                            <span>•</span>
                            <span className="flex items-center space-x-1">
                              {item.source === "camera" ? (
                                <>
                                  <Camera className="w-3 h-3 text-emerald-400" />
                                  <span>Camera</span>
                                </>
                              ) : (
                                <>
                                  <Upload className="w-3 h-3 text-indigo-400" />
                                  <span>Upload</span>
                                </>
                              )}
                            </span>
                          </div>

                          {/* Status / Extracted Details */}
                          {item.status === "completed" && item.extractedInvoice && (
                            <p className="text-[11px] font-semibold text-emerald-400 font-mono flex items-center space-x-1">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              <span>{item.extractedInvoice.invoiceNumber} • {formatRupees(item.extractedInvoice.totalAmount)}</span>
                            </p>
                          )}

                          {item.status === "error" && (
                            <p className="text-[10px] font-semibold text-rose-400 truncate max-w-[200px]">
                              {item.errorMessage || "Extraction failed"}
                            </p>
                          )}

                          {item.status === "processing" && (
                            <p className="text-[10px] font-semibold text-indigo-400 flex items-center space-x-1">
                              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                              <span>Gemini OCR extracting...</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="shrink-0 flex items-center space-x-1">
                        {item.status === "pending" && (
                          <span className="text-[10px] bg-white/5 border border-white/10 text-slate-400 px-2 py-0.5 rounded font-bold">
                            Ready
                          </span>
                        )}

                        {!isProcessingBatch && (
                          <button
                            onClick={() => removeBatchItem(item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                            title="Remove from batch"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Batch Action Summary Bar (When items are completed) */}
                {completedInvoicesCount > 0 && (
                  <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in-up" id="batch-commit-bar">
                    <div className="space-y-0.5 text-center sm:text-left">
                      <div className="flex items-center space-x-1.5 text-emerald-400 font-bold text-sm">
                        <FileCheck2 className="w-4.5 h-4.5" />
                        <span>{completedInvoicesCount} Invoices Ready to Save</span>
                      </div>
                      <p className="text-xs text-slate-300 font-mono">
                        Total Extracted Value: <b className="text-emerald-400">{formatRupees(totalBatchExtractedAmount)}</b>
                      </p>
                    </div>

                    <button
                      onClick={commitBatchToLedger}
                      className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition-all shadow-md cursor-pointer hover:scale-[1.02]"
                      id="commit-batch-to-ledger-btn"
                    >
                      <span>Save All to Enterprise Ledger</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
