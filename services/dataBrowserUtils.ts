// Utility Funktionen für DataBrowserView (getrennt für testbare Logik)

export interface VirtualWindow {
  start: number; // inkl
  end: number;   // exkl
  padTop: number; // px
  padBottom: number; // px
}

export const computeVirtualWindow = (
  total: number,
  rowHeight: number,
  scrollTop: number,
  viewportHeight: number,
  overscan = 4
): VirtualWindow => {
  if (rowHeight <= 0) return { start: 0, end: total, padTop: 0, padBottom: 0 };
  const visibleCount = Math.ceil(viewportHeight / rowHeight);
  let start = Math.floor(scrollTop / rowHeight) - overscan;
  if (start < 0) start = 0;
  let end = start + visibleCount + overscan * 2;
  if (end > total) end = total;
  const padTop = start * rowHeight;
  const padBottom = (total - end) * rowHeight;
  return { start, end, padTop, padBottom };
};

// Optimistic Update Helper
export const applyOptimisticUpdate = <T extends Record<string, any>>(rows: T[], rowIndex: number, col: string, newValue: any) => {
  const prevRow = rows[rowIndex];
  const prevValue = prevRow ? prevRow[col] : undefined;
  const newRows = rows.map((r, i) => i === rowIndex ? { ...r, [col]: newValue } : r);
  const revert = () => rows.map((r, i) => i === rowIndex ? { ...r, [col]: prevValue } : r);
  return { newRows, revert };
};

// Postgrest / Supabase Fehler Mapping
export const mapPostgrestError = (err: any): string => {
  if (!err) return 'Unbekannter Fehler';
  const code = err.code || err.status || '';
  const msg: string = err.message || String(err);
  if (code === '23505' || /duplicate key value/i.test(msg)) return 'Datenkonflikt (Duplicate Key).';
  if (code === '23503' || /foreign key/i.test(msg)) return 'Fremdschlüssel verletzt (Referenz existiert nicht).';
  if (code === '42501' || /not authorized|permission denied/i.test(msg)) return 'Keine Berechtigung (RLS / Policy).';
  if (code === '22P02' || /invalid input syntax/i.test(msg)) return 'Ungültiges Eingabeformat.';
  if (/timeout/i.test(msg)) return 'Zeitüberschreitung bei der Anfrage.';
  if (/network/i.test(msg)) return 'Netzwerkfehler – bitte Verbindung prüfen.';
  return msg;
};

// Hilfsfunktion für Undo Delete Insert Fehler
export const safeStringify = (v:any, max=500) => {
  try { const s = typeof v==='string'? v : JSON.stringify(v); return s.length>max? s.slice(0,max)+'…': s; } catch { return String(v); }
};
