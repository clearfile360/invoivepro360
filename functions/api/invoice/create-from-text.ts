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

    const { prompt } = body || {};
    if (!prompt) {
      return errorResponse("Prompt is required", 400);
    }

    const systemInstruction = `You are an expert invoice processing AI. Convert natural language requests into structured invoice details.
Parse supplier names, customer names, date, invoice numbers, items, quantities, prices, tax rates (GST rates), and notes.
If specific fields are not mentioned, use logical defaults or leave them empty (e.g. if tax is mentioned as 18% GST, set taxRate as 18).
Standard GST rates are typically 0, 5, 12, 18, 28. Use those if not specified.
Return the structured invoice details exactly matching the schema.`;

    const responseSchema = {
      type: "OBJECT",
      properties: {
        invoiceNumber: { type: "STRING", description: "Invoice number or identifier, generate one if missing (e.g., INV-2026-001)" },
        supplierName: { type: "STRING", description: "Name of the supplier or merchant" },
        supplierGstin: { type: "STRING", description: "15-character GSTIN of the supplier if present" },
        supplierAddress: { type: "STRING", description: "Supplier's address if present" },
        customerName: { type: "STRING", description: "Name of the customer or buyer" },
        customerGstin: { type: "STRING", description: "15-character GSTIN of the customer if present" },
        customerAddress: { type: "STRING", description: "Customer's address if present" },
        date: { type: "STRING", description: "Invoice date in YYYY-MM-DD format. Default to today if not provided." },
        items: {
          type: "ARRAY",
          description: "List of items or services in the invoice",
          items: {
            type: "OBJECT",
            properties: {
              description: { type: "STRING", description: "Item description" },
              quantity: { type: "NUMBER", description: "Quantity of the item (default to 1)" },
              price: { type: "NUMBER", description: "Unit price of the item" },
              taxRate: { type: "NUMBER", description: "GST rate percentage (e.g., 18 for 18% GST, default to 18 if not specified)" },
              hsn: { type: "STRING", description: "4-to-8 digit HSN code if relevant (e.g., steel rods might be HSN 7214)" }
            },
            required: ["description", "quantity", "price", "taxRate"]
          }
        },
        notes: { type: "STRING", description: "Any extra notes, payment instructions, or terms mentioned" }
      },
      required: ["supplierName", "customerName", "items"]
    };

    const text = await callGeminiRest(apiKey, "gemini-2.5-flash", {
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema
    });

    const invoiceData = JSON.parse(text);
    return jsonResponse(invoiceData);
  } catch (err: any) {
    console.error("Cloudflare Pages Function error in create-from-text:", err);
    return errorResponse(err.message || "Failed to process invoice creation request", 500);
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
