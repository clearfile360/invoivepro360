# InvoicePro AI — Supabase & Google Authentication Setup Guide

This project uses **Supabase Authentication** with **Google OAuth** as the exclusive authentication provider and **Supabase PostgreSQL** with **Row Level Security (RLS)** for enterprise data isolation.

Follow these steps to configure and run the authentication flow.

---

### Step 1: Create a Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create a new project.
2. Note your **Project URL** and **Anon / Public Key** from **Project Settings → API**.

---

### Step 2: Enable Google Provider in Supabase
1. In the Supabase Dashboard, navigate to **Authentication → Providers**.
2. Select **Google** and switch the toggle to **Enabled**.
3. Copy the **Callback URL (for OAuth)** shown in the Supabase dashboard. It follows the format:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```

---

### Step 3: Configure Google Cloud OAuth Credentials
1. Go to the [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials).
2. Create or select your Google Cloud project.
3. Configure the **OAuth Consent Screen** (User Type: External, Scopes: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`).
4. Navigate to **Credentials → Create Credentials → OAuth Client ID**.
5. Application Type: **Web Application**.
6. Under **Authorized redirect URIs**, add the Supabase Callback URL copied in Step 2:
   ```
   https://<your-project-ref>.supabase.co/auth/v1/callback
   ```
7. Click **Create** and copy your **Client ID** and **Client Secret**.

---

### Step 4: Add Google Credentials to Supabase
1. Return to **Supabase Dashboard → Authentication → Providers → Google**.
2. Paste the **Client ID** and **Client Secret** obtained from Google Cloud.
3. Click **Save**.

---

### Step 5: Configure Application Redirect URLs in Supabase
1. In Supabase Dashboard, go to **Authentication → URL Configuration**.
2. Set **Site URL** to your application's domain URL:
   - For local development: `http://localhost:3000`
   - For Cloud Run preview: `https://<your-app-id>.run.app`
3. Under **Redirect URLs**, add:
   - `http://localhost:3000/**`
   - `https://*.run.app/**` (or your specific Cloud Run deployment URL)
4. Click **Save**.

---

### Step 6: Configure Environment Variables
Set the following environment variables in your environment or `.env` file:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...<your-anon-key>
```

> **Security Note**: Never expose the Supabase `service_role` secret or Google Client Secret in frontend code. Only the public `anon` key is used in the browser client.

---

### Step 7: Run the Database Schema & RLS Policies
1. In the Supabase Dashboard, open the **SQL Editor**.
2. Copy and paste the contents of `supabase/schema.sql` into the editor.
3. Click **Run** to execute the script.
4. This will create:
   - `public.profiles` with auto-trigger on new Google signups.
   - `public.invoices` scoped to `user_id UUID REFERENCES auth.users(id)`.
   - Complete Row Level Security policies enforcing `auth.uid() = user_id`.

---

### Step 8: Test Authentication
1. Open the application in your browser.
2. Click **Continue with Google**.
3. Complete the Google authentication prompt.
4. You will be redirected back into InvoicePro AI with your authenticated user profile and isolated ledger.
