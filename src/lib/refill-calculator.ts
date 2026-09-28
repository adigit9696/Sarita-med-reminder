import type { Customer, ReminderItem } from '@/types';

/**
 * Calculates days remaining until next due date (Timezone-safe)
 */
export function getDaysRemaining(dueDateISO: string, referenceDate: Date = new Date()): number {
  if (!dueDateISO) return 999;
  const parts = dueDateISO.split('-').map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) return 999;
  
  // Use local midday to avoid DST and UTC boundary shifts
  const due = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
  const ref = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    12, 0, 0, 0
  );
  const diffTime = due.getTime() - ref.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Generates active reminder items from customers
 * Strictly limited to Monthly Customers (isMonthlyRegular: true) who have been selected
 * by staff from All Customers. Non-selected customers are not tracked on Dashboard.
 */
export function generateReminders(
  customers: Customer[],
  alertDaysBefore: number = 5,
  referenceDate: Date = new Date()
): ReminderItem[] {
  const reminders: ReminderItem[] = [];

  // Strictly filter for Monthly Customers only
  const targetMonthlyCustomers = customers.filter(
    cust => cust.isMonthlyRegular && cust.status === 'active'
  );

  targetMonthlyCustomers.forEach(cust => {
    // Only generate reminders for active monthly customers with medicines and a due date
    if (!cust.nextDueDate || cust.medicines.length === 0) {
      return;
    }

    const daysRemaining = getDaysRemaining(cust.nextDueDate, referenceDate);

    let urgency: 'OVERDUE' | 'DUE_IN_5_DAYS' | 'UPCOMING';
    if (daysRemaining < 0) {
      urgency = 'OVERDUE';
    } else if (daysRemaining <= alertDaysBefore) {
      urgency = 'DUE_IN_5_DAYS';
    } else {
      urgency = 'UPCOMING';
    }

    const medNames = cust.medicines.map(m => m.name);
    const summary = medNames.length <= 3 
      ? medNames.join(', ')
      : `${medNames.slice(0, 3).join(', ')} + ${medNames.length - 3} more`;

    reminders.push({
      id: 'rem_' + cust.id,
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerCode: cust.code,
      dueDate: cust.nextDueDate,
      alertDate: cust.alertDate,
      daysRemaining,
      urgency,
      medicinesSummary: summary,
      medicinesList: medNames,
      status: 'pending',
      deliveryNeeded: false,
      notes: cust.notes,
    });
  });

  // Sort by urgency: Overdue first (most negative days), then Due in 5 Days (ascending days)
  reminders.sort((a, b) => a.daysRemaining - b.daysRemaining);

  return reminders;
}

/**
 * Computes dashboard metric statistics
 */
export function computeDashboardStats(customers: Customer[], reminders: ReminderItem[]) {
  const totalCustomers = customers.length;
  const monthlyRegularCustomers = customers.filter(c => c.isMonthlyRegular).length;
  const dueIn5Days = reminders.filter(r => r.urgency === 'DUE_IN_5_DAYS' && r.status === 'pending').length;
  const overdue = reminders.filter(r => r.urgency === 'OVERDUE' && r.status === 'pending').length;
  const actionTodayCount = dueIn5Days + overdue;
  const totalBillsOrMedicines = customers.reduce((acc, c) => acc + (c.medicines.length || 0), 0);

  return {
    totalCustomers,
    monthlyRegularCustomers,
    dueIn5Days,
    overdue,
    actionTodayCount,
    totalBillsOrMedicines,
  };
}
