import React, { useState } from "react";
import { 
  Building2, 
  MapPin, 
  CreditCard, 
  Sparkles, 
  Brain, 
  Cpu, 
  Layers, 
  Briefcase, 
  ShieldCheck, 
  Activity, 
  Flame, 
  Globe, 
  Infinity as InfinityIcon, 
  Pocket,
  Save,
  CheckCircle2,
  RefreshCw,
  Image as ImageIcon
} from "lucide-react";
import { CompanySettings } from "../types";
import { isValidGstin } from "../utils/invoiceUtils";

// Map of icons for brand selection
export const logoIconsMap: Record<string, React.ComponentType<any>> = {
  Sparkles,
  Brain,
  Cpu,
  Layers,
  Briefcase,
  Building2,
  ShieldCheck,
  Activity,
  Flame,
  Globe,
  Infinity: InfinityIcon,
  Pocket
};

// Map of colors for brand selection
export const logoColorsMap: Record<string, { bg: string; border: string; text: string; rawHex: string; ring: string; focus: string }> = {
  indigo: { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400", rawHex: "#4F46E5", ring: "ring-indigo-500", focus: "focus:ring-indigo-500/30" },
  emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400", rawHex: "#10B981", ring: "ring-emerald-500", focus: "focus:ring-emerald-500/30" },
  amber: { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", rawHex: "#F59E0B", ring: "ring-amber-500", focus: "focus:ring-amber-500/30" },
  rose: { bg: "bg-rose-500/10", border: "border-rose-500/20", text: "text-rose-400", rawHex: "#F43F5E", ring: "ring-rose-500", focus: "focus:ring-rose-500/30" },
  cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/20", text: "text-cyan-400", rawHex: "#06B6D4", ring: "ring-cyan-500", focus: "focus:ring-cyan-500/30" },
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", rawHex: "#8B5CF6", ring: "ring-purple-500", focus: "focus:ring-purple-500/30" },
};

interface CompanySettingsProps {
  settings: CompanySettings;
  onSave: (updatedSettings: CompanySettings) => Promise<void>;
  loading?: boolean;
}

export default function CompanySettingsComponent({ settings, onSave, loading = false }: CompanySettingsProps) {
  const [name, setName] = useState(settings.name);
  const [address, setAddress] = useState(settings.address);
  const [gstin, setGstin] = useState(settings.gstin);
  const [logoType, setLogoType] = useState<"icon" | "url" | "initials">(settings.logoType);
  const [logoIcon, setLogoIcon] = useState(settings.logoIcon);
  const [logoColor, setLogoColor] = useState(settings.logoColor);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [logoInitials, setLogoInitials] = useState(settings.logoInitials);
  
  const [validationSuccess, setValidationSuccess] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savingState, setSavingState] = useState(false);

  // Default preset for Unikorn360 AI Solutions
  const handleResetToParentCompany = () => {
    setName("Unikorn360 AI Solutions");
    setAddress("Suite 101, Tech Park Alpha, Nagpur, Maharashtra, 440028");
    setGstin("27AABCU1234A1Z8");
    setLogoType("url");
    setLogoIcon("Sparkles");
    setLogoColor("indigo");
    setLogoInitials("U360");
    setLogoUrl("/logo.svg");
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setValidationSuccess(null);

    if (!name.trim()) {
      setValidationError("Business name is required.");
      return;
    }

    if (gstin && !isValidGstin(gstin)) {
      setValidationError("Please enter a valid 15-character GSTIN format (e.g. 27AAPCS1030F1Z4).");
      return;
    }

    setSavingState(true);
    try {
      await onSave({
        name: name.trim(),
        address: address.trim(),
        gstin: gstin.trim().toUpperCase(),
        logoType,
        logoIcon,
        logoColor,
        logoUrl: logoUrl.trim(),
        logoInitials: logoInitials.trim().substring(0, 5)
      });
      setValidationSuccess("Business settings updated successfully and synced with secure cloud.");
      setTimeout(() => setValidationSuccess(null), 4000);
    } catch (err: any) {
      setValidationError(err.message || "Failed to update business settings.");
    } finally {
      setSavingState(false);
    }
  };

  // Resolve active logo view for Preview Card
  const renderLogoPreview = () => {
    if (logoType === "url" && logoUrl) {
      return (
        <img 
          src={logoUrl} 
          alt="Brand Logo" 
          className="w-16 h-16 rounded-xl object-contain border border-white/10 bg-white/5 p-1"
          onError={(e) => {
            // fallback
            (e.target as HTMLImageElement).style.display = "none";
          }}
          referrerPolicy="no-referrer"
        />
      );
    }

    if (logoType === "initials" && logoInitials) {
      const activeColorConf = logoColorsMap[logoColor] || logoColorsMap.indigo;
      return (
        <div className={`w-16 h-16 rounded-xl ${activeColorConf.bg} border ${activeColorConf.border} ${activeColorConf.text} flex items-center justify-center font-extrabold text-xl tracking-tight shadow-md`}>
          {logoInitials}
        </div>
      );
    }

    // Default: Icon mode
    const IconComponent = logoIconsMap[logoIcon] || Sparkles;
    const activeColorConf = logoColorsMap[logoColor] || logoColorsMap.indigo;
    return (
      <div className={`w-16 h-16 rounded-xl ${activeColorConf.bg} border ${activeColorConf.border} ${activeColorConf.text} flex items-center justify-center shadow-lg transition-all`}>
        <IconComponent className="w-8 h-8" />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="company-settings-panel">
      {/* LEFT FORM */}
      <div className="lg:col-span-7 bg-[#111113] border border-white/5 rounded-2xl p-6 space-y-6 shadow-xl relative" id="settings-form-wrapper">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-white font-display">Business Profile Settings</h2>
            <p className="text-xs text-slate-400">Configure your parent company identity, addresses, tax registry & logos.</p>
          </div>
          
          <button
            type="button"
            onClick={handleResetToParentCompany}
            className="text-[10px] bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold px-3 py-1.5 rounded-lg border border-indigo-500/20 flex items-center space-x-1 transition-all cursor-pointer"
            id="reset-unikorn-btn"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Preset Unikorn360</span>
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-5">
          {/* Business Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">Legal / Trade Business Name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Unikorn360 AI Solutions"
                className="w-full bg-[#161618] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium transition-all"
                id="settings-business-name"
              />
            </div>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">Registered Office Address</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Full billing address, including state & pincode..."
                rows={3}
                className="w-full bg-[#161618] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-medium transition-all resize-none"
                id="settings-business-address"
              />
            </div>
          </div>

          {/* GSTIN */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">GSTIN Register Number (Optional)</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-3.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value.toUpperCase())}
                placeholder="15-character Alphanumeric format, e.g. 27AABCU1234A1Z8"
                maxLength={15}
                className="w-full bg-[#161618] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-mono font-bold transition-all"
                id="settings-business-gstin"
              />
            </div>
            {gstin && !isValidGstin(gstin) && (
              <p className="text-[10px] text-amber-400 font-semibold italic">
                Note: GSTIN is partially complete or doesn't match standard Indian GST format yet.
              </p>
            )}
          </div>

          {/* Logo configuration */}
          <div className="border-t border-white/5 pt-4 space-y-4">
            <p className="text-xs font-bold text-white uppercase tracking-wider text-slate-500">Corporate Branding & Logo</p>
            
            {/* Logo type selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setLogoType("icon")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  logoType === "icon" 
                    ? "bg-indigo-600 border-indigo-400/20 text-white shadow-md shadow-indigo-600/10" 
                    : "bg-[#161618] border-white/5 text-slate-400 hover:text-white"
                }`}
                id="settings-logo-type-icon"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Vector Icon</span>
              </button>

              <button
                type="button"
                onClick={() => setLogoType("initials")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  logoType === "initials" 
                    ? "bg-indigo-600 border-indigo-400/20 text-white shadow-md shadow-indigo-600/10" 
                    : "bg-[#161618] border-white/5 text-slate-400 hover:text-white"
                }`}
                id="settings-logo-type-initials"
              >
                <span className="font-mono text-xs font-black">Aa</span>
                <span>Initials Text</span>
              </button>

              <button
                type="button"
                onClick={() => setLogoType("url")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  logoType === "url" 
                    ? "bg-indigo-600 border-indigo-400/20 text-white shadow-md shadow-indigo-600/10" 
                    : "bg-[#161618] border-white/5 text-slate-400 hover:text-white"
                }`}
                id="settings-logo-type-url"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Image URL</span>
              </button>
            </div>

            {/* Sub fields depending on logo type */}
            {logoType === "icon" && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 block">Select Icon Symbol</label>
                <div className="grid grid-cols-6 gap-2 bg-[#161618] p-3 rounded-xl border border-white/5">
                  {Object.keys(logoIconsMap).map((iconName) => {
                    const Component = logoIconsMap[iconName];
                    const isActive = logoIcon === iconName;
                    return (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => setLogoIcon(iconName)}
                        className={`p-2.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer ${
                          isActive 
                            ? "bg-indigo-500/10 border-indigo-500 text-indigo-400 scale-105" 
                            : "border-white/5 text-slate-500 hover:text-slate-300 hover:bg-white/5"
                        }`}
                        title={iconName}
                      >
                        <Component className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {logoType === "initials" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 block">Brand Initials (Max 4 chars)</label>
                <input
                  type="text"
                  value={logoInitials}
                  onChange={(e) => setLogoInitials(e.target.value.substring(0, 4))}
                  placeholder="e.g. U360"
                  className="w-full bg-[#161618] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold tracking-widest uppercase"
                  id="settings-logo-initials-input"
                />
              </div>
            )}

            {logoType === "url" && (
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 block">Logo Image URL</label>
                <input
                  type="text"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png or /logo.svg"
                  className="w-full bg-[#161618] border border-white/10 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  id="settings-logo-url-input"
                />
                
                <div className="flex items-center space-x-2 pt-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Preset Logos:</span>
                  <button
                    type="button"
                    onClick={() => setLogoUrl("/logo.svg")}
                    className="text-[10px] bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer"
                  >
                    Unikorn360 Primary (/logo.svg)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoUrl("/unikorn360_logo.svg")}
                    className="text-[10px] bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer"
                  >
                    Unikorn360 Badge (/unikorn360_logo.svg)
                  </button>
                </div>
              </div>
            )}

            {/* Brand Color selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 block">Select Brand Theme Color</label>
              <div className="flex items-center space-x-3 bg-[#161618] p-3 rounded-xl border border-white/5">
                {Object.keys(logoColorsMap).map((colorKey) => {
                  const conf = logoColorsMap[colorKey];
                  const isActive = logoColor === colorKey;
                  return (
                    <button
                      key={colorKey}
                      type="button"
                      onClick={() => setLogoColor(colorKey)}
                      className={`w-7 h-7 rounded-full transition-transform ring-offset-2 ring-offset-[#161618] relative cursor-pointer hover:scale-110 ${
                        isActive ? "ring-2 " + conf.ring : "opacity-75"
                      }`}
                      style={{ backgroundColor: conf.rawHex }}
                      title={colorKey}
                    />
                  );
                })}
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-2">
                  {logoColor} Theme
                </span>
              </div>
            </div>
          </div>

          {/* Errors / Success Status */}
          {validationError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl p-3.5 text-xs font-medium leading-relaxed flex items-center space-x-2 animate-fade-in">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>{validationError}</span>
            </div>
          )}

          {validationSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3.5 text-xs font-semibold leading-relaxed flex items-center space-x-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{validationSuccess}</span>
            </div>
          )}

          {/* Form Submit Footer */}
          <div className="border-t border-white/5 pt-4 flex justify-end">
            <button
              type="submit"
              disabled={savingState || loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-600/50 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition-all flex items-center space-x-2 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95 disabled:pointer-events-none"
              id="settings-save-button"
            >
              {savingState ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Synchronizing...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Corporate Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* RIGHT PREVIEW */}
      <div className="lg:col-span-5 flex flex-col justify-between" id="settings-preview-wrapper">
        <div className="bg-[#111113] border border-white/5 rounded-2xl p-6 shadow-xl space-y-6 flex-1 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-white/5 pb-3">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Business Card Live Preview</h3>
            </div>

            {/* Profile Card layout */}
            <div className="bg-gradient-to-br from-[#161618] to-[#121214] border border-white/10 rounded-2xl p-6 relative overflow-hidden shadow-inner flex flex-col justify-between h-56">
              {/* background design circles */}
              <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-indigo-500/5 blur-xl pointer-events-none" />

              <div className="flex justify-between items-start">
                <div className="space-y-2">
                  <h4 className="text-lg font-extrabold text-white font-display leading-tight tracking-tight">
                    {name || "Your Business Name"}
                  </h4>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-extrabold px-2 py-0.5 rounded-full tracking-wider">
                      Verified Identity
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {gstin ? "GST registered" : "GST not set"}
                    </span>
                  </div>
                </div>

                {renderLogoPreview()}
              </div>

              <div className="space-y-1 pt-6 text-[11px] text-slate-400 font-medium">
                <p className="flex items-start">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 mr-1.5 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">{address || "Registered office address details will show up here."}</span>
                </p>
                {gstin && (
                  <p className="flex items-center font-mono text-slate-300">
                    <CreditCard className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                    <span>GSTIN: <b>{gstin}</b></span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-[#18181b] p-4.5 rounded-xl border border-white/5 space-y-3">
            <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-400" />
              <span>How this is used</span>
            </h4>
            <ul className="text-[11px] text-slate-400 space-y-2 list-disc pl-4 font-medium leading-relaxed">
              <li>These details are automatically saved and merged into your secure Firestore cloud session.</li>
              <li>When generating new invoice templates or prompts, these credentials will be injected as the default supplier, giving your documents complete legal precision.</li>
              <li>Generated PDF downloads and printable invoices will carry your corporate name, address details, and logo theme.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
