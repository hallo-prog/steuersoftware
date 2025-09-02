import { supabase } from '../src/supabaseClient';

export interface ColumnMeta {
  name: string;
  type: string; // abgeleiteter Typ (primitive | json | date | uuid | unknown)
  nullable: boolean; // heuristisch (falls alle Werte null/undefined oder gemischt)
  sampleValue?: any;
  foreignKeyRef?: string; // heuristisch erkannte Referenz (Tabellenname)
  missingFraction?: number; // Anteil fehlender Werte (auf Basis Sample Rows)
}

interface TableMetaCacheEntry { columns: ColumnMeta[]; fetchedAt: number; signature?: string; }

const memoryCache = new Map<string, TableMetaCacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 Minuten
const CACHE_VERSION = 1; // zur späteren Invalidation bei Schemaänderungen im Client Code

// Heuristik zur Typbestimmung basierend auf Sample-Werten einer Spalte
const detectType = (values: any[]): string => {
  const nonNull = values.filter(v => v !== null && v !== undefined);
  if (nonNull.length === 0) return 'unknown';
  const allNumbers = nonNull.every(v => typeof v === 'number');
  if (allNumbers) return 'number';
  const allBooleans = nonNull.every(v => typeof v === 'boolean');
  if (allBooleans) return 'boolean';
  const allObjects = nonNull.every(v => typeof v === 'object' && !Array.isArray(v));
  if (allObjects) return 'json';
  const allArrays = nonNull.every(v => Array.isArray(v));
  if (allArrays) return 'array';
  const maybeDates = nonNull.every(v => typeof v === 'string' && /\d{4}-\d{2}-\d{2}T?/.test(v) && !isNaN(Date.parse(v)));
  if (maybeDates) return 'date';
  const maybeUUID = nonNull.every(v => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v));
  if (maybeUUID) return 'uuid';
  return 'string';
};

// Einfache Hash-Funktion (nicht kryptografisch) für Column-Namen zur Invalidierung
const hash = (str: string): string => {
  let h = 0, i = 0, len = str.length;
  while (i < len) { h = ((h << 5) - h + str.charCodeAt(i++)) | 0; }
  return h.toString(36);
};

export const inferTableColumns = async (table: string, userId?: string): Promise<ColumnMeta[]> => {
  const cacheKey = table; // pro Tabelle; könnte erweitert werden mit Role/User
  const now = Date.now();
  const mem = memoryCache.get(cacheKey);
  if (mem && now - mem.fetchedAt < CACHE_TTL_MS) return mem.columns;

  // Optional: localStorage Cache (nur Browser)
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(`table_meta_${cacheKey}`);
      if (raw) {
        const parsed: TableMetaCacheEntry & { version?: number } = JSON.parse(raw);
        if (parsed.version === CACHE_VERSION && now - parsed.fetchedAt < CACHE_TTL_MS) {
          // Signatur Validierung: falls vorhanden und später unterschiedliche Signatur -> ignorieren
          if (parsed.signature) {
            memoryCache.set(cacheKey, parsed);
            return parsed.columns;
          } else {
            memoryCache.set(cacheKey, parsed);
            return parsed.columns;
          }
        }
      }
    } catch {/* ignore */}
  }

  if (!supabase) return [];

  // Primäre Strategie (später austauschbar): Beispielzeilen holen und struktur analysieren
  const { data, error } = await supabase.from(table).select('*').limit(50).maybeSingle();
  // maybeSingle liefert nur 1 row oder null; für breitere Abdeckung holen wir alternativ weitere rows
  let rows: any[] = [];
  if (!error) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Einzelne Row
      rows = [data];
    } else if (Array.isArray(data)) {
      rows = data as any[];
    }
  } else {
    // Fallback 2: normale select ohne maybeSingle
    try {
      const { data: d2 } = await supabase.from(table).select('*').limit(20);
      rows = d2 || [];
    } catch {/* ignore */}
  }

  // Falls keine Zeilen -> keine Spalten sicher: wir versuchen HEAD Count + generisches Schema? => leer zurück
  if (rows.length === 0) {
    const empty: ColumnMeta[] = [];
    memoryCache.set(cacheKey, { columns: empty, fetchedAt: now });
    return empty;
  }

  // Spaltenliste aus Keys der ersten Zeile aggregieren
  const colNames = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const sampleRowCount = rows.length || 1;
  const columns: ColumnMeta[] = colNames.map(name => {
    const values = rows.map(r => r[name]);
    const nonNull = values.filter(v => v !== null && v !== undefined);
    const missingFraction = (sampleRowCount - nonNull.length) / sampleRowCount;
    const colMeta: ColumnMeta = {
      name,
      type: detectType(nonNull.slice(0, 10)),
      nullable: nonNull.length !== values.length,
      sampleValue: nonNull[0],
      missingFraction
    };
    // FK Heuristik: *_id Felder (ohne user_id) -> Referenz Tabellenname ableiten
    if (/^[a-z0-9_]+_id$/.test(name) && name !== 'user_id') {
      const base = name.slice(0, -3); // remove _id
      const candidates = [
        base + 's',
        base + 'es',
        base
      ];
      colMeta.foreignKeyRef = candidates[0];
    }
    return colMeta;
  }).sort((a,b)=> a.name.localeCompare(b.name));

  const entry: TableMetaCacheEntry = { columns, fetchedAt: now };
  memoryCache.set(cacheKey, entry);
  if (typeof window !== 'undefined') {
    try { 
      const signature = hash(columns.map(c=>c.name+':'+c.type+(c.nullable?'?':'')) .join('|'));
      localStorage.setItem(`table_meta_${cacheKey}`, JSON.stringify({ ...entry, signature, version: CACHE_VERSION })); 
    } catch {/* ignore */}
  }
  return columns;
};

// Manuelle Invalidierung (z.B. nach Migration)
export const invalidateTableMeta = (table: string) => {
  memoryCache.delete(table);
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem(`table_meta_${table}`); } catch {/* ignore */}
  }
};

// FK Liste aus Columns extrahieren (öffentlich für Tests)
export const extractForeignKeys = (cols: ColumnMeta[]): { column: string; ref: string }[] => {
  return cols.filter(c=> !!c.foreignKeyRef).map(c=> ({ column: c.name, ref: c.foreignKeyRef! }));
};

// (Planned) Erweiterung: information_schema / rpc + Typ-Mapping
// export const loadSystemCatalogMeta = async (...) => {}

// Mapping für UI Badge Farben (Tailwind Klassen)
export const typeColor = (t:string): string => {
  switch(t){
    case 'number': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
    case 'boolean': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300';
    case 'date': return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
    case 'uuid': return 'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/40 dark:text-fuchsia-300';
    case 'json': return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
    case 'array': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300';
    case 'string': return 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-200';
    default: return 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300';
  }
};
