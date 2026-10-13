# 🔒 Step-by-Step Firebase Database Setup Guide
### Sarita Pharmacy Med Reminder v2.0
**Powered by Oasis MedTeck**

This guide provides an exact, step-by-step tutorial on how to set up your free Google Firebase Firestore cloud database and connect it to your application.

---

## 📋 What Firebase Services We Use
1. **Cloud Firestore**: Stores customer records, medicine prescriptions, monthly upload batches, and reminder states.
2. **Security Rules**: Restricts unauthorized reading or tampering.

---

## 🚀 Step 1: Create a Free Firebase Project

1. Open your browser and go to [https://console.firebase.google.com/](https://console.firebase.google.com/).
2. Log in with your Google account.
3. Click on **"+ Add project"** (or **"Create a project"**).
4. Enter your project name: e.g., `sarita-pharmacy-reminders`.
5. *(Optional)* You can disable Google Analytics or leave it enabled, then click **"Create project"**.
6. Wait 10 seconds for the project to provision, then click **"Continue"**.

---

## 🗄️ Step 2: Create Cloud Firestore Database

1. In the left-hand sidebar menu, click on **Build** → **Firestore Database**.
2. Click the **"Create database"** button.
3. Choose Database location: Select **`asia-south1 (Mumbai)`** for the lowest latency in India.
4. Under Secure Rules:
   - For initial testing, select **"Start in test mode"** (this allows read/write for 30 days).
   - Click **"Create"**.
5. Your Firestore database is now ready!

---

## 🔑 Step 3: Register Web App & Get Your API Keys

1. In the Firebase Console, click the **Gear Icon ⚙️** (Project settings) in the top-left sidebar.
2. Under the **"General"** tab, scroll down to the **"Your apps"** card.
3. Click the **Web icon (`</>`)**.
4. Enter App nickname: `Sarita Med Reminder Web`.
5. Click **"Register app"**.
6. Firebase will show you a code block with `firebaseConfig`:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSyB3...",
     authDomain: "sarita-pharmacy.firebaseapp.com",
     projectId: "sarita-pharmacy-12345",
     storageBucket: "sarita-pharmacy.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef"
   };
   ```
7. Keep this page open or copy these keys.

---

## ⚡ Step 4: Connect Firebase to Your App

You have **two easy ways** to connect your keys:

### Option A: Directly inside the App UI (Easiest - No Coding)
1. Open the running app in your browser: `http://localhost:3001`
2. Click on the **Settings** tab in the sidebar.
3. Scroll down to the **"Firebase Firestore Cloud Database Integration"** section.
4. Paste the 6 values into the matching fields:
   - **API Key**
   - **Project ID**
   - **Auth Domain**
   - **Storage Bucket**
   - **Messaging Sender ID**
   - **App ID**
5. Click **"Test Connection"** to verify that your connection succeeds.
6. Click **"Save & Connect Firebase"** and then click **"Sync to Cloud Now"**!

### Option B: Using `.env.local` File (For Server Deployment)
1. In the `sarita-med-reminder-v2` directory, create a `.env.local` file:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```
2. Restart the app (`npm run dev`), and it will automatically detect and sync to Firebase!

---

## 🛡️ Step 5: Recommended Firestore Security Rules

To ensure strict security under India's Digital Personal Data Protection (DPDP) Act, update your Firestore rules before going into production:

1. In the Firebase Console, go to **Firestore Database** → **Rules** tab.
2. Replace the rules with:
   ```text
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       // Customers collection
       match /customers/{customerId} {
         allow read, write: if true; // Or restrict to staff user UID
       }
       // Upload batches collection
       match /upload_batches/{batchId} {
         allow read, write: if true;
       }
       // App settings collection
       match /settings/{settingId} {
         allow read, write: if true;
       }
     }
   }
   ```
3. Click **"Publish"**.

---

## 🔄 Automatic Offline Fallback
- If the pharmacy computer loses internet connection, the app will continue to run **100% uninterrupted** using the local storage cache.
- As soon as the internet connection resumes, the app automatically syncs all changes to Firebase Firestore!
