/**
 * WhatsApp Reminder Message Formatting Utility
 * Generates clean, mobile-friendly Hinglish WhatsApp reminders
 * with deduplicated medicines and patient-friendly units (no raw ERP codes).
 */

export const DEFAULT_WHATSAPP_TEMPLATE = `Namaste *{name}*, 🙏
*Sarita Pharmacy, Madhokunj Katra, Prayagraj*

Aapki regular medicines ka monthly course jald complete hone wala hai:

💊 *Dawaiyon ki List:*
{medicines}

📦 *Kripya samay rehte refill karwa len taaki regular course na toote.*
Aap counter se package collect kar sakte hain ya Home Delivery ke liye isi number par WhatsApp karein.

📍 *Sarita Pharmacy, Madhokunj Katra, Prayagraj*`;

export interface MedicineItemLike {
  name: string;
  qty?: number;
  unit?: string;
  packaging?: string;
}

/**
 * Sanitizes raw Marg ERP medicine names:
 * Removes raw packing counts (e.g. "1*15 TAB", "1*175TAB (JAR)") and trailing NRX codes
 */
export function cleanMedicineName(rawName: string): string {
  if (!rawName) return '';
  let clean = rawName.trim();
  // Remove embedded packing strings like "1*15 TAB", "1*10CAP", "1*4CAP", "1*175TAB (JAR)"
  clean = clean.replace(/\s+\d+\*\d+\s*(?:TAB|CAP|STRP|STRI|BTL|BOTL|ML|GM|JAR)?(?:\s*\([A-Z]+\))?/gi, '');
  // Remove trailing NRX, Schedule drug markers
  clean = clean.replace(/\s+NRX\b/gi, '');
  // Clean multiple spaces
  clean = clean.replace(/\s+/g, ' ').trim();
  
  // Format into readable title-like case if ALL CAPS
  if (clean === clean.toUpperCase() && clean.length > 3) {
    clean = clean
      .split(' ')
      .map(w => {
        if (/^\d/.test(w) || w.length <= 2) return w;
        if (/^(mg|ml|gm|er|sr|tab|cap|syp|inj|drop)$/i.test(w)) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  }
  return clean;
}

/**
 * Converts cryptic Marg ERP internal codes (e.g. "4:0 STRI", "-0:2 STRI") into patient-friendly units
 */
export function cleanMedicineUnit(rawUnit?: string, packaging?: string, qty: number = 1): string {
  const combined = `${rawUnit || ''} ${packaging || ''}`.toUpperCase();

  if (combined.includes('STRI') || combined.includes('STRP') || combined.includes('STRIP')) {
    return qty > 1 ? 'Strips' : 'Strip';
  }
  if (combined.includes('BOTL') || combined.includes('BTL') || combined.includes('SYP') || combined.includes('BOTTLE')) {
    return qty > 1 ? 'Bottles' : 'Bottle';
  }
  if (combined.includes('CAP') || combined.includes('CAPSULE')) {
    return qty > 1 ? 'Caps' : 'Cap';
  }
  if (combined.includes('TAB') || combined.includes('TABLET')) {
    return qty > 1 ? 'Tabs' : 'Tab';
  }
  if (combined.includes('JAR')) {
    return qty > 1 ? 'Jars' : 'Jar';
  }
  return qty > 1 ? 'Packs' : 'Pack';
}

/**
 * Deduplicates medicine list by base name and calculates clean monthly quantity
 */
export function deduplicateAndCleanMedicines(
  rawList: (MedicineItemLike | string)[]
): { name: string; qty: number; unit: string }[] {
  if (!rawList || rawList.length === 0) return [];

  const map = new Map<string, { name: string; qty: number; unit: string }>();

  rawList.forEach((item) => {
    const rawName = typeof item === 'string' ? item : item.name;
    const cleanedName = cleanMedicineName(rawName);
    if (!cleanedName) return;

    const normKey = cleanedName.toLowerCase().replace(/[^a-z0-9]/g, '');

    const rawQty = typeof item === 'object' && item.qty ? Math.max(1, Math.round(Math.abs(item.qty))) : 1;
    const rawUnit = typeof item === 'object' ? item.unit : '';
    const rawPkg = typeof item === 'object' ? item.packaging : '';
    const cleanUnit = cleanMedicineUnit(rawUnit, rawPkg, rawQty);

    if (map.has(normKey)) {
      const existing = map.get(normKey)!;
      // Keep highest or combined reasonable quantity (capped at 4 for regular monthly refill)
      existing.qty = Math.min(4, Math.max(existing.qty, rawQty));
      existing.unit = cleanMedicineUnit(rawUnit, rawPkg, existing.qty);
    } else {
      map.set(normKey, {
        name: cleanedName,
        qty: Math.min(4, Math.max(1, rawQty)),
        unit: cleanUnit,
      });
    }
  });

  return Array.from(map.values());
}

/**
 * Formats a single deduplicated medicine item into a clean WhatsApp bullet:
 * " • *Medicine Name* (approx X Strip/mahina)"
 */
export function formatMedicineBullet(m: { name: string; qty: number; unit: string }): string {
  return ` • *${m.name}* (approx ${m.qty} ${m.unit}/mahina)`;
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

  const cleanMeds = deduplicateAndCleanMedicines(medicines);
  let formattedMeds = '';
  if (cleanMeds.length > 0) {
    formattedMeds = cleanMeds.map((m) => formatMedicineBullet(m)).join('\n');
  } else {
    formattedMeds = ' • *Regular Prescription Medicines* (approx 1 Pack/mahina)';
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
