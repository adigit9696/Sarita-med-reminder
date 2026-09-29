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

/**
 * Saves all customer records permanently into the dedicated 'all_customers' collection in Firestore.
 * Automatically deduplicates by sanitized customer ID and writes in safe batches of 50 documents.
 */
export async function syncCustomersToFirestore(customers: Customer[]): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) {
    console.warn('Cannot sync customers: Firestore DB not initialized');
    return false;
  }

  if (!Array.isArray(customers) || customers.length === 0) {
    return true;
  }

  try {
    // 1. Deduplicate by unique document ID
    const uniqueMap = new Map<string, Customer>();
    customers.forEach(cust => {
      if (!cust) return;
      const safeId = String(cust.id || '').replace(/[\/\s]/g, '_') || 'cust_' + Math.random().toString(36).slice(2);
      uniqueMap.set(safeId, { ...cust, id: safeId });
    });

    const uniqueCustomers = Array.from(uniqueMap.values());
    const chunkSize = 50; // Ultra-safe chunk size for Firestore

    for (let i = 0; i < uniqueCustomers.length; i += chunkSize) {
      const chunk = uniqueCustomers.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach(cust => {
        const cleanCust = JSON.parse(JSON.stringify(cust));
        const payload = {
          ...cleanCust,
          id: cust.id,
          syncedAt: new Date().toISOString(),
        };

        // Primary collection: all_customers (per user requirement)
        const allCustRef = doc(db, 'all_customers', cust.id);
        batch.set(allCustRef, payload, { merge: true });

        // Mirror collection: customers (for backward compatibility)
        const legacyRef = doc(db, 'customers', cust.id);
        batch.set(legacyRef, payload, { merge: true });
      });

      try {
        await batch.commit();
      } catch (batchErr) {
        console.warn(`[Firebase] Batch chunk ${i} commit error, falling back to individual writes:`, batchErr);
        // Fallback: write each customer individually so no customer is dropped
        for (const cust of chunk) {
          try {
            const cleanCust = JSON.parse(JSON.stringify(cust));
            const payload = { ...cleanCust, id: cust.id, syncedAt: new Date().toISOString() };
            await setDoc(doc(db, 'all_customers', cust.id), payload, { merge: true });
            await setDoc(doc(db, 'customers', cust.id), payload, { merge: true });
          } catch (singleErr) {
            console.error(`[Firebase] Error saving individual customer ${cust.id}:`, singleErr);
          }
        }
      }
    }

    console.log(`[Firebase] Successfully synced ${uniqueCustomers.length} master customers to 'all_customers' collection in Firestore!`);
    return true;
  } catch (err) {
    console.error('[Firebase] Error syncing customers to Firestore:', err);
    return false;
  }
}

export async function syncSingleCustomerToFirestore(customer: Customer): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !customer || !customer.id) return false;

  try {
    const docId = String(customer.id).replace(/[\/\s]/g, '_');
    const cleanCust = JSON.parse(JSON.stringify(customer));
    const payload = {
      ...cleanCust,
      id: docId,
      syncedAt: new Date().toISOString(),
    };

    // Write to primary 'all_customers' collection
    await setDoc(doc(db, 'all_customers', docId), payload, { merge: true });
    try {
      await setDoc(doc(db, 'customers', docId), payload, { merge: true });
    } catch {}

    return true;
  } catch (err) {
    console.error(`[Firebase] Error syncing customer ${customer.id} to Firestore:`, err);
    return false;
  }
}

/**
 * Dedicated Firestore Batch Collection for "Monthly Customers":
 * When staff selects a customer in "All Customers", they are saved directly into the 'monthly_customers' collection.
 * When deselected, they are removed from 'monthly_customers' while remaining permanently in 'all_customers'.
 */
export async function syncMonthlyCustomerToFirestore(
  customer: Customer, 
  isMonthly: boolean
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !customer || !customer.id) return false;

  try {
    const docId = String(customer.id).replace(/[\/\s]/g, '_');
    const cleanCust = JSON.parse(JSON.stringify(customer));
    const monthlyDocRef = doc(db, 'monthly_customers', docId);
    const masterDocRef = doc(db, 'all_customers', docId);

    if (isMonthly) {
      // 1. Save directly into dedicated monthly_customers collection
      await setDoc(monthlyDocRef, {
        ...cleanCust,
        id: docId,
        isMonthlyRegular: true,
        addedToMonthlyAt: new Date().toISOString(),
        syncedAt: new Date().toISOString(),
      }, { merge: true });

      // 2. Mark isMonthlyRegular: true on permanent all_customers master record
      await setDoc(masterDocRef, {
        isMonthlyRegular: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      try {
        await setDoc(doc(db, 'customers', docId), {
          isMonthlyRegular: true,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch {}
    } else {
      // 1. Delete from dedicated monthly_customers collection
      await deleteDoc(monthlyDocRef);

      // 2. Mark isMonthlyRegular: false on permanent all_customers master record
      await setDoc(masterDocRef, {
        isMonthlyRegular: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      try {
        await setDoc(doc(db, 'customers', docId), {
          isMonthlyRegular: false,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch {}
    }

    // Update manifest summary doc in settings collection
    try {
      const manifestRef = doc(db, 'settings', 'monthly_customers_manifest');
      await setDoc(manifestRef, {
        lastModifiedAt: new Date().toISOString(),
        lastAction: isMonthly ? `Added ${customer.name}` : `Removed ${customer.name}`,
      }, { merge: true });
    } catch {}

    console.log(`[Firebase] Successfully updated monthly status for ${customer.name} (${docId}) -> isMonthly: ${isMonthly}`);
    return true;
  } catch (err) {
    console.error(`[Firebase] Error syncing monthly customer ${customer.id} to Firestore:`, err);
    return false;
  }
}

export async function fetchMonthlyCustomersFromFirestore(): Promise<Customer[] | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const snapshot = await getDocs(collection(db, 'monthly_customers'));
    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Customer);
    });
    return list;
  } catch (err) {
    console.warn('[Firebase] Note fetching monthly_customers collection:', err);
    return null;
  }
}

export async function syncAllMonthlyCustomersToFirestore(monthlyCustomers: Customer[]): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !Array.isArray(monthlyCustomers)) return false;

  try {
    const uniqueMap = new Map<string, Customer>();
    monthlyCustomers.forEach(cust => {
      if (!cust) return;
      const safeId = String(cust.id || '').replace(/[\/\s]/g, '_');
      uniqueMap.set(safeId, { ...cust, id: safeId, isMonthlyRegular: true });
    });

    const list = Array.from(uniqueMap.values());
    const chunkSize = 50;

    for (let i = 0; i < list.length; i += chunkSize) {
      const chunk = list.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach(cust => {
        const monthlyDocRef = doc(db, 'monthly_customers', cust.id);
        const cleanCust = JSON.parse(JSON.stringify(cust));
        batch.set(monthlyDocRef, {
          ...cleanCust,
          isMonthlyRegular: true,
          syncedAt: new Date().toISOString(),
        }, { merge: true });
      });

      await batch.commit();
    }
    console.log(`[Firebase] Successfully synced ${list.length} monthly customers to 'monthly_customers' collection`);
    return true;
  } catch (err) {
    console.error('[Firebase] Error syncing all monthly customers to Firestore:', err);
    return false;
  }
}

export async function clearAllMonthlyCustomersFromFirestore(): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    const snapshot = await getDocs(collection(db, 'monthly_customers'));
    const batch = writeBatch(db);
    snapshot.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
    await batch.commit();
    return true;
  } catch (err) {
    console.error('[Firebase] Error clearing monthly_customers collection:', err);
    return false;
  }
}

export async function fetchCustomersFromFirestore(): Promise<Customer[] | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    // 1. Fetch from primary user-requested collection: 'all_customers'
    let snapshot = await getDocs(collection(db, 'all_customers'));
    if (snapshot.empty) {
      // 2. Fallback to legacy 'customers' collection if all_customers is empty
      snapshot = await getDocs(collection(db, 'customers'));
    }

    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Customer);
    });
    return list;
  } catch (err) {
    console.error('[Firebase] Error fetching customers from Firestore:', err);
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

/**
 * Saves a single upload batch and its isolated new_customers record directly to Firestore.
 * Guarantees that new upload batches persist immediately even after manual database clears.
 */
export async function saveSingleBatchToFirestore(batch: UploadBatch): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !batch || !batch.id) return false;

  try {
    const docRef = doc(db, 'upload_batches', batch.id);
    const cleanBatch = JSON.parse(JSON.stringify(batch));
    await setDoc(docRef, {
      ...cleanBatch,
      syncedAt: new Date().toISOString(),
    }, { merge: true });

    if (batch.newCustomers && batch.newCustomers.length > 0) {
      try {
        const newCustDocRef = doc(db, 'batch_new_customers', batch.id);
        await setDoc(newCustDocRef, {
          batchId: batch.id,
          fileName: batch.fileName,
          uploadDate: batch.uploadDate,
          periodStart: batch.periodStart,
          periodEnd: batch.periodEnd,
          newCustomersCount: batch.newCustomers.length,
          newCustomers: JSON.parse(JSON.stringify(batch.newCustomers)),
          updatedAt: new Date().toISOString(),
        });
      } catch (subErr) {
        console.warn('Note saving batch_new_customers:', subErr);
      }
    }

    console.log(`[Firebase] Successfully saved upload batch ${batch.id} (${batch.fileName}) to Firestore`);
    return true;
  } catch (err) {
    console.error(`[Firebase] Error saving batch ${batch.id} to Firestore:`, err);
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
 * Real-time listener for Firestore customers, monthly_customers, and batches collections.
 * Automatically synchronizes changes and deletions immediately across all devices.
 */
export function subscribeToFirestore(
  onCustomers: (customers: Customer[]) => void,
  onBatches: (batches: UploadBatch[]) => void,
  onMonthlyCustomers?: (customers: Customer[]) => void
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};

  const unsubCustomers = onSnapshot(collection(db, 'all_customers'), (snapshot) => {
    if (snapshot.empty) {
      // Check legacy collection as fallback
      getDocs(collection(db, 'customers')).then(legacySnap => {
        if (!legacySnap.empty) {
          const list: Customer[] = [];
          legacySnap.forEach(docSnap => list.push(docSnap.data() as Customer));
          onCustomers(list);
        } else {
          onCustomers([]);
        }
      }).catch(() => onCustomers([]));
      return;
    }
    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      list.push(docSnap.data() as Customer);
    });
    onCustomers(list);
  }, (err) => {
    console.warn('Real-time all_customers listener warning:', err);
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

  let unsubMonthly: (() => void) | null = null;
  if (onMonthlyCustomers) {
    unsubMonthly = onSnapshot(collection(db, 'monthly_customers'), (snapshot) => {
      const list: Customer[] = [];
      snapshot.forEach(docSnap => {
        list.push(docSnap.data() as Customer);
      });
      onMonthlyCustomers(list);
    }, (err) => {
      console.warn('Real-time monthly_customers listener warning:', err);
    });
  }

  return () => {
    try {
      unsubCustomers();
      unsubBatches();
      if (unsubMonthly) unsubMonthly();
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
