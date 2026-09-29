import type { Customer, UploadBatch, ReminderItem, AppSettings, ReminderStatus } from '@/types';
import { generateReminders } from './refill-calculator';
import { deduplicateCustomerList } from './customer-matcher';
import { 
  syncCustomersToFirestore, 
  syncSingleCustomerToFirestore,
  syncMonthlyCustomerToFirestore,
  fetchMonthlyCustomersFromFirestore,
  syncAllMonthlyCustomersToFirestore,
  clearAllMonthlyCustomersFromFirestore,
  fetchCustomersFromFirestore, 
  syncBatchesToFirestore, 
  saveSingleBatchToFirestore,
  fetchBatchesFromFirestore, 
  deleteBatchFromFirestore,
  syncSettingsToFirestore,
  fetchSettingsFromFirestore,
  subscribeToFirestore,
  getFirebaseDb 
} from './firebase';
import { SAMPLE_MERGED_CUSTOMERS, SAMPLE_BATCHES } from './sample-data';
import { DEFAULT_WHATSAPP_TEMPLATE } from './whatsapp';
import { audioAlerts } from './audio-alerts';
import { deriveMonthInfo } from './marg-parser';
import { getCustomersForBatch } from './monthly-comparator';

/**
 * Merges remote customers from Firestore into the local customer array.
 * Real-time authoritative sync: propagates any changed customer properties across devices.
 */
export function mergeRemoteCustomers(
  localCustomers: Customer[],
  remoteCustomers: Customer[]
): { merged: Customer[]; hasChanges: boolean } {
  if (!remoteCustomers || !Array.isArray(remoteCustomers) || remoteCustomers.length === 0) {
    return { merged: localCustomers, hasChanges: false };
  }

  let hasChanges = false;
  const localMap = new Map<string, Customer>();
  const phoneMap = new Map<string, string>();
  const codeMap = new Map<string, string>();

  localCustomers.forEach(c => {
    if (!c || !c.id) return;
    localMap.set(c.id, { ...c });
    if (c.phoneNorm) phoneMap.set(c.phoneNorm, c.id);
    if (c.code) codeMap.set(String(c.code).trim().toLowerCase(), c.id);
  });

  remoteCustomers.forEach(remote => {
    if (!remote || !remote.id) return;

    let localId = remote.id;
    if (!localMap.has(localId)) {
      if (remote.phoneNorm && phoneMap.has(remote.phoneNorm)) {
        localId = phoneMap.get(remote.phoneNorm)!;
      } else if (remote.code && codeMap.has(String(remote.code).trim().toLowerCase())) {
        localId = codeMap.get(String(remote.code).trim().toLowerCase())!;
      }
    }

    if (localMap.has(localId)) {
      const existing = localMap.get(localId)!;
      const isDiff = 
        existing.isMonthlyRegular !== Boolean(remote.isMonthlyRegular) ||
        existing.lastRefillDate !== remote.lastRefillDate ||
        existing.nextDueDate !== remote.nextDueDate ||
        existing.alertDate !== remote.alertDate ||
        existing.lastPurchaseDate !== remote.lastPurchaseDate ||
        existing.totalSpend !== remote.totalSpend ||
        (remote.updatedAt && (!existing.updatedAt || remote.updatedAt > existing.updatedAt));

      if (isDiff) {
        hasChanges = true;
        // Never let a stale remote record deselect a locally selected monthly customer
        const resolvedMonthly = (remote.updatedAt && existing.updatedAt && remote.updatedAt > existing.updatedAt)
          ? Boolean(remote.isMonthlyRegular)
          : (existing.isMonthlyRegular || Boolean(remote.isMonthlyRegular));

        localMap.set(localId, {
          ...existing,
          ...remote,
          id: existing.id,
          isMonthlyRegular: resolvedMonthly,
          medicines: Array.isArray(remote.medicines) && remote.medicines.length > 0 ? remote.medicines : existing.medicines,
        });
      }
    } else {
      hasChanges = true;
      localMap.set(remote.id, remote);
      if (remote.phoneNorm) phoneMap.set(remote.phoneNorm, remote.id);
      if (remote.code) codeMap.set(String(remote.code).trim().toLowerCase(), remote.id);
    }
  });

  return {
    merged: Array.from(localMap.values()),
    hasChanges,
  };
}

const CUSTOMERS_KEY = 'sarita_med_customers_v2';
const BATCHES_KEY = 'sarita_med_batches_v2';
const SETTINGS_KEY = 'sarita_med_settings_v2';
const REMINDERS_KEY = 'sarita_med_reminders_v2';

export const DEFAULT_SETTINGS: AppSettings = {
  pin: '1234',
  pinLength: 4,
  autoLockMinutes: 10,
  alertDaysBefore: 5,
  defaultRefillCycleDays: 30,
  enableAudioAlerts: true,
  enableBrowserNotifications: true,
  audioVolume: 0.7,
  language: 'en',
  whatsappTemplate: DEFAULT_WHATSAPP_TEMPLATE,
};

class DataStoreService {
  private customers: Customer[] = [...SAMPLE_MERGED_CUSTOMERS];
  private batches: UploadBatch[] = [...SAMPLE_BATCHES];
  private reminders: ReminderItem[] = generateReminders(SAMPLE_MERGED_CUSTOMERS, DEFAULT_SETTINGS.alertDaysBefore);
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<() => void> = new Set();
  private isInitialized: boolean = false;
  private isSyncingWithFirebase: boolean = false;
  private unsubscribeFirestore: (() => void) | null = null;
  private firebaseSyncStatus: 'disconnected' | 'synced' | 'syncing' | 'error' = 'disconnected';

  constructor() {
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(cb => cb());
  }

  private enrichBatches(batches: UploadBatch[]): UploadBatch[] {
    return batches.map(b => {
      const monthInfo = deriveMonthInfo(b.periodStart, b.periodEnd, b.fileName);
      const enrichedBatch: UploadBatch = {
        ...b,
        monthName: b.monthName || monthInfo.monthName,
        monthKey: b.monthKey || monthInfo.monthKey,
      };
      if (!enrichedBatch.customerIds || enrichedBatch.customerIds.length === 0) {
        const custs = getCustomersForBatch(enrichedBatch, this.customers);
        if (custs.length > 0) {
          enrichedBatch.customerIds = custs.map(c => c.id);
        }
      }
      return enrichedBatch;
    });
  }

  public async init(): Promise<void> {
    if (typeof window === 'undefined' || this.isInitialized) return;

    // 1. Load settings
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        // Migrate legacy Hindi template to new exact Hinglish template if unchanged
        if (!parsed.whatsappTemplate || parsed.whatsappTemplate.includes('नमस्ते') || parsed.whatsappTemplate.includes('सरिता फार्मेसी')) {
          parsed.whatsappTemplate = DEFAULT_WHATSAPP_TEMPLATE;
        }
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    }

    // 2. Load Local Data
    const savedCustomers = localStorage.getItem(CUSTOMERS_KEY);
    if (savedCustomers) {
      try {
        const raw = JSON.parse(savedCustomers);
        this.customers = deduplicateCustomerList(raw);
        if (this.customers.length !== raw.length) {
          this.persistLocalCustomers();
        }
      } catch {
        this.customers = [];
      }
    }

    const savedBatches = localStorage.getItem(BATCHES_KEY);
    if (savedBatches) {
      try {
        this.batches = JSON.parse(savedBatches);
      } catch {
        this.batches = [];
      }
    }

    // Auto-populate July & August Marg ERP dataset on first launch if empty AND never initialized before
    const HAS_INITIALIZED_KEY = 'sarita_has_initialized_v2';
    const hasInitialized = typeof window !== 'undefined' ? localStorage.getItem(HAS_INITIALIZED_KEY) : null;

    if (!hasInitialized && this.customers.length === 0 && this.batches.length === 0) {
      this.customers = deduplicateCustomerList(SAMPLE_MERGED_CUSTOMERS);
      this.batches = SAMPLE_BATCHES;
      this.persistLocalCustomers();
      this.persistLocalBatches();
      if (typeof window !== 'undefined') {
        localStorage.setItem(HAS_INITIALIZED_KEY, 'true');
      }
    } else if (typeof window !== 'undefined') {
      localStorage.setItem(HAS_INITIALIZED_KEY, 'true');
    }

    this.batches = this.enrichBatches(this.batches);

    this.recalculateReminders();
    this.isInitialized = true;
    this.notify();

    // 3. Try to connect and sync with Firebase if configured
    this.syncWithFirebase();
  }

  public async syncWithFirebase(): Promise<void> {
    const db = getFirebaseDb();
    if (!db) {
      this.firebaseSyncStatus = 'disconnected';
      this.notify();
      return;
    }

    this.isSyncingWithFirebase = true;
    this.firebaseSyncStatus = 'syncing';
    this.notify();

    try {
      // Fetch remote data
      const remoteCustomers = await fetchCustomersFromFirestore();
      const remoteBatches = await fetchBatchesFromFirestore();
      const remoteMonthly = await fetchMonthlyCustomersFromFirestore();

      // Detection: When the user manually deletes everything from Firebase Firestore
      // (customers, upload_batches, monthly_customers) to manage data manually:
      const isRemoteCompletelyEmpty = (remoteCustomers !== null && remoteCustomers.length === 0) &&
                                     (remoteBatches !== null && remoteBatches.length === 0);

      if (isRemoteCompletelyEmpty) {
        console.log('[Firebase Sync] Detected empty database in Cloud Firestore (collections deleted/wiped by user). Clearing local cache so app starts fresh with new batches.');
        this.customers = [];
        this.batches = [];
        this.reminders = [];
        this.persistLocalCustomers(true);
        this.persistLocalBatches();
        this.recalculateReminders();
        this.firebaseSyncStatus = 'synced';
        this.isSyncingWithFirebase = false;
        this.notify();
        return;
      }

      if (remoteCustomers && remoteCustomers.length > 0) {
        const { merged } = mergeRemoteCustomers(this.customers, remoteCustomers);
        this.customers = merged;
        this.persistLocalCustomers();
      }

      // Fetch dedicated monthly customers collection
      if (remoteMonthly !== null && remoteMonthly.length > 0) {
        const monthlyIdSet = new Set(remoteMonthly.map(c => c.id));
        this.customers.forEach(c => {
          if (monthlyIdSet.has(c.id)) {
            c.isMonthlyRegular = true;
          }
        });
        this.persistLocalCustomers(true);
      } else if (remoteMonthly !== null && remoteMonthly.length === 0) {
        // If remote has 0 monthly customers, BUT local already has customers selected as monthly:
        const localMonthly = this.customers.filter(c => c.isMonthlyRegular);
        if (localMonthly.length > 0) {
          console.log(`[Firebase] Preserving ${localMonthly.length} local monthly customers and syncing to 'monthly_customers' collection in Firestore`);
          syncAllMonthlyCustomersToFirestore(localMonthly).catch(() => {});
        }
      }

      if (remoteBatches && remoteBatches.length > 0) {
        this.batches = this.enrichBatches(remoteBatches);
        this.persistLocalBatches();
      }

      this.recalculateReminders();
      this.firebaseSyncStatus = 'synced';

      // Start real-time Firestore synchronization across all devices
      if (!this.unsubscribeFirestore) {
        this.unsubscribeFirestore = subscribeToFirestore(
          (remoteCustomers) => {
            if (!this.isSyncingWithFirebase && Array.isArray(remoteCustomers)) {
              if (remoteCustomers.length === 0 && this.customers.length > 0) {
                // Check if batches are also empty (database wipe)
                fetchBatchesFromFirestore().then(b => {
                  if (b && b.length === 0) {
                    console.log('[Real-time] Detected remote database wipe. Resetting local state.');
                    this.customers = [];
                    this.batches = [];
                    this.reminders = [];
                    this.persistLocalCustomers(true);
                    this.persistLocalBatches();
                    this.recalculateReminders();
                    this.notify();
                  }
                });
                return;
              }

              const { merged, hasChanges } = mergeRemoteCustomers(this.customers, remoteCustomers);
              if (hasChanges || merged.length !== this.customers.length) {
                this.customers = merged;
                this.persistLocalCustomers(true);
                this.recalculateReminders();
                this.notify();
              }
            }
          },
          (remoteBatches) => {
            if (!this.isSyncingWithFirebase && Array.isArray(remoteBatches)) {
              if (remoteBatches.length === 0 && this.batches.length > 0) {
                fetchCustomersFromFirestore().then(c => {
                  if (c && c.length === 0) {
                    this.customers = [];
                    this.batches = [];
                    this.reminders = [];
                    this.persistLocalCustomers(true);
                    this.persistLocalBatches();
                    this.recalculateReminders();
                    this.notify();
                  }
                });
                return;
              }

              if (remoteBatches.length !== this.batches.length) {
                this.batches = this.enrichBatches(remoteBatches);
                this.persistLocalBatches();
                this.notify();
              }
            }
          },
          (remoteMonthlyList) => {
            if (!this.isSyncingWithFirebase && Array.isArray(remoteMonthlyList)) {
              if (remoteMonthlyList.length === 0) {
                // When remoteMonthlyList is empty, do NOT wipe local monthly selections on initial connect
                return;
              }
              const monthlyIdSet = new Set(remoteMonthlyList.map(c => c.id));
              let changed = false;
              this.customers.forEach(c => {
                const shouldBeMonthly = monthlyIdSet.has(c.id);
                if (c.isMonthlyRegular !== shouldBeMonthly) {
                  c.isMonthlyRegular = shouldBeMonthly;
                  changed = true;
                }
              });
              if (changed) {
                this.persistLocalCustomers(true);
                this.recalculateReminders();
                this.notify();
              }
            }
          }
        );
      }
    } catch (err) {
      console.warn('Firebase sync warning:', err);
      this.firebaseSyncStatus = 'error';
    } finally {
      this.isSyncingWithFirebase = false;
      this.notify();
    }
  }

  public async forcePushToFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
    const db = getFirebaseDb();
    if (!db) {
      return { success: false, count: 0, error: 'Firebase is not initialized or credentials are missing.' };
    }

    this.isSyncingWithFirebase = true;
    this.firebaseSyncStatus = 'syncing';
    this.notify();

    try {
      const okCust = await syncCustomersToFirestore(this.customers);
      if (this.batches.length > 0) {
        await syncBatchesToFirestore(this.batches);
      }
      await syncSettingsToFirestore(this.settings);

      this.firebaseSyncStatus = 'synced';
      return { success: okCust, count: this.customers.length };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.firebaseSyncStatus = 'error';
      return { success: false, count: 0, error: msg };
    } finally {
      this.isSyncingWithFirebase = false;
      this.notify();
    }
  }

  public recalculateReminders(): void {
    this.reminders = generateReminders(this.customers, this.settings.alertDaysBefore);
    if (typeof window !== 'undefined') {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(this.reminders));
    }
  }

  private persistCustomersTimer: ReturnType<typeof setTimeout> | null = null;
  private persistLocalCustomers(immediate = false): void {
    if (typeof window === 'undefined') return;
    if (immediate) {
      if (this.persistCustomersTimer) clearTimeout(this.persistCustomersTimer);
      try {
        localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customers));
      } catch {}
      return;
    }

    if (this.persistCustomersTimer) clearTimeout(this.persistCustomersTimer);
    this.persistCustomersTimer = setTimeout(() => {
      try {
        localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customers));
      } catch {}
    }, 100);
  }

  private persistLocalBatches(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(BATCHES_KEY, JSON.stringify(this.batches));
    }
  }

  // Getters
  public getCustomers(): Customer[] {
    return this.customers;
  }

  public getMonthlyCustomers(): Customer[] {
    return this.customers.filter(c => c.isMonthlyRegular);
  }

  public getAllCustomers(): Customer[] {
    return this.customers;
  }

  public getBatches(): UploadBatch[] {
    return this.batches;
  }

  public getReminders(): ReminderItem[] {
    return this.reminders;
  }

  public getSettings(): AppSettings {
    return this.settings;
  }

  public getSyncStatus(): { status: 'disconnected' | 'synced' | 'syncing' | 'error'; isSyncing: boolean } {
    return { status: this.firebaseSyncStatus, isSyncing: this.isSyncingWithFirebase };
  }

  public updateSettings(newSettings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    }
    this.recalculateReminders();
    this.notify();

    // Persist settings to Firestore cloud so Serverless Cron and other devices sync immediately
    syncSettingsToFirestore(this.settings).catch(() => {});
  }

  public async setCustomers(customers: Customer[], batch?: UploadBatch): Promise<void> {
    this.customers = deduplicateCustomerList(customers);
    let enrichedBatch: UploadBatch | undefined;
    if (batch) {
      enrichedBatch = this.enrichBatches([batch])[0];
      this.batches = [enrichedBatch, ...this.batches.filter(b => b.id !== enrichedBatch!.id)];
      this.persistLocalBatches();
    }
    this.persistLocalCustomers(true);
    this.recalculateReminders();
    this.notify();

    // Async sync to Firestore with robust batch creation
    if (enrichedBatch) {
      this.firebaseSyncStatus = 'syncing';
      this.notify();
      try {
        const batchOk = await saveSingleBatchToFirestore(enrichedBatch);
        const custOk = await syncCustomersToFirestore(this.customers);
        
        // Also sync any monthly customers if present
        const monthlyCusts = this.customers.filter(c => c.isMonthlyRegular);
        if (monthlyCusts.length > 0) {
          await syncAllMonthlyCustomersToFirestore(monthlyCusts);
        }

        if (batchOk && custOk) {
          this.firebaseSyncStatus = 'synced';
          console.log(`[Firebase] Batch ${enrichedBatch.id} (${enrichedBatch.fileName}) and ${this.customers.length} customers successfully saved to Firestore!`);
        } else {
          this.firebaseSyncStatus = 'error';
        }
      } catch (err) {
        console.error('[Firebase] Error persisting new batch to Firestore:', err);
        this.firebaseSyncStatus = 'error';
      } finally {
        this.notify();
      }
    } else {
      syncCustomersToFirestore(this.customers).catch(() => {});
    }
  }

  public updateReminderStatus(
    reminderId: string, 
    status: ReminderStatus, 
    notes?: string,
    calledBy?: string
  ): void {
    const rem = this.reminders.find(r => r.id === reminderId);
    if (rem) {
      rem.status = status;
      if (notes !== undefined) rem.notes = notes;
      if (calledBy) rem.calledBy = calledBy;
      rem.lastCallDate = new Date().toISOString();

      if (typeof window !== 'undefined') {
        localStorage.setItem(REMINDERS_KEY, JSON.stringify(this.reminders));
      }
      this.notify();
    }
  }

  public markMedicineRefilled(customerId: string): void {
    const todayISO = new Date().toISOString().split('T')[0];
    this.recordDispensedDate(customerId, todayISO);
  }

  public recordDispensedDate(customerId: string, dispensedDate: string, cycleDays?: number): void {
    const cust = this.customers.find(c => c.id === customerId);
    if (!cust) return;

    const actualCycle = cycleDays && cycleDays > 0 ? cycleDays : this.settings.defaultRefillCycleDays;

    cust.lastPurchaseDate = dispensedDate;
    cust.lastRefillDate = dispensedDate;

    // Reset customer cycle for actualCycle days starting from the exact dispensed date (timezone-safe)
    const parts = dispensedDate.split('-').map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      const dt = new Date(parts[0], parts[1] - 1, parts[2] + actualCycle);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      cust.nextDueDate = `${y}-${m}-${d}`;

      const alertDt = new Date(parts[0], parts[1] - 1, parts[2] + actualCycle - this.settings.alertDaysBefore);
      const ay = alertDt.getFullYear();
      const am = String(alertDt.getMonth() + 1).padStart(2, '0');
      const ad = String(alertDt.getDate()).padStart(2, '0');
      cust.alertDate = `${ay}-${am}-${ad}`;
    }

    cust.medicines.forEach(m => {
      m.refillCycleDays = actualCycle;
      m.lastPurchaseDate = dispensedDate;
      m.nextDueDate = cust.nextDueDate;
    });

    this.persistLocalCustomers();
    this.recalculateReminders();
    this.notify();

    // Play pleasant confirmation chime
    audioAlerts.playSuccessChime();

    // Immediately sync single customer to Firestore so other devices update within ~100ms
    syncSingleCustomerToFirestore(cust).catch(() => {
      syncCustomersToFirestore(this.customers).catch(() => {});
    });
  }

  private reminderRecalcTimer: ReturnType<typeof setTimeout> | null = null;
  public recalculateRemindersDebounced(delay = 250): void {
    if (this.reminderRecalcTimer) clearTimeout(this.reminderRecalcTimer);
    this.reminderRecalcTimer = setTimeout(() => {
      this.recalculateReminders();
      this.notify();
    }, delay);
  }

  public toggleCustomerMonthly(customerId: string, isMonthly: boolean): void {
    const cust = this.customers.find(c => c.id === customerId);
    if (!cust) return;

    cust.isMonthlyRegular = isMonthly;
    cust.updatedAt = new Date().toISOString();

    // Persist immediately to local storage so page reload preserves state without delay
    this.persistLocalCustomers(true);
    this.recalculateRemindersDebounced();
    this.notify();

    // Instantly sync dedicated monthly_customers collection in Firestore
    syncMonthlyCustomerToFirestore(cust, isMonthly).catch((err) => {
      console.warn('[Firebase] Failed to sync monthly customer, falling back to master write:', err);
      syncSingleCustomerToFirestore(cust).catch(() => {});
    });
  }

  public deselectAllMonthly(): void {
    this.customers.forEach(c => {
      c.isMonthlyRegular = false;
      c.updatedAt = new Date().toISOString();
    });

    this.persistLocalCustomers(true);
    this.recalculateReminders();
    this.notify();

    clearAllMonthlyCustomersFromFirestore().catch(() => {});
    syncCustomersToFirestore(this.customers).catch(() => {});
  }

  public updateCustomerDetails(customerId: string, updates: Partial<Customer>): void {
    const custIndex = this.customers.findIndex(c => c.id === customerId);
    if (custIndex === -1) return;

    const existing = this.customers[custIndex];
    const updatedMeds = updates.medicines || existing.medicines;
    const totalSpend = updatedMeds.reduce((acc, m) => acc + (m.amount || 0), 0);

    const updatedCust: Customer = {
      ...existing,
      ...updates,
      medicines: updatedMeds,
      totalSpend,
      updatedAt: new Date().toISOString(),
    };

    if (updates.name) {
      updatedCust.nameNorm = updates.name.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (updates.phone) {
      const digits = String(updates.phone).replace(/\D/g, '');
      updatedCust.phoneNorm = digits.length >= 10 ? digits.slice(-10) : undefined;
    }

    this.customers[custIndex] = updatedCust;
    this.persistLocalCustomers();
    this.recalculateReminders();
    this.notify();

    syncSingleCustomerToFirestore(updatedCust).catch(() => {
      syncCustomersToFirestore(this.customers).catch(() => {});
    });
  }

  public deleteUploadBatch(batchId: string): boolean {
    const batchIndex = this.batches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) return false;

    // Remove the batch packaging record from the uploaded batches list
    this.batches.splice(batchIndex, 1);

    // STRICT USER REQUIREMENT:
    // Deleting an upload batch entry from the app must only remove the specific packaging record for that month.
    // All customer data saved under "All Customers" MUST remain 100% secure in Firebase and accessible in the app!
    // Do NOT delete customers from this.customers.
    this.persistLocalBatches();
    this.recalculateReminders();
    this.notify();

    // Remove only the batch upload record from Firebase without touching customer documents
    deleteBatchFromFirestore(batchId).catch(err => {
      console.error('Error deleting batch from Firestore:', err);
    });
    return true;
  }

  public rollbackBatch(batchId: string): boolean {
    const batchIndex = this.batches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) return false;

    const batch = this.batches[batchIndex];
    batch.status = 'rolled_back';

    // Keep all customer records intact in "All Customers"
    this.persistLocalBatches();
    this.recalculateReminders();
    this.notify();

    syncBatchesToFirestore(this.batches).catch(() => {});
    return true;
  }

  public async forcePullFromFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
    const db = getFirebaseDb();
    if (!db) {
      return { success: false, count: 0, error: 'Cloud service is offline or not configured.' };
    }

    this.isSyncingWithFirebase = true;
    this.firebaseSyncStatus = 'syncing';
    this.notify();

    try {
      const remoteCustomers = await fetchCustomersFromFirestore();
      const remoteBatches = await fetchBatchesFromFirestore();
      const remoteMonthly = await fetchMonthlyCustomersFromFirestore();

      // If remote database was manually wiped by the user in Firebase Console:
      if (remoteCustomers !== null && remoteCustomers.length === 0 && remoteBatches !== null && remoteBatches.length === 0) {
        console.log('[Force Pull] Detected empty database in Cloud Firestore. Resetting local state to 0.');
        this.customers = [];
        this.batches = [];
        this.reminders = [];
        this.persistLocalCustomers(true);
        this.persistLocalBatches();
        this.recalculateReminders();
        this.firebaseSyncStatus = 'synced';
        this.notify();
        return { success: true, count: 0 };
      }

      if (remoteCustomers && remoteCustomers.length > 0) {
        // Authoritative merge from Firestore cloud database
        const { merged } = mergeRemoteCustomers(this.customers, remoteCustomers);
        this.customers = merged.length >= remoteCustomers.length ? merged : remoteCustomers;
        this.persistLocalCustomers(true);
      }

      // Authoritative sync with dedicated monthly_customers collection
      if (remoteMonthly !== null) {
        const monthlyIdSet = new Set(remoteMonthly.map(c => c.id));
        this.customers.forEach(c => {
          c.isMonthlyRegular = monthlyIdSet.has(c.id);
        });
        this.persistLocalCustomers(true);
      }

      if (remoteBatches && remoteBatches.length > 0) {
        this.batches = this.enrichBatches(remoteBatches);
        this.persistLocalBatches();
      }

      this.recalculateReminders();
      this.firebaseSyncStatus = 'synced';
      this.notify();
      return { success: true, count: this.customers.length };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.firebaseSyncStatus = 'error';
      return { success: false, count: 0, error: msg };
    } finally {
      this.isSyncingWithFirebase = false;
      this.notify();
    }
  }

  public clearAllData(): void {
    this.customers = [];
    this.batches = [];
    this.reminders = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CUSTOMERS_KEY);
      localStorage.removeItem(BATCHES_KEY);
      localStorage.removeItem(REMINDERS_KEY);
      localStorage.setItem('sarita_has_initialized_v2', 'true');
    }
    this.notify();
  }

  public exportJson(): string {
    return JSON.stringify({
      customers: this.customers,
      batches: this.batches,
      settings: this.settings,
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
    }, null, 2);
  }

  public importJson(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (Array.isArray(data.customers)) {
        this.customers = data.customers;
        this.persistLocalCustomers();
      }
      if (Array.isArray(data.batches)) {
        this.batches = data.batches;
        this.persistLocalBatches();
      }
      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings };
      }
      this.recalculateReminders();
      this.notify();
      syncCustomersToFirestore(this.customers).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
}

export const dataStore = new DataStoreService();
