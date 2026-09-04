import { callGeminiRest, jsonResponse, errorResponse } from "../../_gemini";

interface Env {
  GEMINI_API_KEY?: string;
  [key: string]: any;
}

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    const { request, env } = context;
    const apiKey = env.GEMINI_API_KEY || (typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined);

    if (!apiKey) {
      return errorResponse("GEMINI_API_KEY is not configured in Cloudflare environment bindings.", 500);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON in request body", 400);
    }

    const { messages, invoices } = body || {};
    if (!messages || !Array.isArray(messages)) {
      return errorResponse("messages array is required", 400);
    }

    const compactInvoices = (invoices || []).map((inv: any) => ({
      id: inv.id,
      number: inv.invoiceNumber,
      supplier: inv.supplierName,
      customer: inv.customerName,
      date: inv.date,
      subtotal: inv.subtotal,
      taxAmount: inv.taxAmount,
      totalAmount: inv.totalAmount,
      status: inv.status,
      category: inv.category,
      supplierGstin: inv.supplierGstin,
      customerGstin: inv.customerGstin,
      itemCount: inv.items?.length || 0,
      itemsSummary: (inv.items || []).map((item: any) => `${item.description} (Qty: ${item.quantity}, Price: ${item.price}, Tax: ${item.taxRate}%)`).join(", ")
    }));

    const systemInstruction = `You are InvoicePro AI Assistant, a professional and helpful accounting bot.
You have secure access to the user's current list of invoices:
${JSON.stringify(compactInvoices, null, 2)}

Your job is to answer queries about these invoices.
Common questions include:
- Invoices above certain values (e.g., show invoices above ₹50,000)
- Finding duplicate invoices (same number or very similar vendor/amount)
- Finding invoices missing GSTIN details
- Customer purchase analysis (which customer bought the most, top clients)
- Vendor spend analysis (top suppliers)
- Date-based queries (last month, specific date range)
- Monthly revenue, tax totals, or outstanding unpaid balances.

Guidelines:
1. Always format financial figures in Indian Rupees (₹) with proper formatting (e.g. ₹50,000).
2. When answering, be concise and highly professional.
3. Use clean Markdown tables to present invoice lists or comparisons.
4. You can suggest a specific action (like "filter" with a query, or "highlight_invoice" with an ID) in the JSON response to help the UI focus the user's view.
5. If the user asks a question that requires filtering the list, explain your findings and specify the filter query or invoice ID in the suggestedAction block.
   For example, if they ask about "Tata", you can output a filter query of "Tata".

Always return your response in JSON format matching the schema:
{
  "text": "Your markdown answer text here...",
  "suggestedAction": {
    "type": "highlight_invoice" | "filter" | "none",
    "invoiceId": "the invoice ID if referencing a single invoice",
    "filterQuery": "the string to search or filter invoices in the UI"
  }
}`;

    const userPrompt = messages[messages.length - 1].text;
    const chatHistory = messages.slice(0, -1).map((msg: any) => ({
      role: msg.sender === "user" ? "user" : "model",
      parts: [{ text: msg.text }]
    }));

    const contents = [
      ...chatHistory,
      { role: "user", parts: [{ text: userPrompt }] }
    ];

    const responseSchema = {
      type: "OBJECT",
      properties: {
        text: { type: "STRING", description: "The response markdown text to show the user" },
        suggestedAction: {
          type: "OBJECT",
          description: "Optional action for the UI to execute",
          properties: {
            type: { type: "STRING", description: "Must be 'highlight_invoice', 'filter', or 'none'" },
            invoiceId: { type: "STRING", description: "ID of the invoice if highlighting a single invoice" },
            filterQuery: { type: "STRING", description: "Filter search query (e.g. vendor name, status) to filter the invoices list in the UI" }
          },
          required: ["type"]
        }
      },
      required: ["text"]
    };

    const text = await callGeminiRest(apiKey, "gemini-2.5-flash", {
      contents,
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    });

    const result = JSON.parse(text);
    return jsonResponse(result);
  } catch (err: any) {
    console.error("Cloudflare Pages Function error in chat:", err);
    return errorResponse(err.message || "Failed to process chat query", 500);
  }
};

export const onRequestOptions = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
};
