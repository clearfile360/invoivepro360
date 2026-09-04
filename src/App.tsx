import React, { useState, useEffect } from "react";
import { Invoice, ChatMessage, CompanySettings } from "./types";
import DashboardOverview from "./components/DashboardOverview";
import InvoiceList from "./components/InvoiceList";
import InvoiceCreator from "./components/InvoiceCreator";
import InvoiceViewer from "./components/InvoiceViewer";
import InvoiceChat from "./components/InvoiceChat";
import CompanySettingsComponent from "./components/CompanySettings";
import RecordPaymentModal from "./components/RecordPaymentModal";
import { 
  BarChart3, 
  FileSpreadsheet, 
  Sparkles, 
  Bot, 
  FileCheck2, 
  Lock, 
  LogOut, 
  ShieldCheck, 
  Cloud, 
  Loader2, 
  User, 
  Settings,
  AlertCircle
} from "lucide-react";
import { 
  supabase,
  SupabaseUser,
  signInWithGoogle,
  signOut,
  getSession,
  fetchUserProfile,
  saveUserProfile,
  fetchUserInvoices,
  createInvoiceInDb,
  updateInvoiceInDb,
  deleteInvoiceFromDb,
  isSupabaseConfigured
} from "./lib/supabase";

// High-fidelity Google logo vector icon
const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-2 shrink-0" viewBox="0 0 24 24" fill="currentColor">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
  </svg>
);

export default function App() {
  // Tabs: "dashboard" | "ledger" | "ai-creator" | "copilot" | "settings"
  const [activeTab, setActiveTab] = useState<"dashboard" | "ledger" | "ai-creator" | "copilot" | "settings">("dashboard");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  
  const [recordingPaymentInvoice, setRecordingPaymentInvoice] = useState<Invoice | null>(null);
  
  // Cross-component communication states
  const [ledgerSearchQuery, setLedgerSearchQuery] = useState("");
  
  // Company Profile Settings State
  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: "Unikorn360 AI Solutions",
    address: "Suite 101, Tech Park Alpha, Nagpur, Maharashtra, 440028",
    gstin: "27AABCU1234A1Z8",
    logoType: "url",
    logoIcon: "Sparkles",
    logoColor: "indigo",
    logoUrl: "/logo.svg",
    logoInitials: "U360"
  });

  // Chat memory persistence
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      text: "👋 Hello! I am **InvoicePro 360 AI Assistant**.\n\nI have complete secure visibility over all your current invoices in this ledger session. Ask me anything!\n\nExamples:\n- *'Show invoices above ₹50,000'*\n- *'Find duplicate invoices'*\n- *'Who is our top vendor?'*\n- *'Show invoices from Delhi Retailers'*",
      createdAt: new Date().toISOString()
    }
  ]);

  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Custom Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    onConfirm: () => void;
  } | null>(null);

  // Load user data from Supabase PostgreSQL (isolated by user_id)
  const loadUserData = async (user: SupabaseUser) => {
    try {
      // 1. Fetch Company Settings
      const profile = await fetchUserProfile(user.id);
      if (profile && profile.companySettings) {
        setCompanySettings(profile.companySettings);
      }

      // 2. Fetch Invoices from Supabase
      const userInvoices = await fetchUserInvoices(user.id);
      setInvoices(userInvoices);
    } catch (error) {
      console.error("Error loading user data from Supabase:", error);
    }
  };

  // Monitor Supabase Auth State and Sessions
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      setAuthLoading(true);
      setAuthError(null);

      try {
        const session = await getSession();
        if (!isMounted) return;

        if (session && session.user) {
          setCurrentUser(session.user);
          await loadUserData(session.user);
        } else {
          setCurrentUser(null);
          setInvoices([]);
        }
      } catch (err) {
        console.error("Auth initialization error:", err);
        if (isMounted) {
          setCurrentUser(null);
          setInvoices([]);
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for real-time Auth state changes from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === "SIGNED_IN" || (event === "INITIAL_SESSION" && session?.user)) {
        if (session?.user) {
          setCurrentUser(session.user);
          await loadUserData(session.user);
        }
      } else if (event === "SIGNED_OUT") {
        setCurrentUser(null);
        setInvoices([]);
        setSelectedInvoice(null);
      }
      setAuthLoading(false);
      setAuthSubmitting(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSaveCompanySettings = async (updatedSettings: CompanySettings) => {
    if (currentUser) {
      try {
        await saveUserProfile(currentUser, updatedSettings);
      } catch (err) {
        console.error("Error saving company settings to Supabase:", err);
      }
    }
    setCompanySettings(updatedSettings);
  };

  // Sign In with Google via Supabase OAuth
  const handleGoogleLogin = async () => {
    setAuthSubmitting(true);
    setAuthError(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        console.error("Google sign in failed:", error);
        setAuthError(error.message || "Unable to sign in with Google. Please try again.");
        setAuthSubmitting(false);
      }
    } catch (err: any) {
      console.error("Google sign in exception:", err);
      setAuthError(err.message || "Unable to sign in with Google. Please check your network and configuration.");
      setAuthSubmitting(false);
    }
  };

  // Log out of Supabase session
  const handleLogout = () => {
    setConfirmDialog({
      isOpen: true,
      title: "Sign Out",
      message: "Are you sure you want to sign out of your secure enterprise ledger session?",
      confirmText: "Sign Out",
      onConfirm: async () => {
        setAuthLoading(true);
        try {
          await signOut();
          setCurrentUser(null);
          setInvoices([]);
          setSelectedInvoice(null);
        } catch (err) {
          console.error("Logout error:", err);
        } finally {
          setAuthLoading(false);
          setConfirmDialog(null);
        }
      }
    });
  };

  // Add a freshly generated invoice
  const handleInvoiceCreated = async (newInvoice: Invoice) => {
    if (!currentUser) return;

    try {
      const created = await createInvoiceInDb(newInvoice, currentUser.id);
      const updated = [created, ...invoices.filter(i => i.id !== created.id)];
      setInvoices(updated);
      setSelectedInvoice(created);
      setActiveTab("ledger");
    } catch (err) {
      console.error("Error creating invoice in Supabase:", err);
      const fallbackWithUser = { ...newInvoice, userId: currentUser.id };
      setInvoices([fallbackWithUser, ...invoices]);
      setSelectedInvoice(fallbackWithUser);
      setActiveTab("ledger");
    }
  };

  // Update an existing invoice (e.g. after editing, math correction, or payment)
  const handleUpdateInvoice = async (updatedInvoice: Invoice) => {
    if (!currentUser) return;

    try {
      const saved = await updateInvoiceInDb(updatedInvoice, currentUser.id);
      const updated = invoices.map(inv => inv.id === saved.id ? saved : inv);
      setInvoices(updated);
      setSelectedInvoice(saved);
    } catch (err) {
      console.error("Error updating invoice in Supabase:", err);
      const updated = invoices.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv);
      setInvoices(updated);
      setSelectedInvoice(updatedInvoice);
    }
  };

  // Delete invoice
  const handleDeleteInvoice = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Invoice Record",
      message: "Are you sure you want to delete this invoice record from your ledger? This action cannot be undone.",
      confirmText: "Delete Permanently",
      onConfirm: async () => {
        if (currentUser) {
          try {
            await deleteInvoiceFromDb(id, currentUser.id);
          } catch (err) {
            console.error("Error deleting invoice from Supabase:", err);
          }
        }
        
        const updated = invoices.filter(inv => inv.id !== id);
        setInvoices(updated);
        if (selectedInvoice?.id === id) {
          setSelectedInvoice(null);
        }
        setConfirmDialog(null);
      }
    });
  };

  // Triggered when the AI chatbot suggests a filter or highlight
  const handleApplyChatFilter = (query: string) => {
    setLedgerSearchQuery(query);
    setActiveTab("ledger");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-slate-300 flex flex-col items-center justify-center space-y-4" id="app-auth-loading">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-400 font-bold tracking-wide">Initializing secure enterprise ledger workspace...</p>
      </div>
    );
  }

  // Unauthenticated: Show strict Google OAuth login page (zero bypass, zero demo mode)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-slate-300 flex flex-col justify-between p-6 sm:p-12 relative overflow-hidden" id="app-login-screen">
        {/* Decorative ambient gradient blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 rounded-full blur-[120px]" />

        <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col justify-center py-12 space-y-10 z-10">
          {/* Logo Brand Header */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="bg-indigo-600 text-white p-3.5 rounded-2xl flex items-center justify-center font-bold shadow-lg shadow-indigo-600/20 ring-1 ring-white/10">
              <FileCheck2 className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h1 className="font-display font-black text-white text-3xl sm:text-4xl tracking-tight flex items-center justify-center space-x-2">
                <span>InvoicePro 360</span>
                <span className="text-xs bg-indigo-500/10 text-indigo-400 px-3 py-1 rounded-full font-bold border border-indigo-500/20">AI Workspace v1</span>
              </h1>
              <p className="text-sm text-slate-400 max-w-lg font-medium leading-relaxed">
                The secure AI Hub to create, extract, validate, audit, and converse with business invoices, powered by <span className="text-indigo-400 font-semibold">Unikorn360 AI Solutions</span>.
              </p>
            </div>
          </div>

          {/* Main Visual Box / Features Bento */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-stretch">
            {/* Left Column: Feature Highlights */}
            <div className="md:col-span-3 bg-[#111113] border border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-[10px] uppercase font-black text-indigo-400 tracking-wider bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20 inline-block">
                  Enterprise Capabilities
                </span>
                <h3 className="font-display font-bold text-white text-lg sm:text-xl">
                  Automate and secure your bookkeeping workflow
                </h3>
              </div>

              <div className="space-y-4 text-xs">
                <div className="flex items-start space-x-3.5">
                  <div className="bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-0.5">Instant AI Creator</h4>
                    <p className="text-slate-400 leading-relaxed">Draft professional tax invoices and extract detailed item lists automatically via Gemini AI.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-0.5">Automated Compliance Auditor</h4>
                    <p className="text-slate-400 leading-relaxed">Check GSTIN formats, HSN compliance, and state-wise SGST/CGST/IGST tax breakdowns instantly.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3.5">
                  <div className="bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-0.5">AI Ledger Copilot</h4>
                    <p className="text-slate-400 leading-relaxed">Query duplicates, analyze monthly spending, and filter complex vendor states via plain English dialogue.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center space-x-2 text-[10px] text-slate-500 font-medium">
                <Lock className="w-3.5 h-3.5" />
                <span>Row Level Security (RLS) PostgreSQL Storage Isolation</span>
              </div>
            </div>

            {/* Right Column: Google Sign In Gateway */}
            <div className="md:col-span-2 bg-[#111113] border border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col justify-center text-center space-y-6">
              <div className="space-y-1.5">
                <h3 className="font-display font-bold text-white text-base">Sign in to continue</h3>
                <p className="text-xs text-slate-400">Sign in with your Google account to access your secure ledger workspace.</p>
              </div>

              {authError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl font-medium leading-relaxed flex items-start space-x-2 text-left" id="auth-error-banner">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              {!isSupabaseConfigured && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-3 rounded-xl font-medium leading-relaxed text-left space-y-1.5">
                  <div className="flex items-center space-x-1.5 font-bold text-amber-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Supabase Configuration Required</span>
                  </div>
                  <p className="text-[11px] text-amber-200/80">
                    Please set <code className="font-mono bg-amber-950/60 px-1 py-0.5 rounded text-[10px]">VITE_SUPABASE_URL</code> and <code className="font-mono bg-amber-950/60 px-1 py-0.5 rounded text-[10px]">VITE_SUPABASE_ANON_KEY</code> in your environment or <code className="font-mono bg-amber-950/60 px-1 py-0.5 rounded text-[10px]">.env</code> file. Refer to <code className="font-mono text-amber-300">SUPABASE_SETUP.md</code> for setup instructions.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {/* Official Google Sign-In Button */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={authSubmitting}
                  className="w-full bg-white hover:bg-slate-100 disabled:opacity-75 disabled:cursor-not-allowed text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center shadow-lg transition-all cursor-pointer text-xs transform hover:scale-[1.01] active:scale-[0.99]"
                  id="login-google-btn"
                >
                  {authSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-indigo-600" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon />
                      <span>Continue with Google</span>
                    </>
                  )}
                </button>

                <p className="text-[10px] text-slate-500 font-medium">
                  Secure authentication powered by Google OAuth & Supabase Auth
                </p>
              </div>

              <div className="pt-2 border-t border-white/5 text-[10px] text-slate-500 leading-relaxed">
                By continuing, your data is securely isolated using Supabase PostgreSQL Row Level Security.
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-600 font-medium">
          InvoicePro 360 • A Product of <span className="text-slate-500 font-bold">Unikorn360 AI Solutions</span> • Powered by Gemini & Supabase PostgreSQL
        </div>
      </div>
    );
  }

  const userAvatar = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture;
  const userFullName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split("@")[0] || "User";

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-300 flex flex-col justify-between" id="app-wrapper">
      <div>
        {/* Elite Navigation Header */}
        <header className="bg-[#111113] border-b border-white/5 sticky top-0 z-40" id="app-header">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="bg-indigo-600 text-white p-2 rounded-xl flex items-center justify-center font-bold">
                <FileCheck2 className="w-5.5 h-5.5" />
              </div>
              <div>
                <h1 className="font-display font-black text-white text-lg tracking-tight flex items-center space-x-1.5">
                  <span>InvoicePro 360</span>
                  <span className="text-xs bg-white/5 text-indigo-400 px-2 py-0.5 rounded-full font-bold border border-white/5">AI Workspace v1</span>
                </h1>
                <p className="text-[10px] text-slate-400 font-medium flex items-center space-x-1.5">
                  <span className="text-indigo-400 font-bold">Unikorn360 AI Solutions</span>
                  <span className="text-slate-600">•</span>
                  <span>Create • Scan • Extract • Validate • Automate</span>
                </p>
              </div>
            </div>

            {/* Authenticated User Header Controls */}
            <div className="flex items-center space-x-3" id="auth-header-controls">
              <div className="flex items-center space-x-3">
                <div className="hidden md:flex flex-col items-end text-right">
                  <span className="text-xs font-bold text-white block leading-none">{userFullName}</span>
                  <span className="text-[10px] text-indigo-400 font-semibold flex items-center space-x-1 mt-1">
                    <Cloud className="w-3 h-3" />
                    <span>Supabase Cloud Sync Active</span>
                  </span>
                </div>
                
                {userAvatar ? (
                  <img 
                    src={userAvatar} 
                    alt="Avatar" 
                    className="w-8 h-8 rounded-full border border-indigo-500/30 object-cover shadow-sm" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/30 font-bold text-xs shadow-sm">
                    <User className="w-4 h-4" />
                  </div>
                )}

                <button
                  onClick={handleLogout}
                  className="p-2 hover:bg-white/5 text-slate-400 hover:text-rose-400 rounded-xl transition-colors cursor-pointer"
                  title="Sign Out"
                  id="sign-out-button"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Workspace Container */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          {/* Main Controls - Workspace Navigation */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-4" id="tab-controls-row">
            <div className="flex bg-[#111113] border border-white/5 p-1 rounded-2xl" id="tab-nav-wrapper">
              <button 
                onClick={() => setActiveTab("dashboard")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === "dashboard" 
                    ? "bg-white/10 text-white border border-white/5 shadow-sm" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                id="tab-dashboard"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Executive Analytics</span>
              </button>

              <button 
                onClick={() => setActiveTab("ledger")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === "ledger" 
                    ? "bg-white/10 text-white border border-white/5 shadow-sm" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                id="tab-ledger"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Invoices Ledger</span>
              </button>

              <button 
                onClick={() => setActiveTab("ai-creator")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === "ai-creator" 
                    ? "bg-white/10 text-white border border-white/5 shadow-sm" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                id="tab-creator"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>AI Creator Workspace</span>
              </button>

              <button 
                onClick={() => setActiveTab("copilot")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === "copilot" 
                    ? "bg-white/10 text-white border border-white/5 shadow-sm" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                id="tab-copilot"
              >
                <Bot className="w-3.5 h-3.5" />
                <span>AI Chat Copilot</span>
              </button>

              <button 
                onClick={() => setActiveTab("settings")}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                  activeTab === "settings" 
                    ? "bg-white/10 text-white border border-white/5 shadow-sm" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
                id="tab-settings"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-400" />
                <span>Company Settings</span>
              </button>
            </div>

            {/* Invoices Count / Limits indicator */}
            <div className="flex items-center space-x-3 text-xs bg-[#111113] border border-white/5 p-2.5 rounded-xl" id="tier-limits-widget">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-300 block text-[10px]">ENTERPRISE PLAN: <b className="text-indigo-400">UNLIMITED</b></span>
                <span className="text-slate-500 font-medium tracking-tight block">Active Invoices: <b>{invoices.length}</b></span>
              </div>
            </div>
          </div>

          {/* ACTIVE PANELS SWITCHBOARD */}
          <div className="animate-fade-in-up" key={activeTab} id="active-tab-panel">
            {activeTab === "dashboard" && (
              <DashboardOverview 
                invoices={invoices} 
                onSelectInvoice={(inv) => setSelectedInvoice(inv)}
                onRecordPayment={(inv) => setRecordingPaymentInvoice(inv)}
              />
            )}

            {activeTab === "ledger" && (
              <InvoiceList 
                invoices={invoices} 
                onSelectInvoice={(inv) => setSelectedInvoice(inv)} 
                onDeleteInvoice={handleDeleteInvoice}
                onOpenCreateModal={() => setActiveTab("ai-creator")}
                searchFilter={ledgerSearchQuery}
                onRecordPayment={(inv) => setRecordingPaymentInvoice(inv)}
              />
            )}

            {activeTab === "ai-creator" && (
              <InvoiceCreator 
                onInvoiceCreated={handleInvoiceCreated}
                onClose={() => setActiveTab("ledger")}
                companySettings={companySettings}
              />
            )}

            {activeTab === "copilot" && (
              <InvoiceChat 
                invoices={invoices}
                onApplyFilter={handleApplyChatFilter}
                messages={chatMessages}
                setMessages={setChatMessages}
              />
            )}

            {activeTab === "settings" && (
              <CompanySettingsComponent 
                settings={companySettings}
                onSave={handleSaveCompanySettings}
              />
            )}
          </div>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-[#111113] text-slate-500 py-6 text-xs border-t border-white/5 mt-12" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-display font-extrabold text-white tracking-tight text-sm">InvoicePro AI</span>
            <span className="text-slate-700 font-bold">|</span>
            <span className="text-slate-400">Developed by <strong className="text-slate-300 font-semibold">Unikorn360 AI Solutions</strong></span>
          </div>
          <div className="flex items-center space-x-4 font-semibold text-slate-500">
            <span>GST Audit Ready</span>
            <span>•</span>
            <span>Supabase PostgreSQL + RLS</span>
            <span>•</span>
            <span>Cloud Synchronized</span>
          </div>
        </div>
      </footer>

      {/* FLOATING EXPANDED DETAILS / PRINT DIALOG COMPONENT */}
      {selectedInvoice && (
        <InvoiceViewer 
          invoice={selectedInvoice}
          allInvoices={invoices}
          onClose={() => setSelectedInvoice(null)}
          onUpdateInvoice={handleUpdateInvoice}
          companySettings={companySettings}
          onDeleteInvoice={handleDeleteInvoice}
          onRecordPayment={(inv) => setRecordingPaymentInvoice(inv)}
        />
      )}

      {/* RECORD PAYMENT MODAL */}
      {recordingPaymentInvoice && (
        <RecordPaymentModal 
          invoice={recordingPaymentInvoice}
          onClose={() => setRecordingPaymentInvoice(null)}
          onSavePayment={(updatedInvoice) => {
            handleUpdateInvoice(updatedInvoice);
            setRecordingPaymentInvoice(null);
          }}
        />
      )}

      {/* CUSTOM CONFIRMATION DIALOG */}
      {confirmDialog && confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-fade-in" id="confirm-modal-overlay">
          <div className="bg-[#111113] border border-white/10 rounded-2xl p-6 max-w-sm w-full space-y-6 shadow-2xl animate-scale-in" id="confirm-modal-box">
            <div className="space-y-2 text-center">
              <h3 className="text-base font-bold text-white font-display">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{confirmDialog.message}</p>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 text-slate-300 font-bold py-2 rounded-xl text-xs transition-all cursor-pointer"
                id="confirm-modal-cancel"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-rose-600/10"
                id="confirm-modal-action"
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
