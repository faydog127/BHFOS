# CRM System Overview

## 1. Access & Architecture
The CRM is a protected application module served under the `/crm/*` route namespace. It uses a dedicated layout structure distinct from the public-facing website.

- **Entry Point**: `src/pages/Crm.jsx` handles the routing for all CRM sub-pages.
- **Layout**: `src/components/CrmLayout.jsx` provides the persistent sidebar navigation, responsive mobile sheet menu, and shell structure.
- **Authentication**: Routes are protected by `src/components/AdminRoute.jsx` (implied from App.jsx usage), ensuring only authenticated users with appropriate roles can access these pages.
- **Direct Access**: Users can access the CRM by navigating to `/crm` or `/crm/dashboard` after logging in.

## 2. Core Modules & Features

### A. Dashboard (Mission Control)
**File**: `src/pages/crm/CrmHome.jsx`
- Acts as the "Mission Control" center.
- **Key Features**:
  - Real-time "Critical", "Stalled", and "Needs Approval" widgets.
  - Recent Leads table.
  - Monitoring for failed marketing actions, stuck AI generations, and referral SLA breaches.

### B. Lead Management
**Files**: `src/pages/crm/Leads.jsx`, `src/pages/crm/Pipeline.jsx`
- **Functionality**:
  - Kanban and List views for lead stages.
  - Detailed lead intake and tracking.
  - **Database Tables**: `leads`, `lead_pipeline_events`.
  - **Automation**: Triggers defined in Postgres functions (`trigger_marketing_playbooks`, `log_pipeline_change`).

### C. Partner Portal & Management
**Files**: `src/pages/crm/Partners.jsx`, `src/pages/crm/HvacPartnerDashboardPage.jsx`
- **Features**:
  - Dedicated HVAC Vertical Portal (`/crm/hvac`).
  - Partner scoring (Velocity, Operations, Growth scores).
  - Partner specific dashboards and submission tracking.
  - **Database Tables**: `partners`, `partner_registrations`, `partner_prospects`.

### D. Call Console (Console V2)
**Files**: `src/pages/crm/CallConsole.jsx`, `src/components/crm/call-console/*`
- **Features**:
  - **AiCopilot**: Real-time script suggestions and objection handling.
  - **SignalsPanel**: Visual indicators of lead health and status.
  - **LogAndActionHub**: Integrated call logging and follow-up task creation.
  - **Database Tables**: `calls`, `call_logs`, `script_library`.

### E. Marketing & Automation
**Files**: `src/pages/crm/Marketing.jsx`, `src/components/crm/marketing/*`
- **Features**:
  - **AutomationPlaybooks**: Logic for handling lead events (e.g., "Referral Received", "Partner Onboarding").
  - **CampaignsManager**: Creation and tracking of marketing campaigns.
  - **Content Generation**: AI-driven content generation for emails/SMS.
  - **Database Tables**: `marketing_actions`, `marketing_campaigns`, `campaign_metrics`.

### F. Operations & Tasks
**Files**: `src/pages/crm/ActionHub.jsx`, `src/pages/crm/Schedule.jsx`, `src/pages/crm/Inbox.jsx`
- **Features**:
  - Unified Inbox for communication.
  - Scheduling and calendar views.
  - Action Hub for task management (Kanban/List views).

## 3. Specialized Tools

- **HVAC Live Test Workflow**: `src/pages/testing/HvacLiveTestWorkflow.jsx` - A dedicated environment for testing HVAC partner flows.
- **Estimate Wizard**: `src/components/EstimateWizard.jsx` - Complex multi-step wizard for generating service quotes, integrated with the `estimates` table.
- **Brand Brain**: `src/pages/crm/BrandBrainLoader.jsx` - Tooling for managing brand voice and context.

## 4. Database Schema Map

The CRM relies on a robust Supabase (PostgreSQL) backend. Key tables include:

| Domain | Tables | Description |
|--------|--------|-------------|
| **Core Entities** | `leads`, `partners`, `users` | Primary records for people and organizations. |
| **Communication** | `calls`, `call_logs`, `chat_logs`, `inbox` | Records of all interactions. |
| **Marketing** | `marketing_actions`, `campaigns`, `doc_templates` | Automation rules, email templates, and campaign data. |
| **Sales** | `estimates`, `price_book`, `packages` | Financial data, quoting, and product catalog. |
| **System** | `global_config`, `widget_settings`, `secrets` | Configuration and environment variables. |

## 5. Navigation Structure
The CRM navigation is defined in `src/components/CrmLayout.jsx` and includes:
1.  Dashboard
2.  Leads
3.  Partners
4.  Inbox
5.  Schedule
6.  Customers
7.  My Money / Payroll
8.  Reporting
9.  Marketing
10. Call Console
11. Settings (Chat Widget, General)