/**
 * WhatsApp Reminder Message Formatting Utility
 * Matches the exact Hinglish template from Screenshot 5:
 * 
 * Namaste {name},
 * Sarita Pharmacy se yaad dilaya ja raha hai ki aapki niche di gayi medicine(s) ka ek mahine ka stock khatam hone wala hai:
 * 
 *  · Alkasol Syp 100Ml (approx 1 unit/mahina)
 *  · Cabgolin 0.5 Mg Tab (approx 1 unit/mahina)
 * 
 * Kripya jald refill karwa len. Dhanyawad.
 *  · Sarita Pharmacy, Madhokunj Katra, Prayagraj
 */

export const DEFAULT_WHATSAPP_TEMPLATE = `Namaste {name},
Sarita Pharmacy se yaad dilaya ja raha hai ki aapki niche di gayi medicine(s) ka ek mahine ka stock khatam hone wala hai:

{medicines}

Kripya jald refill karwa len. Dhanyawad.
 · Sarita Pharmacy, Madhokunj Katra, Prayagraj`;

export interface MedicineItemLike {
  name: string;
  qty?: number;
  unit?: string;
  packaging?: string;
}

/**
 * Formats a single medicine item into the Screenshot 5 bullet format:
 * " · Medicine Name (approx X unit/mahina)"
 */
export function formatMedicineBullet(m: MedicineItemLike | string): string {
  if (typeof m === 'string') {
    return ` · ${m} (approx 1 unit/mahina)`;
  }
  const qty = m.qty && m.qty > 0 ? m.qty : 1;
  const unit = m.unit && m.unit.trim().length > 0 ? m.unit.trim() : (m.packaging && !m.packaging.includes('*') ? m.packaging : 'unit');
  return ` · ${m.name} (approx ${qty} ${unit}/mahina)`;
}

/**
 * Formats full WhatsApp reminder message with template replacement
 */
export function formatWhatsAppReminderMessage(
  template: string,
  name: string,
  medicines: (MedicineItemLike | string)[] = [],
  dueDate?: string
): string {
  const tmpl = template && template.trim().length > 0 ? template : DEFAULT_WHATSAPP_TEMPLATE;

  let formattedMeds = '';
  if (medicines && medicines.length > 0) {
    formattedMeds = medicines.map((m) => formatMedicineBullet(m)).join('\n');
  } else {
    formattedMeds = ' · Chronic Prescription Medicines (approx 1 unit/mahina)';
  }

  let result = tmpl
    .replace(/\{name\}/gi, name)
    .replace(/\{patient_name\}/gi, name)
    .replace(/\{customer_name\}/gi, name)
    .replace(/\{medicines\}/gi, formattedMeds)
    .replace(/\{medicines_list\}/gi, formattedMeds)
    .replace(/\{date\}/gi, dueDate || 'soon')
    .replace(/\{due_date\}/gi, dueDate || 'soon')
    .replace(/\{pharmacy_name\}/gi, 'Sarita Pharmacy');

  return result;
}

/**
 * Normalizes Indian mobile number to international format (91XXXXXXXXXX)
 */
export function normalizeIndianPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return '91' + digits;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return '91' + digits.slice(1);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  if (digits.length > 10) {
    return '91' + digits.slice(-10);
  }
  return null;
}

/**
 * Universal WhatsApp message dispatcher that works on both Mobile (WhatsApp App)
 * and Desktop (WhatsApp Web / App), bypassing aggressive popup blockers.
 */
export function openWhatsAppChat(phone: string, message: string): boolean {
  const cleanPhone = normalizeIndianPhone(phone);
  if (!cleanPhone) {
    return false;
  }

  const encodedText = encodeURIComponent(message);
  // Universal WhatsApp endpoint supported natively by both mobile apps and desktop browsers
  const webUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;

  try {
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    // Create anchor element to prevent browser popup blockers from blocking the link
    const anchor = document.createElement('a');
    anchor.href = webUrl;
    anchor.target = isMobile ? '_top' : '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    
    setTimeout(() => {
      if (document.body.contains(anchor)) {
        document.body.removeChild(anchor);
      }
    }, 300);
    return true;
  } catch (err) {
    console.error('Error opening WhatsApp:', err);
    window.location.href = webUrl;
    return true;
  }
}
