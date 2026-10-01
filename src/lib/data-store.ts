import type { Customer, UploadBatch, ReminderItem, AppSettings, ReminderStatus } from '@/types';
import { generateReminders } from './refill-calculator';
import { deduplicateCustomerList } from './customer-matcher';
import { 
  syncCustomersToFirestore, 
  syncSingleCustomerToFirestore,
  syncMonthlyCustomerToFirestore,
  fetchMonthlyCustomersFromFirestore,
  clearAllMonthlyCustomersFromFirestore,
  fetchCustomersFromFirestore, 
  syncBatchesToFirestore, 
  saveSingleBatchToFirestore,
  fetchBatchesFromFirestore, 
  deleteBatchFromFirestore,
  syncSettingsToFirestore,
  fetchSettingsFromFirestore,
  subscribeToFirestore,
  getFirebaseDb,
  initOrGetCloudDataState,
  executeServerSideReset,
} from './firebase';
import { DEFAULT_WHATSAPP_TEMPLATE } from './whatsapp';
import { audioAlerts } from './audio-alerts';
import { deriveMonthInfo } from './marg-parser';
import { getCustomersForBatch, computeMissingCustomers } from './monthly-comparator';

const CUSTOMERS_KEY = 'sarita_med_customers_v2';
const BATCHES_KEY = 'sarita_med_batches_v2';
const SETTINGS_KEY = 'sarita_med_settings_v2';
const REMINDERS_KEY = 'sarita_med_reminders_v2';
const EPOCH_KEY = 'sarita_data_epoch';

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
  private customers: Customer[] = [];
  private batches: UploadBatch[] = [];
  private reminders: ReminderItem[] = [];
  private settings: AppSettings = { ...DEFAULT_SETTINGS };
  private listeners: Set<() => void> = new Set();
  private isInitialized: boolean = false;
  private isSyncingWithFirebase: boolean = false;
  private isApplyingRemote: boolean = false;
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
        if (!parsed.whatsappTemplate || parsed.whatsappTemplate.includes('नमस्ते') || parsed.whatsappTemplate.includes('सरिता फार्मेसी')) {
          parsed.whatsappTemplate = DEFAULT_WHATSAPP_TEMPLATE;
        }
        this.settings = { ...DEFAULT_SETTINGS, ...parsed };
      } catch {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    }

    // 2. Load Local Data (for immediate offline rendering)
    const savedCustomers = localStorage.getItem(CUSTOMERS_KEY);
    if (savedCustomers) {
      try {
        const raw = JSON.parse(savedCustomers);
        this.customers = deduplicateCustomerList(raw);
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

    this.batches = this.enrichBatches(this.batches);
    this.recalculateReminders();
    this.isInitialized = true;
    this.notify();

    // 3. Connect and perform authoritative server-confirmed sync with Firebase
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
      // Step A: Stale-device protection (Section 3.2)
      // Check cloud epoch from settings/data_state before doing any operations
      const cloudState = await initOrGetCloudDataState();
      const localEpoch = typeof window !== 'undefined' ? localStorage.getItem(EPOCH_KEY) : null;
      const isStaleDevice = !localEpoch || (cloudState && cloudState.epoch && localEpoch !== cloudState.epoch);

      if (isStaleDevice && cloudState?.epoch) {
        console.log(`[Epoch Guard] Stale or uninitialized device detected (localEpoch=${localEpoch || 'none'}, cloudEpoch=${cloudState.epoch}). Discarding local customers/batches cache...`);
        this.customers = [];
        this.batches = [];
        this.reminders = [];
        if (typeof window !== 'undefined') {
          localStorage.removeItem(CUSTOMERS_KEY);
          localStorage.removeItem(BATCHES_KEY);
          localStorage.removeItem(REMINDERS_KEY);
          localStorage.setItem(EPOCH_KEY, cloudState.epoch);
        }
      }

      // Step B: Server-confirmed read (Section 3.1 #2)
      const remoteCustomers = await fetchCustomersFromFirestore(true);
      const remoteBatches = await fetchBatchesFromFirestore(true);
      const remoteMonthly = await fetchMonthlyCustomersFromFirestore(true);

      // If server reads succeeded, replace local cache with authoritative cloud state
      if (remoteCustomers !== null) {
        this.customers = deduplicateCustomerList(remoteCustomers);

        if (remoteMonthly !== null) {
          const monthlyIdSet = new Set(remoteMonthly.map(c => c.id));
          this.customers.forEach(c => {
            c.isMonthlyRegular = monthlyIdSet.has(c.id);
          });
        }
        this.persistLocalCustomers(true);
      }

      if (remoteBatches !== null) {
        this.batches = this.enrichBatches(remoteBatches);
        this.persistLocalBatches();
      }

      if (cloudState?.epoch && typeof window !== 'undefined') {
        localStorage.setItem(EPOCH_KEY, cloudState.epoch);
      }

      this.recalculateReminders();
      this.firebaseSyncStatus = 'synced';

      // Step C: Start real-time Firestore listeners (Section 3.1 #3)
      if (!this.unsubscribeFirestore) {
        this.unsubscribeFirestore = subscribeToFirestore(
          (incomingCustomers) => {
            if (this.isApplyingRemote || this.isSyncingWithFirebase) return;
            this.isApplyingRemote = true;
            try {
              this.customers = deduplicateCustomerList(incomingCustomers);
              this.persistLocalCustomers(true);
              this.recalculateReminders();
              this.notify();
            } finally {
              this.isApplyingRemote = false;
            }
          },
          (incomingBatches) => {
            if (this.isApplyingRemote || this.isSyncingWithFirebase) return;
            this.isApplyingRemote = true;
            try {
              this.batches = this.enrichBatches(incomingBatches);
              this.persistLocalBatches();
              this.notify();
            } finally {
              this.isApplyingRemote = false;
            }
          },
          (incomingMonthly) => {
            if (this.isApplyingRemote || this.isSyncingWithFirebase) return;
            this.isApplyingRemote = true;
            try {
              const monthlyIdSet = new Set(incomingMonthly.map(c => c.id));
              let changed = false;
              this.customers.forEach(c => {
                const shouldBe = monthlyIdSet.has(c.id);
                if (c.isMonthlyRegular !== shouldBe) {
                  c.isMonthlyRegular = shouldBe;
                  changed = true;
                }
              });
              if (changed) {
                this.persistLocalCustomers(true);
                this.recalculateReminders();
                this.notify();
              }
            } finally {
              this.isApplyingRemote = false;
            }
          }
        );
      }
    } catch (err) {
      console.warn('[Firebase Sync] Warning during server-confirmed sync:', err);
      this.firebaseSyncStatus = 'error';
    } finally {
      this.isSyncingWithFirebase = false;
      this.notify();
    }
  }

  /**
   * Manual Sync = Pull-only (Section 3.1 #4)
   * Refreshes local cache from cloud; never pushes local-only data to Firestore.
   */
  public async forcePullFromFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
    const db = getFirebaseDb();
    if (!db) {
      return { success: false, count: 0, error: 'Cloud service is offline or not configured.' };
    }

    this.isSyncingWithFirebase = true;
    this.firebaseSyncStatus = 'syncing';
    this.notify();

    try {
      // Refresh epoch check
      const cloudState = await initOrGetCloudDataState();
      if (cloudState?.epoch && typeof window !== 'undefined') {
        const localEpoch = localStorage.getItem(EPOCH_KEY);
        if (localEpoch !== cloudState.epoch) {
          this.customers = [];
          this.batches = [];
          this.reminders = [];
          localStorage.removeItem(CUSTOMERS_KEY);
          localStorage.removeItem(BATCHES_KEY);
          localStorage.removeItem(REMINDERS_KEY);
          localStorage.setItem(EPOCH_KEY, cloudState.epoch);
        }
      }

      const remoteCustomers = await fetchCustomersFromFirestore(true);
      const remoteBatches = await fetchBatchesFromFirestore(true);
      const remoteMonthly = await fetchMonthlyCustomersFromFirestore(true);

      if (remoteCustomers !== null) {
        this.customers = deduplicateCustomerList(remoteCustomers);
        if (remoteMonthly !== null) {
          const monthlyIdSet = new Set(remoteMonthly.map(c => c.id));
          this.customers.forEach(c => {
            c.isMonthlyRegular = monthlyIdSet.has(c.id);
          });
        }
        this.persistLocalCustomers(true);
      }

      if (remoteBatches !== null) {
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

  /**
   * Maintained for backwards compatibility: strictly executes a pull-only refresh.
   */
  public async forcePushToFirestore(): Promise<{ success: boolean; count: number; error?: string }> {
    return this.forcePullFromFirestore();
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
    return this.customers.filter(c => c.isMonthlyRegular && c.status === 'active');
  }

  public getMissingCustomersInfo(): { missingCustomerIds: Set<string>; previousMonthLabel: string } {
    return computeMissingCustomers(this.batches, this.customers);
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

    // Persist only changed settings fields to Firestore
    syncSettingsToFirestore(newSettings, 'settings_update').catch(() => {});
  }

  /**
   * Upload Commit (Section 3.1 #7):
   * Writes ONLY the new UploadBatch document and the customer documents that this upload actually
   * created or changed (touchedCustomers), NOT the entire customer list.
   */
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

    if (enrichedBatch) {
      this.firebaseSyncStatus = 'syncing';
      this.notify();
      try {
        // 1. Save single upload batch document
        const batchOk = await saveSingleBatchToFirestore(enrichedBatch, 'upload_commit');

        // 2. Identify strictly the touched / new customers in this batch
        const touchedIds = new Set(enrichedBatch.customerIds || []);
        const touchedCustomers = this.customers.filter(c => touchedIds.has(c.id));

        // 3. Save only touched customers with explicit authorization flag
        const custOk = await syncCustomersToFirestore(touchedCustomers, {
          caller: 'upload_commit',
          isUploadCommit: true,
        });

        if (batchOk && custOk) {
          this.firebaseSyncStatus = 'synced';
          console.log(`[Firebase] Batch ${enrichedBatch.id} (${enrichedBatch.fileName}) and ${touchedCustomers.length} touched customers successfully saved to Firestore!`);
        } else {
          this.firebaseSyncStatus = 'error';
        }
      } catch (err) {
        console.error('[Firebase] Error persisting upload commit to Firestore:', err);
        this.firebaseSyncStatus = 'error';
      } finally {
        this.notify();
      }
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

    const actualCycle = cycleDays && cycleDays > 0 
      ? cycleDays 
      : (cust.refillCycleDays && cust.refillCycleDays > 0 ? cust.refillCycleDays : this.settings.defaultRefillCycleDays);

    cust.refillCycleDays = actualCycle;
    cust.lastPurchaseDate = dispensedDate;
    cust.lastRefillDate = dispensedDate;

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

    // Targeted single-document writes only (Section 3.1 #1)
    syncSingleCustomerToFirestore(cust, 'record_dispensed').catch(() => {});
    if (cust.isMonthlyRegular) {
      syncMonthlyCustomerToFirestore(cust, true, 'record_dispensed').catch(() => {});
    }
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

    this.persistLocalCustomers(true);
    this.recalculateRemindersDebounced();
    this.notify();

    // Targeted write to monthly_customers and master doc flag (Section 3.1 #6)
    syncMonthlyCustomerToFirestore(cust, isMonthly, 'monthly_toggle').catch((err) => {
      console.warn('[Firebase] Failed to sync monthly customer:', err);
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

    clearAllMonthlyCustomersFromFirestore('deselect_all_monthly').catch(() => {});
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

    const cycle = updates.refillCycleDays;
    if (cycle && cycle > 0) {
      updatedCust.refillCycleDays = cycle;
      const baseDate = updatedCust.lastPurchaseDate || updatedCust.lastRefillDate;
      if (baseDate) {
        const parts = baseDate.split('-').map(Number);
        if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
          const dt = new Date(parts[0], parts[1] - 1, parts[2] + cycle);
          const y = dt.getFullYear();
          const m = String(dt.getMonth() + 1).padStart(2, '0');
          const d = String(dt.getDate()).padStart(2, '0');
          updatedCust.nextDueDate = `${y}-${m}-${d}`;

          const alertDt = new Date(parts[0], parts[1] - 1, parts[2] + cycle - this.settings.alertDaysBefore);
          const ay = alertDt.getFullYear();
          const am = String(alertDt.getMonth() + 1).padStart(2, '0');
          const ad = String(alertDt.getDate()).padStart(2, '0');
          updatedCust.alertDate = `${ay}-${am}-${ad}`;
        }
      }
      updatedCust.medicines.forEach(m => {
        m.refillCycleDays = cycle;
        if (updatedCust.lastPurchaseDate) m.lastPurchaseDate = updatedCust.lastPurchaseDate;
        m.nextDueDate = updatedCust.nextDueDate;
      });
    }

    this.customers[custIndex] = updatedCust;
    this.persistLocalCustomers();
    this.recalculateReminders();
    this.notify();

    // Targeted single-document write only (Section 3.1 #1)
    syncSingleCustomerToFirestore(updatedCust, 'customer_update').catch(() => {});
    if (updatedCust.isMonthlyRegular) {
      syncMonthlyCustomerToFirestore(updatedCust, true, 'customer_update').catch(() => {});
    }
  }

  public deleteUploadBatch(batchId: string): boolean {
    const batchIndex = this.batches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) return false;

    this.batches.splice(batchIndex, 1);
    this.persistLocalBatches();
    this.recalculateReminders();
    this.notify();

    deleteBatchFromFirestore(batchId, 'delete_batch').catch(err => {
      console.error('Error deleting batch from Firestore:', err);
    });
    return true;
  }

  public rollbackBatch(batchId: string): boolean {
    const batchIndex = this.batches.findIndex(b => b.id === batchId);
    if (batchIndex === -1) return false;

    const batch = this.batches[batchIndex];
    batch.status = 'rolled_back';

    this.persistLocalBatches();
    this.recalculateReminders();
    this.notify();

    saveSingleBatchToFirestore(batch, 'rollback_batch').catch(() => {});
    return true;
  }

  public clearAllData(): void {
    this.customers = [];
    this.batches = [];
    this.reminders = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CUSTOMERS_KEY);
      localStorage.removeItem(BATCHES_KEY);
      localStorage.removeItem(REMINDERS_KEY);
    }
    this.recalculateReminders();
    this.notify();
  }

  /**
   * Safe Full-Reset Tool (Section 3.3):
   * Deletes data from the server in chunks, bumps settings/data_state.epoch,
   * and clears local caches accordingly.
   */
  public async executeSafeReset(mode: 'ALL' | 'KEEP_MONTHLY'): Promise<{
    success: boolean;
    deletedCustomers: number;
    deletedBatches: number;
    keptMonthly: number;
    newEpoch: string;
    error?: string;
  }> {
    const res = await executeServerSideReset(mode);
    if (res.success) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(EPOCH_KEY, res.newEpoch);
      }
      if (mode === 'ALL') {
        this.customers = [];
        this.batches = [];
        this.reminders = [];
      } else {
        // Keep strictly the monthly customers
        this.customers = this.customers.filter(c => c.isMonthlyRegular);
        this.batches = [];
      }
      this.persistLocalCustomers(true);
      this.persistLocalBatches();
      this.recalculateReminders();
      this.notify();
    }
    return res;
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
        this.customers = deduplicateCustomerList(data.customers);
        this.persistLocalCustomers(true);
      }
      if (Array.isArray(data.batches)) {
        this.batches = this.enrichBatches(data.batches);
        this.persistLocalBatches();
      }
      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings };
      }
      this.recalculateReminders();
      this.notify();

      // Authorized restore
      syncCustomersToFirestore(this.customers, { caller: 'restore_backup', isRestore: true }).catch(() => {});
      syncBatchesToFirestore(this.batches, 'restore_backup').catch(() => {});
      return true;
    } catch {
      return false;
    }
  }
}

export const dataStore = new DataStoreService();
