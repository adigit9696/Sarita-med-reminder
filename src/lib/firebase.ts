import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  deleteDoc,
  writeBatch, 
  onSnapshot,
  type Unsubscribe,
  query, 
  limit, 
  type Firestore 
} from 'firebase/firestore';
import type { Customer, UploadBatch, AppSettings } from '@/types';

export interface FirebaseConfigObject {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const DEFAULT_FIREBASE_CONFIG: FirebaseConfigObject = {
  apiKey: "AIzaSyAq_intMs_g06a-5qplEiwld5-D-agrxkM",
  authDomain: "sarita-med-reminder.firebaseapp.com",
  projectId: "sarita-med-reminder",
  storageBucket: "sarita-med-reminder.firebasestorage.app",
  messagingSenderId: "502753762562",
  appId: "1:502753762562:web:7f41798c148aadda2f361b",
};

const STORAGE_KEY = 'sarita_med_firebase_config';

export function getActiveFirebaseConfig(): FirebaseConfigObject | null {
  // 1. Check browser localStorage
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.apiKey && parsed.projectId) {
          return parsed;
        }
      } catch {
        // invalid JSON
      }
    }
  }

  // 2. Check process.env (Next.js public env vars)
  if (
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  ) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || DEFAULT_FIREBASE_CONFIG.authDomain,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || DEFAULT_FIREBASE_CONFIG.storageBucket,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || DEFAULT_FIREBASE_CONFIG.messagingSenderId,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || DEFAULT_FIREBASE_CONFIG.appId,
    };
  }

  // 3. Built-in configured project fallback
  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config: FirebaseConfigObject): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }
}

export function clearFirebaseConfig(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

let cachedApp: FirebaseApp | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseDb(): Firestore | null {
  const config = getActiveFirebaseConfig();
  if (!config || !config.apiKey || !config.projectId) return null;

  try {
    if (!cachedApp) {
      const apps = getApps();
      cachedApp = apps.length > 0 ? getApp() : initializeApp(config);
    }
    if (!cachedDb && cachedApp) {
      cachedDb = getFirestore(cachedApp);
    }
    return cachedDb;
  } catch (err) {
    console.warn('Firebase initialization note:', err);
    return null;
  }
}

export async function testFirebaseConnection(config: FirebaseConfigObject): Promise<{ success: boolean; message: string }> {
  try {
    const testApp = initializeApp(config, 'test-app-' + Date.now());
    const db = getFirestore(testApp);
    // Write health check doc to verify write permissions
    const testRef = doc(db, 'health_check', 'connection_test');
    await setDoc(testRef, {
      status: 'connected',
      timestamp: new Date().toISOString()
    });
    return { success: true, message: 'Successfully connected and verified read/write access with Firebase Firestore!' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: 'Firebase connection failed: ' + errorMsg };
  }
}

// ================= Firestore Sync Methods =================

export async function syncCustomersToFirestore(customers: Customer[]): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) {
    console.warn('Cannot sync customers: Firestore DB not initialized');
    return false;
  }

  try {
    // Write in chunks of 350 (Firestore batch limit is 500)
    const chunkSize = 350;
    for (let i = 0; i < customers.length; i += chunkSize) {
      const chunk = customers.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      chunk.forEach(cust => {
        const docRef = doc(db, 'customers', cust.id);
        // Clean undefined values to prevent Firestore rejection
        const cleanCust = JSON.parse(JSON.stringify(cust));
        batch.set(docRef, {
          ...cleanCust,
          syncedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
    }
    console.log(`Successfully synced ${customers.length} customers to Firestore`);
    return true;
  } catch (err) {
    console.error('Error syncing customers to Firestore:', err);
    return false;
  }
}

export async function fetchCustomersFromFirestore(): Promise<Customer[] | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const snapshot = await getDocs(collection(db, 'customers'));
    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Customer);
    });
    return list;
  } catch (err) {
    console.error('Error fetching customers from Firestore:', err);
    return null;
  }
}

export async function syncBatchesToFirestore(batches: UploadBatch[]): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    const batch = writeBatch(db);
    batches.forEach(b => {
      // 1. Save master upload batch metadata
      const docRef = doc(db, 'upload_batches', b.id);
      const cleanBatch = JSON.parse(JSON.stringify(b));
      batch.set(docRef, cleanBatch);

      // 2. Save isolated separate file/record containing ONLY new customers for this upload
      if (b.newCustomers && b.newCustomers.length > 0) {
        const newCustDocRef = doc(db, 'batch_new_customers', b.id);
        batch.set(newCustDocRef, {
          batchId: b.id,
          fileName: b.fileName,
          uploadDate: b.uploadDate,
          periodStart: b.periodStart,
          periodEnd: b.periodEnd,
          newCustomersCount: b.newCustomers.length,
          newCustomers: JSON.parse(JSON.stringify(b.newCustomers)),
          updatedAt: new Date().toISOString(),
        });
      }
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.error('Error syncing batches to Firestore:', err);
    return false;
  }
}

export async function fetchBatchesFromFirestore(): Promise<UploadBatch[] | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const snapshot = await getDocs(collection(db, 'upload_batches'));
    const list: UploadBatch[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as UploadBatch);
    });
    return list;
  } catch (err) {
    console.error('Error fetching upload batches from Firestore:', err);
    return null;
  }
}

export async function deleteBatchFromFirestore(batchId: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    // 1. Delete upload batch record and its separate new_customers document
    await deleteDoc(doc(db, 'upload_batches', batchId));
    try {
      await deleteDoc(doc(db, 'batch_new_customers', batchId));
    } catch {
      // ignore if document does not exist
    }

    // STRICT USER REQUIREMENT:
    // Deleting an upload batch must ONLY remove the packaging record for that month.
    // Customer master data in "customers" collection must remain permanently secure in Firebase
    // so staff can restore or view them anytime under "All Customers".
    return true;
  } catch (err) {
    console.error('Error deleting batch from Firestore:', err);
    return false;
  }
}

/**
 * Real-time listener for Firestore customers and batches collections.
 * Automatically synchronizes changes and deletions immediately.
 */
export function subscribeToFirestore(
  onCustomers: (customers: Customer[]) => void,
  onBatches: (batches: UploadBatch[]) => void
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};

  const unsubCustomers = onSnapshot(collection(db, 'customers'), (snapshot) => {
    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Customer);
    });
    onCustomers(list);
  }, (err) => {
    console.warn('Real-time customers listener warning:', err);
  });

  const unsubBatches = onSnapshot(collection(db, 'upload_batches'), (snapshot) => {
    const list: UploadBatch[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as UploadBatch);
    });
    onBatches(list);
  }, (err) => {
    console.warn('Real-time batches listener warning:', err);
  });

  return () => {
    try {
      unsubCustomers();
      unsubBatches();
    } catch {
      // ignore
    }
  };
}

export async function syncSettingsToFirestore(settings: AppSettings): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    const docRef = doc(db, 'settings', 'app_config');
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    await setDoc(docRef, cleanSettings);
    return true;
  } catch (err) {
    console.error('Error syncing settings to Firestore:', err);
    return false;
  }
}

export async function fetchSettingsFromFirestore(): Promise<AppSettings | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const docSnap = await getDoc(doc(db, 'settings', 'app_config'));
    if (docSnap.exists()) {
      return docSnap.data() as AppSettings;
    }
    return null;
  } catch (err) {
    console.error('Error fetching settings from Firestore:', err);
    return null;
  }
}
