import { Contact } from '../types';
import { fetchContacts, upsertContact } from './supabaseDataService';

// Normalisiert einen Kontaktnamen für Deduplikation (vereinfachtes Heuristikverfahren)
export const normalizeContactName = (name?: string): string => {
  if (!name) return '';
  let n = name.toLowerCase();
  // Rechtliche Suffixe entfernen
  n = n.replace(/\b(gmbh & co\. kg|gmbh & co kg|ag & co\. kg|ag & co kg)\b/g, '');
  n = n.replace(/\b(gmbh|ag|ug|kg|ohg|eg|eg\(haftungsbeschränkt\)|mbh)\b/g, '');
  // Sonderzeichen & Interpunktion raus
  n = n.replace(/[^a-z0-9]+/g, ' ');
  // Mehrfache Spaces reduzieren
  n = n.replace(/\s+/g, ' ').trim();
  return n;
};

const normalizePhone = (phone?: string): string => {
  if (!phone) return '';
  return phone.replace(/[^0-9+]/g, '');
};

// Merged Felder nicht-destruktiv; vorhandene Werte haben Vorrang
export const mergeContactData = (existing: Contact, incoming: Partial<Contact>): Contact => {
  const merged: Contact = {
    id: existing.id,
    name: existing.name || incoming.name || 'Kontakt',
    type: existing.type || (incoming.type as any) || 'Sonstige',
    email: existing.email || incoming.email,
    phone: existing.phone || incoming.phone,
    sourceIds: Array.from(new Set([...(existing.sourceIds||[]), ...(incoming.sourceIds||[])])),
    tags: Array.from(new Set([...(existing.tags||[]), ...(incoming.tags||[])])),
    lastDocumentDate: (() => {
      const dates = [existing.lastDocumentDate, incoming.lastDocumentDate].filter(Boolean).map(d=> new Date(d!));
      if (!dates.length) return undefined;
      return dates.sort((a,b)=> b.getTime()-a.getTime())[0].toISOString();
    })(),
    notes: existing.notes || incoming.notes,
    aiSummary: existing.aiSummary || incoming.aiSummary,
  };
  return merged;
};

// Findet bestehenden Kontakt anhand normalisiertem Namen ODER identischer Email/Telefon
const findExisting = (all: Contact[], probe: Partial<Contact>): Contact | undefined => {
  const norm = normalizeContactName(probe.name);
  const em = (probe.email||'').toLowerCase();
  const ph = normalizePhone(probe.phone);
  return all.find(c => {
    if (norm && normalizeContactName(c.name) === norm) return true;
    if (em && c.email && c.email.toLowerCase() === em) return true;
    if (ph && c.phone && normalizePhone(c.phone) === ph) return true;
    return false;
  });
};

// High-level Upsert mit Deduplikation
export const upsertContactDedupe = async (userId: string, c: Partial<Contact>): Promise<Contact> => {
  const all = await fetchContacts(userId);
  const existing = findExisting(all, c);
  if (existing) {
    const merged = mergeContactData(existing, c);
    return upsertContact(userId, merged);
  }
  // Neu anlegen
  return upsertContact(userId, c);
};

// Reiner In-Memory Deduplikator (für Tests / zukünftige Batch-Verarbeitung)
export const dedupeContactsArray = (list: Partial<Contact>[]): Partial<Contact>[] => {
  const result: Partial<Contact>[] = [];
  for (const c of list) {
    const norm = normalizeContactName(c.name);
    const em = (c.email||'').toLowerCase();
    const ph = normalizePhone(c.phone);
    const idx = result.findIndex(r => (
      (norm && normalizeContactName(r.name||'') === norm) ||
      (em && r.email && r.email.toLowerCase() === em) ||
      (ph && r.phone && normalizePhone(r.phone) === ph)
    ));
    if (idx === -1) {
      result.push({ ...c, sourceIds: [...(c.sourceIds||[])] });
    } else {
      const existing = result[idx];
      result[idx] = {
        ...existing,
        email: existing.email || c.email,
        phone: existing.phone || c.phone,
        sourceIds: Array.from(new Set([...(existing.sourceIds||[]), ...(c.sourceIds||[])])),
        tags: Array.from(new Set([...(existing.tags||[]), ...(c.tags||[])])),
        lastDocumentDate: (() => {
          const dates = [existing.lastDocumentDate, c.lastDocumentDate].filter(Boolean).map(d=> new Date(d!));
          if (!dates.length) return undefined;
          return dates.sort((a,b)=> b.getTime()-a.getTime())[0].toISOString();
        })(),
      };
    }
  }
  return result;
};
