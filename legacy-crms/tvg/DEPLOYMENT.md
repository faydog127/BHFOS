# Deployment Guide

This guide provides instructions for deploying The Vent Guys' web app and CRM to a hosting provider like Vercel or Netlify. The process is similar for both platforms.

The goal is to have:
- The main website live at `www.vent-guys.com`.
- The Call Console accessible at `console.vent-guys.com`.

**Note:** Both domains will point to the same deployed project. The React Router handles showing the correct content based on the URL path (`/` for the website, `/crm/console` for the console).

---

### Step 1: Connect Your Git Repository

1.  **Sign up or log in** to your Vercel or Netlify account.
2.  **Create a new project/site** and connect it to the Git repository for this project.

---

### Step 2: Configure Build Settings

The platform should automatically detect the Vite configuration. Ensure the settings are as follows:

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`
- **Framework Preset:** `Vite`

---

### Step 3: Add Environment Variables

In your project's settings on Vercel or Netlify, navigate to the "Environment Variables" section. Add the following variables with the values from your Supabase project dashboard:

-   **`VITE_SUPABASE_URL`**: Your Supabase project URL.
-   **`VITE_SUPABASE_ANON_KEY`**: Your Supabase project's `anon` (public) key.
-   **`VITE_SUPABASE_PROJECT_ID`**: Your Supabase project ID.

**Important:** These variables are prefixed with `VITE_` to make them accessible on the client-side, which is necessary for the Supabase JS client. Ensure they are set correctly for the production environment.

---

### Step 4: Deploy the Project

Trigger a deployment. Vercel/Netlify will build the project and deploy it to a unique URL. Verify that everything works correctly on this preview URL.

---

### Step 5: Configure Custom Domains

Once you've confirmed the deployment is successful, you can add your custom domains.

1.  **Navigate to the "Domains" section** of your project settings on Vercel/Netlify.
2.  **Add `www.vent-guys.com`** as a domain. Follow the instructions to update your DNS records (usually adding a `CNAME` or `A` record).
3.  **Add `vent-guys.com`** and set up a redirect to `www.vent-guys.com`. Most platforms handle this automatically.
4.  **Add `console.vent-guys.com`**. This domain will also point to the same deployment. Vercel/Netlify will provide the necessary DNS records.

After DNS propagation (which can take a few minutes to a few hours), your sites should be live:
-   `https://www.vent-guys.com` will show the public website.
-   `https://console.vent-guys.com` will also show the public website initially, but your team can navigate to `https://console.vent-guys.com/crm/console` to access the Call Console.

---
### Supabase URL Configuration

For the Supabase Edge Functions to work correctly with your custom `console` subdomain, you must add your production domain to Supabase's CORS configuration.

1.  Go to your Supabase Project Dashboard.
2.  Navigate to **Authentication -> URL Configuration**.
3.  In the **Redirect URLs** section, add `https://console.vent-guys.com/**`.
4.  Save the changes.

This ensures that authentication callbacks and other Supabase services function correctly on your custom subdomain.
