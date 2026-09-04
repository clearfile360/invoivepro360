import React, { useState, useRef, useEffect } from "react";
import { ChatMessage, Invoice } from "../types";
import { 
  Send, 
  Sparkles, 
  Bot, 
  User, 
  Loader2, 
  Trash2, 
  Search, 
  HelpCircle,
  FileSpreadsheet
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { safeFetchJson } from "../utils/apiUtils";

interface InvoiceChatProps {
  invoices: Invoice[];
  onApplyFilter: (query: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export default function InvoiceChat({ invoices, onApplyFilter, messages, setMessages }: InvoiceChatProps) {
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Handle send message
  const handleSendMessage = async (textToSend = inputText) => {
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: "msg-" + Math.random().toString(36).substring(2, 9),
      sender: "user",
      text: textToSend,
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const botData = await safeFetchJson("/api/invoice/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          invoices
        })
      });

      const botMsg: ChatMessage = {
        id: "msg-" + Math.random().toString(36).substring(2, 9),
        sender: "assistant",
        text: botData.text,
        createdAt: new Date().toISOString(),
        suggestedAction: botData.suggestedAction
      };

      setMessages(prev => [...prev, botMsg]);

      // If there is a suggested filter action, apply it automatically!
      if (botData.suggestedAction && botData.suggestedAction.type === "filter" && botData.suggestedAction.filterQuery) {
        onApplyFilter(botData.suggestedAction.filterQuery);
      }
    } catch (err: any) {
      console.error(err);
      const errorMsg: ChatMessage = {
        id: "msg-err",
        sender: "assistant",
        text: `⚠️ **Error communicating with Gemini AI**: ${err.message || "Something went wrong. Please check your server status."}`,
        createdAt: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Clear Chat history
  const handleClearHistory = () => {
    setMessages([
      {
        id: "msg-welcome",
        sender: "assistant",
        text: "👋 Hello! I am **InvoicePro 360 AI Assistant**.\n\nI have complete secure visibility over all your current invoices in this ledger session. Ask me anything!\n\nExamples:\n- *'Show invoices above ₹50,000'*\n- *'Find duplicate invoices'*\n- *'Who is our top vendor?'*\n- *'Show invoices from Delhi Retailers'*",
        createdAt: new Date().toISOString()
      }
    ]);
    onApplyFilter("");
  };

  // Static suggestion prompts
  const chatPrompts = [
    "Find duplicate invoices",
    "Show invoices above ₹50,000",
    "Which customer spent the most?",
    "Find invoices with tax errors"
  ];

  return (
    <div className="bg-[#111113] rounded-2xl border border-white/10 flex flex-col h-[650px] overflow-hidden" id="invoice-chat-container">
      {/* Chat Header */}
      <div className="px-5 py-4 border-b border-white/5 bg-[#0A0A0B]/50 flex items-center justify-between" id="chat-header">
        <div className="flex items-center space-x-2.5">
          <div className="bg-indigo-500/10 text-indigo-400 p-2 rounded-xl border border-indigo-500/10">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-display font-bold text-white text-sm">InvoicePro 360 AI Copilot</h4>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold border border-emerald-500/20">Ledger Knowledge-Base Linked</span>
          </div>
        </div>

        <button 
          onClick={handleClearHistory}
          className="p-1.5 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Clear Conversation"
          id="clear-chat-history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Chat Thread Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4" id="chat-thread">
        {messages.map((msg) => (
          <div 
            key={msg.id}
            className={`flex items-start space-x-3 max-w-[85%] ${
              msg.sender === "user" ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
            }`}
            id={`chat-msg-${msg.id}`}
          >
            {/* Sender Icon */}
            <div className={`p-1.5 rounded-xl shrink-0 ${
              msg.sender === "user" ? "bg-white/15 text-white" : "bg-indigo-500/10 text-indigo-400 border border-indigo-500/10"
            }`}>
              {msg.sender === "user" ? <User className="w-4.5 h-4.5" /> : <Bot className="w-4.5 h-4.5" />}
            </div>

            {/* Message Body */}
            <div className={`p-3.5 rounded-2xl text-xs space-y-1.5 shadow-sm leading-relaxed ${
              msg.sender === "user" 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "bg-[#1c1c1e] border border-white/5 text-slate-200 rounded-tl-none"
            }`}>
              <div className="markdown-body">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>

              {/* Suggested action alert pill */}
              {msg.suggestedAction && msg.suggestedAction.type === "filter" && msg.suggestedAction.filterQuery && (
                <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-semibold flex items-center space-x-1">
                    <Search className="w-3 h-3 text-indigo-400" />
                    <span>Auto-applied Ledger Filter:</span>
                    <b className="text-slate-300 font-mono">"{msg.suggestedAction.filterQuery}"</b>
                  </span>
                  <button 
                    onClick={() => onApplyFilter("")}
                    className="text-indigo-400 hover:text-indigo-300 font-bold hover:underline cursor-pointer"
                  >
                    Clear Filter
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-start space-x-3 mr-auto animate-pulse" id="chat-loading-indicator">
            <div className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/10">
              <Bot className="w-4.5 h-4.5" />
            </div>
            <div className="bg-[#1c1c1e] border border-white/5 p-3 rounded-2xl rounded-tl-none text-xs text-slate-400 flex items-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Analyzing ledger values & drafting response...</span>
            </div>
          </div>
        )}
        <div ref={threadEndRef} />
      </div>

      {/* Suggestion Prompts Row */}
      <div className="px-5 py-2.5 border-t border-white/5 bg-[#0A0A0B]/30 overflow-x-auto whitespace-nowrap flex space-x-2" id="chat-suggestion-pills">
        {chatPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p)}
            disabled={loading}
            className="inline-block bg-[#111113] hover:bg-indigo-500/10 hover:border-indigo-500/25 border border-white/5 rounded-full px-3.5 py-1.5 text-[10px] font-bold text-slate-300 hover:text-white cursor-pointer transition-all shrink-0"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input Form */}
      <form 
        onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
        className="p-3 border-t border-white/5 flex items-center space-x-2 bg-[#0A0A0B]/50"
        id="chat-input-form"
      >
        <input 
          type="text" 
          placeholder="Ask InvoicePro AI: e.g. 'Show me duplicates', 'Who is ABC Traders?'..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={loading}
          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/5 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-indigo-500 focus:bg-[#0A0A0B] focus:text-white transition-all placeholder:text-slate-500"
          id="chat-input"
        />
        <button 
          type="submit" 
          disabled={loading || !inputText.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-white/5 disabled:text-slate-600 p-2.5 rounded-xl transition-colors shrink-0 shadow-sm cursor-pointer"
          id="send-chat-button"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
