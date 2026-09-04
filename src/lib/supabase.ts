import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { Invoice, CompanySettings } from '../types';

// Environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-supabase-project-url') &&
  !supabaseAnonKey.includes('your-supabase-publishable-or-anon-key')
);

// Fallback dummy URL & key to prevent createClient crash if env vars are empty at startup
const clientUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co';
const clientKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase: SupabaseClient = createClient(clientUrl, clientKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

export type SupabaseUser = User;
export type SupabaseSession = Session;

/**
 * Sign in using Supabase Google OAuth
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { 
      error: new Error('Supabase is not configured yet. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment/Settings to enable Google Sign-In.') 
    };
  }

  try {
    const redirectUrl = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });

    if (error) {
      console.error('Supabase Google OAuth error:', error);
      return { error: new Error(error.message || 'Unable to sign in with Google. Please try again.') };
    }

    return { error: null };
  } catch (err: any) {
    console.error('Sign in exception:', err);
    return { error: new Error(err?.message || 'Unable to connect to the authentication service. Please try again.') };
  }
}

/**
 * Sign out of current Supabase session
 */
export async function signOut(): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.auth.signOut();
    return { error };
  } catch (err: any) {
    console.error('Sign out exception:', err);
    return { error: err };
  }
}

/**
 * Get the current Supabase session
 */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error('Error fetching session:', error);
      return null;
    }
    return session;
  } catch (err) {
    console.error('Exception fetching session:', err);
    return null;
  }
}

/**
 * Fetch profile and company settings for the authenticated user
 */
export async function fetchUserProfile(userId: string): Promise<{ companySettings?: CompanySettings } | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('company_settings')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }

    if (data && data.company_settings) {
      return { companySettings: data.company_settings as CompanySettings };
    }

    return null;
  } catch (err) {
    console.error('Exception fetching profile:', err);
    return null;
  }
}

/**
 * Upsert user profile and company settings
 */
export async function saveUserProfile(user: User, companySettings: CompanySettings): Promise<boolean> {
  if (!isSupabaseConfigured) return false;

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        avatar_url: user.user_metadata?.avatar_url || '',
        company_settings: companySettings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    if (error) {
      console.error('Error saving user profile to Supabase:', error);
      throw error;
    }

    return true;
  } catch (err) {
    console.error('Exception saving profile:', err);
    throw err;
  }
}

// Convert Supabase DB invoice row to Invoice model
function mapDbRowToInvoice(row: any): Invoice {
  return {
    id: row.id,
    userId: row.user_id,
    invoiceNumber: row.invoice_number,
    supplierName: row.supplier_name,
    supplierGstin: row.supplier_gstin || undefined,
    supplierAddress: row.supplier_address || undefined,
    customerName: row.customer_name,
    customerGstin: row.customer_gstin || undefined,
    customerAddress: row.customer_address || undefined,
    date: row.date,
    dueDate: row.due_date || undefined,
    items: row.items || [],
    subtotal: Number(row.subtotal) || 0,
    cgst: Number(row.cgst) || 0,
    sgst: Number(row.sgst) || 0,
    igst: Number(row.igst) || 0,
    taxAmount: Number(row.tax_amount) || 0,
    totalAmount: Number(row.total_amount) || 0,
    status: row.status || 'unpaid',
    paymentStatus: row.payment_status || 'due',
    amountPaid: Number(row.amount_paid) || 0,
    balanceDue: Number(row.balance_due) || 0,
    payments: row.payments || [],
    category: row.category || 'Sales',
    notes: row.notes || undefined,
    ocrSource: row.ocr_source || undefined,
    createdAt: row.created_at || new Date().toISOString()
  };
}

// Convert Invoice model to Supabase DB invoice row
function mapInvoiceToDbRow(invoice: Invoice, userId: string): Record<string, any> {
  return {
    id: invoice.id,
    user_id: userId,
    invoice_number: invoice.invoiceNumber,
    supplier_name: invoice.supplierName,
    supplier_gstin: invoice.supplierGstin || null,
    supplier_address: invoice.supplierAddress || null,
    customer_name: invoice.customerName,
    customer_gstin: invoice.customerGstin || null,
    customer_address: invoice.customerAddress || null,
    date: invoice.date,
    due_date: invoice.dueDate || null,
    items: invoice.items || [],
    subtotal: invoice.subtotal || 0,
    cgst: invoice.cgst || 0,
    sgst: invoice.sgst || 0,
    igst: invoice.igst || 0,
    tax_amount: invoice.taxAmount || 0,
    total_amount: invoice.totalAmount || 0,
    status: invoice.status || 'unpaid',
    payment_status: invoice.paymentStatus || 'due',
    amount_paid: invoice.amountPaid || 0,
    balance_due: invoice.balanceDue || 0,
    payments: invoice.payments || [],
    category: invoice.category || 'Sales',
    notes: invoice.notes || null,
    ocr_source: invoice.ocrSource || null,
    created_at: invoice.createdAt || new Date().toISOString()
  };
}

/**
 * Fetch all invoices for the authenticated user from Supabase PostgreSQL
 */
export async function fetchUserInvoices(userId: string): Promise<Invoice[]> {
  if (!isSupabaseConfigured) return [];

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user invoices from Supabase:', error);
      throw error;
    }

    return (data || []).map(mapDbRowToInvoice);
  } catch (err) {
    console.error('Exception fetching invoices:', err);
    throw err;
  }
}

/**
 * Insert a new invoice into Supabase PostgreSQL
 */
export async function createInvoiceInDb(invoice: Invoice, userId: string): Promise<Invoice> {
  if (!isSupabaseConfigured) return invoice;

  try {
    const row = mapInvoiceToDbRow(invoice, userId);
    const { data, error } = await supabase
      .from('invoices')
      .insert(row)
      .select()
      .single();

    if (error) {
      console.error('Error creating invoice in Supabase:', error);
      throw error;
    }

    return mapDbRowToInvoice(data);
  } catch (err) {
    console.error('Exception creating invoice:', err);
    throw err;
  }
}

/**
 * Update an existing invoice in Supabase PostgreSQL
 */
export async function updateInvoiceInDb(invoice: Invoice, userId: string): Promise<Invoice> {
  if (!isSupabaseConfigured) return invoice;

  try {
    const row = mapInvoiceToDbRow(invoice, userId);
    const { data, error } = await supabase
      .from('invoices')
      .update(row)
      .eq('id', invoice.id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating invoice in Supabase:', error);
      throw error;
    }

    return mapDbRowToInvoice(data);
  } catch (err) {
    console.error('Exception updating invoice:', err);
    throw err;
  }
}

/**
 * Delete an invoice from Supabase PostgreSQL
 */
export async function deleteInvoiceFromDb(invoiceId: string, userId: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;

  try {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error deleting invoice from Supabase:', error);
      throw error;
    }

    return true;
  } catch (err) {
    console.error('Exception deleting invoice:', err);
    throw err;
  }
}
