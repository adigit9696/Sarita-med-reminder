import type { Customer, UploadBatch, ReminderItem, AppSettings, ReminderStatus } from '@/types';
import { generateReminders } from './refill-calculator';
import { deduplicateCustomerList } from './customer-matcher';
import { 
  syncCustomersToFirestore, 
  fetchCustomersFromFirestore, 
  syncBatchesToFirestore, 
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

    // Auto-populate July & August Marg ERP dataset on first launch if empty
    if (this.customers.length === 0 && this.batches.length === 0) {
      this.customers = deduplicateCustomerList(SAMPLE_MERGED_CUSTOMERS);
      this.batches = SAMPLE_BATCHES;
      this.persistLocalCustomers();
      this.persistLocalBatches();
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
      if (remoteCustomers && remoteCustomers.length > 0) {
        // Strict deduplication: merge remote customers without losing any existing local customer records
        this.customers = deduplicateCustomerList([...this.customers, ...remoteCustomers]);
        this.persistLocalCustomers();
      } else if (this.customers.length > 0) {
        // First-time sync: push local customers to Firestore
        await syncCustomersToFirestore(this.customers);
      }

      const remoteBatches = await fetchBatchesFromFirestore();
      if (remoteBatches && remoteBatches.length > 0) {
        if (remoteBatches.length >= this.batches.length) {
          this.batches = this.enrichBatches(remoteBatches);
          this.persistLocalBatches();
        } else if (this.batches.length > remoteBatches.length) {
          await syncBatchesToFirestore(this.batches);
        }
      } else if (this.batches.length > 0) {
        await syncBatchesToFirestore(this.batches);
      }

      this.recalculateReminders();
      this.firebaseSyncStatus = 'synced';

      // Start real-time Firestore synchronization
      if (!this.unsubscribeFirestore) {
        this.unsubscribeFirestore = subscribeToFirestore(
          (remoteCustomers) => {
            if (!this.isSyncingWithFirebase && remoteCustomers && remoteCustomers.length > 0) {
              const deduped = deduplicateCustomerList([...this.customers, ...remoteCustomers]);
              if (deduped.length !== this.customers.length) {
                this.customers = deduped;
                this.persistLocalCustomers();
                this.recalculateReminders();
                this.notify();
              }
            }
          },
          (remoteBatches) => {
            if (!this.isSyncingWithFirebase && remoteBatches) {
              if (remoteBatches.length !== this.batches.length) {
                this.batches = this.enrichBatches(remoteBatches);
                this.persistLocalBatches();
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

  private persistLocalCustomers(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(this.customers));
    }
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

  // Mutators
  public updateSettings(newSettings: Partial<AppSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    if (typeof window !== 'undefined') {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    }
    this.recalculateReminders();
    this.notify();
  }

  public setCustomers(customers: Customer[], batch?: UploadBatch): void {
    this.customers = deduplicateCustomerList(customers);
    if (batch) {
      const enrichedBatch = this.enrichBatches([batch])[0];
      this.batches = [enrichedBatch, ...this.batches.filter(b => b.id !== enrichedBatch.id)];
      this.persistLocalBatches();
    }
    this.persistLocalCustomers();
    this.recalculateReminders();
    this.notify();

    // Async sync to Firestore
    syncCustomersToFirestore(this.customers).catch(() => {});
    if (batch) syncBatchesToFirestore(this.batches).catch(() => {});
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

    syncCustomersToFirestore(this.customers).catch(() => {});
  }

  public toggleCustomerMonthly(customerId: string, isMonthly: boolean): void {
    const cust = this.customers.find(c => c.id === customerId);
    if (!cust) return;

    cust.isMonthlyRegular = isMonthly;
    cust.updatedAt = new Date().toISOString();

    this.persistLocalCustomers();
    this.recalculateReminders();
    this.notify();

    syncCustomersToFirestore(this.customers).catch(() => {});
  }

  public deselectAllMonthly(): void {
    this.customers.forEach(c => {
      c.isMonthlyRegular = false;
      c.updatedAt = new Date().toISOString();
    });

    this.persistLocalCustomers();
    this.recalculateReminders();
    this.notify();

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

    syncCustomersToFirestore(this.customers).catch(() => {});
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
      if (remoteCustomers && remoteCustomers.length > 0) {
        // Merge remote customers into local master list with deduplication
        this.customers = deduplicateCustomerList([...this.customers, ...remoteCustomers]);
        this.persistLocalCustomers();
      }

      const remoteBatches = await fetchBatchesFromFirestore();
      if (remoteBatches && remoteBatches.length > 0) {
        this.batches = this.enrichBatches(remoteBatches);
        this.persistLocalBatches();
      }

      this.recalculateReminders();
      this.firebaseSyncStatus = 'synced';
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
