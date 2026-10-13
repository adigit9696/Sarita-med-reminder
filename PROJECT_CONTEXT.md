# Project Context & Technical Architecture Document
**Target Codebase:** `sarita-med-reminder-v2`  
**Last Generated:** 2026-09-30  
**Document Status:** Complete & Verified against Codebase

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Folder & File Map](#3-folder--file-map)
4. [Screens, Routes & Navigation](#4-screens-routes--navigation)
5. [Authentication, PIN Lock & Security Implementation](#5-authentication-pin-lock--security-implementation)
6. [Data Model & Storage](#6-data-model--storage)
7. [Excel/Marg Upload Pipeline](#7-excelmarg-upload-pipeline)
8. [Business Logic & Calculations](#8-business-logic--calculations)
9. [Feature-by-Feature Behaviour](#9-feature-by-feature-behaviour)
10. [UI/UX & Design System](#10-uiux--design-system)
11. [Dependencies Between Components (Change Impact Map)](#11-dependencies-between-components-change-impact-map)
12. [Configuration & Environment](#12-configuration--environment)
13. [Known Issues, Gaps & Technical Debt](#13-known-issues-gaps--technical-debt)
14. [Safe-Change Guidelines](#14-safe-change-guidelines)

---

## 1. Project Overview

### Purpose of the App
`sarita-med-reminder-v2` is a specialized, single-tenant web application designed for retail pharmacies operating with **Marg ERP**. Its primary clinical and commercial purpose is to automate chronic medicine refill tracking, patient retention auditing, and 5-day advance notification workflows for patients on continuous maintenance therapies (e.g., hypertension, diabetes, cardiology).

### Target Users
- **Primary Users:** Retail pharmacy counter staff and dispensing pharmacists at **Sarita Pharmacy**.
- **Secondary Users:** Pharmacy owner/administrators receiving automated daily email executive summaries.
- **End Beneficiaries:** Chronic medicine patients receiving timely refill reminders via WhatsApp or phone.

### Branding Text & Identity
All branding constants are centralized in `src/lib/brand.config.ts`:
- **Application Name:** `Sarita Pharmacy Med Reminder` (`BRAND.name`)
- **Short Name:** `Sarita Med` (`BRAND.shortName`)
- **Tagline:** `Powered by Oasis MedTeck` (`BRAND.tagline`)
- **Pharmacy Name:** `Sarita Pharmacy` (`BRAND.pharmacy.name`)
- **Pharmacy Address:** `5/1/1 Madhokunj, Katra, Prayagraj - 211002` (`BRAND.pharmacy.address`)
- **Contact Numbers:** Configured in `BRAND.pharmacy.phones`
- **Official Email:** Configured in `BRAND.pharmacy.email`
- **Application Version:** `2.0.0` (`BRAND.version`)

### Current Overall Status
- **Complete & Fully Functional:**
  - Marg ERP Excel/CSV ingestion (`.XLS`, `.XLSX`, `.CSV`) supporting hierarchical sales summaries and flat tabular registers (`src/lib/marg-parser.ts`).
  - Cross-month customer matching and deduplication via phone, Marg ERP patient code, and normalized name (`src/lib/customer-matcher.ts`).
  - Master customer directory with tree-structure medicine breakdown and inline monthly status toggling (`src/components/customers/AllCustomersView.tsx`).
  - Dedicated Monthly Customers tracking directory with automated urgency-ranked sorting (`src/components/monthly/MonthlyCustomersView.tsx`).
  - Web Audio API synthesizer generating hospital-grade chime alerts for 5-day refill warnings and overdue alerts with zero audio asset dependencies (`src/lib/audio-alerts.ts`).
  - WhatsApp reminder generator formatting clean, patient-friendly Hinglish bullet lists with universal mobile/desktop dispatch (`src/lib/whatsapp.ts`).
  - Multi-batch monthly retention audit drawer cross-referencing retained, missing, and new patients (`src/components/uploads/MonthlyAuditDrawer.tsx`).
  - Physical A4 print engine generating pen-friendly staff call sheets and 2x4 cuttable delivery bag slips (`src/components/print/PrintListView.tsx`).
  - Google Firebase Cloud Firestore synchronization mapped to 4 dedicated collections (`all_customers`, `monthly_customers`, `all_uploads`, `settings`) backed by an offline-resilient `localStorage` cache (`src/lib/firebase.ts`, `src/lib/data-store.ts`).
  - Serverless daily cron alerting endpoint running on Vercel Cron (`src/app/api/cron/daily-alert/route.ts`).
- **Partial / Gaps:**
  - PIN authentication is enforced client-side via React state and `localStorage`; no cryptographic JWT session or server-side auth gate is implemented (`src/components/lock/PinLockModal.tsx`).
  - `bcryptjs` is installed in `package.json` but is unused; PIN comparisons are evaluated as plain text (`src/components/lock/PinLockModal.tsx`, `src/lib/data-store.ts`).
  - Hindi language toggle is defined in type interfaces (`language: 'en' | 'hi'` in `src/types/index.ts`) and store defaults, but no language switcher or i18n translation dictionary exists in the UI.

---

## 2. Tech Stack & Architecture

### Frameworks, Libraries & Versions
As specified in `package.json`:
- **Core Framework:** Next.js `16.3.6` (App Router, Turbopack)
- **Runtime & UI Library:** React `19.2.8` & React DOM `19.2.8`
- **Language & Compiler:** TypeScript `^5`, Node.js (v20+ target)
- **Styling System:** Tailwind CSS `^4` (via `@tailwindcss/postcss`) with CSS variables in `src/app/globals.css`
- **Database SDK:** Google Firebase JavaScript SDK `^11.3.1` (Firestore App/Web SDK)
- **Spreadsheet Parser:** SheetJS `xlsx` `^0.18.5`
- **Icons:** `lucide-react` `^1.48.0` (inline SVG icons)
- **Analytics Charts:** `recharts` `^3.10.1`
- **Date Manipulation:** `date-fns` `^4.4.0`
- **Validation:** `zod` `^4.6.5`
- **Password Utility (Unused):** `bcryptjs` `^3.0.3`

### Build Tool & Hosting Setup
- **Build Engine:** Next.js Turbopack compiler (`next build` configured in `package.json`).
- **Development Server:** `next dev -p 3001` (runs by default on port 3001).
- **Deployment Platform:** Vercel (`https://sarita-med-reminder.vercel.app/`).
- **Scheduled Tasks:** Vercel Cron configured in `vercel.json` triggering `/api/cron/daily-alert` daily at 03:30 UTC (`30 3 * * *`).

### Client vs. Server Responsibilities
- **Client (Browser SPA via `AppShell.tsx`):**
  - All interactive UI views, routing, tab switching, and modal management.
  - Excel file parsing directly in-browser using SheetJS (`src/lib/marg-parser.ts`) without uploading files to an intermediate server.
  - Customer matching, deduplication, and reminder urgency calculations (`src/lib/data-store.ts`).
  - Web Audio API acoustic synthesis (`src/lib/audio-alerts.ts`).
  - Direct read/write client connectivity with Firebase Cloud Firestore using client credentials (`src/lib/firebase.ts`).
  - Persistent fallback state storage using browser `localStorage`.
- **Server (Next.js Serverless Edge/Node Routes):**
  - `GET/POST /api/cron/daily-alert`: Executed automatically by Vercel Cron. Initializes Firebase server-side, identifies patients due within alert thresholds, renders an executive HTML briefing, and sends emails via Resend HTTP API (`src/app/api/cron/daily-alert/route.ts`).
  - `POST /api/send-owner-alert`: On-demand endpoint used by the Settings UI to send test or manual alert emails (`src/app/api/send-owner-alert/route.ts`).

### System Architecture Diagram
```
+-----------------------------------------------------------------------------------+
|                                  BROWSER CLIENT                                   |
|                                                                                   |
|  +-------------------+       +-----------------------+     +-------------------+  |
|  | Marg ERP Spread-  | ----> |  Excel/CSV Parser     | --> | Customer Matcher  |  |
|  | sheets (.XLS)     |       | (src/lib/marg-parser) |     | & Deduplicator    |  |
|  +-------------------+       +-----------------------+     +-------------------+  |
|                                                                      |            |
|                                                                      v            |
|  +--------------------+      +-----------------------+     +-------------------+  |
|  | Web Audio Chime    | <--- |   DataStoreService    | <-> | LocalStorage      |  |
|  | Synthesizer        |      | (src/lib/data-store)  |     | Offline Cache     |  |
|  +--------------------+      +-----------------------+     +-------------------+  |
|                                      ^       ^                                    |
|                                      |       |                                    |
|                                      v       v                                    |
|  +-----------------------------------------------------------------------------+  |
|  | UI Component Views (AppShell, Dashboard, Monthly, All Customers, Print, etc.)|  |
|  +-----------------------------------------------------------------------------+  |
+--------------------------------------|-------|------------------------------------+
                                       |       |
                 Direct Client SDK Sync|       | Realtime Subscriptions
                                       v       v
+-----------------------------------------------------------------------------------+
|                         GOOGLE FIREBASE CLOUD FIRESTORE                           |
|                                                                                   |
|   +-------------------+  +---------------------+  +-------------+  +------------+ |
|   |   all_customers   |  |  monthly_customers  |  | all_uploads |  |  settings  | |
|   +-------------------+  +---------------------+  +-------------+  +------------+ |
+-----------------------------------------------------------------------------------+
                                       ^
                                       | Server-side Reads & Timestamp Writes
+--------------------------------------|--------------------------------------------+
|                          VERCEL SERVERLESS BACKEND                                |
|                                                                                   |
|   +------------------------------------+      +---------------------------------+ |
|   | Vercel Cron (Daily 03:30 UTC)      | ---> | Route: /api/cron/daily-alert    | |
|   +------------------------------------+      +---------------------------------+ |
|                                                               |                   |
|                                                               v                   |
|   +------------------------------------+      +---------------------------------+ |
|   | Settings Test Email Dispatcher     | ---> | Route: /api/send-owner-alert    | |
|   +------------------------------------+      +---------------------------------+ |
|                                                               |                   |
|                                                               v                   |
|                                               +---------------------------------+ |
|                                               | Resend HTTP API Email Delivery  | |
|                                               +---------------------------------+ |
+-----------------------------------------------------------------------------------+
```

---

## 3. Folder & File Map

```
sarita-med-reminder-v2/
├── .env.example                     # Reference template for Firebase and email environment variables
├── .env.local                       # Local environment variable configuration
├── .gitignore                       # Git ignore definitions (node_modules, .next, etc.)
├── AGENTS.md                        # Documentation rules regarding Next.js agent execution
├── CLAUDE.md                        # Project instructions marker
├── FIREBASE_SETUP_GUIDE.md          # Step-by-step setup documentation for Firestore database
├── README.md                        # High-level product overview, features, and setup instructions
├── next.config.ts                   # Next.js configuration with security headers and dev indicator flags
├── package.json                     # NPM dependencies, metadata, and execution scripts
├── package-lock.json                # Locked dependency tree
├── postcss.config.mjs               # PostCSS plugin pipeline for Tailwind CSS v4
├── tsconfig.json                    # TypeScript compiler configuration with @/* path aliases
├── vercel.json                      # Vercel deployment spec declaring daily cron job schedule
├── public/                          # Static public web assets
│   ├── icon.svg                     # Primary SVG brand pill icon
│   └── icons/                       # PWA application icons (192x192, 512x512)
├── tests/                           # Integration and regression test suites
│   ├── pipeline.test.ts             # TypeScript automated pipeline verification script
│   └── test-runner.js               # Standalone Node.js Marg parsing and matching test runner
└── src/
    ├── app/                         # Next.js App Router entry points
    │   ├── error.tsx                # Client-side Error Boundary preventing white-screen crashes
    │   ├── globals.css              # Global styles, Tailwind imports, keyframe animations, and print media rules
    │   ├── icon.svg                 # App favicon icon definition
    │   ├── layout.tsx               # Root HTML layout with brand metadata and Inter typography
    │   ├── page.tsx                 # Root index route rendering <AppShell />
    │   └── api/                     # Serverless Next.js API route handlers
    │       ├── cron/
    │       │   └── daily-alert/
    │       │       └── route.ts     # Scheduled cron route sending daily HTML refill briefing to owner
    │       └── send-owner-alert/
    │           └── route.ts         # On-demand manual test email dispatch endpoint
    ├── types/
    │   └── index.ts                 # Central TypeScript interfaces, entities, types, and data contracts
    ├── lib/                         # Core domain logic, utilities, and services
    │   ├── audio-alerts.ts          # Native Web Audio API synthesizer for acoustic chime alerts
    │   ├── brand.config.ts          # Central branding text, shop addresses, colors, and defaults
    │   ├── customer-matcher.ts      # Multi-tiered matching, merging, and list deduplication engine
    │   ├── data-store.ts            # Reactive singleton service managing state, sync, and persistence
    │   ├── email-service.ts         # Universal serverless HTML email generator and Resend dispatcher
    │   ├── firebase.ts              # Firebase app initialization, Firestore CRUD, and realtime listeners
    │   ├── marg-parser.ts           # In-browser parser for Marg ERP Grouped and Tabular reports
    │   ├── medicine-database.json   # Static dictionary containing 9,586+ pharmaceutical brand names
    │   ├── medicine-search.ts       # Autocomplete search utility querying medicine-database.json
    │   ├── monthly-comparator.ts    # Multi-month retention and churn audit comparison engine
    │   ├── refill-calculator.ts     # Chronological due-date and 5-day alert urgency calculation engine
    │   ├── sample-data.ts           # Pre-compiled fallback mock dataset for offline demonstration
    │   └── whatsapp.ts              # Hinglish WhatsApp reminder message formatting and dispatcher
    └── components/                  # React modular components organized by feature
        ├── analytics/
        │   └── AnalyticsView.tsx    # Retention metrics, revenue statistics, and top medication charts
        ├── customers/
        │   ├── AllCustomersView.tsx # Master customer directory with tree view and keyboard navigation
        │   ├── CustomerDrawer.tsx   # Slide-out patient profile drawer with history and quick actions
        │   └── EditCustomerModal.tsx# Modal for editing patient demographics and prescription items
        ├── dashboard/
        │   └── DashboardView.tsx    # Action Today stat cards, 5-day alert banner, and urgency table
        ├── layout/
        │   ├── AppShell.tsx         # Central layout controller, tab state coordinator, and event bus
        │   ├── MobileBottomNav.tsx  # Mobile-optimized 5-item thumb navigation bar
        │   ├── Sidebar.tsx          # Desktop navigation sidebar with status badges and PIN indicators
        │   ├── SplashScreen.tsx     # Startup animated splash screen with brand presentation
        │   └── TopBar.tsx           # Global header with live search, sound toggle, and sync controls
        ├── lock/
        │   ├── PinLockModal.tsx     # Full-screen staff PIN lock modal with touch numeric keypad
        │   └── PinVerifyModal.tsx   # Modal interceptor requiring PIN before opening protected tabs
        ├── modals/
        │   └── DispenseCalendarModal.tsx # Date picker modal for recording medication dispensed dates
        ├── monthly/
        │   └── MonthlyCustomersView.tsx # Dedicated chronic patient tracking directory with priority sorting
        ├── print/
        │   └── PrintListView.tsx    # Printable A4 physical call sheets and cuttable delivery bag slips
        ├── settings/
        │   └── SettingsView.tsx     # Configuration manager for PIN, alerts, templates, and Firebase
        └── uploads/
            ├── BillsAndUploadsView.tsx  # Drag-and-drop Marg file upload, preview, and batch manager
            └── MonthlyAuditDrawer.tsx   # Slide-out comparison drawer for retained vs. missing patients
```

---

## 4. Screens, Routes & Navigation

The application operates as a single-page application (SPA) managed by `src/components/layout/AppShell.tsx` on the root route (`/`). Tabs are swapped conditionally in React state without full page reloads.

| Screen / Tab | Component File | Trigger / Access | Displayed Content | User Actions Available | Data Read / Written |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Splash Screen** | `SplashScreen.tsx` | App boot / reload | Glowing brand emblem, title, tagline. Automatically transitions after 1.8s. | Click anywhere to skip instantly. | None. |
| **Startup PIN Lock** | `PinLockModal.tsx` | Immediately follows splash | Touch number pad, 4 dot indicators, brand icon. | Enter 4-digit PIN, backspace, clear, keyboard typing. | Reads `settings.pin`. Unlocks to `dashboard`. |
| **Inactivity PIN Lock** | `PinLockModal.tsx` | Idle timeout (`autoLockMinutes`) | Full-screen modal overlay blocking all view contents. | Enter PIN to resume session. | Reads `settings.pin`. Clears lock state. |
| **Tab Access PIN Gate** | `PinVerifyModal.tsx` | Clicking `customers`, `uploads`, or `settings` | Modal dialog requesting staff PIN before navigation. | Enter PIN, cancel (reverts tab), submit. | Reads `settings.pin`. Sets `activeTab` on match. |
| **Dashboard** (`dashboard`) | `DashboardView.tsx` | Default tab / Home | 4 summary metric cards, 5-day alert banner, Action Today table, status filters. | Play chime, filter by status, Call, WhatsApp, Mark Given/Refilled, select customer. | Reads `customers`, `reminders`. Writes reminder status and refill updates. |
| **Monthly Customers** (`monthly`) | `MonthlyCustomersView.tsx` | Sidebar / Bottom Nav | Filterable directory of regular monthly patients sorted by urgency rank. | Search, WhatsApp, Call, open Dispense Calendar, select customer. | Reads `customers` (`isMonthlyRegular: true`). Writes dispense records. |
| **All Customers** (`customers`) | `AllCustomersView.tsx` | Sidebar (PIN Protected) | Master directory of all customers, expandable tree structure, pagination, index numbers. | Toggle tree structure (`T`), toggle monthly (`Space`), edit customer, select customer, search. | Reads `customers`. Writes `isMonthlyRegular` toggle, updates customer details. |
| **Bills & Uploads** (`uploads`) | `BillsAndUploadsView.tsx` | Sidebar (PIN Protected) | Drop zone for Marg files, live match report, batch history table, audit drawer button. | Drag/drop file, preview report, commit batch, rollback batch, delete batch, open audit drawer. | Reads `customers`, `batches`. Writes new batches and merged customer records. |
| **Monthly Audit Drawer** | `MonthlyAuditDrawer.tsx` | "Monthly Audit" button in Uploads | Comparative analysis between reference month (July) and target month (August). | Switch comparison months, filter by missing/retained/new, toggle monthly, export CSV. | Reads `batches`, `customers`. Writes `isMonthlyRegular` toggles. |
| **Analytics** (`analytics`) | `AnalyticsView.tsx` | Sidebar tab | Revenue metrics, customer retention %, top 10 customers by spend, top 10 medicines. | View analytics cards, inspect customer rankings. | Reads `customers`, `batches`. Read-only. |
| **Print List** (`print`) | `PrintListView.tsx` | Sidebar tab | Pen-friendly A4 Staff Daily Refill Call Sheet and 2x4 cuttable Delivery Bag Slips. | Toggle Call Sheet / Delivery Slips, filter due range, trigger native `window.print()`. | Reads `customers`, `reminders`. Read-only. |
| **Settings** (`settings`) | `SettingsView.tsx` | Sidebar (PIN Protected) | Refill parameters, audio test, WhatsApp template editor, PIN change, Firebase config, email config, backup/restore. | Save parameters, change PIN, test audio, test Firebase, sync cloud, send test email, export/import JSON, clear all. | Reads & writes `settings`, triggers `dataStore` sync, import/export. |
| **Customer Drawer** | `CustomerDrawer.tsx` | Clicking customer row | Slide-out drawer with patient details, due countdown card, medicine breakdown, dispense history. | Call, WhatsApp, Mark Refilled, open Dispense Calendar, close drawer. | Reads `selectedCustomer`. Writes refill records. |
| **Edit Customer Modal** | `EditCustomerModal.tsx` | Clicking Edit in All Customers | Form fields for patient name, phone, code, address, notes, and medicine list with live search. | Add/edit/remove medicines, search 9,586+ drug database, save changes. | Writes updated `Customer` record via `dataStore.updateCustomerDetails`. |
| **Dispense Modal** | `DispenseCalendarModal.tsx` | "Dispense" button in Dashboard / Monthly | Date selector, quick offset buttons (Today, Yesterday, -2d, -3d), cycle days input (+15, +30, +60, +90). | Select date, pick cycle, confirm refill countdown reset. | Writes dispense date & cycle via `dataStore.recordDispensedDate`. |

---

## 5. Authentication, PIN Lock & Security Implementation

### Storage & Verification
- **Storage Location:** Stored in browser `localStorage` under key `sarita_med_settings_v2` as part of the `AppSettings` JSON object (`pin: string`).
- **Cloud Backup:** Also persisted in Firestore document `settings/app_config`.
- **Default PIN:** Defaults to `"1234"` (`DEFAULT_SETTINGS` in `src/lib/data-store.ts`).
- **Verification Method:** Checked via strict string equality (`candidate === correctPin`). No hashing is performed.

### Auto-Enter & Keypad Handling
- In both `PinLockModal.tsx` and `PinVerifyModal.tsx`, as soon as the length of entered digits matches `correctPin.length` (default 4), the `verifyPin()` function executes immediately without requiring an "Enter" button.
- A hidden `<input type="tel" pattern="[0-9]*" />` is mounted and auto-focused to intercept physical keyboard keystrokes and mobile soft keypads.

### Error Handling & Shake Animation
- When an incorrect PIN is submitted:
  - Error state `isError` is set to `true`.
  - An acoustic overdue warning chime is sounded via `audioAlerts.playOverdueAlert()`.
  - The UI indicators apply an `animate-shake` CSS animation and highlight in red (`bg-rose-500`).
  - After 450 milliseconds, the PIN input is automatically wiped clean and error flags are cleared so staff can re-enter digits immediately without pressing backspace.

### Lockout & Attempt Limits
- **Implementation Reality:** There is **NO lockout policy, attempt limit, or exponential backoff** in the code. A user can make unlimited PIN attempts without being locked out.

### Session Auto-Lock Logic
- Handled in `src/components/layout/AppShell.tsx`:
  - Listens to window events: `mousemove`, `keydown`, and `touchstart`.
  - A timer is configured based on `settings.autoLockMinutes` (default: 10 minutes).
  - If no interaction occurs within the window, `isLocked` is set to `true`, instantly mounting `PinLockModal.tsx`.

### Change PIN Flow
- Implemented in `src/components/settings/SettingsView.tsx`:
  - Staff must provide `currentPin` and `newPin`.
  - Validates that `currentPin === settings.pin` and `newPin` is exactly 4 numeric digits.
  - Updates `settings.pin` locally and persists to Firestore.
- **WhatsApp OTP:** **NOT IMPLEMENTED / NOT FOUND**. There is no OTP dispatch or verification flow for PIN changes.

### HTTP & Header Security
- Implemented in `next.config.ts`:
  - `X-Frame-Options: DENY` (prevents clickjacking)
  - `X-Content-Type-Options: nosniff` (prevents MIME sniffing)
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

---

## 6. Data Model & Storage

### Core Data Entities & Interfaces (`src/types/index.ts`)

#### 1. `Customer`
Master record representing a distinct patient.
- `id` (`string`): Deterministic identifier (e.g., `cust_p_9839123456`, `cust_c_0006`, or `cust_n_ramesh_kumar`).
- `name` (`string`): Full patient name.
- `nameNorm` (`string`): Lowercase alphanumeric normalized name for deduplication.
- `phone` (`string | undefined`): Formatted or raw phone number.
- `phoneNorm` (`string | undefined`): Exactly 10 digits starting with 6, 7, 8, or 9.
- `code` (`string | undefined`): Marg ERP patient ledger code (e.g., `0006`, `0014`).
- `address`, `notes` (`string | undefined`): Optional notes or address.
- `isMonthlyRegular` (`boolean`): **Source of Truth** for monthly tracking status.
- `regularityScore` (`number`): Score between 0 and 100 based on purchase frequency.
- `firstPurchaseDate` (`string`): ISO `YYYY-MM-DD`.
- `lastPurchaseDate` (`string`): ISO `YYYY-MM-DD` of last Marg bill.
- `lastRefillDate` (`string | undefined`): ISO date of last manual staff dispense confirmation.
- `nextDueDate` (`string`): ISO date when medications will run out.
- `alertDate` (`string`): ISO date when the 5-day warning begins (`nextDueDate - 5 days`).
- `totalPurchases` (`number`), `totalSpend` (`number`), `monthsActive` (`number`).
- `status` (`'active' | 'inactive' | 'archived'`).
- `medicines` (`CustomerMedicine[]`): Array of prescribed drugs.
- `history` (`PurchaseRecord[] | undefined`): Historical purchase transactions.
- `createdAt`, `updatedAt` (`string`): ISO timestamps.

#### 2. `CustomerMedicine`
Prescription item attached to a customer.
- `id` (`string`): Deterministic identifier (`med_dolo650_0`).
- `name` (`string`): Full brand name (e.g. `CYBLEX M XR 60 TAB`).
- `nameNorm` (`string`): Normalized lowercase medicine name.
- `packaging` (`string | undefined`): Pack size (e.g. `1*15TAB`, `100ML`).
- `qty` (`number`): Units purchased (strips, bottles, packs).
- `unit` (`string | undefined`): Raw or normalized unit string.
- `amount` (`number`): Cost of medicine in rupees.
- `refillCycleDays` (`number`): Days medication will last (default: 30).
- `lastPurchaseDate` (`string`): ISO date.
- `nextDueDate` (`string`): ISO date when this specific drug runs out.
- `status` (`'regular' | 'new' | 'changed' | 'stopped' | 'one-time'`).

#### 3. `UploadBatch`
Record of an ingested Marg ERP spreadsheet.
- `id` (`string`): Unique batch ID (e.g. `batch_1727635200000`).
- `fileName` (`string`): Derived display name (e.g. `July 2026 Sales Report (jully26.XLS)`).
- `originalFileName` (`string | undefined`): Raw file name as uploaded.
- `monthName` (`string | undefined`): Formatted month (e.g. `July 2026`).
- `monthKey` (`string | undefined`): Sorting key `YYYY-MM` (e.g. `2026-07`).
- `fileSize` (`number`): Size in bytes.
- `uploadDate` (`string`): ISO upload timestamp.
- `periodStart`, `periodEnd` (`string`): ISO sales date range.
- `formatType` (`'MARG_GROUPED_SUMMARY' | 'MARG_BILL_WISE_STATEMENT' | 'TABULAR_SALES_REGISTER'`).
- `totalRows`, `totalCustomers`, `newCustomersCount`, `repeatCustomersCount` (`number`).
- `status` (`'committed' | 'rolled_back'`).
- `customerIds` (`string[]`): Array of customer IDs contained in this batch.
- `newCustomers` (`Customer[] | undefined`): Array of newly created customers.

#### 4. `ReminderItem`
Derived entity representing an active alert for staff action.
- `id` (`string`): `rem_` + `customerId`.
- `customerId`, `customerName`, `customerPhone`, `customerCode`.
- `dueDate`, `alertDate` (`string`): ISO dates.
- `daysRemaining` (`number`): Positive for upcoming, negative for overdue.
- `urgency` (`'OVERDUE' | 'DUE_IN_5_DAYS' | 'UPCOMING'`).
- `medicinesSummary` (`string`), `medicinesList` (`string[]`).
- `status` (`'pending' | 'called' | 'confirmed' | 'not_needed' | 'not_reachable' | 'bought_elsewhere' | 'snoozed'`).
- `deliveryNeeded` (`boolean`), `notes` (`string | undefined`), `lastCallDate` (`string | undefined`), `calledBy` (`string | undefined`).

#### 5. `AppSettings`
System configuration entity.
- `pin` (`string`), `pinLength` (`number`), `autoLockMinutes` (`number`).
- `alertDaysBefore` (`number`), `defaultRefillCycleDays` (`number`).
- `enableAudioAlerts` (`boolean`), `enableBrowserNotifications` (`boolean`), `audioVolume` (`number`).
- `language` (`'en' | 'hi'`).
- `whatsappTemplate` (`string`).
- `firebaseConfig` (`object | undefined`).
- `enableOwnerEmailAlerts` (`boolean | undefined`), `ownerAlertEmail` (`string | undefined`), `emailProviderApiKey` (`string | undefined`), `emailSenderAddress` (`string | undefined`), `lastOwnerEmailAlertSentAt` (`string | undefined`).

### Source of Truth vs. Derived Fields
- **Source of Truth:**
  - `Customer.id`, `Customer.name`, `Customer.phone`, `Customer.code`, `Customer.medicines`.
  - `Customer.isMonthlyRegular` (staff manual toggle or customer-matcher assignment).
  - `Customer.lastPurchaseDate` and `Customer.lastRefillDate`.
  - `CustomerMedicine.refillCycleDays`.
  - `UploadBatch.id`, `UploadBatch.customerIds`.
  - `AppSettings` in `localStorage` and Firestore `settings/app_config`.
- **Derived / Calculated:**
  - `Customer.nextDueDate`: Calculated from `lastPurchaseDate` (or `lastRefillDate`) + `defaultRefillCycleDays`.
  - `Customer.alertDate`: Calculated as `nextDueDate - alertDaysBefore`.
  - `Customer.totalSpend`: Sum of all `CustomerMedicine.amount`.
  - `ReminderItem`: Recomputed dynamically on state change by `generateReminders()` in `src/lib/refill-calculator.ts`.
  - `MissingCustomerAuditItem` & `MonthlyAuditComparison`: Recomputed dynamically by `compareMonthlyBatches()` in `src/lib/monthly-comparator.ts`.

### Firebase Firestore Storage Structure
Configured in `src/lib/firebase.ts`:

| Firestore Collection | Document ID Format | Contents | Read / Write Points |
| :--- | :--- | :--- | :--- |
| **`all_customers`** | Sanitized `cust.id` (e.g. `cust_p_9839123456`) | Full `Customer` object with sanitized ID and `syncedAt` timestamp. | Read: `fetchCustomersFromFirestore()`, Realtime listener.<br>Written: `syncCustomersToFirestore()`, `syncSingleCustomerToFirestore()`. |
| **`monthly_customers`** | Sanitized `cust.id` | Full `Customer` object with `isMonthlyRegular: true`. | Read: `fetchMonthlyCustomersFromFirestore()`, Realtime listener.<br>Written: `syncMonthlyCustomerToFirestore()`, `syncAllMonthlyCustomersToFirestore()`. |
| **`all_uploads`** | `batch.id` (e.g. `batch_1727635200000`) | Full `UploadBatch` metadata, counts, and customer ID lists. | Read: `fetchBatchesFromFirestore()`, Realtime listener.<br>Written: `saveSingleBatchToFirestore()`, `syncBatchesToFirestore()`. |
| **`settings`** | Fixed document: `app_config` | Full `AppSettings` object (PIN, cycle, alert days, email config). | Read: `fetchSettingsFromFirestore()`.<br>Written: `syncSettingsToFirestore()`. |

### Firestore Security Rules
Recommended production rules defined in `FIREBASE_SETUP_GUIDE.md`:
```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /all_customers/{customerId} { allow read, write: if true; }
    match /monthly_customers/{customerId} { allow read, write: if true; }
    match /all_uploads/{batchId} { allow read, write: if true; }
    match /settings/{settingId} { allow read, write: if true; }
  }
}
```

---

## 7. Excel/Marg Upload Pipeline

The ingestion pipeline is completely client-side, executed through `src/lib/marg-parser.ts` and `src/lib/customer-matcher.ts`.

### Step 1: File & Folder Ingestion
- Supported Ingestion Modes in `src/components/uploads/BillsAndUploadsView.tsx`:
  - **Single Excel/CSV File:** Drag & drop or file picker.
  - **Multi-File Selection:** Using the `Select Files (Multi-Select)` button.
  - **Entire Monthly Folder:** Using HTML5 directory traversal (`webkitGetAsEntry` / `FileSystemDirectoryEntry`) via drag & drop or the `Select Folder (Daily Sheets)` button (`webkitdirectory` input). Scans recursively, automatically filtering out system artifacts (`~$*`, `.DS_Store`, `Thumbs.db`).
- Handled by `src/lib/folder-scanner.ts` (`scanFilesFromDropEvent`, `scanFilesFromInputEvent`).
- Supported extensions: `.xls`, `.xlsx`, `.csv`.

### Step 2: Format Detection & Parsing (`src/lib/marg-parser.ts`)
- Passed to `parseMargExcel(fileBuffer, fileName, defaultCycleDays, alertDaysBefore)`.
- SheetJS (`XLSX.read`) parses the workbook into a 2D row array (`XLSX.utils.sheet_to_json(sheet, { header: 1 })`).
- **Inspection of Header Rows:**
  - **Marg Bill Wise Sales Statement:** Checks for `BILL NO.` / `DESCRIPTION` / `BILL VALUE` or `BILL WISE SALES STATEMENT`. Invokes **`parseBillWiseSalesStatement()`**.
  - **Marg Grouped Summary:** Checks for headers matching `PATIENT/PRODUCT WISE SALES SUMMARY` or `SARITA PHARMACY`. Invokes **`parseGroupedMargReport()`**.
  - **Tabular Register:** Scans for column headers (`Date`, `Bill`, `Party/Customer`, `Mobile/Phone`, `Item`, `Qty`, `Amount`). Invokes **`parseTabularSalesReport()`**.

### Step 3: Date Range & Month Derivation
- Regex extracts sales dates from report headers:
  - Range Pattern: `/FROM\s+(\d{2}\/\d{2}\/\d{4})\s+TO\s+(\d{2}\/\d{2}\/\d{4})/i`
  - Single-Day Pattern: `/DATE\s*:\s*(\d{2}\/\d{2}\/\d{4})/i` or `/FOR\s+(\d{2}\/\d{2}\/\d{4})/i`
  - Fallback: Filename date patterns (e.g. `05-09-2026.xls`, `05-09.xls`, `2026-09-05.xlsx`).
  - Dates are converted from Indian format (`DD/MM/YYYY`) to ISO format (`YYYY-MM-DD`).
- `deriveMonthInfo()` extracts the month name (e.g. `July 2026`) and sorting key `monthKey` (e.g. `2026-07`) from dates or falls back to filename month tokens.

### Step 4: Customer & Medicine Row Extraction
- **In Marg Bill Wise Sales Statements (`01-09 TO 30-09.XLS`, `01-09.XLS`):**
  - Iterates through daily date sections separated by `DD/MM/YYYY` date rows.
  - Extracts customer descriptions from Col 1 after stripping payment mode suffixes (`CASH`, `CREDIT`, `CARD`, `UPI`, etc.).
  - Extracts 10-digit mobile phone numbers or 2-6 digit Marg patient codes (`0006`, `1212`, etc.).
  - Aggregates multi-bill customer visits across the month, calculating cumulative spend.
  - Generates clean prescription bill summary entries: `Prescription Bill (₹X)` without requiring itemized medicine rows.
  - **Automatic ₹1,000 Filter:** Automatically marks customers with total spend $\ge$ ₹1,000 as `isMonthlyRegular: true`.
- **In Grouped Marg Reports (`jully26.XLS`, `aug26.XLS`):**
  - Customer header rows match patterns:
    - Case 1: `/^(\d+)\.\s+(\d{3,10})\s+(.+)$/` (e.g. `84. 0006 NITI RANI KHESARI` or `456. 9936199660 MADHU PANDEY`).
    - Case 2: `/^(\d+)\.\s+([A-Za-z].+)$/` (e.g. `12. RAMESH KUMAR`).
  - Medicine rows below the header contain item name, packaging, quantity, and amount.
  - Regex `/^(.*?)\s{2,}([\d\*]+[A-Za-z0-9]+)$/` separates product name from packaging.
  - Quantity `/^([\d\.\-]+)/` converts Marg ratio strings (e.g., `6:0 STRP` $\rightarrow$ `6`).

### Step 5: Chronological Merge & Customer Matching (`src/lib/customer-matcher.ts`)
- Executed by `matchAndMergeChronologicalBatches(existingCustomers, parsedBatches, defaultCycleDays, alertDaysBefore, folderName)`:
- **Chronological Sequencing:** Daily batches are automatically sorted in ascending date order (`periodEnd` / `periodStart`).
- **Sequential Ingestion:**
  - If a patient visits on Day 2 and Day 22:
    - Day 2 initializes the patient's record.
    - Day 22 updates `lastPurchaseDate = Day 22`, recalculating `nextDueDate` from Day 22 using their refill duration.
  - If an incoming bill is older than the currently recorded date (e.g. supplementary sheet), spend is accumulated and missing medicines are merged without rolling back the newer due date.
- **Deduplication Hierarchy:**
  1. **Primary Key (10-Digit Mobile):** If `incoming.phoneNorm` matches `existing.phoneNorm`.
  2. **Secondary Key (Marg Party Code):** If `incoming.code` matches `existing.code`.
  3. **Fallback Key (Normalized Name):** If `incoming.nameNorm` matches `existing.nameNorm`.
- **Merge Guarantees & Monthly Selection Logic:**
  - **Zero Duplicate Customers:** Deterministic IDs and phone/code/name indexes guarantee single customer documents.
  - **Auto-Selected for Monthly Tracking ($\ge$ ₹1,000):** If incoming customer has spend $\ge$ ₹1,000, they are automatically placed in "Monthly Customers" (`isMonthlyRegular: true`) and saved in "All Customers".
  - **Unticked by Default (< ₹1,000):** If total spend is under ₹1,000 and not previously selected by staff, saved in "All Customers" with `isMonthlyRegular: false`.
  - **Staff Selections Preserved:** Existing staff manual `isMonthlyRegular` selections remain 100% untouched.
  - **Consolidated Batch:** Produces a single unified `UploadBatch` representing the entire folder or multi-file set with `isFolderBatch: true`, `filesCount`, and `dailyFilesList`.

### Step 6: Batch Commitment & Persistence
- User clicks "Commit Batch to Database" in `BillsAndUploadsView.tsx`.
- Calls `dataStore.setCustomers(mergedCustomers, newBatch)`:
  - Updates `this.customers` and `this.batches` in memory.
  - Saves immediately to browser `localStorage` (`CUSTOMERS_KEY` & `BATCHES_KEY`).
  - Asynchronously pushes the batch document to Firestore collection **`all_uploads`**.
  - Pushes customer records in safe batches of 25 to Firestore collection **`all_customers`**.
  - Re-evaluates active reminders.

### Step 7: Rollback & Deletion Behavior
- **Rollback (`dataStore.rollbackBatch(batchId)`):** Sets `batch.status = 'rolled_back'`. Retains customer records in `all_customers`.
- **Delete Batch (`dataStore.deleteUploadBatch(batchId)`):** Removes the packaging record from `this.batches`, updates `localStorage`, and deletes the document from Firestore `all_uploads`. **Strict Protection:** Does not delete customer documents from `all_customers`, preventing accidental patient data loss.

---

## 8. Business Logic & Calculations

### 1. Refill Due Date Calculation
- **File & Function:** `src/lib/marg-parser.ts` $\rightarrow$ `computeDueDate()`; `src/lib/data-store.ts` $\rightarrow$ `recordDispensedDate()`.
- **Formula:**
  $$\text{nextDueDate} = \text{purchaseDate} + \text{refillCycleDays}$$
- **Default Refill Cycle:** 30 days (`BRAND.defaults.refillCycleDays`, `DEFAULT_SETTINGS.defaultRefillCycleDays`).
- **Calculation Mechanism:** Split-based integer date arithmetic (`Date(year, month - 1, day + cycle)`) avoiding UTC/DST boundary shifts.

### 2. Advance Alert Window & Date
- **File & Function:** `src/lib/marg-parser.ts` $\rightarrow$ `computeAlertDate()`.
- **Formula:**
  $$\text{alertDate} = \text{nextDueDate} - \text{alertDaysBefore}$$
- **Default Alert Threshold:** 5 days (`BRAND.defaults.alertDaysBefore`, `DEFAULT_SETTINGS.alertDaysBefore`).

### 3. Days Remaining Calculation
- **File & Function:** `src/lib/refill-calculator.ts` $\rightarrow$ `getDaysRemaining()`.
- **Formula:**
  $$\text{daysRemaining} = \text{round}\left(\frac{\text{dueDate}_{\text{midday}} - \text{today}_{\text{midday}}}{86,400,000 \text{ ms}}\right)$$
- Evaluated at local midday (12:00:00) to prevent 23-hour or 25-hour daylight saving shifts.

### 4. Urgency Classification
- **File & Function:** `src/lib/refill-calculator.ts` $\rightarrow$ `generateReminders()`.
- **Rules:**
  - If $\text{daysRemaining} < 0$: Urgency = **`OVERDUE`** (Red badges, 3-tone attention alert sound).
  - If $0 \le \text{daysRemaining} \le 5$: Urgency = **`DUE_IN_5_DAYS`** (Amber badges, 2-tone hospital chime alert).
  - If $\text{daysRemaining} > 5$: Urgency = **`UPCOMING`** (Blue/neutral badge).

### 5. Reminder Generation Filter
- **File & Function:** `src/lib/refill-calculator.ts` $\rightarrow$ `generateReminders()`.
- **Strict Business Rule:** Reminders are **strictly generated for Monthly Regular customers** (`isMonthlyRegular: true && status === 'active'`) with active medicines and a valid due date. One-time counter sales and unselected patients in "All Customers" do not clutter the Dashboard Action Today table.

### 6. Monthly Sorting Rank (Priority Rules)
- **File & Function:** `src/components/monthly/MonthlyCustomersView.tsx` $\rightarrow$ `sorted`.
- **Sorting Rank:**
  - Rank 0: Overdue ($< 0$ days) at the very top.
  - Rank 1: Alert Mode ($0$ to $5$ days).
  - Rank 2: Upcoming ($6$ to $25$ days).
  - Rank 3: Completed / Just Refilled ($> 25$ days) automatically drop to the bottom.

### 7. Monthly Retention & Audit Logic
- **File & Function:** `src/lib/monthly-comparator.ts` $\rightarrow$ `compareMonthlyBatches()`.
- **Audit Categories:**
  - **`RETAINED`:** Customer purchased in reference month (e.g. July) AND purchased in target month (e.g. August).
  - **`MISSING_THIS_MONTH`:** Customer purchased in reference month (e.g. July) BUT has no transaction in target month (e.g. August). Marked as churn/missing.
  - **`NEW_THIS_MONTH`:** Customer has transactions in target month (August) but was absent in reference month (July).

### 8. Acoustic Synthesizer Sound Design
- **File & Function:** `src/lib/audio-alerts.ts`.
- **5-Day Refill Chime:** Ascending sine wave triad:
  - Note 1: $C_5$ ($523.25\text{ Hz}$), duration $0.35\text{s}$
  - Note 2: $G_5$ ($783.99\text{ Hz}$), duration $0.60\text{s}$
  - Note 3: $C_6$ ($1046.50\text{ Hz}$), duration $0.80\text{s}$
- **Overdue Alert:** 3-tone triangle wave sequence:
  - Note 1: $A_5$ ($880.00\text{ Hz}$), duration $0.25\text{s}$
  - Note 2: $E_5$ ($659.25\text{ Hz}$), duration $0.25\text{s}$
  - Note 3: $D_5$ ($587.33\text{ Hz}$), duration $0.50\text{s}$
- **Recurring Alert:** Fires every 5 minutes ($300,000\text{ ms}$) if any monthly customer remains in pending Alert Mode or Overdue status.

---

## 9. Feature-by-Feature Behaviour

### 1. Dashboard
- **Inputs:** `customers`, `reminders`, `searchQuery`.
- **Outputs:** Reminder status updates, dispense records, WhatsApp URL dispatch.
- **Key Sub-features:**
  - 4 Stat Cards: Monthly Regulars, Due in 5 Days, Overdue, Total Registered.
  - 5-Day Refill Alert Banner: Orange gradient banner with "Chime Alert" button.
  - Action Today Table: Displays urgency badges, medicine summaries, Call button, WhatsApp button, and Dispense Calendar trigger.

### 2. Monthly Customers Tab
- **Inputs:** `customers` filtered by `c.isMonthlyRegular === true`.
- **Outputs:** Refill confirmations, WhatsApp links.
- **Key Sub-features:**
  - Status filters: `ALL`, `DUE_SOON`, `OVERDUE`, `COMPLETED`.
  - Automated priority sorting putting overdue and due-soon at the top.
  - One-click Dispense button resetting the 30-day cycle.

### 3. All Customers Tab
- **Inputs:** `customers` master list.
- **Outputs:** `isMonthlyRegular` toggle, customer demographic/prescription edits.
- **Key Sub-features:**
  - Expandable Tree Structure showing medicines, dosages, quantities, and dates.
  - Keyboard shortcut <kbd>T</kbd> to toggle tree expansion for focused row.
  - Keyboard shortcut <kbd>Space</kbd> or single-click checkbox to add/remove from Monthly Regular list.
  - Global "Expand All Trees" / "Collapse All Trees" control.
  - Pagination (50 rows per page) with direct jump buttons.

### 4. Bills & Uploads Tab
- **Inputs:** Spreadsheets (`.XLS`, `.XLSX`, `.CSV`).
- **Outputs:** New `UploadBatch` records, merged master customers.
- **Key Sub-features:**
  - In-browser parsing of Marg summary reports.
  - Pre-commit matching breakdown showing new vs. repeat patients.
  - Rollback and delete controls for uploaded batches.
  - Trigger button for the Monthly Audit & Missing Patients Drawer.

### 5. Monthly Audit & Missing Patients Drawer
- **Inputs:** Selected reference batch and target batch.
- **Outputs:** Filterable list of retained, missing, and new patients, CSV download.
- **Key Sub-features:**
  - Automatic detection of missing patients who missed their refill month.
  - Direct WhatsApp outreach to missing patients.
  - Checkboxes to promote retained patients to the Monthly Roster.

### 6. Analytics Tab
- **Inputs:** `customers`, `batches`.
- **Outputs:** Summary sales calculations.
- **Key Sub-features:**
  - Total pharmacy sales vs. regular monthly customer sales.
  - Customer retention percentage.
  - Top 10 patients by total spend.
  - Top 10 prescribed medications across all customer records.

### 7. Print List (A4 Staff Call Sheet & Slips)
- **Inputs:** `customers`, `reminders`.
- **Outputs:** Native print dialog via `window.print()`.
- **Key Sub-features:**
  - Mode 1: Staff Call Sheet with pen-friendly checkboxes (`[ ] Refill`, `[ ] Not Needed`, `[ ] Home Delivery`).
  - Mode 2: 2x4 cuttable delivery bag slips with dotted cut lines.
  - Filter by Due in 5 Days, Overdue, or All Pending.

### 8. Settings Tab
- **Inputs:** User input fields for PIN, alert days, cycle days, templates, email keys.
- **Outputs:** Updated `AppSettings` saved to `localStorage` and Firestore.
- **Key Sub-features:**
  - PIN modification form.
  - Hinglish WhatsApp template editor with placeholder tokens (`{name}`, `{medicines}`, `{dueDate}`).
  - Test audio alert button.
  - Firestore cloud configuration fields with live connection test.
  - Daily owner email briefing configuration with "Send Test Briefing" button.
  - Offline JSON data export and import.

### 9. Customer Drawer
- **Inputs:** `selectedCustomer`.
- **Outputs:** Direct telephone dialer (`tel:`), WhatsApp message, dispense modal.
- **Key Sub-features:**
  - Slide-out animation from the right.
  - Full prescription medicine breakdown.
  - Dispense history timeline.

### 10. Edit Customer Modal
- **Inputs:** Customer demographic and medicine data.
- **Outputs:** Updated customer record written to `dataStore`.
- **Key Sub-features:**
  - Real-time search across 9,586+ medicine database.
  - Auto-fill of suggested packaging (e.g. `1*15TAB`).

---

## 10. UI/UX & Design System

### Design Tokens & Color Palette
Centralized in `src/lib/brand.config.ts` and Tailwind CSS:
- **Primary / Medical Teal:**
  - Base: `#0d9488` (`teal-600`)
  - Dark: `#0f766e` (`teal-700`)
  - Light: `#14b8a6` (`teal-500`)
  - Surface: `#f0fdfa` (`teal-50`)
- **Accent:** `#0284c7` (`sky-600`)
- **Warning / Alert:** `#f59e0b` (`amber-500`), `#ea580c` (`orange-600`)
- **Urgent / Overdue:** `#ef4444` (`red-500`), `#b91c1c` (`red-700`)
- **Success / Refilled:** `#10b981` (`emerald-500`)
- **Neutral Backgrounds:** `#f8fafc` (`slate-50`), `#ffffff` (white cards), `#0f172a` (`slate-900` text)

### Typography
- Configured in `src/app/globals.css`:
  - `font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;`
  - Monospace font (`font-mono`) used for all dates, telephone numbers, currency amounts, and patient codes.

### Layout Structure
- **Desktop ($\ge 768\text{px}$):**
  - Left navigation sidebar (`w-64`, fixed/collapsible).
  - Main content pane with sticky top header (`TopBar.tsx`, `h-16`).
  - Max-width container (`max-w-7xl mx-auto`).
- **Mobile ($< 768\text{px}$):**
  - Top bar with hamburger button opening the full sidebar overlay.
  - 1-thumb bottom navigation bar (`MobileBottomNav.tsx`, `fixed bottom-0`).
  - Safe-area bottom padding (`pb-[max(0.375rem,env(safe-area-inset-bottom))]`).

### Print Stylesheet (`@media print`)
Configured in `src/app/globals.css`:
- `@page { size: A4 portrait; margin: 12mm 12mm 22mm 12mm; }`
- Pure white background (`#ffffff !important`) and crisp black text (`#000000 !important`).
- Automatically hides all non-printable elements: `aside, header, nav, .no-print, button, input { display: none !important; }`.
- Prevents table row page breaks: `tr { break-inside: avoid; page-break-inside: avoid; }`.

---

## 11. Dependencies Between Components (Change Impact Map)

| If You Change This File / Concept | These Files & Features Are Directly Impacted | Potential Risk or Breakage |
| :--- | :--- | :--- |
| **`src/types/index.ts`** (`Customer`, `UploadBatch`, `ReminderItem`) | `data-store.ts`, `customer-matcher.ts`, `marg-parser.ts`, `AllCustomersView.tsx`, `MonthlyCustomersView.tsx`, `DashboardView.tsx`, `firebase.ts` | High. TypeScript compiler errors across entire application. |
| **`src/lib/firebase.ts`** (Collection names or CRUD methods) | `data-store.ts`, `/api/cron/daily-alert/route.ts`, `SettingsView.tsx` | Critical. Misaligning collection names (`all_customers`, `monthly_customers`, `all_uploads`, `settings`) causes cloud sync failure or data disappearance on refresh. |
| **`src/lib/data-store.ts`** (`init()`, `syncWithFirebase()`, `setCustomers()`) | `AppShell.tsx`, `DashboardView.tsx`, `AllCustomersView.tsx`, `BillsAndUploadsView.tsx` | Critical. Altering empty-state or merge logic can reintroduce local storage wiping bugs. |
| **`src/lib/marg-parser.ts`** (Regex or date extraction) | `customer-matcher.ts`, `BillsAndUploadsView.tsx`, `tests/test-runner.js` | High. Modifying Marg header regex breaks customer detection from Marg `.XLS` exports. |
| **`src/lib/customer-matcher.ts`** (Matching hierarchy) | `BillsAndUploadsView.tsx`, `MonthlyAuditDrawer.tsx`, `tests/pipeline.test.ts` | High. Changing phone/code/name priority can result in duplicate customer profiles. |
| **`src/lib/refill-calculator.ts`** (`generateReminders()`, `getDaysRemaining()`) | `DashboardView.tsx`, `MonthlyCustomersView.tsx`, `PrintListView.tsx`, `TopBar.tsx`, `/api/cron/daily-alert` | High. Changing formulas shifts 5-day alert windows, audio chimes, and action lists. |
| **`src/components/lock/PinLockModal.tsx`** or **`PinVerifyModal.tsx`** | `AppShell.tsx`, `Sidebar.tsx` | Medium. Modifying auto-enter or validation logic can lock staff out of the application. |
| **`src/lib/audio-alerts.ts`** (Web Audio frequencies or gain ramps) | `AppShell.tsx`, `DashboardView.tsx`, `TopBar.tsx`, `SettingsView.tsx` | Low. Audio distortion or browser autoplay policy violations. |
| **`src/lib/whatsapp.ts`** (Template formatting or cleaning functions) | `DashboardView.tsx`, `MonthlyCustomersView.tsx`, `CustomerDrawer.tsx`, `MonthlyAuditDrawer.tsx` | Medium. Formatting errors or broken WhatsApp web/app redirection links. |
| **`src/lib/brand.config.ts`** (Branding constants & defaults) | `layout.tsx`, `TopBar.tsx`, `Sidebar.tsx`, `PrintListView.tsx`, `SplashScreen.tsx` | Low. Mismatched branding text or default parameter discrepancies. |

---

## 12. Configuration & Environment

### Environment Variables
Configured in `.env.local` / Vercel Environment Variables:

| Variable Name | Purpose | Required For |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key for client SDK authentication | Cloud Firestore sync |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase authentication domain (e.g. `*.firebaseapp.com`) | Cloud Firestore sync |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project identifier | Cloud Firestore sync |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Cloud storage bucket URL | Firebase initialization |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | FCM messaging sender ID | Firebase initialization |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Unique Firebase Web Application ID | Firebase initialization |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | Optional Google Analytics measurement ID | Firebase analytics (optional) |
| `CRON_SECRET` | Secret bearer token protecting scheduled cron routes | Vercel Cron invocation |
| `OWNER_ALERT_EMAIL` | Fallback email address for daily owner alert briefing | Daily cron notifications |
| `RESEND_API_KEY` / `EMAIL_API_KEY` | API token for Resend HTTP email delivery service | Daily cron & test emails |
| `EMAIL_FROM` | Sender email address (e.g. `onboarding@resend.dev`) | Outgoing alert emails |

### Build, Run & Test Commands
```bash
# Start development server on port 3001
npm run dev

# Run TypeScript typechecker without emitting files
npx tsc --noEmit

# Build production bundle with Next.js Turbopack
npm run build

# Start production server
npm run start

# Execute integration test runner for Marg Excel parsing
node tests/test-runner.js
```

### External Services Integration
- **Google Firebase Cloud Firestore:** Connected client-side via Firebase JS SDK (`src/lib/firebase.ts`) and server-side in API routes. Utilizes project `sarita-med-reminder` with collections `all_customers`, `monthly_customers`, `all_uploads`, and `settings`.
- **WhatsApp Web / Mobile API:** Deep links dispatched via universal URL protocol `https://api.whatsapp.com/send?phone=91XXXXXXXXXX&text=...` (`src/lib/whatsapp.ts`).
- **Resend Email API:** Outgoing HTTP POST calls to `https://api.resend.com/emails` (`src/lib/email-service.ts`).

---

## 13. Known Issues, Gaps & Technical Debt

1. **Unused `bcryptjs` Dependency:**
   - `bcryptjs` is declared in `package.json` (`^3.0.3`), but the PIN is evaluated and stored in plain text.
2. **Missing Attempt Limits on PIN Entry:**
   - Both `PinLockModal.tsx` and `PinVerifyModal.tsx` allow unlimited attempts without lockout or rate limiting.
3. **Missing Language Toggle UI:**
   - `language: 'en' | 'hi'` exists in types and default settings, but there is no switcher in `SettingsView.tsx` and no string dictionary for Hindi localization.
4. **No True Server-Side Auth:**
   - All Firestore rules rely on open access (`allow read, write: if true;`) or client-side checks. Anyone with the Firebase config can theoretically interact with Firestore if not restricted by IP or App Check.
5. **Static Medicine Database Bundle Size:**
   - `medicine-database.json` contains 9,586+ entries ($260\text{ KB}$) bundled directly into client chunks. A server-side search route could optimize initial bundle loading.
6. **Hardcoded Fallback Phone & Doctor Data:**
   - In `tests/test-runner.js` and `src/lib/sample-data.ts`, static fallback strings exist for mock simulations.
7. **Simulated Email Warning:**
   - If no `RESEND_API_KEY` is set, `email-service.ts` simulates success without alerting the user that the email was not actually dispatched over SMTP/HTTP.

---

## 14. Safe-Change Guidelines

### Critical Modules (Handle With Extreme Caution)
- **`src/lib/data-store.ts`:** Contains synchronization logic, offline caching, and race condition protections. Do not reintroduce empty-array wipe logic on empty snapshots.
- **`src/lib/firebase.ts`:** Collection names must strictly remain `all_customers`, `monthly_customers`, `all_uploads`, and `settings`.
- **`src/lib/marg-parser.ts`:** Regex patterns for customer headers and medicine lines are calibrated specifically against Marg ERP outputs.
- **`src/lib/refill-calculator.ts`:** Timezone arithmetic relies on local midday (12:00:00). Do not switch to raw UTC timestamps.

### Post-Change Verification Checklist
After making any change to the codebase, run this checklist before deploying:
- [ ] Run `npx tsc --noEmit` and confirm 0 TypeScript compiler errors.
- [ ] Run `npm run build` and confirm Next.js Turbopack completes successfully.
- [ ] Run `node tests/test-runner.js` to ensure Marg parsing and customer matching logic remain intact.
- [ ] Verify that page refresh retains customer data and does not clear `localStorage` or Firestore.
- [ ] Test toggling a customer into "Monthly Customers" and verify document creation in `monthly_customers`.
- [ ] Verify that <kbd>T</kbd> and tree expansion buttons render properly in All Customers.
- [ ] Verify that audio alerts play correctly via the "Chime Alert" button on the Dashboard.
