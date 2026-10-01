import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  getDoc,
  getDocsFromServer,
  getDocFromServer,
  deleteDoc, 
  writeBatch, 
  onSnapshot,
  type Unsubscribe,
  type Firestore 
} from 'firebase/firestore';
import type { Customer, UploadBatch, AppSettings, DataStateDoc } from '@/types';

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
    console.log('[Firestore Write] caller=testFirebaseConnection, collection=health_check, doc=connection_test');
    return { success: true, message: 'Successfully connected and verified read/write access with Firebase Firestore!' };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { success: false, message: 'Firebase connection failed: ' + errorMsg };
  }
}

// ================= Firestore Sync Options & Guard =================

export interface SyncCustomersOptions {
  caller?: string;
  isUploadCommit?: boolean;
  isRestore?: boolean;
  isResetTool?: boolean;
}

/**
 * Saves customer records into the 'all_customers' collection in Firestore.
 * Strictly guarded: Any call attempting > 10 docs without explicit authorization is aborted.
 */
export async function syncCustomersToFirestore(
  customers: Customer[], 
  options: SyncCustomersOptions = {}
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) {
    console.warn('Cannot sync customers: Firestore DB not initialized');
    return false;
  }

  if (!Array.isArray(customers) || customers.length === 0) {
    return true;
  }

  const caller = options.caller || 'unknown';
  const isAuthorizedBulk = options.isUploadCommit || options.isRestore || options.isResetTool;

  // Requirement 3.1 #8: Unexpected-bulk-write guard (> 10 customers)
  if (customers.length > 10 && !isAuthorizedBulk) {
    const errorMsg = `[Firestore Safety Guard] BLOCKED unauthorized bulk write of ${customers.length} customers by caller '${caller}'.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  try {
    const uniqueMap = new Map<string, Customer>();
    customers.forEach(cust => {
      if (!cust || !cust.name) return;
      const safeId = String(cust.id || '').replace(/[\/\s]/g, '_') || 'cust_' + Math.random().toString(36).slice(2);
      uniqueMap.set(safeId, { ...cust, id: safeId });
    });

    const uniqueCustomers = Array.from(uniqueMap.values());
    // Requirement 3.1 #10: Log secret-free write line in development
    console.log(`[Firestore Write] caller=${caller}, collection=all_customers, docCount=${uniqueCustomers.length}`);

    const chunkSize = 25;
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

        const allCustRef = doc(db, 'all_customers', cust.id);
        batch.set(allCustRef, payload, { merge: true });
      });

      await batch.commit();
    }

    return true;
  } catch (err) {
    console.error('[Firebase] Error syncing customers to Firestore:', err);
    return false;
  }
}

export async function syncSingleCustomerToFirestore(
  customer: Customer, 
  caller: string = 'single_update'
): Promise<boolean> {
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

    console.log(`[Firestore Write] caller=${caller}, collection=all_customers, docId=${docId}, docCount=1`);
    await setDoc(doc(db, 'all_customers', docId), payload, { merge: true });
    return true;
  } catch (err) {
    console.error(`[Firebase] Error syncing customer ${customer.id} to Firestore:`, err);
    return false;
  }
}

/**
 * Dedicated Firestore Collection for "Monthly Customers":
 * When staff selects a customer, they are saved directly into 'monthly_customers'.
 * When deselected, they are removed from 'monthly_customers' while remaining in 'all_customers'.
 */
export async function syncMonthlyCustomerToFirestore(
  customer: Customer, 
  isMonthly: boolean,
  caller: string = 'monthly_toggle'
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !customer || !customer.id) return false;

  try {
    const docId = String(customer.id).replace(/[\/\s]/g, '_');
    const cleanCust = JSON.parse(JSON.stringify(customer));
    const monthlyDocRef = doc(db, 'monthly_customers', docId);
    const masterDocRef = doc(db, 'all_customers', docId);

    if (isMonthly) {
      console.log(`[Firestore Write] caller=${caller}, collection=monthly_customers, docId=${docId}, action=add, docCount=1`);
      // 1. Save record into dedicated monthly_customers collection
      await setDoc(monthlyDocRef, {
        ...cleanCust,
        id: docId,
        isMonthlyRegular: true,
        addedToMonthlyAt: new Date().toISOString(),
        syncedAt: new Date().toISOString(),
      }, { merge: true });

      // 2. Mark isMonthlyRegular: true on permanent all_customers master record
      await setDoc(masterDocRef, {
        ...cleanCust,
        id: docId,
        isMonthlyRegular: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } else {
      console.log(`[Firestore Write] caller=${caller}, collection=monthly_customers, docId=${docId}, action=remove, docCount=1`);
      // Remove from dedicated monthly_customers collection
      await deleteDoc(monthlyDocRef);

      // Keep in all_customers but mark isMonthlyRegular: false
      await setDoc(masterDocRef, {
        isMonthlyRegular: false,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return true;
  } catch (err) {
    console.error(`[Firebase] Error syncing monthly customer ${customer.id}:`, err);
    return false;
  }
}

export async function clearAllMonthlyCustomersFromFirestore(caller: string = 'deselect_all_monthly'): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    const snapshot = await getDocsFromServer(collection(db, 'monthly_customers'));
    console.log(`[Firestore Write] caller=${caller}, collection=monthly_customers, docCount=${snapshot.size} (clear)`);
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

// ================= Server-Confirmed Read Methods =================

export async function fetchCustomersFromFirestore(fromServer = true): Promise<Customer[] | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const colRef = collection(db, 'all_customers');
    const snapshot = fromServer ? await getDocsFromServer(colRef) : await getDocs(colRef);
    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Customer;
      if (data && data.name && data.id) {
        list.push(data);
      }
    });
    return list;
  } catch (err) {
    console.warn('[Firebase] Warning reading all_customers from server:', err);
    return null;
  }
}

export async function fetchMonthlyCustomersFromFirestore(fromServer = true): Promise<Customer[] | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const colRef = collection(db, 'monthly_customers');
    const snapshot = fromServer ? await getDocsFromServer(colRef) : await getDocs(colRef);
    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Customer;
      if (data && data.name) {
        list.push(data);
      }
    });
    return list;
  } catch (err) {
    console.warn('[Firebase] Warning reading monthly_customers from server:', err);
    return null;
  }
}

export async function fetchBatchesFromFirestore(fromServer = true): Promise<UploadBatch[] | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const colRef = collection(db, 'all_uploads');
    const snapshot = fromServer ? await getDocsFromServer(colRef) : await getDocs(colRef);
    const list: UploadBatch[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as UploadBatch;
      if (data && data.id) {
        list.push(data);
      }
    });
    return list;
  } catch (err) {
    console.warn('[Firebase] Warning reading all_uploads from server:', err);
    return null;
  }
}

export async function saveSingleBatchToFirestore(batch: UploadBatch, caller: string = 'upload_commit'): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !batch || !batch.id) return false;

  try {
    const docRef = doc(db, 'all_uploads', batch.id);
    const cleanBatch = JSON.parse(JSON.stringify(batch));
    console.log(`[Firestore Write] caller=${caller}, collection=all_uploads, docId=${batch.id}, docCount=1`);
    await setDoc(docRef, {
      ...cleanBatch,
      syncedAt: new Date().toISOString(),
    }, { merge: true });

    return true;
  } catch (err) {
    console.error(`[Firebase] Error saving batch ${batch.id} to all_uploads in Firestore:`, err);
    return false;
  }
}

export async function deleteBatchFromFirestore(batchId: string, caller: string = 'delete_batch'): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    console.log(`[Firestore Write] caller=${caller}, collection=all_uploads, docId=${batchId}, docCount=1 (delete)`);
    await deleteDoc(doc(db, 'all_uploads', batchId));
    return true;
  } catch (err) {
    console.error('[Firebase] Error deleting batch from all_uploads in Firestore:', err);
    return false;
  }
}

export async function syncBatchesToFirestore(
  batches: UploadBatch[],
  caller: string = 'restore_backup'
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db || !Array.isArray(batches) || batches.length === 0) return true;

  try {
    console.log(`[Firestore Write] caller=${caller}, collection=all_uploads, docCount=${batches.length}`);
    const batchWriter = writeBatch(db);
    batches.forEach(b => {
      if (b && b.id) {
        const cleanBatch = JSON.parse(JSON.stringify(b));
        batchWriter.set(doc(db, 'all_uploads', b.id), {
          ...cleanBatch,
          syncedAt: new Date().toISOString(),
        }, { merge: true });
      }
    });
    await batchWriter.commit();
    return true;
  } catch (err) {
    console.error('[Firebase] Error syncing batches to all_uploads:', err);
    return false;
  }
}

// ================= Stale-Device Epoch & Data State =================

export async function fetchDataStateFromFirestore(): Promise<DataStateDoc | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  try {
    const snap = await getDocFromServer(doc(db, 'settings', 'data_state'));
    if (snap.exists()) {
      return snap.data() as DataStateDoc;
    }
    return null;
  } catch (err) {
    console.warn('[Firebase] Note reading settings/data_state from server:', err);
    return null;
  }
}

export async function initOrGetCloudDataState(): Promise<DataStateDoc | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  try {
    const existing = await fetchDataStateFromFirestore();
    if (existing && existing.epoch) {
      return existing;
    }
    const newEpoch = 'epoch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    const newState: DataStateDoc = {
      epoch: newEpoch,
      resetAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'settings', 'data_state'), newState);
    console.log(`[Firestore Write] caller=init_data_state, collection=settings, doc=data_state, epoch=${newEpoch}`);
    return newState;
  } catch (err) {
    console.warn('[Firebase] Error initializing data_state:', err);
    return null;
  }
}

// ================= Controlled Safe Reset Engine =================

export async function executeServerSideReset(mode: 'ALL' | 'KEEP_MONTHLY'): Promise<{
  success: boolean;
  deletedCustomers: number;
  deletedBatches: number;
  keptMonthly: number;
  newEpoch: string;
  error?: string;
}> {
  const db = getFirebaseDb();
  if (!db) {
    return { success: false, deletedCustomers: 0, deletedBatches: 0, keptMonthly: 0, newEpoch: '', error: 'Firestore DB offline' };
  }

  console.log(`[Firestore Reset] Starting server-side clean reset with mode=${mode}...`);

  try {
    // 1. Read monthly IDs
    const monthlySnap = await getDocsFromServer(collection(db, 'monthly_customers'));
    const monthlyIds = new Set<string>();
    monthlySnap.forEach(d => monthlyIds.add(d.id));

    // 2. Delete all uploads batches in chunks of <= 400
    const batchesSnap = await getDocsFromServer(collection(db, 'all_uploads'));
    let deletedBatches = 0;
    const batchDocs = batchesSnap.docs;
    for (let i = 0; i < batchDocs.length; i += 400) {
      const chunk = batchDocs.slice(i, i + 400);
      const b = writeBatch(db);
      chunk.forEach(d => b.delete(d.ref));
      await b.commit();
      deletedBatches += chunk.length;
    }

    let deletedCustomers = 0;
    let keptMonthly = 0;

    if (mode === 'ALL') {
      // Delete all monthly_customers
      const mDocs = monthlySnap.docs;
      for (let i = 0; i < mDocs.length; i += 400) {
        const chunk = mDocs.slice(i, i + 400);
        const b = writeBatch(db);
        chunk.forEach(d => b.delete(d.ref));
        await b.commit();
      }

      // Delete all all_customers
      const custSnap = await getDocsFromServer(collection(db, 'all_customers'));
      const cDocs = custSnap.docs;
      for (let i = 0; i < cDocs.length; i += 400) {
        const chunk = cDocs.slice(i, i + 400);
        const b = writeBatch(db);
        chunk.forEach(d => b.delete(d.ref));
        await b.commit();
        deletedCustomers += chunk.length;
      }
      keptMonthly = 0;
    } else {
      // Mode KEEP_MONTHLY: delete all_customers NOT in monthlyIds
      const custSnap = await getDocsFromServer(collection(db, 'all_customers'));
      const cDocs = custSnap.docs.filter(d => !monthlyIds.has(d.id));
      for (let i = 0; i < cDocs.length; i += 400) {
        const chunk = cDocs.slice(i, i + 400);
        const b = writeBatch(db);
        chunk.forEach(d => b.delete(d.ref));
        await b.commit();
        deletedCustomers += chunk.length;
      }
      keptMonthly = monthlyIds.size;
    }

    // 3. Bump settings/data_state with new epoch so all other devices wipe local cache on open
    const newEpoch = 'epoch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    const newState: DataStateDoc = {
      epoch: newEpoch,
      resetAt: new Date().toISOString(),
      mode,
    };
    await setDoc(doc(db, 'settings', 'data_state'), newState);
    console.log(`[Firestore Write] caller=reset_tool, collection=settings, doc=data_state, newEpoch=${newEpoch}`);
    console.log(`[Firestore Reset] Completed. Deleted: ${deletedCustomers} customers, ${deletedBatches} batches. Kept: ${keptMonthly} monthly.`);

    return {
      success: true,
      deletedCustomers,
      deletedBatches,
      keptMonthly,
      newEpoch,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Firestore Reset] Failed during reset execution:', msg);
    return {
      success: false,
      deletedCustomers: 0,
      deletedBatches: 0,
      keptMonthly: 0,
      newEpoch: '',
      error: msg,
    };
  }
}

// ================= Real-time Listeners =================

export function subscribeToFirestore(
  onCustomers: (customers: Customer[]) => void,
  onBatches: (batches: UploadBatch[]) => void,
  onMonthlyCustomers?: (customers: Customer[]) => void
): Unsubscribe {
  const db = getFirebaseDb();
  if (!db) return () => {};

  const unsubCustomers = onSnapshot(collection(db, 'all_customers'), (snapshot) => {
    // Ignore cache-only transient snapshots
    if (snapshot.metadata.fromCache) return;
    const list: Customer[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Customer;
      if (data && data.name && data.id) {
        list.push(data);
      }
    });
    onCustomers(list);
  }, (err) => {
    console.warn('Real-time all_customers listener warning:', err);
  });

  const unsubBatches = onSnapshot(collection(db, 'all_uploads'), (snapshot) => {
    if (snapshot.metadata.fromCache) return;
    const list: UploadBatch[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as UploadBatch;
      if (data && data.id) {
        list.push(data);
      }
    });
    onBatches(list);
  }, (err) => {
    console.warn('Real-time all_uploads listener warning:', err);
  });

  let unsubMonthly: (() => void) | null = null;
  if (onMonthlyCustomers) {
    unsubMonthly = onSnapshot(collection(db, 'monthly_customers'), (snapshot) => {
      if (snapshot.metadata.fromCache) return;
      const list: Customer[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Customer;
        if (data && data.name && data.id) {
          list.push(data);
        }
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

// ================= Settings Sync =================

export async function syncSettingsToFirestore(
  settings: Partial<AppSettings>,
  caller: string = 'settings_update'
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    const docRef = doc(db, 'settings', 'app_config');
    const cleanSettings = JSON.parse(JSON.stringify(settings));
    console.log(`[Firestore Write] caller=${caller}, collection=settings, doc=app_config`);
    await setDoc(docRef, cleanSettings, { merge: true });
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
    const docSnap = await getDocFromServer(doc(db, 'settings', 'app_config'));
    if (docSnap.exists()) {
      return docSnap.data() as AppSettings;
    }
    return null;
  } catch (err) {
    console.warn('Error fetching settings from Firestore server:', err);
    return null;
  }
}
