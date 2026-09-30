export interface CustomerMedicine {
  id: string;
  name: string;
  nameNorm: string;
  packaging?: string;
  qty: number;
  unit?: string;
  amount: number;
  refillCycleDays: number; // default 30
  lastPurchaseDate: string; // ISO date YYYY-MM-DD
  nextDueDate: string; // ISO date YYYY-MM-DD
  status: 'regular' | 'new' | 'changed' | 'stopped' | 'one-time';
}

export interface PurchaseRecord {
  id: string;
  batchId: string;
  billNo?: string;
  date: string; // ISO date YYYY-MM-DD
  item: string;
  qty: number;
  unit?: string;
  amount: number;
  doctor?: string;
}

export interface Customer {
  id: string;
  name: string;
  nameNorm: string;
  phone?: string;
  phoneNorm?: string; // 10 digits
  code?: string; // Marg ERP party code e.g. 0006
  address?: string;
  notes?: string;
  isMonthlyRegular: boolean; // Purchased in repeat months
  regularityScore: number; // 0 - 100
  firstPurchaseDate: string; // ISO date
  lastPurchaseDate: string; // ISO date
  lastRefillDate?: string; // ISO date of last staff refill confirmation
  nextDueDate: string; // earliest due medicine date
  alertDate: string; // nextDueDate - 5 days
  totalPurchases: number;
  totalSpend: number;
  monthsActive: number;
  status: 'active' | 'inactive' | 'archived';
  medicines: CustomerMedicine[];
  refillCycleDays?: number; // customer-level refill duration in days (default 30)
  history?: PurchaseRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface UploadBatch {
  id: string;
  fileName: string;
  originalFileName?: string;
  monthName?: string; // e.g. "July 2026"
  monthKey?: string; // e.g. "2026-07" for chronological sorting
  fileSize: number;
  uploadDate: string;
  periodStart: string;
  periodEnd: string;
  formatType: 'MARG_GROUPED_SUMMARY' | 'TABULAR_SALES_REGISTER';
  totalRows: number;
  totalCustomers: number;
  newCustomersCount: number;
  repeatCustomersCount: number;
  status: 'committed' | 'rolled_back';
  customerIds: string[];
  newCustomers?: Customer[];
  isFolderBatch?: boolean;
  folderName?: string;
  filesCount?: number;
  dailyFilesList?: string[];
}

export interface MissingCustomerAuditItem {
  customer: Customer;
  previousMonthPurchaseDate: string;
  previousMonthSpend: number;
  previousMedicines: CustomerMedicine[];
  status: 'MISSING_THIS_MONTH' | 'RETAINED' | 'NEW_THIS_MONTH';
  contactPhone?: string;
  customerCode?: string;
  matchedBy?: 'phone' | 'code' | 'name';
  notes?: string;
}

export interface MonthlyAuditComparison {
  referenceBatch: UploadBatch; // e.g. July 2026
  targetBatch: UploadBatch;    // e.g. August 2026
  totalInReferenceMonth: number;
  totalInTargetMonth: number;
  retainedCount: number;
  missingCount: number;
  newCount: number;
  missingCustomers: MissingCustomerAuditItem[];
  retainedCustomers: MissingCustomerAuditItem[];
  newCustomers: MissingCustomerAuditItem[];
}

export type ReminderStatus = 
  | 'pending'
  | 'called'
  | 'confirmed'
  | 'not_needed'
  | 'not_reachable'
  | 'bought_elsewhere'
  | 'snoozed';

export interface ReminderItem {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerCode?: string;
  dueDate: string; // ISO date
  alertDate: string; // ISO date
  daysRemaining: number;
  urgency: 'OVERDUE' | 'DUE_IN_5_DAYS' | 'UPCOMING';
  medicinesSummary: string;
  medicinesList: string[];
  status: ReminderStatus;
  snoozedUntil?: string;
  deliveryNeeded: boolean;
  notes?: string;
  lastCallDate?: string;
  calledBy?: string;
}

export interface AppSettings {
  pin: string; // stored hashed or plain for local dev
  pinLength: number;
  autoLockMinutes: number;
  alertDaysBefore: number; // default 5 days
  defaultRefillCycleDays: number; // default 30 days
  enableAudioAlerts: boolean;
  enableBrowserNotifications: boolean;
  audioVolume: number; // 0 to 1
  language: 'en' | 'hi';
  whatsappTemplate: string;
  firebaseConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
  enableOwnerEmailAlerts?: boolean;
  ownerAlertEmail?: string;
  emailProviderApiKey?: string;
  emailSenderAddress?: string;
  lastOwnerEmailAlertSentAt?: string;
}

export interface CustomerMatchReport {
  totalInFile: number;
  newCustomers: Customer[];
  matchedMonthlyCustomers: Array<{
    existing: Customer;
    incoming: Customer;
    matchType: 'phone' | 'code' | 'name';
  }>;
}
