# Sarita Pharmacy Med Reminder — Staff User Guide (Hinglish)

> **Last Updated:** 30 September 2026  
> **Document Purpose:** Pharmacy staff aur counter team ke liye step-by-step complete user manual.  
> **Language:** Simple Hinglish (Hindi in Roman script with standard English pharmacy terms).

---

## Table of Contents

- [0. Is guide ka use kaise karein](#0-is-guide-ka-use-kaise-karein)
- [1. App ka Overview](#1-app-ka-overview)
- [2. App Kholna aur Login (Startup)](#2-app-kholna-aur-login-startup)
- [3. Screen ka Layout](#3-screen-ka-layout)
- [4. Dashboard (Aaj ka Kaam)](#4-dashboard-aaj-ka-kaam)
- [5. All Customers Tab](#5-all-customers-tab)
- [6. Monthly Customers Tab](#6-monthly-customers-tab)
- [7. Refill Duration (Dawai kitne din ki di gayi)](#7-refill-duration-dawai-kitne-din-ki-di-gayi)
- [8. Bills & Uploads (Har Mahine ka Excel Upload) — STEP BY STEP](#8-bills--uploads-har-mahine-ka-excel-upload--step-by-step)
- [9. Print List](#9-print-list)
- [10. Analytics Tab](#10-analytics-tab)
- [11. Settings Tab](#11-settings-tab)
- [12. Roz ka Kaam (Daily Routine)](#12-roz-ka-kaam-daily-routine)
- [13. Mahine ka Kaam (Monthly Routine)](#13-mahine-ka-kaam-monthly-routine)
- [14. Ek Poora Example (Customer ki Journey)](#14-ek-poora-example-customer-ki-journey)
- [15. Aksar Puche Jaane Wale Sawal (FAQ) aur Problems](#15-aksar-puche-jaane-wale-sawal-faq-aur-problems)
- [16. Kya Karein / Kya Na Karein (Do's and Don'ts)](#16-kya-karein--kya-na-karein-dos-and-donts)
- [17. Ek Page ka Cheat Sheet](#17-ek-page-ka-cheat-sheet)
- [18. Owner ke liye Technical Notes](#18-owner-ke-liye-technical-notes)

---

## 0. Is guide ka use kaise karein

- **Main Maqsad:** Ye app hamare regular chronic (BP, Sugar, Heart, Thyroid) customers ki dawai khatam hone se theek 5 din pehle hume yaad dilata hai, taaki unki dawai kabhi choote na aur pharmacy ki monthly sales bane rahe.
- **Staff ke liye aasan rasta:** Agar aap naye hain to pehle **Section 1**, **2**, aur **12** padhein.
- **Har roz ke kaam ke liye:** Subah counter par aakar **Section 4 (Dashboard)** aur **Section 9 (Print List)** dekhein.
- **Mahine ke bill upload ke liye:** Har mahine naya bill aane par **Section 8** ka step-by-step tareeqa follow karein.
- **Screen matching:** Guide mein buttons aur column ke naam bilkul waise hi English mein likhe hain jaise computer screen par dikhte hain (jaise `"Refilled"`, `"Monthly Customers"`, `"Commit & Add to Database"`).

---

## 1. App ka Overview

Sarita Pharmacy Med Reminder app Marg ERP ke sales data ko smart reminder system mein badalta hai.

### Kaun kya use karta hai?
1. **Counter Staff (Aap):** Roz Dashboard par dekhte hain kis patient ki dawai due hai, unhe call ya WhatsApp karte hain, dawai pack karke deliver/dispense karte hain, aur `"Refilled"` mark karte hain.
2. **Shop Owner:** Monthly reports, settings, cloud sync, aur email summary dekhte hain.

### Poora Flow (Text Diagram)

```text
[Marg ERP Software]
       │
       ▼ (Export: PATIENT/PRODUCT WISE SALES SUMMARY Excel)
[Bills & Uploads Tab] ──► Upload & Click "Commit & Add to Database"
       │
       ▼
[All Customers Tab] ────► Naye customers master list mein aate hain
       │                 Staff "Track Monthly" tick karta hai
       ▼
[Monthly Customers] ───► Auto calculate hoti hai: Next Refill Date
       │
       ▼
[Dashboard & Alerts] ──► Due in 5 Days par Chime sound bajta hai
       │
       ├──► [Print List Tab] ──► A4 Call Sheet print karein aur pen se tick karein
       │
       ▼
[Call / WhatsApp] ─────► Customer se baat karein: "Aapki dawai khatam hone wali hai"
       │
       ▼
[Refilled Button] ─────► Click "Refilled" ya Calendar se date chunien
       │                 Countdown dobara agle mahine ke liye shuru ho jata hai!
```

---

## 2. App Kholna aur Login (Startup)

### 2.1 Splash Screen
Jab aap browser mein app kholte hain, pehle 1.8 seconds ke liye teal aur emerald rang ka logo aur **"Sarita Pharmacy - Med Reminder"** dikhta hai. Aap screen par kahin bhi click karke ise turant skip kar sakte hain.

### 2.2 PIN Lock Screen (Startup Login)
Splash screen ke turant baad PIN Lock Screen aati hai:
1. Screen par 4 khali gole (circles) aur 0 se 9 tak ka number pad dikhai dega.
2. **PIN kaise dalein:** Screen par bane number buttons click karein ya apne computer keyboard se seedhe 4 number type karein.
3. **Auto-Enter:** Jaise hi aap 4th digit type karenge, koi "Submit" button dabane ki zaroorat nahi hai; app apne aap PIN check kar leta hai.
4. **Agar PIN sahi hai:** Ek meethi chime sound bajegi aur Dashboard khul jayega.
5. **Agar PIN galat hai:** Screen shake (hil) hogi, warning beep aayegi, aur boxes 400ms mein apne aap khali ho jayenge taaki aap dobara try kar sakein.
6. **Security Note:** App ka PIN kya hai? **PIN owner se pooch lein.**

### 2.3 Auto-Lock (Be-istemaal rehne par)
Agar counter par kaam karte waqt aap computer ko kuch der (default 15 minutes) bina touch kiye chhod dete hain, to security ke liye screen apne aap lock ho jati hai. Dobara kaam karne ke liye bas wahi 4-digit PIN dalein.

### 2.4 Kin Tabs par Dobara PIN Maangta hai?
Store ki privacy aur sensitive patient data bachane ke liye, app ke 3 tabs PIN-protected hain:
- **All Customers** (Lock icon bana hai)
- **Bills & Uploads** (Lock icon bana hai)
- **Settings** (Lock icon bana hai)

Jab bhi aap in par click karenge, screen par **"Enter Staff PIN"** ka popup aayega. 4-digit PIN type karte hi tab turant khul jayega. Cancel karne par aap wapis purani screen par chale jayenge.

---

## 3. Screen ka Layout

### 3.1 Sidebar (Left Menu)
Left side ke dark blue/slate menu mein ye 7 tabs hain:

| Tab Name | Lock Icon | Kaam (1 Line Summary) |
|---|:---:|---|
| **Dashboard** | Nahi | Aaj kin patients ko call karna hai (Action Today list aur summary cards). |
| **Monthly Customers** | Nahi | Sirf un regular chronic patients ki list jinhe staff track kar raha hai. |
| **All Customers** | Haan (PIN) | Pharmacy ke sabhi registered customers ki master directory (Add/Remove to Monthly, Edit, Missing). |
| **Bills & Uploads** | Haan (PIN) | Marg ERP ki monthly Excel file upload karne aur purani files manage karne ki jagah. |
| **Analytics** | Nahi | Dukan ki monthly retention, total sales aur top medicines ke charts. |
| **Print List** | Nahi | Subah call karne ke liye A4 paper par Call Sheet ya Delivery Bag Slips print nikalna. |
| **Settings** | Haan (PIN) | Alert days, refill duration, sound on/off, WhatsApp template, aur PIN badalna. |

*Badge Notice:* **Monthly Customers** tab ke aage amber rang ka badge dikhta hai jisme number hota hai (jaise `16`). Iska matlab hai ki 16 patients aise hain jinhe agle 5 din mein refill chahiye ya overdue hain.

### 3.2 Top Bar (Upar ki Patti)
Top bar par har waqt kaam aane wale zaroori buttons hain:
1. **Search Box (`"Search patient, phone, medicine..."`):** Kisi bhi patient ka naam, 10-digit mobile number, Marg code, ya dawai ka naam type karein. Cross (`×`) dabane par search clear ho jata hai.
2. **Refill Alert Bell (`"{n} Due in 5 Days (Chime)"`):**
   - Agar patients due hain, to amber rang ka bell button dikhta hai.
   - Is button par click karne se **alert sound bajti hai** aur screen seedhe Dashboard ke urgent list par le aati hai.
   - Agar koi patient due nahi hai, to green dot ke sath `"All Prescriptions Current"` dikhta hai.
3. **Sound Button (`"Sound On"` / `"Muted"`):**
   - Click karke alert sound ko mute ya unmute karein.
   - On hone par teal background dikhta hai; mute hone par grey.
4. **Cloud Sync Button (`"Sync"` / `"Syncing..."`):**
   - Green dot ka matlab data cloud database se fully connected aur synced hai.
   - Agar aapne doosre phone ya computer par koi entry ki hai aur yahan turant dekhni hai, to `"Sync"` par click karein. Spinning circle ghumega aur success chime bajegi.
5. **Lock Button (Taala):** Counter chhodkar jane se pehle is par click karein, screen turant lock ho jayegi.

### 3.3 Mobile par Navigation (Phone View)
Agar aap mobile phone par app kholte hain:
- Niche 5-button bar dikhta hai: **Home** (Dashboard), **Monthly**, **Patients** (Lock), **Uploads** (Lock), aur **Menu**.
- Left side ka poora menu kholne ke liye TopBar par hamburger icon (`☰`) ya bottom bar par **Menu** dabayein.

---

## 4. Dashboard (Aaj ka Kaam)

Counter par aate hi sabse pehle Dashboard screen dikhti hai. Yahi aapke din bhar ke kaam ka control center hai.

### Kya dikhta hai:
1. **Refill Alert Banner (Orange/Amber gradient):**
   - Likhta hai: *"Refill Alert: X Monthly Customers Due in Next 5 Days (Y Overdue)"*.
   - Saath mein `"Chime Alert"` button (sound sunne ke liye) aur `"View Due List"` button hota hai.
2. **Upar ke 4 Stat Cards:**
   - **Monthly Customers (Teal):** Dukan ke kul regular monthly patients ki sankhya. Click karne par Action Today filter lag jata hai.
   - **Due in 5 Days (Amber):** Wo patients jinki dawai agle 1 se 5 din mein khatam hone wali hai. Click karne par sirf 5 din wale patients dikhte hain.
   - **Overdue Refills (Red/Rose):** Wo patients jinki due date nikal chuki hai lekin abhi tak dawai nahi li. Inhe sabse pehle call karna zaroori hai!
   - **All Registered (Grey):** Pharmacy ke total customers jo Marg files se import hue hain.
3. **Action Today Table & Quick Filter Chips:**
   - `Action Today (n)`: Due in 5 Days + Overdue dono ko ek sath dikhata hai.
   - `Due 5 Days (n)`: Sirf agle 5 din wale.
   - `Overdue (n)`: Sirf date nikal chuke log.
   - `All Pending (n)`: Sabhi pending reminders.

### Urgency ke Colours ka Matlab:
- **Red Badge (`Overdue by Xd`):** Dawai khatam hue X din ho gaye hain. Red dot blink/pulse karta hai. Inhe turant phone karein.
- **Amber Badge (`Due in Xd`):** Dawai khatam hone mein X din bache hain (Alert Mode). Inhe reminder bhejein taaki time se dawai ban sake.
- **Grey/Slate Badge (`In X days`):** Abhi 5 din se zyada ka samay bacha hai, koi jaldi nahi hai.

### Action Today Table ke Columns:
- `#` (Serial Number)
- `Patient Name` (Monthly customer ke aage teal dot hota hai)
- `Contact` (Mobile number)
- `Due Date` (YYYY-MM-DD format mein)
- `Status & Days Left` (Overdue / Due pill aur niche `Pending` ya `Complete`)
- `Medicines List` (Dawaiyon ke naam)
- `Quick Action` (Call, WhatsApp, Calendar, aur `"Complete"` button)

### Kya karna hai (Step-by-Step):
1. **Call Button (`Phone icon`):** Click karein. Mobile par hain to seedhe dialer khul jayega; desktop par patient ka 10-digit number screen par dikh jayega.
2. **WhatsApp Button (`Message icon`):**
   - Click karte hi WhatsApp Web ya app khul jayega.
   - Customer ka naam, unki dawaiyon ki list, aur refill date apne aap Hinglish message mein ban kar aa jayegi.
   - Agar kisi customer ka mobile number feed nahi hai, to app turant ek popup puchega: *"Enter 10-digit WhatsApp number for [Name]"*. Wahan number dalein aur Send karein.
3. **Calendar Button (`Calendar icon`):**
   - Agar patient ne kaha "Main kal sham ko dawai le gaya tha" ya kisi aur din dawai li hai, to Calendar button click karein.
   - Wahan exact date chuniye aur duration set karke confirm karein.
4. **Refilled / Complete Button (`Checkmark icon`):**
   - Jaise hi customer dawai le jaye ya pack ho kar nikal jaye, `"Complete"` button daba dein.
   - Success chime bajegi, status `"Complete"` ho jayega, countdown reset ho jayega, aur wo patient aaj ki Action Today list se hat jayega.

---

## 5. All Customers Tab

> **Security:** Is tab ko kholne ke liye Staff PIN dalna padta hai. **PIN owner se pooch lein.**

Ye aapki pharmacy ke har us vyakti ki master list hai jiska naam Marg ERP ke bill mein aaya hai.

### 5.1 Kya dikhta hai
Upar banner mein total patients aur unme se kitne `"Monthly Active"` hain dikhai deta hai.
Table mein ye 11 columns hote hain:
1. `Tree` (`>` icon — medicines expand karne ke liye)
2. `#` (Serial number)
3. `Track Monthly` (Checkbox — Sabse zaroori control!)
4. `Patient Name` (Saath mein Marg Party Code aur agar missing ho to red badge)
5. `Category` (`Monthly Regular` ya `New / Unticked`)
6. `Contact Phone` (Mobile number)
7. `Total Spend` (Kul kitne rupaye ki khareed ki)
8. `Medicines` (Kitni dawaiyan li hain)
9. `Active` (Kitne mahine se khareed rahe hain, jaise `2m`)
10. `Latest Bill` (Aakhiri bill ki date)
11. `Actions` (Tree button, Edit button, aur Profile arrow)

### 5.2 Kisi Customer ko "Monthly Customer" kaise banayein ya hatayein
- **Add to Monthly:** `Track Monthly` column mein khali box (`Square`) par click karein. Box turant teal rang ka checkmark (`CheckSquare`) ban jayega. Wo customer Monthly Customers list aur Dashboard reminders mein jud jayega.
- **Remove from Monthly:** Agar koi patient ab monthly dawai nahi leta, to checkmark par click karein.
- **Confirmation Popup:** Galti se hatne se bachane ke liye app aapse puchega:
  > *"Remove [Customer Name] from Monthly Customers?"*
  - **OK** dabane par hi hatega.
  - **Cancel** dabane par customer monthly hi rahega.

### 5.3 Keyboard Shortcuts (Tez Kaam ke liye)
Desktop counter par bina mouse chuye tez kaam karne ke liye keyboard controls bane hain:
- **`↑` / `↓` Arrow keys:** Upar aur niche ke customer par move karein. Focused row teal colour se highlight hoti hai.
- **`Space Bar`:** Focused customer ko turant Monthly tick ya untick karein.
- **`T` key:** Focused customer ki dawaiyon ka tree structure kholein/band karein.
- **`Enter`:** Focused customer ki full profile drawer kholein.
- **`Page Up` / `Page Down`:** Agle 50 ya pichle 50 customers par jump karein.

### 5.4 Tree View (Medicines dekhna)
- Har row ke pehle column mein `Tree` button (`>`) ya upar `Expand All Trees` button hai.
- Is par click karne se usi row ke niche patient ki har ek dawai ka naam, pack size, quantity, cycle days (jaise 30 Days), aur amount khul jata hai.

### 5.5 Edit Customer (`Edit icon`)
Agar patient ka phone number galat hai ya naya judna hai:
1. Row ke aage bane pencil/edit button par click karein.
2. **Edit Patient & Prescription Information** modal khulega.
3. Wahan aap Patient Name, 10-Digit Mobile Number, Marg Party Code, Home Delivery Address, Notes, Refill Duration, aur medicines edit kar sakte hain ya nayi dawai jod sakte hain.
4. Save karein.

### 5.6 RED HIGHLIGHT — "Missing since [Month]" ka Matlab
Agar kisi customer ki row **halke laal (rose) rang** mein dikh rahi hai aur unke naam ke aage **`Missing since Aug 2026`** (ya pichle mahine ka naam) likha hai:
- **Iska matlab:** Is customer ne pichle mahine dukan se regular dawai li thi, lekin is mahine ke upload hue Marg bill mein inka koi parcha nahi aaya hai! Matlab ye customer dawai lena bhool gaye hain ya kisi doosri dukan par chale gaye hain.
- **"Missing (n)" Filter:** Upar dropdown ke bagal mein laal rang ka button hai **`Missing (n)`**. Is par click karte hi screen par sirf wahi log aa jayenge jo is mahine nahi aaye.
- **Staff ko kya karna hai:** In red row wale sabhi customers ko turant phone ya WhatsApp karein: *"Namaste Sharma ji, pichle mahine aapki BP ki dawai chali thi, is mahine aapka refill nahi hua hai, kya dawai bhej di jaye?"*
- **Red kab hat jata hai:** Jaise hi agle mahine ka bill upload hoga aur usme inka naam dubara aa jayega, red highlight apne aap gayab ho jayegi.

---

## 6. Monthly Customers Tab

> **Important Rule:** Is tab mein sirf aur sirf wahi customers aate hain jinhe staff ne All Customers tab se manually select (`Track Monthly` tick) kiya hai. Marg se naya bill upload hone par koi bhi naya customer apne aap is tab mein zabardasti add nahi hota.

### 6.1 Screen par kya dikhta hai
Upar banner mein regular patients ki sankhya, search box, aur filter dropdown hota hai:
- `All (n)`: Sabhi monthly patients.
- `Alert Mode (n)`: Agle 5 din mein due hone wale.
- `Overdue (n)`: Date nikal chuke log.
- `Complete / Countdown`: Jinki dawai abhi haal hi mein di gayi hai aur unka 30 din ka timer chal raha hai.

### 6.2 Monthly Table ke 7 Columns (Exact Order):

| # | Column Name | Iska Matlab |
|:---:|---|---|
| **1** | `#` | Serial number (1, 2, 3...) |
| **2** | **Customer Name & Code** | Patient ka poora naam aur niche unka Marg ERP Party Code. Agar missing hon to red badge bhi dikhega. |
| **3** | **Contact Number** | 10-digit mobile number. Agar nahi hai to *No Phone* likha hota hai. |
| **4** | **Regular Medications** | Patient ki regular dawaiyon ke chips (shuruati 3 dawaiyan aur agar zyada hon to `+X more`). Hover karne par poora naam dikhta hai. |
| **5** | **Last Bill Date** | Unhone dukan se aakhiri baar dawai kis tareekh ko li thi (YYYY-MM-DD). |
| **6** | **Next Refill Date** | Dawai kab khatam hogi. Saath mein colourful urgency badge: Overdue (Red), Due in Xd (Amber), ya In Xd (Grey). Is date par click karke Calendar khul jata hai. |
| **7** | **Action** | Teen quick buttons: Phone Call, WhatsApp Refill Alert, aur **`Refilled`** button. |

### 6.3 Next Refill Date kaise nikalti hai?
$$\text{Next Refill Date} = \text{Last Bill Date} + \text{Customer ki Refill Duration}$$
*Example:* Agar Last Bill Date **2026-09-25** hai aur Refill Duration **30 days** hai, to Next Refill Date apne aap **2026-10-25** set ho jayegi.

### 6.4 Table ki Smart Sorting (Kaun Upar Aayega?)
Table hamesha urgency ke hisab se apne aap set rehti hai taaki staff ko scroll na karna pade:
1. **Sabse Upar:** `Overdue (< 0 days)` — Jinhe turant call karni hai.
2. **Doosre Number par:** `Alert Mode (0 to 5 days)` — Jinki dawai 5 din mein khatam hone wali hai.
3. **Teesre Number par:** `Upcoming (6 to 25 days)` — Jinka abhi samay bacha hai.
4. **Sabse Niche:** `Complete / Just Refilled (> 25 days)` — Jinhe abhi-abhi dawai di gayi hai, wo apne aap list ke aakhiri hisse mein chale jate hain.

### 6.5 Call, WhatsApp aur "Refilled" Button kab dabayein?
- **Call / WhatsApp:** Jab patient Alert Mode (Amber) ya Overdue (Red) mein ho, unhe call ya WhatsApp karein.
- **`Refilled` Button:** Jab customer counter se dawai le jaye ya delivery boy delivery confirm kar de, row ke aakhiri column mein bane green **`Refilled`** button par click karein.
  - Success chime bajegi.
  - Unki Last Bill Date aaj ki tareekh ho jayegi.
  - Next Refill Date agle mahine ki ban jayegi (jaise +30 days).
  - Patient turant list ke sabse niche move ho jayega!

---

## 7. Refill Duration (Dawai kitne din ki di gayi)

Har patient ko ek hi jitne din ki dawai nahi milti. Kisi ko 15 din ka parcha milta hai, kisi ko 1 mahine ka, aur kisi ko 2 ya 3 mahine ka.

### 7.1 Ye kahan se set hota hai?
App mein 2 jagah se Refill Duration set ki ja sakti hai:
1. **Dispense Calendar Modal:** Jab aap Dashboard ya Monthly table mein Next Refill Date / Calendar icon par click karte hain.
2. **Edit Customer Modal:** Jab aap All Customers mein pencil (`Edit`) icon par click karte hain.

### 7.2 Preset Chips aur Custom Days:
Modal ke andar 4 quick buttons aur 1 custom box milta hai:
- `15 days` (15 din ke parcho ke liye)
- `1 month` (30 din ke normal parcho ke liye — Default)
- `2 months` (60 din ki regular chronic dawai)
- `3 months` (90 din ki lambi dawai)
- `Custom days` (Yahan aap apni marzi ka koi bhi number likh sakte hain, jaise `17`, `20`, `45`, waghera)

### 7.3 Next Refill Date par iska asar (Real Example)
- **Scenario:** Customer `Ramesh Sharma` dukan par aaye. Unka bill Marg mein **25 September 2026** ko bana.
- **Agar 1 month (30 days) set hai:** Next Refill Date hogi **25 October 2026**. Alert 20 October ko aayega.
- **Agar 2 months (60 days) set hai:** Next Refill Date hogi **24 November 2026**. Alert 19 November ko aayega.
- **Agar 15 days set hai:** Next Refill Date hogi **10 October 2026**. Alert 5 October ko aayega.

### 7.4 Ek baar set karne ka fayda
Ek baar aapne kisi customer ka refill duration 60 days set kar diya, to agli baar jab bhi Marg ka naya bill upload hoga, app us customer ke liye apne aap 60 days hi use karega! Har mahine dobara change karne ki zaroorat nahi padti.

---

## 8. Bills & Uploads (Excel File ya Pura Daily Folder Upload) — STEP BY STEP

> **Security:** Is tab ko kholne ke liye Staff PIN dalna padta hai. **PIN owner se pooch lein.**

### 8.1 Marg ERP se konsi report nikalni hai?
Marg ERP software se jo Excel report export karni hai uska exact format hota hai:
- **Report Name:** `PATIENT/PRODUCT WISE SALES SUMMARY`
- **Supported File Types:** `.XLS`, `.XLSX`, `.CSV` (Jaise `jully26.XLS`, `aug26.XLS`, `sep26.XLS`, ya daily sheets jaise `01-09-2026.xls`, `02-09-2026.xls`, waghera)

---

### 8.2 Upload ke 2 Aasan Tareeqe:

#### Tareeqa A: Pura Folder ya Multiple Daily Sheets Upload (Recommended for Accurate Dates)
Agar aap chahte hain ki har customer ki **exact khareed ki tareekh** mile (aur sab par mahine ki aakhiri tareekh na lage):
1. **Computer par folder banayein:** Apne computer par har mahine ek folder banayein (jaise `"September"`).
2. **Roz ki Marg sheets save karein:** Marg se daily summary sheet is folder mein save karte rahein (jaise `01-09-2026.xls`, `02-09-2026.xls`, `03-09-2026.xls`, waghera).
3. **App mein Upload karein:**
   - **Option 1 (Drag & Drop):** Pura ka pura `"September"` folder mouse se uthakar app ke drop zone mein chhod dein.
   - **Option 2 (Folder Button):** Green **`Select Folder (Daily Sheets)`** button par click karein aur apna folder select karein.
   - **Option 3 (Multi-Select Files):** **`Select Files (Multi-Select)`** par click karke ek sath 10, 20 ya 30 daily files select karein.
4. **App ka Smart Chronological Merge:**
   - App sabhi sheets ko tareekh ke hisab se (chronological order: 1 se 30) sort kar leta hai.
   - Agar koi customer 2nd September ko aaya aur dobara 22nd September ko aaya, to app unki Last Purchase Date apne aap **22 September** set karega, aur unka refill countdown 22 September se shuru karega.
   - Jo customer sirf 2nd September ko aaya, uski date 2 September hi rahegi (25 ya 30 nahi hogi).
   - Ek bhi customer ka duplicate record nahi banega (Zero Duplicates).

#### Tareeqa B: Ek Hi Monthly Summary Excel Sheet Upload (Classic Method)
Agar aap roz ki sheet nahi nikalte balki mahine ke aakhiri din ek hi summary sheet nikalte hain:
- Badi dashed patti par click karke wahi single monthly file (`sep26.XLS`) chunein ya drag & drop karein.
- App pehle ki tarah summary sheet ko padh kar report ki `TO` date (period end) ko use karega.

---

### 8.3 Upload karne ke Step-by-Step Niyam:

1. **Step 1 — File ya Folder Drop/Select karein:**
   - Bills & Uploads tab par jayein.
   - Folder drop karein ya **`Select Folder (Daily Sheets)`** / **`Select Files (Multi-Select)`** button dabayein.
2. **Step 2 — Preview Card Padhein:**
   - File/Folder select hote hi neele/teal border wala **Preview Card** khulega.
   - Folder upload par ye extra smart jaankari dikhayega:
     - **Folder / Batch Name:** Jaise `September (25 Daily Sheets)`.
     - **Date Timeline Chips:** Detected sales dates ka timeline.
     - **Total In File / Visits Processed:** Kul kitne patient visits record hue.
     - **Repeat Customers Matched:** Purane kitne regular customers aaye.
     - **New Customers:** Naye kitne customers jude.
     - **Sample Patient Latest Dates Table:** Yahan aap dekh sakte hain kis patient ka last bill kis din aur kis file se aaya (jaise Ramesh Sharma -> 25/09/2026 via `25-09-2026.xls`).
3. **Step 3 — Commit karein:**
   - Sab theek lagne par green checkmark button dabayein: **`Commit & Add to Database`**.
   - Success chime bajegi aur master customer list update ho jayegi.
   - Agar file galat chuni thi, to bagal mein bana **`Discard`** button daba dein.

### 8.4 Commit ke baad kya-kya apne aap update hota hai?
- **All Customers Master Directory:** Sabhi naye aur purane customers ki total purchases, total spend, aur nayi dawaiyan jud jati hain.
- **Last Bill Date:** Har customer ki unki actual aakhiri khareed wali date par update ho jati hai.
- **Next Refill Date:** Har customer ke set refill duration ke hisab se exact refill date calculate ho jati hai.
- **Monthly Customers Selection Surakshit:** Jin customers ko staff ne pehle se `Track Monthly` kiya hua tha, wo monthly list mein waise ke waise bane rehte hain; naye unticked log All Customers mein rehte hain.

### 8.5 Ek hi File ya Sheet Dobara Upload ho jaye to?
App mein smart matching system hai (Phone number, Marg code, aur name se). Agar aap wahi file ya sheet dobara upload kar dete hain to:
- Koi duplicate customer create nahi hoga.
- Existing customer ka data kharab nahi hoga.
- Records safe rahenge.

### 8.5 Galat file upload ho jaye to Rollback / Delete kaise karein?
Niche **Upload Batch History** table mein har upload kiye gaye mahine ki file dikhti hai:
- **`Rollback` Button:** Agar galti se upload ho gaya, to `Rollback` dabane par us file se aaye naye records inactive ho jate hain.
- **`Delete Bill` Button:**
  - Agar kisi purani ya test file ko hamesha ke liye hatana hai, to red **`Delete Bill`** button dabayein.
  - Screen par security modal aayega: *"Delete Uploaded Bill File"*.
  - Staff PIN dalein. **PIN owner se pooch lein.**
  - PIN dalte hi wo uploaded bill file delete ho jayegi.
  - **Important:** Uploaded file delete karne se All Customers master directory ke customer records delete nahi hote, sirf wo upload batch history se hat ti hai.

### 8.6 Separate New Customers File (.CSV / .JSON) Download
Har upload batch ke samne ek green button hota hai: **`CSV`** (jaise `+44 new [CSV]`).
Is par click karke aap sirf is mahine ke naye customers ki Excel/CSV file download kar sakte hain taaki unhe welcome call ya discount SMS bheja ja sake!

### 8.7 Har Mahine ka Checklist:
- [ ] Marg se pichle mahine ki summary export karein (`PATIENT/PRODUCT WISE SALES SUMMARY`).
- [ ] Bills & Uploads mein file drop karein aur preview check karein.
- [ ] `Commit & Add to Database` par click karein.
- [ ] All Customers tab mein jayein aur naye acche chronic patients ke aage `Track Monthly` ka tick lagayein.
- [ ] All Customers mein `Missing (n)` filter dabakar dekhein kaun se purane customer is mahine chhoot gaye.

---

## 9. Print List

Subah counter par bheed hoti hai, isliye kai staff members computer dekhne ke bajaye ek printed sheet par pen se tick karna pasand karte hain. Is tab ko isi kaam ke liye banaya gaya hai.

### 9.1 Do Print Modes:
Upar do buttons milte hain:
1. **`Call Sheet` (Table Format):** Staff ke haath mein rakhne ke liye A4 sheet.
2. **`Delivery Bag Slips` (Cut & Paste Grid):** Dawai ke lifafe/bag par chipkane wali choti slips jinpar patient ka naam, phone, due date, aur packing list hoti hai.

### 9.2 Filter Lagana:
Dropdown se chuniye:
- `Due in Next 5 Days` (Aaj aur agle 5 din wale — Subah calling ke liye best)
- `Overdue Only` (Jinki tareekh nikal gayi)
- `All Monthly Active` (Mahine ke sabhi regular patients)

### 9.3 Print Nikalna:
1. Upar right side bane **`Print (A4) / Save as PDF`** button par click karein.
2. Browser ka print window khul jayega.
3. Agar printer laga hai to seedhe Print karein, ya "Save as PDF" karke WhatsApp par print wale counter ko bhej dein.
4. Top bar, buttons, aur navigation apne aap print se gayab ho jate hain; sirf saaf Black & White table print hoti hai.

### 9.4 Printed Call Sheet Pen se kaise bharein?
Sheet mein har patient ke samne unki dawaiyon ke aage box bana hota hai:
- `[ ] Refill`: Agar patient ne kaha "Haan dawai bhej do / pack kar do", to Refill par tick karein.
- `[ ] Not Needed`: Agar patient ne kaha "Abhi 10 din ki dawai bachi hai", to Not Needed par tick karein.
- Niche notes mein likhein: "Kal subah 10 baje delivery" ya "Customer khud aayega".

### 9.5 Result ko App mein Update karna:
Calling khatam hone ke baad 5 minute computer par baithein:
- Jo-jo patients dawai le gaye ya confirm ho gaye, Dashboard par jakar unke aage **`Complete`** ya **`Refilled`** button dabate jayein. List clear ho jayegi!

---

## 10. Analytics Tab

Analytics tab dukan ki business health aur patient retention dikhata hai.

### Kya-kya dikhta hai:
1. **Total Pharmacy Sales:** Upload hue Marg files ke mutabik kul kitne rupaye ki sales hui.
2. **Monthly Regular Sales:** Dukan ki kul sales mein se regular monthly patients ka kitna hissa hai (aur kitne percent revenue unse aata hai).
3. **Customer Retention Rate:** Kitne percent customers har mahine dukan par regular wapis laut rahe hain.
4. **Active Prescriptions:** Kul kitni alag-alag tarah ki chronic dawaiyan track ho rahi hain.
5. **Top Regular Patients by Spend:** Dukan ke top 10 sabse wafadar aur zyada khareedne wale patients ki ranking (#1, #2, #3 gold/silver/bronze badges ke sath).
6. **Top Prescribed Chronic Medications:** Dukan mein sabse zyada bikne wali chronic dawaiyon ki ranking (jaise Telma, Glycomet, Eltroxin, waghera) aur kitne patients unhe le rahe hain.

---

## 11. Settings Tab

> **Security:** Settings tab staff PIN se protected hai. **PIN owner se pooch lein.**

### 11.1 Staff ke Kaam ki Settings:
- **Advance Alert Window (Days Before Due Date):** Default `5` days hota hai. Yani due date se 5 din pehle warning sound bajegi aur patient Action Today mein aayega.
- **Default Chronic Refill Cycle (Days):** Default `30` days hota hai (Indian pharmacy monthly standard).
- **Audible Chimes & Voice Alerts:** Toggle switch aur `"Test Sound"` button. Yahan se alert sound check kar sakte hain.
- **WhatsApp Message Template (Hinglish):**
  - Yahan par message ka format set hota hai jo WhatsApp button dabane par banta hai.
  - Isme dynamic tags use hote hain:
    - `{name}` — Patient ka naam
    - `{medicines}` — Unki dawaiyon ki bulleted list
    - `{date}` — Expected refill due date
  - Agar format bigad jaye to upar bana **`Reset to Standard Template`** link dabakar default format wapis laya ja sakta hai.

### 11.2 Staff PIN Change karna:
- **Staff Security & PIN Lock** card mein jayein.
- Current PIN dalein.
- Naya 4-Digit PIN dalein.
- **`Change Staff PIN`** button dabayein.
- *Tip:* Naya PIN hamesha shop owner ki ijazat se hi badlein aur sabhi staff members ko bata dein.

### 11.3 Owner-Only Settings (Staff inhein na chhedein):
Settings screen ke kuch hisse sirf owner ke technical setup ke liye hain:
- **Cloud Backup & Store Synchronization:** `"Sync Store Data Now"`, `"Restore All Customers from Cloud"`, aur `"Check Backup Status"`.
- **Owner Automated Email Notifications:** Resend API key aur owner email address jahan subah 9 baje daily briefing email jati hai.
- **Database Backup & Restore:** Encrypted JSON export/import aur **`Clear Local Data`** (Lal button — ise kabhi bina owner ke ijazat ke na dabayein!).

---

## 12. Roz ka Kaam (Daily Routine)

Staff ke liye subah se shaam tak ka 6-step checklist:

1. **Subah 9:30 AM — App Kholein:** Computer par browser kholein, PIN dalein (**PIN owner se pooch lein**).
2. **TopBar Sync Check:** Dekhein TopBar par green sync dot hai ya nahi. Agar doosre system par kaam hua tha to `"Sync"` button dabakar refresh karein.
3. **Dashboard Dekhein:** Upar orange banner aur `Due in 5 Days` / `Overdue` cards check karein.
4. **Print List Nikalein:** `Print List` tab par jakar `Due in Next 5 Days` ki A4 Call Sheet print karein.
5. **Calls & WhatsApp Karein:**
   - Red (Overdue) wale patients ko pehle call karein.
   - Amber (Due in 5 Days) wale patients ko call ya WhatsApp reminder bhejein.
   - Paper par tick karein kisne confirm kiya aur kisne delivery mangwai.
6. **Shaam ko Refilled Mark Karein:** Jinki delivery chali gayi ya jo counter se dawai le gaye, Dashboard ya Monthly tab mein unke aage **`Complete`** ya **`Refilled`** button daba dein.

---

## 13. Mahine ka Kaam (Monthly Routine)

Jab bhi naya mahina shuru ho ya Marg se nayi billing report nikle:

1. **Marg se Export:** Marg ERP se pichle mahine ki `PATIENT/PRODUCT WISE SALES SUMMARY` file export karein.
2. **Bills & Uploads Upload:** File ko drop karein, preview stats check karein, aur `Commit & Add to Database` karein.
3. **Naye Regulars Triage Karein:** `All Customers` tab mein jayein. `Unticked` filter lagayein. Jo naye patients 2-3 mahine se regular chronic dawai le rahe hain, unke aage `Track Monthly` tick kar dein.
4. **Missing Customers Calling:** All Customers mein `Missing (n)` filter lagayein. Jo regular patients is mahine nahi aaye unhe call karke feedback lein aur unki health ka haal-chaal poochein.
5. **Special Refill Cycle Check:** Agar kisi customer ko 15 din ya 2 mahine ka parcha mila hai, to unki profile/calendar mein duration sahi kar dein.

---

## 14. Ek Poora Example (Customer ki Journey)

Samjhne ke liye ek kaalpanik (imaginary) customer ki journey dekhte hain:

- **Customer ka Naam:** Ramesh Gupta
- **Dawai:** Glycomet GP 1mg, Telma 40mg
- **Marg Bill Date:** 25 September 2026

```text
Step 1: Marg Report Upload (26 Sep)
└── Staff ne file upload karke "Commit & Add to Database" kiya.
    Ramesh Gupta "All Customers" tab mein dikhai diye.

Step 2: Monthly List mein Shamil Karna (26 Sep)
└── Staff ne All Customers mein Ramesh Gupta ke samne "Track Monthly" par click kiya.
    Ramesh ji ab "Monthly Customers" tab mein jud gaye.
    Refill Duration: 30 days.
    Last Bill Date: 2026-09-25.
    Next Refill Date bani: 2026-10-25.

Step 3: Countdown (26 Sep se 19 Oct)
└── Ramesh ji table ke aakhiri hisse mein shant rehte hain (In 20 days, In 10 days).

Step 4: 5 Din Pehle Alert Mode (20 Oct)
└── Date aayi 20 October (25 Oct se theek 5 din pehle).
    TopBar par chime bajti hai.
    Dashboard ke Action Today table mein Ramesh Gupta amber rang mein dikhte hain: "Due in 5d".

Step 5: Calling & WhatsApp (21 Oct)
└── Staff WhatsApp button dabata hai:
    "Namaste Ramesh Gupta ji, Sarita Pharmacy se reminder hai ki aapki dawai
     (Glycomet GP 1mg, Telma 40mg) 25-10-2026 tak chalegi..."
    Ramesh ji reply karte hain: "Haan bhaiyya, kal ghar bhej dena."

Step 6: Dawai Dispense & Refilled Mark Karna (22 Oct)
└── 22 October ko delivery boy ne dawai dedi.
    Staff ne Monthly Customers tab mein Ramesh Gupta ke aage "Refilled" button dabaya.
    Unki Last Bill Date ab 2026-10-22 ho gayi!
    Next Refill Date 2026-11-21 (+30 din) set ho gayi.
    Ramesh Gupta Action Today list se hatkar dobara agle mahine ke liye countdown mein chale gaye!
```

---

## 15. Aksar Puche Jaane Wale Sawal (FAQ) aur Problems

### Q1: Customer "Monthly Customers" tab mein kyun nahi dikh raha?
**Jawab:** Marg file upload hone par customers seedhe All Customers mein aate hain. Monthly mein dikhne ke liye aapko **All Customers** tab mein jakar us customer ke aage **`Track Monthly`** ka checkbox tick karna padega.

### Q2: Next Refill Date galat kyun dikh rahi hai?
**Jawab:** Marg summary report mein har bill ki alag date nahi hoti, isliye upload ke waqt period end date lagti hai. Agar customer ne kisi aur din dawai li hai, to unki Next Refill Date par click karein aur Calendar se sahi date aur refill duration (jaise 15 days ya 2 months) chun kar save karein.

### Q3: Customer ki row laal (red) kyun dikh rahi hai aur "Missing" kyun likha hai?
**Jawab:** Iska matlab hai ki customer ne pichle mahine khareeda tha lekin is mahine ke upload mein unka koi bill nahi aaya hai. Unhe turant call karein. Agle mahine jab unka naya bill upload hoga, to red highlight apne aap hat jayegi.

### Q4: Customer ka phone number nahi hai to kya karein?
**Jawab:** Row ke aage bane pencil (`Edit`) icon par click karein aur wahan unka 10-digit number type karke Save kar dein. Agar aap WhatsApp button dabate hain to app khud wahan number maang leta hai.

### Q5: Galti se galat Excel file upload ho gayi to kya karein?
**Jawab:** Bills & Uploads tab mein jayein. Niche Upload Batch History mein us file ke samne bane **`Rollback`** ya **`Delete Bill`** button par click karein aur PIN dalein (**PIN owner se pooch lein**).

### Q6: Sound chime nahi baj raha hai, kya karein?
**Jawab:** Do cheezein check karein:
1. Top bar par sound icon check karein — agar `"Muted"` likha hai to click karke `"Sound On"` karein.
2. Apne computer/laptop ka main speaker volume check karein.
3. Settings tab mein jakar `"Test Sound"` button daba kar check karein.

### Q7: PIN bhool gaye to kya karein?
**Jawab:** Khud se guessing na karein. Turant shop owner se sampark karein: **PIN owner se pooch lein.**

### Q8: Maine phone par entry ki thi, counter PC par kyun nahi dikh rahi?
**Jawab:** Top bar par bane **`Sync`** button par click karein. Data turant cloud database se download hokar screen update ho jayegi.

### Q9: Agar dukan ka internet band ho jaye to kya app chalega?
**Jawab:** Haan! App offline mode mein local memory se chalta rehta hai. Jab internet wapis aayega, tab `"Sync"` dabane par data cloud mein upload ho jayega.

### Q10: Kya ek customer ki dawaiyon ki list edit ki ja sakti hai?
**Jawab:** Haan. All Customers tab mein pencil (`Edit`) icon dabayein. Wahan se aap purani dawai delete kar sakte hain ya nayi dawai jod sakte hain.

### Q11: "Deselect All Monthly" button kya karta hai?
**Jawab:** Ye button All Customers ke header mein hota hai. Agar aap sabhi patients ko ek sath monthly tracking se hatana chahte hain to ye use hota hai. Dhyan rahe, isse customer delete nahi hote, sirf unka monthly tick hat jata hai.

### Q12: Patient ne 2 mahine ki dawai li hai, 1 mahine baad alert kyun aa raha hai?
**Jawab:** Kyunki unka Refill Duration 30 days (1 month) par set reh gaya hoga. Customer ke Calendar par click karein aur duration ko **`2 months` (60 days)** select kar dein. Agli baar se 60 din baad hi alert aayega.

### Q13: Kya uploaded bill delete karne se customer delete ho jate hain?
**Jawab:** Bilkul nahi! Bills & Uploads se koi purani file delete karne par All Customers master directory se koi patient delete nahi hota.

### Q14: Print nikalte waqt navigation bar aur buttons print mein aate hain kya?
**Jawab:** Nahi. Print screen smart CSS se bani hai. Print out par sirf pharmacy ka header, date, aur saaf table aati hai; saare computer buttons apne aap chhip jate hain.

### Q15: Kya hum naye customers ki list alag se Excel mein le sakte hain?
**Jawab:** Haan! Bills & Uploads tab mein batch history ke andar har upload ke samne green button hota hai: **`CSV`** (jaise `+44 new CSV`). Click karte hi sirf naye customers ki file download ho jayegi.

---

## 16. Kya Karein / Kya Na Karein (Do's and Don'ts)

### KYA KAREIN (DO'S)
- [x] **Roz subah Dashboard zaroori dekhein:** Subah aate hi Overdue aur Due in 5 Days wale patients ki calling niptayein.
- [x] **Dawai dete hi "Refilled" dabayein:** Jab bhi customer ko dawai handover karein, turant `"Refilled"` ya `"Complete"` button dabayein taaki timer sahi chal sake.
- [x] **10-Digit Mobile Number hamesha update karein:** Bina mobile number ke reminder call ya WhatsApp nahi ho sakta.
- [x] **Missing Customers ko har mahine call karein:** Red row wale patients ko phone karke unki sehat ka haal poochein.
- [x] **Counter chhodne se pehle Lock dabayein:** Agar aap khane ya bahar ja rahe hain to TopBar par Lock icon dabakar jayein.

### KYA NA KAREIN (DON'TS)
- [ ] **Bina confirm kiye "Refilled" na dabayein:** Jab tak customer dawai na le jaye, tab tak Refilled na dabayein.
- [ ] **Har kisi customer ko Monthly tick na karein:** Jo log sirf ek baar sardi-khansi ki dawai lene aaye hain unhe `Track Monthly` na karein; sirf chronic (BP, Sugar, Heart, Asthma, Thyroid) walo ko tick karein.
- [ ] **Settings ke sensitive hisso ko na chhedein:** Cloud sync keys ya Firebase config ko bina owner ki ijazat ke na badlein.
- [ ] **"Clear Local Data" par galti se click na karein:** Settings tab ka lal button bina owner ke instruction ke kabhi na dabayein.
- [ ] **PIN kisi anjaan ya customer ko na batayein.**

---

## 17. Ek Page ka Cheat Sheet

*(Is section ko print karke counter desk ke paas laga sakte hain)*

```text
================================================================================
           SARITA PHARMACY MED REMINDER — QUICK STAFF CHEAT SHEET
================================================================================

1. LOGIN & STARTUP:
   - Screen kholte hi 4-digit PIN type karein (Auto-enter hoga).
   - PIN bhool gaye? -> PIN owner se pooch lein.

2. SUBHA KA ACTION (DASHBOARD):
   - Red Badge    = OVERDUE (Pehle call karein!)
   - Amber Badge  = DUE IN 5 DAYS (Aaj hi call ya WhatsApp bhejein)
   - Grey Badge   = UPCOMING (Abhi time hai)

3. BUTTONS KA MATLAB:
   - [Phone Icon]      = Customer ka number dial karein
   - [WhatsApp Icon]   = Hinglish reminder message bhejein
   - [Calendar Icon]   = Exact dispensed date aur refill duration chunien
   - [Refilled Button] = Dawai dene ke baad click karein (Timer reset hoga)

4. MONTHLY LIST MEIN ADD KARNA:
   - "All Customers" tab kholein -> PIN dalein -> Patient ke aage "Track Monthly"
     box tick karein.

5. RED ROW ("Missing since..."):
   - Customer is mahine dawai lene nahi aaya. Turant call karein!
   - Naya bill aane par red highlight apne aap hat jayegi.

6. REFILL DURATION OPTIONS:
   - 15 days | 1 month (30d) | 2 months (60d) | 3 months (90d) | Custom days

7. TOP BAR CONTROLS:
   - Search box: Patient ka naam, phone ya medicine khojein.
   - Bell button: 5-day alert sound check karein.
   - Sync button: Phone aur PC ka data milane ke liye click karein.
   - Lock button: Screen turant lock karein.
================================================================================
```

---

## 18. Owner ke liye Technical Notes

> **Audience:** Shop Owner & Technical Administrator  
> *(Technical terms allowed in this section)*

### 18.1 Data Storage Architecture
- **Primary Cloud Store:** Google Cloud Firestore (Collections: `all_customers`, `monthly_customers`, `all_uploads`, `settings`).
- **Offline & Local Cache:** Browser `localStorage` (Keys: `sarita_med_customers`, `sarita_med_batches`, `sarita_med_reminders`, `sarita_med_settings`).
- **Deterministic Deduplication:** Customer documents generate deterministic IDs based on normalized 10-digit mobile number (`cust_p_XXXXXXXXXX`), Marg Party Code (`cust_c_XXXX`), or normalized full name (`cust_n_XXXX`). This completely prevents duplicate customer records across repetitive monthly uploads.

### 18.2 Offline Capabilities & Cloud Sync
- The application executes client-side with complete offline capability. All calculations (days remaining, urgency tiers, search, sorting) run in-browser.
- When an active internet connection is present, updates to customer records, refill status, or upload batches automatically synchronize with Cloud Firestore in the background (~100ms latency).
- Clicking the TopBar **`Sync`** button triggers a full bidirectional pull/push cycle via `dataStore.forcePullFromFirestore()`.

### 18.3 Serverless Autonomous Email Alerts
- Serverless Cron API endpoint: `/api/cron/owner-daily-alert` (scheduled via `vercel.json` for `09:00 AM IST` daily).
- Scans Firestore for active monthly customers in `DUE_IN_5_DAYS` or `OVERDUE` state and dispatches an HTML table digest to the configured owner email address via Resend / Brevo API.

### 18.4 Current Boundaries & Honest Limitations (What the app does NOT do)
1. **No direct live database link to Marg ERP:** The app does not read Marg's proprietary `.dbf` or SQL database directly in real-time. Staff must export Marg's `PATIENT/PRODUCT WISE SALES SUMMARY` file and upload it through the Bills & Uploads tab.
2. **Individual Invoice Dates in Grouped Marg Summaries:** Marg ERP grouped sales summaries aggregate sales over a date bracket without per-line invoice timestamps. The app sets `lastPurchaseDate` to the file's `periodEnd` date. For non-standard duration prescriptions, staff should use the Dispense Calendar to fine-tune individual cycle lengths.
3. **SMS Gateway:** Automated GSM/SMS is not built-in; messaging is handled via direct WhatsApp Web links and client-side telephone URI protocol handlers (`tel:`).
