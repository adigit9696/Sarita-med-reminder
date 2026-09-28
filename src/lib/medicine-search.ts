import medicineList from './medicine-database.json';

export interface MedicineSuggestion {
  name: string;
  fullName: string;
  packaging?: string;
}

/**
 * Searches the 9,586+ medicine database for matching products
 * Extracts suggested packaging if standard formats (e.g. 1*10TAB, 100ML) are found
 */
export function searchMedicines(query: string, limit = 15): MedicineSuggestion[] {
  if (!query || query.trim().length < 2) return [];

  const q = query.toLowerCase().trim();
  const results: MedicineSuggestion[] = [];

  for (const item of (medicineList as string[])) {
    if (item.toLowerCase().includes(q)) {
      // Extract packaging if standard format at the end
      // e.g. "DOLO 650 MG TAB 1*15TAB" -> packaging: "1*15TAB", name: "DOLO 650 MG TAB"
      const packMatch = item.match(/^(.*?)(?:\s+(\d+(?:\*\d+)?\s*(?:TAB|CAP|SYP|SYR|ML|GM|PCS|VIAL|AMP|BOTTLE|STRIP|TABS|CAPS|OINT|CREAM|GEL|DROPS)?))$/i);
      
      let cleanName = item;
      let packaging: string | undefined = undefined;

      if (packMatch && packMatch[1] && packMatch[2]) {
        cleanName = packMatch[1].trim();
        packaging = packMatch[2].trim();
      }

      results.push({
        name: cleanName,
        fullName: item,
        packaging,
      });

      if (results.length >= limit) break;
    }
  }

  return results;
}
