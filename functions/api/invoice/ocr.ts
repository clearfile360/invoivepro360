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

    const { fileBase64, mimeType } = body || {};
    if (!fileBase64 || !mimeType) {
      return errorResponse("fileBase64 and mimeType are required", 400);
    }

    const imagePart = {
      inlineData: {
        mimeType,
        data: fileBase64,
      },
    };

    const textPart = {
      text: `Analyze this invoice scan/image/photo and extract all relevant details into structured JSON format.
Be highly accurate in reading the numeric values, dates, supplier and customer details, items, HSN codes, and GST rates.
If any field is unreadable, leave it empty or make a best guess based on context.
Return the structured invoice details exactly matching the schema.`,
    };

    const responseSchema = {
      type: "OBJECT",
      properties: {
        invoiceNumber: { type: "STRING", description: "Invoice number or identifier found on the page" },
        supplierName: { type: "STRING", description: "Legal or brand name of the supplier" },
        supplierGstin: { type: "STRING", description: "15-character GSTIN of the supplier" },
        supplierAddress: { type: "STRING", description: "Supplier's address" },
        customerName: { type: "STRING", description: "Name of the customer or buyer" },
        customerGstin: { type: "STRING", description: "15-character GSTIN of the customer" },
        customerAddress: { type: "STRING", description: "Customer's address" },
        date: { type: "STRING", description: "Invoice date in YYYY-MM-DD format (convert from the read date format)" },
        items: {
          type: "ARRAY",
          description: "Items or services in the table",
          items: {
            type: "OBJECT",
            properties: {
              description: { type: "STRING", description: "Item name or description" },
              quantity: { type: "NUMBER", description: "Quantity" },
              price: { type: "NUMBER", description: "Unit price before tax" },
              taxRate: { type: "NUMBER", description: "GST rate percentage (e.g. 18, 5, 12, 28, 0)" },
              hsn: { type: "STRING", description: "HSN code if listed" }
            },
            required: ["description", "quantity", "price", "taxRate"]
          }
        },
        notes: { type: "STRING", description: "Any other details, notes, terms, bank details found" }
      },
      required: ["supplierName", "customerName", "items"]
    };

    const text = await callGeminiRest(apiKey, "gemini-2.5-flash", {
      contents: [{ parts: [imagePart, textPart] }],
      responseMimeType: "application/json",
      responseSchema
    });

    const extractedData = JSON.parse(text);
    return jsonResponse(extractedData);
  } catch (err: any) {
    console.error("Cloudflare Pages Function error in ocr:", err);
    return errorResponse(err.message || "Failed to extract invoice details via OCR", 500);
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
