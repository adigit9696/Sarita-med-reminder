# 💊 Sarita Pharmacy Med Reminder v2.0
> **Powered by Oasis MedTeck**  
> *Smart Chronic Medicine Refill Tracker & 5-Day Alert Notification System for Retail Pharmacies*

---

## 🌟 Overview & Core Purpose

**Sarita Pharmacy Med Reminder v2** is a professional, high-performance web application purpose-built for retail pharmacies using **Marg ERP**. 

Its primary purpose is to:
1. **Analyze monthly Marg ERP sales reports** (`.XLS`, `.XLSX`, `.CSV`), automatically detecting customer identities and repeat chronic medicine buyers.
2. **Match newly uploaded monthly files against previously uploaded files** (by 10-digit mobile number, Marg patient ledger code, and normalized patient name).
3. **Populate a dedicated "Monthly Customers" tab** for repeat monthly buyers so pharmacy staff don't have to wade through noise or one-time counter sales.
4. **Preserve every customer in the "All Customers" tab** as a master reference to compare against future months.
5. **Predict when each patient's chronic medication will run out** (default 30-day refill cycle) and **notify the pharmacy 5 days in advance via visual badges and acoustic alert sounds**.
6. **Provide pen-friendly printable A4 call sheets** and **cut-and-paste home delivery slips**.
7. **Cloud sync with Google Firebase Firestore** while maintaining a 100% offline-resilient local cache.

---

## 📊 Marg ERP File Analysis (`jully26.XLS` & `aug26.XLS`)

When analyzing the actual pharmacy files from Marg ERP:

| Format Trait | Marg ERP Summary Report (`jully26.XLS`, `aug26.XLS`) | Standard Tabular Sales Register |
| :--- | :--- | :--- |
| **Structure** | Hierarchical Grouped Report (`PATIENT/PRODUCT WISE SALES SUMMARY`) | Flat tabular rows (`Date, Bill No, Party, Mobile, Item, Qty, Amount`) |
| **Sales Period** | Header: `FROM DD/MM/YYYY TO DD/MM/YYYY` | Per-row bill date column |
| **Customer Header** | `84.  0006       NITI RANI KHESARI`<br>`456. 9936199660 MADHU PANDEY` | `Party Name` + `Mobile No.` |
| **Medicine Items** | `CYBLEX M XR 60 TAB    1*15TAB` with Qty (`6:0 STRP`) and Amount | `Item Name`, `Qty`, `Amount` |
| **Customer Overlap** | **161 repeat customers** matched between July & August | Preserved identically |

### Which Information is Important for Monthly Tracking:
1. **Customer Mobile Number** (10 digits starting with 6, 7, 8, 9) — Primary matching key (100% accuracy).
2. **Marg ERP Patient Code** (e.g. `0006`, `0014`) — Secondary matching key (95% accuracy for ledger accounts).
3. **Patient Full Name** (Normalized) — Fallback match (90% accuracy).
4. **Sales Period End Date** — Baseline purchase date from which the 30-day refill cycle is counted.
5. **Medicine Name & Pack Size** (e.g., `CYBLEX M XR 60 TAB 1*15TAB`) — Displayed to staff so they can confirm exact brands.
6. **Quantity & Units** (e.g., `1:0 STRI`, `6:0 STRP`) — Indicates whether patient bought 1 month or multiple months.
7. **Amount (₹)** — Patient value and order confirmation.

---

## 🖥️ Application Sections

The sidebar and user interface are streamlined, clean, and completely uncluttered:

1. **Dashboard**:
   - 4 Stat Cards: *Monthly Customers*, *Due in 5 Days*, *Overdue*, *All Registered*.
   - **5-Day Refill Alert Banner**: Highlighting urgent refills with a 1-click **"Chime Alert"** sound button.
   - **Action Today Table**: Urgency-sorted list of patients due within 5 days or overdue, with 1-click **Call**, **WhatsApp Reminder**, and **"Mark Given/Refilled"** buttons.
2. **Monthly Customers**:
   - Dedicated directory of repeat chronic patients.
   - Shows regularity score, regular medicines list, next due date, and days remaining.
   - Clicking any patient opens the slide-out **Customer Profile Drawer** with prescription timeline and actions.
3. **All Customers**:
   - Master directory of all customers across all uploaded Excel files.
   - Searchable by name, 10-digit mobile, or medicine.
   - Displays total spend, number of prescriptions, and months active.
4. **Bills & Uploads**:
   - Drag & Drop uploader supporting `.XLS`, `.XLSX`, and `.CSV`.
   - Automatic format detection (Marg Grouped Summary or Tabular).
   - Live matching report (New patients vs Repeat monthly customers detected).
   - Upload batch history with single-click **Rollback**.
   - **Quick Load Button**: 1-click pre-loader for July & August 2026 data!
5. **Analytics**:
   - Pharmacy sales metrics, monthly revenue vs regular customer revenue.
   - Customer retention rate.
   - Top 10 patients by spend (rank badges #1, #2, #3).
   - Top prescribed chronic medications.
6. **Print List**:
   - **Staff Call Sheet**: A4 layout with pen-friendly checkboxes `[ ] Refill   [ ] Not Needed`.
   - **Delivery Bag Labels**: 2x4 cuttable grid with dotted lines to staple/tape onto medicine delivery bags.
7. **Settings**:
   - Refill parameters (Advance alert days [default 5], Chronic cycle days [default 30]).
   - **Audio Alert Sound Test & Mute Toggle** (gentle Web Audio API synthesizer).
   - WhatsApp message template editor (supports `{name}`, `{medicines}`, `{dueDate}`).
   - **Staff PIN Security**: 4-digit PIN lock screen with touch number pad and auto-lock on inactivity.
   - **Firebase Cloud Database Setup**: Step-by-step guide and credentials configuration.
   - **Backup & Restore**: Offline JSON export/import.

---

## 🔊 5-Day Alert Sound System

The application incorporates a **native Web Audio API synthesizer**:
- **Zero MP3/network dependencies** — works 100% offline.
- When any customer's due date is within **5 days** (or overdue), the system rings a gentle, hospital-grade ascending chime (`C5 -> G5 -> C6`).
- Can be tested with 1 click from the Top Bar or Settings.
- Can be muted/unmuted anytime.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling**: Tailwind CSS v4 + Vanilla CSS animations
- **Icons**: Lucide React (pure inline SVG, zero emoji in UI)
- **Spreadsheet Engine**: SheetJS (`xlsx`)
- **Cloud Database**: Google Firebase Cloud Firestore (`firebase` v11)
- **Local Persistence**: LocalStorage / IndexedDB fallback
- **Audio Alerts**: Web Audio API Synthesizer

---

## 🚀 Running the Project

```bash
# Navigate to project
cd sarita-med-reminder-v2

# Install dependencies (already installed)
npm install

# Start development server on port 3001
npm run dev

# Run full Marg Excel & Customer Matching test
node tests/test-runner.js

# Build production bundle
npm run build
```

Open [http://localhost:3001](http://localhost:3001) in your browser.

---

## 🔒 Security & Data Protection
- Compliant with India's Digital Personal Data Protection (DPDP) Act 2023.
- All HTTP headers hardened via `next.config.ts` (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`).
- Staff PIN lock screen protects client workstation from unauthorized walk-ins.
- Offline resilience guarantees that patient records remain secure and accessible during network outages.
